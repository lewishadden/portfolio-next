/**
 * Generates the land dot cloud used by the contact-page globe in the 3D world.
 *
 * Samples an even Fibonacci lattice over the sphere and keeps the points that
 * fall on land (Natural Earth 110m via world-atlas), writing a flat
 * [lat, lng, lat, lng, ...] array rounded to 0.1° to
 * components/World/data/globePoints.json.
 *
 * Re-run after changing the density:  node scripts/generate-globe-points.mjs
 */
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
import { feature } from 'topojson-client';
import { geoContains } from 'd3-geo';

const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url).pathname;
const out = path.join(root, 'components/World/data/globePoints.json');
const samples = 16000;

const topology = JSON.parse(await readFile(require.resolve('world-atlas/land-110m.json'), 'utf-8'));
const land = feature(topology, topology.objects.land);

const golden = Math.PI * (3 - Math.sqrt(5));
const points = [];
for (let i = 0; i < samples; i++) {
  const y = 1 - (i / (samples - 1)) * 2;
  const theta = golden * i;
  const lat = (Math.asin(y) * 180) / Math.PI;
  const lng = (((((theta * 180) / Math.PI + 180) % 360) + 360) % 360) - 180;
  // Skip Antarctica — it reads as noise at the globe's south pole
  if (lat < -60) continue;
  if (geoContains(land, [lng, lat])) points.push(+lat.toFixed(1), +lng.toFixed(1));
}

await writeFile(out, JSON.stringify(points));
console.log(`wrote ${points.length / 2} land points to ${path.relative(root, out)}`);
