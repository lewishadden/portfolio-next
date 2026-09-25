/**
 * Generates an offline Iconify bundle so icons render without hitting
 * api.iconify.design at runtime.
 *
 * Scans content/content.json and component/app source for `prefix:name`
 * icon references and writes the minimal icon data per collection to
 * components/IconifyLoader/iconify-bundle.json, plus the list of bundled prefixes
 * to components/IconifyLoader/iconify-prefixes.json (IconifyLoader routes those
 * prefixes to the bundle instead of the API). Icon data comes from a local
 * `@iconify-json/<prefix>` package when installed, otherwise the Iconify API,
 * otherwise the previously generated bundle.
 *
 * Re-run after adding/changing icons:  node scripts/generate-iconify-bundle.mjs
 */
import { readFile, writeFile, readdir } from 'fs/promises';
import { createRequire } from 'module';
import path from 'path';
import { getIcons } from '@iconify/utils';

const require = createRequire(import.meta.url);

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = path.join(ROOT, 'components/IconifyLoader/iconify-bundle.json');
const PREFIXES_OUT = path.join(ROOT, 'components/IconifyLoader/iconify-prefixes.json');
// "prefix:name" in JSON / JSX attributes, or 'prefix:name' in TS expressions
const ICON_RE = /(["'])([a-z0-9]+(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)\1/g;

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
  for (const [, , prefix, name] of text.matchAll(ICON_RE)) {
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, new Set());
    byPrefix.get(prefix).add(name);
  }
}

async function fromLocalPackage(prefix, names) {
  let file;
  try {
    file = require.resolve(`@iconify-json/${prefix}/icons.json`);
  } catch {
    return null;
  }
  const data = getIcons(JSON.parse(await readFile(file, 'utf-8')), [...names]);
  return data && Object.keys(data.icons).length ? data : null;
}

async function fromApi(prefix, names) {
  try {
    const url = `https://api.iconify.design/${prefix}.json?icons=${[...names].sort().join(',')}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.not_found?.length) console.warn(`${prefix}: not found: ${data.not_found.join(', ')}`);
    delete data.not_found;
    return Object.keys(data.icons || {}).length ? data : null;
  } catch {
    return null;
  }
}

let previous = [];
try {
  previous = JSON.parse(await readFile(OUT, 'utf-8'));
} catch {
  // first run
}

function fromPreviousBundle(prefix, names) {
  const data = previous.find((c) => c.prefix === prefix);
  if (!data) return null;
  const missing = [...names].filter((n) => !data.icons[n] && !data.aliases?.[n]);
  if (missing.length)
    console.warn(`${prefix}: missing from previous bundle: ${missing.join(', ')}`);
  return data;
}

const collections = [];
for (const [prefix, names] of [...byPrefix.entries()].sort()) {
  const data =
    (await fromLocalPackage(prefix, names)) ??
    (await fromApi(prefix, names)) ??
    fromPreviousBundle(prefix, names);
  if (!data) {
    console.warn(`skip ${prefix}: no icon data (probably not an icon collection)`);
    continue;
  }
  collections.push(data);
}

await writeFile(OUT, JSON.stringify(collections));
await writeFile(
  PREFIXES_OUT,
  `${JSON.stringify(
    collections.map((c) => c.prefix),
    null,
    2
  )}\n`
);
const bytes = (await readFile(OUT)).length;
console.log(
  `Wrote ${collections.length} collections (${collections.reduce(
    (n, c) => n + Object.keys(c.icons).length,
    0
  )} icons, ${(bytes / 1024).toFixed(1)} KB) to ${path.relative(ROOT, OUT)}`
);
