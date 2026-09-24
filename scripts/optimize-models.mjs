/**
 * Optimises raw GLB exports (e.g. Higgsfield / Tripo image-to-3D) for the web
 * and writes them to public/static/models:
 *   dedupe + weld + error-bounded simplify, meshopt compression,
 *   WebP textures capped at 1024px.
 *
 * Meshopt (not Draco) is deliberate: its decoder ships with three-stdlib,
 * so the site never fetches a decoder from a CDN.
 *
 * Usage:  node scripts/optimize-models.mjs <raw-dir> [out-dir]
 *   raw-dir must contain astronaut.glb, helmet.glb, satellite.glb,
 *   terminal.glb and rocket.glb (the names components/World/stations.ts loads).
 */
import { execFileSync } from 'child_process';
import { readdirSync, statSync, mkdirSync } from 'fs';
import path from 'path';

const root = new URL('..', import.meta.url).pathname;
const [rawDir, outDir = path.join(root, 'public/static/models')] = process.argv.slice(2);

if (!rawDir) {
  console.error('Usage: node scripts/optimize-models.mjs <raw-dir> [out-dir]');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const kb = (file) => `${(statSync(file).size / 1024).toFixed(0)} KB`;

for (const name of readdirSync(rawDir).filter((f) => f.endsWith('.glb'))) {
  const input = path.join(rawDir, name);
  const output = path.join(outDir, name);
  execFileSync(
    'npx',
    [
      '--yes',
      '@gltf-transform/cli@4',
      'optimize',
      input,
      output,
      '--compress',
      'meshopt',
      '--texture-compress',
      'webp',
      '--texture-size',
      '1024',
    ],
    { stdio: 'inherit' }
  );
  console.log(`${name}: ${kb(input)} → ${kb(output)}`);
}
