'use client';

import { useEffect, useState } from 'react';

export function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length === 0) return;

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (elements.length === 0) return;

    let frame = 0;

    const compute = () => {
      frame = 0;
      const offset = window.innerHeight * 0.35;
      let current: string | null = null;

      for (const el of elements) {
        const top = el.getBoundingClientRect().top;
        if (top - offset <= 0) current = el.id;
      }

      if (!current && window.scrollY < 120) current = null;
      setActive(current);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);

  return active;
}
