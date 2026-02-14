'use client';

import { useEffect, useRef } from 'react';

/**
 * Google Analytics 4 (GA4) loader via gtag.js.
 *
 * Loads the gtag.js script immediately (async, non-blocking) and
 * configures the GA4 measurement ID. The script is injected
 * imperatively to avoid React hydration mismatches.
 */
export function GoogleTagManagerDeferred({ gtmId }: { gtmId: string }) {
  const injectedRef = useRef(false);

  useEffect(() => {
    if (!gtmId || injectedRef.current) return;
    injectedRef.current = true;

    // Initialise dataLayer and gtag function
    const dataLayer: Record<string, unknown>[] = (window.dataLayer = window.dataLayer || []);
    const gtag = (...args: unknown[]) => {
      dataLayer.push(args as unknown as Record<string, unknown>);
    };
    gtag('js', new Date());
    gtag('config', gtmId, { send_page_view: true });

    // Load the gtag.js script (async — non-render-blocking)
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gtmId}`;
    script.async = true;
    document.head.appendChild(script);
  }, [gtmId]);

  return null;
}
