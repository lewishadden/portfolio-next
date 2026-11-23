'use client';

import { Component, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';

import { snapshotPage } from '@/components/PageTransition/pageSnapshot';
import { useTheme } from '@/contexts/ThemeContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useRouteKey } from '@/hooks/useRouteKey';
import { useWorldFocus } from '@/hooks/useWorldFocus';
import { reportWebGLUnavailable, useWorldPreference } from '@/hooks/useWorldPreference';
import { projectSlugFromPath } from '@/utils/projectPaths';

import { readyBoot, reportBoot, useBooted } from './boot';
import { rememberLoaded } from './bootMemory';
import { ExploreHud } from './ExploreHud';
import { inspectionOwnsCamera, useInspection, useInspectionHistory } from './inspection';
import { NavRadar } from './NavRadar';
import { usePageReading, useRoutePreview, useSkillHover, useTilt } from './pageInputs';
import { TourOverlay } from './TourOverlay';
import { SpatialInspector } from './SpatialInspector';
import { useTravelPreference } from './travelPreference';
import { WorldTooltip } from './WorldTooltip';
import { WorldUtilities } from './WorldUtilities';
import { liteQuery, prefetchStationModel, stationForPath } from './routes';
import { useWorldMode, worldMode } from './worldMode';
import { setDocking, worldNavigateEvent, worldStore } from './worldStore';

import type { ReactNode } from 'react';
import type { WorldContent } from './types';

import './World.scss';

/** How long the docking sequence plays before the page opens (ms; World.scss's clamps match) */
const dockTime = 1700;

// three.js + R3F live in their own chunk, fetched after the page is interactive
const WorldCanvas = dynamic(() => import('./WorldCanvas'), { ssr: false });

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/**
 * The canvas is the WebGL support test: if creating its context (or loading
 * the 3D chunk) fails, the world switches off and the 2D renders show.
 */
class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== 'production') console.warn('[World] WebGL unavailable', error);
    reportWebGLUnavailable();
    // Nothing more to wait for: the loading screen lifts onto the 2D page
    readyBoot();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Hovering or focusing an internal link starts downloading that station's model */
function useModelPrefetch(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onIntent = (e: Event) => {
      const link = e.target instanceof Element ? e.target.closest('a[href^="/"]') : null;
      if (link instanceof HTMLAnchorElement) prefetchStationModel(new URL(link.href).pathname);
    };
    document.addEventListener('pointerover', onIntent, { passive: true });
    document.addEventListener('focusin', onIntent);
    return () => {
      document.removeEventListener('pointerover', onIntent);
      document.removeEventListener('focusin', onIntent);
    };
  }, [active]);
}

/** Feeds scroll + pointer into the world store without touching React state */
function useWorldInputs() {
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      worldStore.scroll = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      worldStore.screens = window.scrollY / Math.max(1, window.innerHeight);
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || inspectionOwnsCamera()) return;
      worldStore.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      worldStore.pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('pointermove', onPointer);
    };
  }, []);
}

/**
 * The persistent 3D world behind every page. Lives in the root layout so the
 * canvas survives navigation — route changes fly the camera between stations.
 */
export function World({ content }: { content: WorldContent }) {
  const pathname = usePathname();
  const routeKey = useRouteKey();
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const travelPreference = useTravelPreference();
  const calm = reducedMotion || travelPreference === 'calm';
  const lite = useMediaQuery(liteQuery);
  const { enabled, supported } = useWorldPreference();
  const active = enabled && supported;
  const [idle, setIdle] = useState(false);
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  const { mode } = useWorldMode();
  const router = useRouter();
  const booted = useBooted();
  const selection = useInspection();

  useInspectionHistory(content.inspection, pathname);

  // Following an inspector's normal page link ends the world overlay once
  // that route arrives, so its article is visible and keyboard accessible.
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    worldMode.exit();
  }, [pathname]);

  useWorldInputs();
  useModelPrefetch(active);
  useWorldFocus();
  useRoutePreview(active && ready);
  usePageReading(active, routeKey);
  useSkillHover(active && ready);
  useTilt(active && ready, calm);

  // Navigation requested from inside the canvas (screens, docking): the page
  // being left flies off with the camera, as a clicked link's does
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const href = (e as CustomEvent<string>).detail;
      snapshotPage(href);
      router.push(href);
    };
    window.addEventListener(worldNavigateEvent, onNavigate);
    return () => window.removeEventListener(worldNavigateEvent, onNavigate);
  }, [router]);

  // Scroll positions from the previous route must not leak into the next station.
  // Keyed by route: the project modal's shallow URL change keeps the grid's scroll.
  useEffect(() => {
    worldStore.scroll = 0;
    worldStore.screens = 0;
  }, [routeKey]);

  // /projects/<slug> (page or modal) turns that project's screen to the camera
  const slug = projectSlugFromPath(pathname);
  const focusProject = slug ? content.projects.findIndex((p) => p.slug === slug) : -1;

  // html[data-world] switches the 2D station renders on (see .station-fallback)
  useEffect(() => {
    document.documentElement.dataset.world = active ? 'on' : 'off';
  }, [active]);

  // Touring or exploring hides the page (html[data-world-mode]) and takes it
  // out of the tab order and the accessibility tree until you come back; so
  // does the loading screen until it lifts
  useEffect(() => {
    const away = active && mode !== 'page';
    document.documentElement.dataset.worldMode = away ? mode : 'page';
    for (const el of document.querySelectorAll('#main-content, .header, .footer')) {
      el.toggleAttribute('inert', away || !booted || !!selection);
    }
  }, [active, mode, booted, selection]);

  // Loaded: a visit soon after skips the loading screen (it's all cached)
  useEffect(() => {
    if (ready) rememberLoaded();
  }, [ready]);

  // The loading screen's first steps: the page is up, then the 3D chunk is on its way
  useEffect(() => {
    reportBoot(idle ? 0.1 : 0.04, idle ? 1 : 0);
  }, [idle]);

  // Leaving explore mode with a world turned off (or unsupported) mid-flight
  useEffect(() => {
    if (!active) worldMode.exit();
  }, [active]);

  // Docking plays a short sequence (clamps close, the camera settles), then
  // opens the station's page; the camera is handed back once it has loaded,
  // so the flight in is one continuous move
  const pendingDock = useRef<string | null>(null);
  const onDockRequest = useCallback(
    (path: string) => {
      if (worldStore.docking) return;
      const open = () => {
        if (path === pathname) {
          worldMode.exit();
          return;
        }
        pendingDock.current = path;
        router.push(path);
      };
      if (calm || worldMode.get().mode !== 'explore') {
        open();
        return;
      }
      setDocking(path);
      // Leaving free roam mid-sequence (Esc) cancels it
      window.setTimeout(() => {
        if (worldStore.docking === path) open();
      }, dockTime);
    },
    [pathname, calm, router]
  );
  useEffect(() => {
    if (pendingDock.current === pathname) {
      pendingDock.current = null;
      worldMode.exit();
    }
  }, [pathname]);

  // First mount waits for an idle moment so three.js never competes with first paint
  useEffect(() => {
    if (!active || idle) return;
    const w = window as IdleWindow;
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setIdle(true), { timeout: 1800 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setIdle(true), 300);
    return () => window.clearTimeout(id);
  }, [active, idle]);

  // Switching the world off unmounts the canvas, which frees the GPU context
  const showCanvas = active && idle;

  return (
    <>
      <div className={`world${showCanvas && ready ? ' world--ready' : ''}`} aria-hidden="true">
        <div className="world__backdrop" />
        {showCanvas && (
          <CanvasBoundary>
            <WorldCanvas
              station={stationForPath(pathname)}
              theme={theme}
              reducedMotion={reducedMotion}
              lite={lite}
              content={content}
              focusProject={focusProject}
              onReady={markReady}
            />
          </CanvasBoundary>
        )}
        <div className="world__veil" />
      </div>
      {showCanvas && ready && <NavRadar />}
      {showCanvas && ready && <WorldTooltip />}
      {showCanvas && ready && <TourOverlay captions={content.tour} />}
      {showCanvas && ready && <ExploreHud onDockRequest={onDockRequest} cv={content.cv} />}
      <WorldUtilities cv={content.cv} />
      <SpatialInspector catalog={content.inspection} />
    </>
  );
}

export default World;
