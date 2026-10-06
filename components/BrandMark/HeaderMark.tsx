'use client';

import { Component, useCallback, useRef, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';

import { useTheme } from '@/contexts/ThemeContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useWorldPreference } from '@/hooks/useWorldPreference';

import { BrandMark } from './BrandMark';

import type { PointerEvent, ReactNode } from 'react';
import type { MarkPointer } from './BrandMark3D';

import './BrandMark.scss';

// Shares three.js and R3F with the world's chunk, which has loaded by the time this does
const BrandMark3D = dynamic(() => import('./BrandMark3D'), { ssr: false });

/** If the 3D mark can't start, the SVG stays */
class Fallback extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const subscribeWorld = (listener: () => void) => {
  const world = document.querySelector('.world');
  if (!world) return () => {};
  const observer = new MutationObserver(listener);
  observer.observe(world, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};
const worldReady = () => !!document.querySelector('.world--ready');
const notReady = () => false;

/**
 * The header's logo: the SVG mark from first paint, swapped for the WebGL
 * model (BrandMark3D) once the 3D world is up, so three.js is already
 * loaded and WebGL known to work. Stays the SVG with 3D effects off, without
 * WebGL, or for reduced motion; the two cross-fade.
 */
export function HeaderMark({ className = '' }: { className?: string }) {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const { enabled, supported } = useWorldPreference();
  const ready = useSyncExternalStore(subscribeWorld, worldReady, notReady);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(false);
  const pointer = useRef<MarkPointer>({ x: 0, y: 0, over: false });
  const live = enabled && supported && !reduced && ready && !failed;

  const onReady = useCallback(() => setShown(true), []);
  const onGone = useCallback(() => setShown(false), []);
  const onError = useCallback(() => setFailed(true), []);

  const follow = (e: PointerEvent<HTMLSpanElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    pointer.current.x = ((e.clientX - box.left) / box.width) * 2 - 1;
    pointer.current.y = ((e.clientY - box.top) / box.height) * 2 - 1;
    pointer.current.over = true;
  };

  return (
    <span
      className={`brand-mark-live${live && shown ? ' brand-mark-live--3d' : ''} ${className}`}
      onPointerEnter={follow}
      onPointerMove={follow}
      onPointerLeave={() => {
        pointer.current.over = false;
      }}
    >
      <BrandMark className="brand-mark-live__svg" />
      {live && (
        <span className="brand-mark-live__stage" aria-hidden="true">
          <Fallback onError={onError}>
            <BrandMark3D
              theme={theme === 'light' ? 'light' : 'dark'}
              pointer={pointer}
              onReady={onReady}
              onGone={onGone}
            />
          </Fallback>
        </span>
      )}
    </span>
  );
}

export default HeaderMark;
