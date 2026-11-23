import { geolocation } from '@vercel/functions';
import { NextResponse } from 'next/server';

import type { VisitorGeo } from 'components/GoogleAnalyticsDeferred/gaInit';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Where Vercel places the visitor, for analytics. Only as far as the city:
 * the IP address, coordinates and postcode Vercel also knows are personal
 * data nothing here needs, so they are never sent to the browser
 */
export function GET(request: NextRequest) {
  const { country, region, city, flag } = geolocation(request);
  const geo: VisitorGeo = { country, region, city, flag };
  return NextResponse.json({ geo });
}
