'use client';

import { Component, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';

import { snapshotPage } from '@/components/PageTransition/pageSnapshot';
import { useTheme } from '@/contexts/ThemeContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useMotionLevel } from '@/hooks/useMotion';
import { useRouteKey } from '@/hooks/useRouteKey';
import { useWorldFocus } from '@/hooks/useWorldFocus';
import { reportWebGLUnavailable, useWorldPreference } from '@/hooks/useWorldPreference';
import { projectSlugFromPath } from '@/utils/projectPaths';

import { readyBoot, reportBoot, useBooted } from './boot';
import { rememberLoaded } from './bootMemory';
import { ExploreHud } from './ExploreHud';
import { NavRadar } from './NavRadar';
import { usePageReading, useRoutePreview, useTargetHover, useTilt } from './pageInputs';
import { TourOverlay } from './TourOverlay';
import { WorldTooltip } from './WorldTooltip';
import { liteQuery, prefetchStationModel, stationForPath } from './routes';
import { arrivedAt, navigateFromMode, restoreFocus, useWorldMode, worldMode } from './worldMode';
import {
  intentSettle,
  onFlight,
  setDocking,
  setIntent,
  worldNavigateEvent,
  worldStore,
} from './worldStore';

import type { ReactNode } from 'react';
import type { StationKey } from './routes';
import type { IdleWindow, WorldContent } from './types';

import './World.scss';

/** How long the docking sequence plays before the page opens (ms; World.scss's clamps match) */
const dockTime = 1700;
/** Longest the page waits for the camera coming back from the tour or free roam (ms) */
const returnCap = 6500;

// three.js + R3F live in their own chunk, fetched after the page is interactive
const WorldCanvas = dynamic(() => import('./WorldCanvas'), { ssr: false });

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

/** The station a link leads to, when it is one to fly to other than the station on show */
function stationOfLink(link: Element | null): StationKey | null {
  if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download')) return null;
  if (link.origin !== window.location.origin) return null;
  // Paths that aren't pages (a download, a typo) belong to the 404 derelict
  const station = stationForPath(link.pathname);
  if (station === 'lost') return null;
  return station === stationForPath(window.location.pathname) ? null : station;
}

/**
 * The station the visitor is about to fly to (worldStore.intent), so the
 * world mounts and warms it before the click lands: a finger or button
 * going down on a link to it (phones never hover, so the hover prefetch
 * never fires there), or the page's way on (its page nav) scrolling into
 * view. Its models start downloading too. The click itself clears it (the
 * flight is on its way), and so does a touch the browser takes for a
 * scroll, back to the page's way on if that has been seen. Cleared on
 * every route change.
 */
function useStationIntent(active: boolean, routeKey: string) {
  useEffect(() => {
    if (!active) return;
    /** The page's way on, once it has come into view */
    let onward: StationKey | '' = '';
    let downAt = -Infinity;
    const intend = (link: Element | null) => {
      const station = stationOfLink(link);
      if (!station) return false;
      prefetchStationModel((link as HTMLAnchorElement).pathname);
      setIntent(station);
      return true;
    };
    const linkOf = (e: Event) =>
      e.target instanceof Element ? e.target.closest('a[href^="/"]') : null;
    const onDown = (e: Event) => {
      if (intend(linkOf(e))) downAt = performance.now();
    };
    const onClick = (e: Event) => {
      if (stationOfLink(linkOf(e))) setIntent('');
    };
    // A scroll that started on a link: not a choice (a finger resting on
    // one, a long press, still is)
    const onCancel = () => {
      if (performance.now() - downAt < intentSettle) setIntent(onward);
      downAt = -Infinity;
    };
    document.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    document.addEventListener('touchstart', onDown, { capture: true, passive: true });
    document.addEventListener('pointercancel', onCancel, true);
    document.addEventListener('click', onClick, true);

    // The page's way on, the first time it comes into view: its first link
    // (the main way on) when several arrive together
    const observer = new IntersectionObserver((entries) => {
      const seen = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
      seen.forEach((link) => observer.unobserve(link));
      seen.sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      );
      const first = seen.find(intend);
      if (first) onward = stationOfLink(first) ?? '';
    });
    const watched = new Set<Element>();
    const watch = () => {
      for (const link of document.querySelectorAll('#main-content .page-nav a[href^="/"]')) {
        if (watched.has(link)) continue;
        watched.add(link);
        observer.observe(link);
      }
    };
    watch();
    // Again once the new page has settled, in case it was still arriving
    const settle = window.setTimeout(watch, 1200);

    return () => {
      document.removeEventListener('pointerdown', onDown, { capture: true });
      document.removeEventListener('touchstart', onDown, { capture: true });
      document.removeEventListener('pointercancel', onCancel, true);
      document.removeEventListener('click', onClick, true);
      window.clearTimeout(settle);
      observer.disconnect();
      setIntent('');
    };
  }, [active, routeKey]);
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
      if (e.pointerType !== 'mouse') return;
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
  const motion = useMotionLevel();
  const lite = useMediaQuery(liteQuery);
  const { enabled, supported } = useWorldPreference();
  const active = enabled && supported;
  const [idle, setIdle] = useState(false);
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  const { mode } = useWorldMode();
  const router = useRouter();
  const booted = useBooted();

  useWorldInputs();
  useModelPrefetch(active);
  useStationIntent(active, routeKey);
  useWorldFocus();
  useRoutePreview(active && ready);
  usePageReading(active, routeKey);
  useTargetHover(active && ready, routeKey);
  useTilt(active && ready, motion !== 'full');

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

  // html[data-world] switches the 2D station renders on (see .station-fallback).
  // ThemeScript sets html[data-world-expected] before first paint; switched
  // on later, the world is expected from then on too
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.world = active ? 'on' : 'off';
    if (active) root.dataset.worldExpected = '';
  }, [active]);

  // Coming back from the tour or free roam, the camera flies back to the
  // page's station: the page waits for it ('returning') rather than showing
  // over open space mid-flight. Only when the camera flies: below full
  // motion it cuts straight there, and the page comes straight back
  const [modeSeen, setModeSeen] = useState(mode);
  const [returning, setReturning] = useState(false);
  if (modeSeen !== mode) {
    setModeSeen(mode);
    setReturning(mode === 'page' && active && motion === 'full');
  }
  const here = stationForPath(pathname);
  useEffect(() => {
    if (!returning) return;
    const done = () => setReturning(false);
    // On final approach, as a link's flight shows its page
    const stop = onFlight((event, to) => {
      if (to === here && event !== 'start') done();
    });
    // The camera plans its flight on its next frame: none on its way here
    // by the frame after (the camera was already there), or one already on
    // approach, and there is nothing to wait for
    let frames = 0;
    let frame = 0;
    const check = () => {
      if (++frames < 3) {
        frame = requestAnimationFrame(check);
        return;
      }
      const { active: flying, to, approached } = worldStore.flight;
      if (!flying || to !== here || approached) done();
    };
    frame = requestAnimationFrame(check);
    const cap = window.setTimeout(done, returnCap);
    return () => {
      stop();
      cancelAnimationFrame(frame);
      window.clearTimeout(cap);
    };
  }, [returning, here]);

  // Touring or exploring hides the page (html[data-world-mode]) and takes it
  // out of the tab order and the accessibility tree until you come back (and
  // the camera has, 'returning'); so does the loading screen until it lifts
  const away = active && mode !== 'page';
  const hidden = away || (active && returning);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.worldMode = away ? mode : hidden ? 'returning' : 'page';
    for (const el of document.querySelectorAll('#main-content, .header, .footer')) {
      el.toggleAttribute('inert', hidden || !booted);
    }
  }, [away, hidden, mode, booted]);

  // The page is back: keyboard focus returns where it was, once inert has
  // lifted (the effect above), and the page fades back in once the camera
  // is home (the hiding rule's own transition only runs on the way out). An
  // animation, not a transition: the header and footer keep their own
  const wasHidden = useRef(false);
  useEffect(() => {
    const back = wasHidden.current && !hidden;
    wasHidden.current = hidden;
    if (!back) return;
    requestAnimationFrame(restoreFocus);
    if (motion !== 'full') return;
    for (const el of document.querySelectorAll('#main-content, .header, .footer')) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: 'ease-out' });
    }
  }, [hidden, motion]);

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
  // opens the station's page; the camera is handed back once it has loaded
  // (navigateFromMode / arrivedAt), so the flight in is one continuous move
  const onDockRequest = useCallback(
    (path: string) => {
      if (worldStore.docking) return;
      const open = () => navigateFromMode(path);
      if (motion !== 'full' || worldMode.get().mode !== 'explore') {
        open();
        return;
      }
      setDocking(path);
      // Leaving free roam mid-sequence (Esc) cancels it
      window.setTimeout(() => {
        if (worldStore.docking === path) open();
      }, dockTime);
    },
    [motion]
  );
  // A tour or free roam that asked for this page hands the camera back now it is here
  useEffect(() => {
    arrivedAt(pathname);
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
              motion={motion}
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
    </>
  );
}

export default World;
