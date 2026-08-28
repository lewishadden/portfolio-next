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

const emptyGeoData: GeoData = { ip: '', geo: {} };

/**
 * Defers Google Analytics loading until the browser is idle,
 * keeping gtag out of Lighthouse's critical rendering path.
 * Geo data comes from /api/geo so the rest of the site can stay static.
 */
export const GoogleAnalyticsDeferred = ({ gaId }: { gaId: string }) => {
  const [geoData, setGeoData] = useState<GeoData | null>(null);

  useEffect(() => {
    if (!gaId) return;

    let cancelled = false;
    const load = async () => {
      let data = emptyGeoData;
      try {
        const res = await fetch('/api/geo');
        if (res.ok) data = (await res.json()) as GeoData;
      } catch {
        // GA still loads without geo user properties
      }
      if (!cancelled) setGeoData(data);
    };

    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(load, { timeout: 4000 });
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }

    const timer = setTimeout(load, 3500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [gaId]);

  if (!gaId || !geoData) return null;

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
