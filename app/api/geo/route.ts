import { geolocation, ipAddress } from '@vercel/functions';
import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const ip = ipAddress(request) || 'Unknown';
  const geo = geolocation(request);
  return NextResponse.json({ ip, geo });
}
