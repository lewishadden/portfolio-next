/**
 * Generates an offline Iconify bundle so icons render without hitting
 * api.iconify.design at runtime.
 *
 * Scans content/content.json and component/app source for `prefix:name`
 * icon references, fetches the minimal icon data per collection from the
 * Iconify API (build-time only), and writes it to
 * components/IconifyLoader/iconify-bundle.json.
 *
 * Re-run after adding/changing icons:  node scripts/generate-iconify-bundle.mjs
 */
import { readFile, writeFile, readdir } from 'fs/promises';
import path from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = path.join(ROOT, 'components/IconifyLoader/iconify-bundle.json');
const ICON_RE = /"([a-z0-9]+(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)"/g;

async function collectFiles(dir, exts, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectFiles(full, exts, files);
    else if (exts.some((e) => entry.name.endsWith(e))) files.push(full);
  }
  return files;
}

const sources = [
  path.join(ROOT, 'content/content.json'),
  ...(await collectFiles(path.join(ROOT, 'components'), ['.tsx', '.ts'])),
  ...(await collectFiles(path.join(ROOT, 'app'), ['.tsx', '.ts'])),
];

const byPrefix = new Map();
for (const file of sources) {
  const text = await readFile(file, 'utf-8');
  for (const [, prefix, name] of text.matchAll(ICON_RE)) {
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, new Set());
    byPrefix.get(prefix).add(name);
  }
}

const collections = [];
for (const [prefix, names] of [...byPrefix.entries()].sort()) {
  const url = `https://api.iconify.design/${prefix}.json?icons=${[...names].sort().join(',')}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`skip ${prefix}: HTTP ${res.status} (probably not an icon collection)`);
    continue;
  }
  const data = await res.json();
  if (data.not_found?.length) console.warn(`${prefix}: not found: ${data.not_found.join(', ')}`);
  delete data.not_found;
  if (Object.keys(data.icons || {}).length) collections.push(data);
}

await writeFile(OUT, JSON.stringify(collections));
const bytes = (await readFile(OUT)).length;
console.log(
  `Wrote ${collections.length} collections (${collections.reduce(
    (n, c) => n + Object.keys(c.icons).length,
    0
  )} icons, ${(bytes / 1024).toFixed(1)} KB) to ${path.relative(ROOT, OUT)}`
);
