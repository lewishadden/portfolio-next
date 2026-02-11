'use client';

import { useEffect, useState } from 'react';

/**
 * Deferred Google Tag Manager loader.
 *
 * Waits for the page to fully load (window 'load' event) before injecting
 * the gtag.js script. This keeps GTM completely off the critical rendering
 * path and improves Core Web Vitals (LCP, TBT, INP).
 */
export function GoogleTagManagerDeferred({ gtmId }: { gtmId: string }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!gtmId || loaded) return undefined;

    // Wait for an idle period after hydration before loading analytics
    const id = requestIdleCallback(() => setLoaded(true), { timeout: 3500 });

    return () => cancelIdleCallback(id);
  }, [gtmId, loaded]);

  if (!loaded || !gtmId) return null;

  return (
    <>
      {/* gtag.js script */}
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${gtmId}`} />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer=window.dataLayer||[];
            function gtag(){dataLayer.push(arguments);}
            gtag('js',new Date());
            gtag('config','${gtmId}');
          `,
        }}
      />
    </>
  );
}
