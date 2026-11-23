'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

import { gaInit } from './gaInit';

import type { VisitorGeo } from './gaInit';

/**
 * Visits that shouldn't be counted: a local server (development, or a
 * production build run locally) and automated browsers (the e2e suite, for
 * one, which would otherwise send a page view per test)
 */
function untracked() {
  const host = window.location.hostname;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host.endsWith('.localhost') ||
    navigator.webdriver === true
  );
}

/**
 * Defers Google Analytics loading until the browser is idle,
 * keeping gtag out of Lighthouse's critical rendering path.
 * Geo data (country, region, city: nothing finer) comes from /api/geo so the
 * rest of the site can stay static.
 */
export const GoogleAnalyticsDeferred = ({ gaId }: { gaId: string }) => {
  const [geo, setGeo] = useState<VisitorGeo | null>(null);

  useEffect(() => {
    if (!gaId || untracked()) return;

    let cancelled = false;
    const load = async () => {
      let data: VisitorGeo = {};
      try {
        const res = await fetch('/api/geo');
        if (res.ok) data = ((await res.json()) as { geo?: VisitorGeo }).geo ?? {};
      } catch {
        // GA still loads without geo user properties
      }
      if (!cancelled) setGeo(data);
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

  if (!gaId || !geo) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="lazyOnload" />
      <Script id="ga-init" strategy="lazyOnload">
        {gaInit(gaId, geo)}
      </Script>
    </>
  );
};
