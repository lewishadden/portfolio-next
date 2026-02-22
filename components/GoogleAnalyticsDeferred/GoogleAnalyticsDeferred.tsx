'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

type GeoData = {
  ip: string;
  geo: {
    city?: string;
    country?: string;
    countryRegion?: string;
    flag?: string;
    latitude?: string;
    longitude?: string;
    postalCode?: string;
    region?: string;
  };
};

/**
 * Defers Google Analytics loading until the browser is idle,
 * keeping gtag out of Lighthouse's critical rendering path.
 */
export const GoogleAnalyticsDeferred = ({ gaId, geoData }: { gaId: string; geoData: GeoData }) => {
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
          gtag('set', 'user_properties', {
            country: '${geoData.geo.country || ''}',
            region: '${geoData.geo.region || ''}',
            city: '${geoData.geo.city || ''}',
            flag: '${geoData.geo.flag || ''}',
            latitude: '${geoData.geo.latitude || ''}',
            longitude: '${geoData.geo.longitude || ''}',
            postal_code: '${geoData.geo.postalCode || ''}',
            ip_address: '${geoData.ip || ''}'
          });
        `}
      </Script>
    </>
  );
};
