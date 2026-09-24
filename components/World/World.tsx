'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

import { useTheme } from '@/contexts/ThemeContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useReducedMotion } from '@/hooks/useReducedMotion';

import { stationForPath } from './routes';
import { worldStore } from './worldStore';

import type { WorldContent } from './types';

import './World.scss';

// three.js + R3F live in their own chunk, fetched after the page is interactive
const WorldCanvas = dynamic(() => import('./WorldCanvas'), { ssr: false });

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function prefersSaveData() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!connection?.saveData;
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
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const lite = useMediaQuery('(max-width: 760px), (pointer: coarse)');
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useWorldInputs();

  // Scroll positions from the previous route must not leak into the next station
  useEffect(() => {
    worldStore.scroll = 0;
    worldStore.screens = 0;
  }, [pathname]);

  useEffect(() => {
    const root = document.documentElement;
    if (!supportsWebGL() || prefersSaveData()) {
      root.dataset.world = 'off';
      return;
    }
    root.dataset.world = 'on';
    const w = window as IdleWindow;
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setEnabled(true), { timeout: 1800 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setEnabled(true), 300);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className={`world${ready ? ' world--ready' : ''}`} aria-hidden="true">
      <div className="world__backdrop" />
      {enabled && (
        <WorldCanvas
          station={stationForPath(pathname)}
          theme={theme}
          reducedMotion={reducedMotion}
          lite={lite}
          content={content}
          onReady={() => setReady(true)}
        />
      )}
      <div className="world__veil" />
    </div>
  );
}

export default World;
