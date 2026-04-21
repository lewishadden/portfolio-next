import { useEffect, useRef } from 'react';

export function useReveal<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      el.classList.add('is-in');
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-in');
          io.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}

export function useGlobalReveal(selector = '.reveal') {
  useEffect(() => {
    const scan = () => {
      const nodes = document.querySelectorAll<HTMLElement>(`${selector}:not(.is-in)`);
      nodes.forEach((el) => {
        if (el.dataset.revealBound) return;
        el.dataset.revealBound = '1';

        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight + 100) {
          el.classList.add('is-in');
          return;
        }

        const io = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              el.classList.add('is-in');
              io.unobserve(el);
            }
          },
          { threshold: 0.05, rootMargin: '0px 0px -40px 0px' }
        );
        io.observe(el);
      });
    };

    scan();
    const t1 = setTimeout(scan, 100);
    const t2 = setTimeout(scan, 500);
    const t3 = setTimeout(scan, 1500);
    const safety = setTimeout(() => {
      document.querySelectorAll<HTMLElement>(`${selector}:not(.is-in)`).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight) el.classList.add('is-in');
      });
    }, 3000);

    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(safety);
      mo.disconnect();
    };
  }, [selector]);
}
