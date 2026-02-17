'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

/**
 * Defers Google Analytics loading until the browser is idle,
 * keeping gtag out of Lighthouse's critical rendering path.
 */
export const GoogleAnalyticsDeferred = ({ gaId }: { gaId: string }) => {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!gaId) return;

    const load = () => setShouldLoad(true);

    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(load, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }

    const timer = setTimeout(load, 3500);
    return () => clearTimeout(timer);
  }, [gaId]);

  if (!gaId || !shouldLoad) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="lazyOnload" />
      <Script id="ga-init" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
};
