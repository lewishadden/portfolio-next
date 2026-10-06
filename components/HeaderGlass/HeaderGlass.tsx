'use client';

import { Component, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';

import { createGlassState } from './glassState';

import type { ReactNode } from 'react';
import type { Box, GlassState } from './glassState';

import './HeaderGlass.scss';

// Shares three.js and R3F with the world's chunk, which has loaded by the time this does
const GlassSlab = dynamic(() => import('./GlassSlab'), { ssr: false });

/** If the slab can't start, the bar stays plain frosted glass */
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

/** A box relative to the bar's border box */
function boxIn(node: HTMLElement, bar: HTMLElement): Box {
  let x = bar.clientLeft;
  let y = bar.clientTop;
  let n: HTMLElement | null = node;
  while (n && n !== bar) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return [x, y, node.offsetWidth, node.offsetHeight];
}

/**
 * The glass slab behind the header bar's links (3D effects on): it measures
 * the bar and what's in it, follows the pointer and what's hovered, and
 * mounts the three.js scene (GlassSlab) once the world is ready, fading it
 * in. Reports a failure so the header can fall back to its flat bar
 */
export function HeaderGlass({
  theme,
  still,
  onFail,
}: {
  theme: 'dark' | 'light';
  still: boolean;
  onFail: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const state = useRef<GlassState>(createGlassState());
  const ready = useSyncExternalStore(subscribeWorld, worldReady, notReady);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const bar = host?.parentElement;
    if (!host || !bar) return;
    const s = state.current;
    const header = bar.closest('header');
    const root = document.documentElement;
    let elements: HTMLElement[] = [];

    const measure = () => {
      const links = [...bar.querySelectorAll<HTMLElement>('.header__link')];
      elements = [...links, ...bar.querySelectorAll<HTMLElement>('.header__actions > *')];
      s.links = links.length;
      s.boxes = elements.map((el) => (el.offsetParent ? boxIn(el, bar) : null));
      s.active = links.findIndex((el) => el.getAttribute('aria-current') === 'page');
      if (s.width !== bar.offsetWidth || s.height !== bar.offsetHeight) {
        s.width = bar.offsetWidth;
        s.height = bar.offsetHeight;
        s.version += 1;
      }
      s.invalidate();
    };
    const targetOf = (node: EventTarget | null) =>
      node instanceof Node ? elements.findIndex((el) => el.contains(node)) : -1;
    const over = (e: Event) => {
      s.hover = targetOf(e.target);
      s.invalidate();
    };
    const out = (e: PointerEvent | FocusEvent) => {
      if (targetOf(e.relatedTarget) < 0) s.hover = -1;
      s.invalidate();
    };
    const move = (e: PointerEvent) => {
      s.pointer.x = e.clientX - bar.getBoundingClientRect().left;
      s.pointer.over = true;
      s.invalidate();
    };
    const leave = () => {
      s.pointer.over = false;
      s.invalidate();
    };
    const sight = () => {
      s.away =
        (root.dataset.worldMode !== undefined && root.dataset.worldMode !== 'page') ||
        root.hasAttribute('data-boot');
      if (!s.away) s.invalidate();
    };

    measure();
    sight();
    bar.addEventListener('pointerover', over);
    bar.addEventListener('pointerout', out);
    bar.addEventListener('focusin', over);
    bar.addEventListener('focusout', out);
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerleave', leave);
    const resize = new ResizeObserver(measure);
    resize.observe(bar);
    elements.forEach((el) => resize.observe(el));
    // The current page changes with navigation; the header's look with its class
    const mutations = new MutationObserver(measure);
    mutations.observe(bar, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
    if (header) mutations.observe(header, { attributes: true, attributeFilter: ['class'] });
    const modes = new MutationObserver(sight);
    modes.observe(root, { attributes: true, attributeFilter: ['data-world-mode', 'data-boot'] });
    document.fonts?.ready.then(measure);

    return () => {
      bar.removeEventListener('pointerover', over);
      bar.removeEventListener('pointerout', out);
      bar.removeEventListener('focusin', over);
      bar.removeEventListener('focusout', out);
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerleave', leave);
      resize.disconnect();
      mutations.disconnect();
      modes.disconnect();
    };
  }, []);

  return (
    <div ref={hostRef} className="header-glass" data-shown={shown || undefined} aria-hidden="true">
      {ready && (
        <Fallback onError={onFail}>
          <GlassSlab state={state} theme={theme} still={still} onReady={() => setShown(true)} />
        </Fallback>
      )}
    </div>
  );
}

export default HeaderGlass;
