#!/usr/bin/env node
/**
 * Tell IndexNow which pages of portfolio.lewishadden.com changed, so Bing, Yandex,
 * Seznam, Naver and the other participating engines (and the ChatGPT and Copilot answers
 * Bing feeds) recrawl them sooner than a natural crawl would.
 *
 * Run after a production deploy is live:
 *   node scripts/indexnow.mjs             # pages new, changed or gone since the last run
 *   node scripts/indexnow.mjs --dry       # preview: nothing submitted or recorded
 *   node scripts/indexnow.mjs --all       # every page, changed or not
 *   node scripts/indexnow.mjs --baseline  # record the live site as submitted
 *   node scripts/indexnow.mjs <url> …     # exactly these URLs; the record is untouched
 * Through npm, flags go after `--` (npm run indexnow -- --dry). A `--dry-run` or
 * `--baseline` that npm keeps for itself is still honoured; anything else it keeps
 * stops the run rather than let it submit unasked.
 *
 * "Changed" is judged on the live site, not on <lastmod>, which many sitemaps leave out
 * or stamp with the build time. The script reads the live sitemap, fetches every page in
 * it and fingerprints what a search engine indexes: the title, description, robots and
 * canonical tags and the text and image alt text of <main> (plus anything React streams
 * in after it), leaving out scripts, styles, hashed asset names, the site chrome around
 * <main> and the IGNORE patterns below, so a footer year, a nav link or a live rating
 * doesn't "change" every page at once. A page is submitted when it is new to the
 * sitemap, or when two fetches in a row agree its fingerprint differs from the last
 * run's; when that can't be judged, when its <lastmod> changed. A page is submitted as
 * removed once it 404s or 410s or, after leaving the sitemap, once it redirects, turns
 * noindex or names another page as canonical, so engines drop it. A new page that can't
 * be fetched yet waits for a run where it loads.
 *
 * The last run is recorded in ~/.local/state/indexnow/<host>.json, outside the repo, so
 * every checkout and worktree shares it (INDEXNOW_STATE_DIR overrides the directory).
 * With no record yet, every page is new. INDEXNOW_SITEMAP=<url> overrides the sitemap.
 *
 * KEY must match the file engines fetch to verify ownership,
 *   public/f01e788253de41b49344920789ed78b3.txt
 * and the script checks the live copy first. It needs only Node 18+, so it also runs
 * straight from git whatever branch is checked out (pipefail makes a missing file fail):
 *   set -o pipefail
 *   git show origin/main:scripts/indexnow.mjs | node --input-type=module - --dry
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOST = 'portfolio.lewishadden.com';
const KEY = 'f01e788253de41b49344920789ed78b3';
// Text that repeats across pages and changes without them changing (a live rating, a
// relative date), removed from the visible text before it is fingerprinted.
const IGNORE = [];

const ORIGIN = `https://${HOST}`;
const KEY_LOCATION = `${ORIGIN}/${KEY}.txt`;
const SITEMAP_URL = process.env.INDEXNOW_SITEMAP || `${ORIGIN}/sitemap.xml`;
const STATE_DIR =
  process.env.INDEXNOW_STATE_DIR || path.join(os.homedir(), '.local', 'state', 'indexnow');
const STATE_FILE = path.join(STATE_DIR, `${HOST}.json`);
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const USER_AGENT = `indexnow-submit (+${ORIGIN})`;
const CONCURRENCY = 6;
const BATCH_SIZE = 10_000; // the protocol's limit per request
const UNLISTED_DAYS = 30; // how long a page out of the sitemap that still loads is watched
const FLAGS = new Set(['--dry', '--dry-run', '--all', '--baseline']);
const USAGE = 'usage: node scripts/indexnow.mjs [--dry] [--all | --baseline | <url> …]';

// What each response means, from https://www.indexnow.org/documentation.
const RESPONSES = {
  200: 'OK',
  202: 'accepted, key validation pending',
  400: 'bad request',
  403: "the key isn't valid for this host",
  422: "a URL isn't on this host, or the key doesn't match the protocol",
  429: 'too many requests',
};

function fail(message) {
  console.error(`indexnow: ${message}`);
  process.exit(1);
}

// A fetch error with its cause, since "fetch failed" alone says nothing.
function why(e) {
  const cause = e.cause?.code ?? e.cause?.message;
  return cause ? `${e.message} (${cause})` : e.message;
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function sameUrl(a, b) {
  try {
    return new URL(a, b).href === new URL(b).href;
  } catch {
    return false;
  }
}

// GET a page, retried once after a network error, a 429 or a 5xx (a cold serverless page
// or a rate limit is usually gone a moment later). Throws when it can't be read at all.
async function get(url, { redirect = 'follow', retries = 1 } = {}) {
  let page = null;
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT },
      redirect,
      signal: AbortSignal.timeout(15_000),
    });
    page = {
      status: res.status,
      ok: res.ok,
      redirectedTo: res.redirected ? res.url : null,
      robotsHeader: res.headers.get('x-robots-tag') ?? '',
      text: await res.text(),
    };
  } catch (e) {
    if (retries === 0) throw e;
  }
  if (page && (retries === 0 || (page.status !== 429 && page.status < 500))) return page;
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return get(url, { redirect, retries: retries - 1 });
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s) {
  const char = (n) => (n <= 0x10ffff ? String.fromCodePoint(n) : '');
  return s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (entity, hex, dec, name) => {
    if (hex) return char(parseInt(hex, 16));
    if (dec) return char(Number(dec));
    return ENTITIES[name.toLowerCase()] ?? entity;
  });
}

// An attribute's raw value in a tag's source, however it is quoted.
function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'));
  return m ? (m[1] ?? m[2] ?? m[3]) : '';
}

// The value of `want` on the first <tag> whose `key` attribute is `value`, e.g. the
// content of <meta name="robots">.
function tagAttr(html, tag, key, value, want) {
  for (const [source] of html.matchAll(new RegExp(`<${tag}\\s[^>]*>`, 'gi'))) {
    if (attr(source, key).toLowerCase() === value) {
      return decodeEntities(attr(source, want));
    }
  }
  return '';
}

// The tags that decide how a page is indexed, wherever in the page they are (Next.js
// can stream metadata into the body).
function headTags(html) {
  return {
    title: decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''),
    description: tagAttr(html, 'meta', 'name', 'description', 'content'),
    robots: tagAttr(html, 'meta', 'name', 'robots', 'content'),
    canonical: tagAttr(html, 'link', 'rel', 'canonical', 'href'),
  };
}

function tagText(block, name) {
  const m = block.match(
    new RegExp(`<${name}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${name}>`)
  );
  return m ? decodeEntities(m[1].trim()) : '';
}

// Every page the sitemap lists, following a sitemap index, as { url, lastmod }.
async function readSitemap(url, visited = new Set()) {
  if (visited.has(url)) return [];
  visited.add(url);
  let res;
  try {
    res = await get(url);
  } catch (e) {
    fail(`could not fetch the sitemap ${url}: ${why(e)}`);
  }
  if (!res.ok) fail(`the sitemap ${url} returned HTTP ${res.status}`);
  const pages = [];
  for (const [, block] of res.text.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/g)) {
    const loc = tagText(block, 'loc');
    if (loc) pages.push(...(await readSitemap(loc, visited)));
  }
  for (const [, block] of res.text.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = tagText(block, 'loc');
    if (loc) pages.push({ url: loc, lastmod: tagText(block, 'lastmod') });
  }
  return pages;
}

// The page's own visible text: <main>, plus what React streams in after the shell
// (<div hidden id="S:…">), with image alt text kept. Everything else outside <main> is
// site chrome; a page without <main> keeps its body minus header, nav and footer.
function visibleText(html) {
  const body = html.replace(/<head[\s>][\s\S]*?<\/head>/i, ' ');
  const mains = [...body.matchAll(/<main[\s>][\s\S]*?<\/main>/gi)].map((m) => m[0]);
  const streamed = [
    ...body.matchAll(
      /<div hidden id="S:[^"]*">[\s\S]*?(?=<script[^>]*>\$R|<div hidden id="S:|<\/body>)/g
    ),
  ].map((m) => m[0]);
  const content =
    mains.length > 0
      ? [...mains, ...streamed].join(' ')
      : body.replace(/<(header|nav|footer)[\s>][\s\S]*?<\/\1>/gi, ' ');
  return decodeEntities(
    content
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|template|svg)[\s>][\s\S]*?<\/\1>/gi, ' ')
      .replace(/<img\s[^>]*>/gi, (img) => ` ${attr(img, 'alt')} `)
      .replace(/<[^>]*>/g, ' ')
  );
}

// A hash of what a search engine indexes, leaving out what changes on every build or
// request (scripts, styles, hashed asset URLs, nonces) and the IGNORE patterns.
function fingerprint(html) {
  const { title, description, robots, canonical } = headTags(html);
  let text = [title, description, robots, canonical, visibleText(html)]
    .join('\n')
    .replace(/\s+/g, ' ');
  for (const pattern of IGNORE) text = text.replace(pattern, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

async function fingerprintPage(url) {
  try {
    const res = await get(url);
    if (!res.ok) return { error: `HTTP ${res.status}`, status: res.status };
    return { fingerprint: fingerprint(res.text), redirect: res.redirectedTo };
  } catch (e) {
    return { error: why(e) };
  }
}

// What became of a page that left the sitemap: "gone" once it 404s, 410s, redirects,
// turns noindex or names another page as canonical (engines should drop it), "loads"
// while it still serves as itself, "failing" while it can't be fetched.
async function unlistedState(url) {
  let res;
  try {
    res = await get(url, { redirect: 'manual' });
  } catch {
    return 'failing';
  }
  if ([404, 410].includes(res.status) || (res.status >= 300 && res.status < 400)) {
    return 'gone';
  }
  if (!res.ok) return 'failing';
  const { robots, canonical } = headTags(res.text);
  if (/noindex/i.test(`${robots} ${res.robotsHeader}`)) return 'gone';
  if (canonical && !sameUrl(canonical, url)) return 'gone';
  return 'loads';
}

// fn over items with at most `limit` in flight, results in order.
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// The last run's pages, { [url]: { lastmod, fingerprint, gone?, unlistedSince? } }, or
// null with no record.
function readState() {
  let text;
  try {
    text = fs.readFileSync(STATE_FILE, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    fail(`can't read the record ${STATE_FILE}: ${e.message}`);
  }
  let state = null;
  try {
    state = JSON.parse(text);
  } catch {
    // unreadable: treated as no record, below
  }
  if (state?.version === 2 && state.pages) return state.pages;
  console.warn(`indexnow: ignoring unreadable ${STATE_FILE}; every page counts as new`);
  return null;
}

// Checked before submitting, so a record that can't be written never means resubmitting
// the same pages on every run.
function checkStateWritable() {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.accessSync(STATE_DIR, fs.constants.W_OK);
  } catch (e) {
    fail(`can't write the record in ${STATE_DIR}: ${e.message}`);
  }
}

function writeState(pages) {
  const state = { version: 2, host: HOST, updatedAt: new Date().toISOString(), pages };
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
    fs.renameSync(tmp, STATE_FILE);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    fail(`couldn't record the run in ${STATE_FILE}: ${e.message}`);
  }
}

async function checkKey() {
  let res;
  try {
    res = await get(KEY_LOCATION);
  } catch (e) {
    fail(`could not fetch the key file ${KEY_LOCATION}: ${why(e)}`);
  }
  if (!res.ok || res.text.trim() !== KEY) {
    const what = res.ok ? 'the wrong content' : `HTTP ${res.status}`;
    fail(`${KEY_LOCATION} doesn't serve the key (${what}); deploy it first`);
  }
}

async function submit(urls) {
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const urlList = urls.slice(i, i + BATCH_SIZE);
    let status;
    let detail;
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'user-agent': USER_AGENT,
        },
        body: JSON.stringify({
          host: HOST,
          key: KEY,
          keyLocation: KEY_LOCATION,
          urlList,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      status = res.status;
      if (status !== 200 && status !== 202) {
        detail = (await res.text()).trim().slice(0, 500);
      }
    } catch (e) {
      fail(`the submission failed: ${why(e)}`);
    }
    const meaning = RESPONSES[status] ?? 'unexpected';
    console.log(`indexnow: submitted ${urlList.length} URL(s) → HTTP ${status} (${meaning})`);
    if (status !== 200 && status !== 202) {
      fail(detail ? `IndexNow replied: ${detail}` : 'IndexNow rejected the submission');
    }
  }
}

function list(rows) {
  const shown = rows.length > 25 ? rows.slice(0, 20) : rows;
  for (const { reason, url } of shown) console.log(`  ${reason.padEnd(8)} ${url}`);
  if (shown.length < rows.length) {
    console.log(`  … and ${rows.length - shown.length} more`);
  }
}

if (typeof fetch !== 'function') {
  fail(`needs Node 18 or newer; this is ${process.version}`);
}

// npm keeps a flag typed before `--` (npm run indexnow --baseline) for itself and passes
// it on as npm_config_*, and pnpm passes a literal `--` through. Honour the flags that
// only make a run safer; refuse any other that npm kept rather than run without it.
const argv = process.argv.slice(2).filter((a) => a !== '--');
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}
const honoured = { npm_config_dry_run: '--dry', npm_config_baseline: '--baseline' };
const npmKept = Object.keys(process.env).filter((k) => /^npm_config_(dry|base|all$)/.test(k));
const refused = npmKept.filter(
  (k) => !(k in honoured) && !(k === 'npm_config_all' && argv.includes('--all'))
);
if (refused.length > 0) {
  const flags = refused.map((k) => `--${k.slice('npm_config_'.length).replace(/_/g, '-')}`);
  fail(
    `npm kept ${flags.join(', ')} for itself (or an .npmrc sets it); put flags after --, as in npm run indexnow -- --dry`
  );
}
const args = [
  ...argv,
  ...npmKept.filter((k) => k in honoured && process.env[k] === 'true').map((k) => honoured[k]),
];
const unknown = args.filter((a) => a.startsWith('-') && !FLAGS.has(a));
if (unknown.length > 0) fail(`unknown option ${unknown.join(', ')}; ${USAGE}`);
const dry = args.includes('--dry') || args.includes('--dry-run');
const all = args.includes('--all');
const baseline = args.includes('--baseline');
const named = [];
for (const arg of args.filter((a) => !FLAGS.has(a))) {
  let url;
  try {
    url = new URL(arg.trim());
  } catch {
    fail(`not a URL: "${arg}"`);
  }
  url.hash = '';
  if (url.host !== HOST) fail(`not on ${HOST}: ${url.href}`);
  if (!named.includes(url.href)) named.push(url.href);
}
if (all && baseline) fail("--all and --baseline don't combine");
if (named.length > 0 && (all || baseline)) {
  fail('name URLs or use --all or --baseline, not both');
}

await checkKey();

// Named URLs: submit exactly those, without reading or recording a run.
if (named.length > 0) {
  console.log(`indexnow ${HOST}: ${named.length} URL(s) named`);
  list(named.map((url) => ({ reason: 'named', url })));
  if (dry) {
    console.log('indexnow: dry run; nothing submitted');
  } else {
    await submit(named);
  }
  process.exit(0);
}

const listed = new Map();
let offHost = 0;
for (const page of await readSitemap(SITEMAP_URL)) {
  if (hostOf(page.url) !== HOST) offHost++;
  else if (!listed.has(page.url)) listed.set(page.url, page);
}
if (listed.size === 0) fail(`no ${HOST} pages in ${SITEMAP_URL}`);

// Fetch every page, giving up early if the site isn't answering at all.
const pages = [...listed.values()];
let loaded = 0;
let failed = 0;
const fetched = await mapLimit(pages, CONCURRENCY, async (page) => {
  const result = await fingerprintPage(page.url);
  if (result.error) failed++;
  else loaded++;
  if (loaded === 0 && failed >= Math.min(12, pages.length)) {
    fail(`${HOST} isn't answering (${result.error}); nothing submitted or recorded`);
  }
  return result;
});
const previous = readState();

// A changed fingerprint counts only if a second fetch agrees, so content that differs
// from one request to the next (a rotating quote, a backend blip) isn't a change.
const differs =
  all || baseline
    ? []
    : pages.filter((page, i) => {
        const before = previous?.[page.url]?.fingerprint;
        return before && fetched[i].fingerprint && fetched[i].fingerprint !== before;
      });
const refetched = new Map(
  (await mapLimit(differs, CONCURRENCY, (page) => fingerprintPage(page.url))).map((result, i) => [
    differs[i].url,
    result.fingerprint,
  ])
);

const snapshot = {};
const changes = [];
const problems = [];
if (offHost > 0) problems.push(`the sitemap lists ${offHost} URL(s) not on ${HOST}`);
pages.forEach((page, i) => {
  const { fingerprint: now = null, error, status, redirect } = fetched[i];
  const before = previous?.[page.url];
  const missing = status === 404 || status === 410;
  // Gone stays gone (submitted once) until the page loads again.
  const gone = missing || Boolean(before?.gone && !now);
  if (redirect) problems.push(`${page.url} redirects to ${redirect}`);
  // A new page that can't be fetched waits, unrecorded, for a run where it loads; a
  // baseline records it as seen.
  if (error && !before && !baseline) {
    problems.push(`${page.url}: ${error}; not submitted until it loads`);
    return;
  }
  if (error) problems.push(`${page.url}: ${error}`);

  let reason = null;
  let kept = now;
  if (!before || (before.gone && now)) {
    reason = 'new';
  } else if (missing) {
    if (!before.gone) reason = 'removed';
  } else if (now && before.fingerprint && now !== before.fingerprint) {
    if (all || baseline || refetched.get(page.url) === now) {
      reason = 'changed';
    } else {
      // Unconfirmed: keep the old fingerprint so the next run looks again, and fall
      // back on <lastmod> as for a page that can't be fetched.
      kept = before.fingerprint;
      if (page.lastmod !== before.lastmod) reason = 'lastmod';
      problems.push(
        refetched.get(page.url)
          ? `${page.url} differs from one fetch to the next`
          : `${page.url} couldn't be fetched again to confirm a change`
      );
    }
  } else if (!(now && before.fingerprint) && page.lastmod !== before.lastmod) {
    reason = 'lastmod';
  }
  // A page that couldn't be fetched keeps its last fingerprint, to compare next run.
  snapshot[page.url] = {
    lastmod: page.lastmod,
    fingerprint: kept ?? before?.fingerprint ?? null,
    ...(gone && { gone: true }),
  };
  if (all) changes.push({ reason: reason ?? 'same', url: page.url });
  else if (reason) changes.push({ reason, url: page.url });
});

// Pages that left the sitemap: submitted once they're gone; watched for UNLISTED_DAYS
// while they still load or fail (they may come back), then forgotten.
const unlisted = Object.keys(previous ?? {}).filter((url) => !listed.has(url));
const fates = await mapLimit(unlisted, CONCURRENCY, unlistedState);
const waiting = { loads: 0, failing: 0, forgotten: 0 };
const today = new Date().toISOString();
unlisted.forEach((url, i) => {
  const entry = previous[url];
  if (entry.gone) return; // already submitted as removed
  if (fates[i] === 'gone') {
    changes.push({ reason: 'removed', url });
    return;
  }
  const since = entry.unlistedSince ?? today;
  if (Date.now() - Date.parse(since) > UNLISTED_DAYS * 86_400_000) {
    waiting.forgotten++;
    return;
  }
  waiting[fates[i]]++;
  snapshot[url] = { ...entry, unlistedSince: since };
});

const record = previous ? '' : ' and no record of a previous run';
if (baseline) {
  console.log(
    `indexnow ${HOST}: ${pages.length} page(s) in the sitemap${record}; recording them as submitted (${changes.length} new, changed or removed)`
  );
} else if (changes.length === 0) {
  console.log(`indexnow ${HOST}: ${pages.length} page(s), none new, changed or removed`);
} else {
  console.log(
    `indexnow ${HOST}: ${pages.length} page(s) in the sitemap${record}; ${changes.length} to submit`
  );
  list(changes);
}
if (waiting.loads + waiting.failing > 0) {
  console.log(
    `indexnow: ${waiting.loads} page(s) left the sitemap but still load and ${waiting.failing} can't be fetched; not submitted until they're gone`
  );
}
if (waiting.forgotten > 0) {
  console.log(
    `indexnow: forgetting ${waiting.forgotten} page(s) out of the sitemap for over ${UNLISTED_DAYS} days`
  );
}
for (const problem of problems.slice(0, 10)) {
  console.warn(`indexnow: warning: ${problem}`);
}
if (problems.length > 10) {
  console.warn(`indexnow: … and ${problems.length - 10} more warnings`);
}

if (dry) {
  console.log('indexnow: dry run; nothing submitted or recorded');
  process.exit(0);
}
checkStateWritable();
if (!baseline && changes.length > 0) await submit(changes.map((change) => change.url));
writeState(snapshot);
console.log(`indexnow: recorded ${Object.keys(snapshot).length} page(s) in ${STATE_FILE}`);
