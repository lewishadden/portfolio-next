'use client';

import { useEffect } from 'react';
import { useLenis } from 'lenis/react';

import { worldMode } from '@/components/World/worldMode';
import { worldFocusEvent } from '@/components/World/worldStore';
import { motionLevel } from '@/utils/motion';

/**
 * Clicking a skill badge or a role's pod in 3D brings the matching page
 * element (data-world-target="skill:React", "role:2", …) into view and
 * pulses it, so the world and the page read as one. Only while the page is
 * on show: in the tour or free roam a click pings and nothing more, and the
 * page stays scrolled where the visitor left it.
 */
export function useWorldFocus() {
  const lenis = useLenis();

  useEffect(() => {
    const onFocus = (e: Event) => {
      if (worldMode.get().mode !== 'page') return;
      const id = (e as CustomEvent<string>).detail;
      const target = document.querySelector<HTMLElement>(`[data-world-target="${CSS.escape(id)}"]`);
      if (!target) return;
      const reduce = motionLevel() !== 'full';
      if (lenis) lenis.scrollTo(target, { offset: -window.innerHeight / 3, immediate: reduce });
      else target.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      target.classList.remove('world-ping');
      // Restart the pulse even if it is already running
      void target.offsetWidth;
      target.classList.add('world-ping');
      window.setTimeout(() => target.classList.remove('world-ping'), 2400);
    };
    window.addEventListener(worldFocusEvent, onFocus);
    return () => window.removeEventListener(worldFocusEvent, onFocus);
  }, [lenis]);
}
