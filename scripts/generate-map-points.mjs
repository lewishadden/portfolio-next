/**
 * Generates the dotted map of the British Isles and nearby Europe shown on the
 * contact page (components/Contact/LocationMap).
 *
 * Lays an offset dot grid over a simple equirectangular projection of the
 * region and keeps the dots that fall on land (Natural Earth 50m via
 * world-atlas), splitting UK dots from the rest. Each set is written as one
 * SVG path of zero-length segments (drawn as dots with round line caps), along
 * with the projected position of every place the map marks and a few chart
 * lines, to components/Contact/LocationMap/mapData.json.
 *
 * Re-run after changing the region, density or places:
 *   node scripts/generate-map-points.mjs
 */
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
import { feature } from 'topojson-client';
import { geoContains } from 'd3-geo';

const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url).pathname;
const out = path.join(root, 'components/Contact/LocationMap/mapData.json');

// Region (degrees) and grid density (viewBox units)
const bounds = { west: -11, east: 15, south: 47.9, north: 59.1 };
const width = 480;
const step = 8;
const rowStep = 7;

// Peterborough, where the beacon sits
const places = {
  home: [52.57, -0.24],
};

// Faint chart lines (degrees)
const graticule = { lat: [50, 52.5, 55, 57.5], lng: [-10, -5, 0, 5, 10] };

const ukId = '826';

const read = async (file) => JSON.parse(await readFile(require.resolve(file), 'utf-8'));
const landTopology = await read('world-atlas/land-50m.json');
const countryTopology = await read('world-atlas/countries-50m.json');
const land = feature(landTopology, landTopology.objects.land);
const uk = feature(countryTopology, countryTopology.objects.countries).features.find(
  (country) => String(country.id) === ukId
);

// Equirectangular, with longitude squeezed for the region's mid latitude
const midLat = (bounds.north + bounds.south) / 2;
const squeeze = Math.cos((midLat * Math.PI) / 180);
const scale = width / ((bounds.east - bounds.west) * squeeze);
const height = Math.round((bounds.north - bounds.south) * scale);
const project = (lat, lng) => [(lng - bounds.west) * squeeze * scale, (bounds.north - lat) * scale];
const unproject = (x, y) => [bounds.west + x / (squeeze * scale), bounds.north - y / scale];

const rows = { uk: [], land: [] };
for (let y = rowStep / 2, row = 0; y < height; y += rowStep, row++) {
  const ukRow = [];
  const landRow = [];
  // Offset every other row by half a step for an even, hex-like weave
  for (let x = row % 2 ? step : step / 2; x < width; x += step) {
    const point = unproject(x, y);
    if (!geoContains(land, point)) continue;
    (geoContains(uk, point) ? ukRow : landRow).push(x);
  }
  if (ukRow.length) rows.uk.push([y, ukRow]);
  if (landRow.length) rows.land.push([y, landRow]);
}

/** One absolute move per row, then relative hops between that row's dots */
const toPath = (set) =>
  set
    .map(([y, xs]) => xs.map((x, i) => (i ? `m${x - xs[i - 1]} 0h0` : `M${x} ${y}h0`)).join(''))
    .join('');

const round = (n) => Math.round(n * 10) / 10;
const data = {
  width,
  height,
  uk: toPath(rows.uk),
  land: toPath(rows.land),
  places: Object.fromEntries(
    Object.entries(places).map(([name, [lat, lng]]) => [name, project(lat, lng).map(round)])
  ),
  graticule: {
    y: graticule.lat.map((lat) => round(project(lat, 0)[1])),
    x: graticule.lng.map((lng) => round(project(0, lng)[0])),
  },
};

await writeFile(out, `${JSON.stringify(data, null, 2)}\n`);
const count = (set) => set.reduce((sum, [, xs]) => sum + xs.length, 0);
console.log(
  `wrote ${count(rows.uk)} UK + ${count(rows.land)} land dots (${width}×${height}) to ${path.relative(root, out)}`
);
