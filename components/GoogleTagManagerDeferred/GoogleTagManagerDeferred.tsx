'use client';

import { useEffect, useRef } from 'react';

/**
 * Interaction-deferred Google Tag Manager loader.
 *
 * GTM is injected via dynamic script creation (not React-rendered
 * `<script>` tags) only after the first genuine user interaction.
 * Uses a short RAF delay before attaching the scroll listener to
 * skip the browser's initial scroll-restoration event.
 *
 * A 10-second safety timeout ensures analytics still fire even if
 * the user never interacts.
 */
export function GoogleTagManagerDeferred({ gtmId }: { gtmId: string }) {
  const injectedRef = useRef(false);

  useEffect(() => {
    if (!gtmId || injectedRef.current) return undefined;

    const inject = () => {
      if (injectedRef.current) return;
      injectedRef.current = true;
      teardown();

      // Initialise dataLayer and gtag function
      window.dataLayer = window.dataLayer || [];
      function gtag(...args: unknown[]) {
        window.dataLayer!.push(args);
      }
      gtag('js', new Date());
      gtag('config', gtmId);

      // Dynamically load the gtag.js script
      const script = document.createElement('script');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${gtmId}`;
      script.async = true;
      document.head.appendChild(script);
    };

    const immediateEvents: (keyof WindowEventMap)[] = ['click', 'touchstart', 'keydown'];
    immediateEvents.forEach((evt) =>
      window.addEventListener(evt, inject, { once: true, passive: true })
    );

    // Delay scroll listener by 2 frames to skip browser scroll-restoration
    let scrollRafId: number;
    scrollRafId = requestAnimationFrame(() => {
      scrollRafId = requestAnimationFrame(() => {
        window.addEventListener('scroll', inject, { once: true, passive: true });
      });
    });

    // Safety net: load after 10s even without interaction
    const timerId = setTimeout(inject, 10_000);

    const teardown = () => {
      immediateEvents.forEach((evt) => window.removeEventListener(evt, inject));
      window.removeEventListener('scroll', inject);
      clearTimeout(timerId);
      cancelAnimationFrame(scrollRafId);
    };

    return teardown;
  }, [gtmId]);

  // Renders nothing — script injection is purely imperative
  return null;
}
