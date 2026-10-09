# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Lewis Hadden's portfolio: Next.js 16 (App Router), React 19, TypeScript, SCSS. Six routes (`/`, `/about`, `/experience`, `/projects`, `/skills`, `/contact`), a statically generated page per project (`/projects/[slug]`) and a 404 share one header and footer. Behind every page sits one persistent three.js world (React Three Fiber): each route is a "station" in space, navigating flies the camera between them, and scrolling moves the camera within a station. All content is static (`content/content.json`) and every page is prerendered. At runtime the server only runs two API routes (`app/api/sendmail` for the contact form, `app/api/geo`, which gives Google Analytics the visitor's Vercel geolocation) and `next/image` optimisation, so the site needs a Node server (deployed on Vercel).

**AGENTS.md is the exhaustive reference.** It describes every subsystem feature by feature (loading screen, header HUD, mobile menu, sound, flights, free roam, each station, the projects ride) and records _why_ things are built the way they are; most of those choices fixed a specific jank, perf or a11y bug. Read the relevant paragraph there before changing a subsystem, and update it in the same PR when behaviour changes. This file is the map; AGENTS.md is the detail. The visual design is specified in `docs/superpowers/specs/2026-09-24-orbit-redesign.md` (the older `2026-07-21-ui-overhaul-design.md` is superseded).

## Commands

Node 24 (`.nvmrc`), npm 11. Copy `.env.SAMPLE` to `.env` (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_EMAIL`, `SMTP_PASS`).

```sh
npm run dev               # dev server on :3000
npm run build             # production build
npm run start -- -p 3100  # serve the build (plain `npm run start` wants :3000)
npm run verify            # prettier:check + eslint + stylelint + tsc; run before committing
npm run lint              # eslint + stylelint only
npm run typecheck         # tsc --noEmit only
npm run prettier:write    # format everything (prettier:check skips .scss, so run this after SCSS edits)
npm run lint:fix          # eslint --fix + stylelint --fix
npm run analyze           # build with the bundle analyzer
```

`npm run purgecss` rewrites the built CSS in `.next/static/chunks` in place and isn't part of CI or deploys. `npm run indexnow` submits the live production sitemap to IndexNow (a network side effect: only after a production deploy that adds or changes URLs, never as a check); `public/f01e788253de41b49344920789ed78b3.txt` is its ownership key, so don't delete it.

End-to-end tests (Playwright; there are no unit tests). CI (`.github/workflows/ci.yml`) runs `verify`, then `build`, then the e2e suite on every pull request.

```sh
npx playwright install chromium                    # once (or set PLAYWRIGHT_CHROMIUM_PATH)
npm run build && npm run test:e2e                  # starts `next start` on :3100 itself
npx playwright test tests/e2e/projects.spec.ts     # one file
npx playwright test -g "take over the page"        # tests whose title matches
npx playwright test --project=chromium-webgl       # only the @webgl tests
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test   # against a running server
```

- `playwright.config.ts` has two projects. `chromium` runs everything not tagged `@webgl` and adds no WebGL flags, but Playwright's Chromium still exposes SwiftShader WebGL, so never assume WebGL is absent there: the fixtures switch the world off by default, and a test that needs "no WebGL" stubs `getContext` (see `world.spec.ts`). `chromium-webgl` runs only `@webgl` tests, with SwiftShader flags, one worker and a 3-minute timeout. Never add the SwiftShader flags to the default project: recent Chrome stalls navigations for seconds with them.
- Locally the config reuses any server already on :3100, so a stale `next start` there means you're testing old code.
- Tests run against the real `content.json`: Drive King, Sidenote, Audi Form Builder (a full-page shot) and AirDoctor Webhook (a logo) are used as fixtures, and `routes` in `tests/e2e/fixtures.ts` lists the six pages. Renaming, removing or re-flagging those projects breaks CI.
- Test-writing rules (fixtures, `openHydrated()`, `@webgl`, role locators while the page ghost exists, `no-js.spec.ts`) are in AGENTS.md › Component Structure.
- Next 16 builds dev output into `.next/dev`, so `npm run build` and a production server on another port can run while `npm run dev` is up. Judge performance and loading behaviour on a production build: dev compiles routes and chunks on demand, which adds seconds the real site doesn't have.
- `.claude/launch.json` has preview configs `next-dev` (`npm run dev`, :3000 or the next free port) and `next-prod` (`next start -p 3100`, after a build).

Generators (run after changing their inputs; outputs are committed):

```sh
node scripts/generate-iconify-bundle.mjs   # offline icon bundle, after using any new icon name
node scripts/generate-brand-icons.mjs      # favicon / app icons from the brand mark geometry
node scripts/generate-og-renders.mjs       # PNG station renders for the Open Graph cards
node scripts/generate-globe-points.mjs     # contact globe land dots
node scripts/generate-map-points.mjs       # contact page dotted map
node scripts/optimize-models.mjs <raw-dir>    # hero GLBs: meshopt + WebP textures
node scripts/optimize-stations.mjs <raw-dir>  # station hulls (hd/sd): simplify + meshopt + KTX2
```

## Architecture

### Pages and data

- `app/**/page.tsx` are server components: each calls `getPageContent()` (`utils/serverUtils.ts`, which reads the whole of `content/content.json`), takes the sections it needs and passes them as props to the page components in `components/<Name>/` (mostly client components; `Home` is a server component). The root layout, `utils/seo.ts`, `app/sitemap.ts` and the OG renderers import `content.json` directly instead.
- `content.json` is the single source for portfolio content; shared types are in `types/index.d.ts` (import from `@/types`). Each page's SEO title and description are constants in its `page.tsx`, and OG card copy is in each `opengraph-image.tsx`. `about.recommendations` are quoted verbatim from LinkedIn: never reword them.
- Content that isn't derived from `content.json`: `public/llms.txt` is hand-written (update it when projects, roles or skills change; it currently lacks the five newest projects). `global.contentUpdated` is deliberately used instead of the build date as every sitemap URL's `lastModified` and the home JSON-LD's `dateModified`, so bump it when content meaningfully changes.
- SEO: inner routes set metadata with `pageMetadata()` (`utils/seo.ts`) and JSON-LD with `components/Seo/PageJsonLd`; the home page uses the root layout's `metadata` and its own inline ProfilePage JSON-LD; the layout adds Person + WebSite JSON-LD everywhere. Every route has an `opengraph-image.tsx` built on `app/_og/OgImage.tsx`.
- `app/layout.tsx` composes the shell. `ThemeScript` sits in `<head>` and runs before first paint. `ClientProviders` (theme context, `IconifyLoader`, Lenis, Framer `LazyMotion` + `MotionConfig reducedMotion="user"`; sets `html[data-hydrated]` on mount) wraps, in order: `BootScreen`, the skip link, `World`, `ScrollProgress`, `Header`, `<main id="main-content">` containing `PageTransition` (which wraps the page), `Footer`, `Cursor`, `CommandPalette`, `StatsOverlay`, `RoamButton`. The layout hands client code small serialisable slices of `content.json` (`WorldContent` for the world, `PaletteData` for the palette) rather than the whole file.
- Projects: `/projects/[slug]` is SSG with `dynamicParams = false`. On `/projects`, "View details" is a real link; a plain click `history.pushState`s the URL and the modal opens from the pathname (`utils/projectPaths.ts`), so Back closes it and a refresh shows the full page. Modal and page share `components/Projects/ProjectBody`. The `/projects` page itself is a scroll runway that drives the camera down a helix of screens (details in AGENTS.md).

**Adding or changing a project:** add an item to `content.json` `projects.items` with a unique `slug`, a `thumbnail` (Iconify `prefix:name`) and `images[]`. Each image needs:

- a `url` under `/static/images/projects/<slug>/`;
- an `alt` (also its gallery caption);
- a `size` equal to the file's real pixels;
- `"fullPage": true` for top-to-bottom captures.

Screenshots are WebP (q90, or lossless when that's no bigger), never AVIF, and at most 8192px per side. Then regenerate the icon bundle for a new icon, bump `global.contentUpdated` and update `public/llms.txt`. The page, sitemap entry, OG card, palette entry and 3D screen all come from `content.json`.

### Where three.js may be imported

three.js is reached only through `next/dynamic`: `WorldCanvas` (loaded by `World.tsx` on `requestIdleCallback`, `ssr: false`) and the header logo's own small canvas `BrandMark3D` (loaded by `HeaderMark.tsx`). Everything the root layout imports statically must stay three-free, which is why the header HUD (`HeaderHud`) and the mobile menu hologram (`MenuHolo`) are hand-written plain WebGL. The DOM-safe world modules are:

- `components/World/routes.ts` (station keys, positions, paths, names, model and hull URLs, `liteQuery`)
- `worldStore.ts`, `worldMode.ts`, `pointerLock.ts`, `pageInputs.ts`
- `boot.ts`, `bootMemory.ts`, `signalStore.ts`
- everything `World.tsx` imports statically: the overlays `NavRadar`, `WorldTooltip`, `TourOverlay`, `ExploreHud`, `SignalsHud` and `Waypoints`
- `StationFallback.tsx` (the pages import it)

`types.ts` and `bloomMask.ts` may only use `import type` from three. Check the split with `npm run analyze`.

### The world: DOM side and WebGL side

- **`World.tsx`** (in the root layout) decides whether the world runs, sets `html[data-world='on'|'off']` and lazy-loads `WorldCanvas`. Its inputs are `useWorldPreference`: WebGL support, Save-Data and the visitor's toggle. It wraps the canvas in an error boundary that is the real WebGL test (`reportWebGLUnavailable`), and mounts the DOM overlays and the page inputs (`pageInputs.ts`).
- **`worldStore.ts`** is the bus between the two sides: a plain mutable object plus small event emitters. DOM listeners write to it (scroll, pointer, which section / role / project is at the reading line, link-hover previews); `useFrame` callbacks read it every frame. Nothing re-renders React per frame. Its APIs include `onFlight` (subscribe to start / approach / end), `emitCue` (sound), `setPreview`, `focusOnPage` and `navigateTo`.
- **The page talks to the world through data attributes under `#main-content`:**
  - `data-world-section` is indexed against `companions[station]` in `stations.ts`, so adding, removing or reordering one on home, about or contact changes the camera poses;
  - `data-world-category` marks the skills categories;
  - `data-world-target="skill:<name>"|"role:<index>"` is where a click on a 3D object scrolls to (`hooks/useWorldFocus.ts`).
- **`WorldCanvas.tsx`** is the world's single `<Canvas>`. Its `frameloop` is `'never'` until warm-up finishes, `'demand'` for reduced motion and `'always'` otherwise. Events come from `document.body` through `worldEvents` in `interaction.ts`, whose `filter` drops every hit unless the pointer is over open space (never page content, dialogs included). Don't give the Canvas an `eventPrefix`: R3F would swap in its own compute and skip that check.
- A station mounts when first visited, then stays mounted and hides itself when far away (`stationInRange`). The tour also pre-mounts its next stop, and free roam mounts the rest one at a time.

### How a navigation becomes a flight

1. When a flight will follow (world live in page mode, motion allowed, link to another station), a capture-phase click on an internal link clones `#main-content` (and the footer if on screen) into an inert, `aria-hidden` `.page-ghost`. So do `popstate` and `snapshotPage(href)` from code (the palette, `World`'s navigate handler). The code is in `components/PageTransition/pageSnapshot.ts`. The clone has ids, names and `data-world-*` stripped. `releaseSnapshot` shows it on the route change and it leaves the way the camera turns; it's dropped after 3s if no navigation follows.
2. On the next frame `CameraRig` plans a path from the camera's current pose (`planFlight` in `flight.ts`). It's either an "ahead" cubic Bézier (`planAhead`) whose view locks onto the destination, or, when the destination is behind and over 30 units away, an "about-turn" arc (`planAbout`). The rig writes `worldStore.flight` and fires `emitFlight('start', station)`, which `onFlight` listeners receive.
3. On final approach (`'approach'`) `PageTransition` reveals the new page's copy, so text arrives with the camera, and the destination station powers up (`power.tsx`). With sound on, a swell plays as the flight sets off, the `power` cue on approach, and clamps plus a chime on arrival (`'end'`).
4. Once docked, page scroll drives the camera: the DOM writes reading state into `worldStore` and `stationCamera()` in `stations.ts` turns it into a pose per station (`stationFraming` handles narrow, stacked layouts).

A full page load shows `BootScreen` while the world downloads and warms up (`reportBoot` / `readyBoot` / `finishBoot` in `boot.ts`). `ThemeScript` raises `html[data-boot='loading']` before first paint, and only when the world will run:

- not switched off;
- WebGL API present, no Save-Data;
- not a crawler;
- not loaded in the last 30 minutes (`bootMemory.ts`, localStorage `world-loaded-at`).

Entrance animations wait on `useBooted()` / `whenBooted()` and play as the screen lifts into the camera's warp in.

`worldMode.ts` holds the world's mode: `page`, `tour` or `explore` (free roam), mirrored to `html[data-world-mode]`. Start a mode with `launchWorldMode('tour' | 'explore', enableWorld)`, which switches the world on first if needed and, for explore, requests pointer lock inside the click or key press. `worldMode.exit()` returns to `page`.

### Stations

Each station is `components/World/stations/<Name>Station.tsx`:

- **Materials:** built by a module-level factory passed to `useThemedMaterials(factory, theme, station)` (`stationHooks.ts`).
- **Power:** the tree is wrapped in `<StationScope station>`.
- **Hull:** `<StationHull>`, `hd` on desktop and `sd` on lite devices.
- **Code-built parts:** from `parts.tsx`.
- **Hero GLB (optional):** home, about, experience, contact and lost have one, via `<Model>`; projects and skills are code-built. `<Model>` loads with meshopt + KTX2 through the self-hosted Basis transcoder in `public/static/basis`. **No Draco**: it would fetch a decoder from a CDN. `<Model>` shows the procedural `HoloCore` while loading and if the GLB fails.

**A new route needs a new station:** `stationForPath()` sends unknown path segments to the 404 `lost` station. Adding a key to `stationKeys` (`routes.ts`; its order is the tour, radar and number-key order) makes tsc flag:

- the other `routes.ts` tables;
- `shots` in `stations.ts`;
- `stationVoices` in `components/Sound/spatial.ts`.

These must be done by hand:

- a `stationCamera` case unless the default static pose will do, plus optional `beaconHeights` / `companions`;
- the mount in `WorldCanvas.tsx` (`has('<key>') && <Precompiled>…`);
- `stationSlots` in `components/BrandMark/markGeometry.ts`;
- hull GLBs via `scripts/optimize-stations.mjs`;
- `global.navItems` and `tour.stops` in `content.json`;
- `app/sitemap.ts`;
- the e2e `routes` list and link counts.

### Rules that are easy to break

Code comments and AGENTS.md record the bugs behind each of these.

- **Warm-up:** WebGL compiles a shader on first draw and blocks the main thread. Anything new must be compiled before it is drawn:
  - wrap it in `<Precompiled>`;
  - register async GPU work with `useWarmupTask()`;
  - upload textures through `queueUpload()` (one per frame);
  - composer passes are precompiled with `precompileComposer`.
- **Post-processing:** `Effects` builds the same three passes on every quality tier. Tiers (`quality.ts`; the current one is on `html[data-world-tier]`) only change four things: pixel ratio, bloom's internal resolution, whether colour fringes and sun shafts run (high only), and how many gas clouds draw. Adding or dropping a pass per tier rebuilds the composer and makes the world flicker. Renderer tone mapping is off: `HighlightRolloffEffect` is the only tone curve, and `toneMapped: false` on a material does nothing. The renderer isn't antialiased; SMAA is the antialiasing.
- **Bloom:** project screens are masked out of bloom (`maskBloom()`, `bloomMask.ts`); mask anything else that must keep its own brightness the same way. Keep the sky below the bloom threshold.
- **Shader NaNs:** clamp every `pow()` base to `[0, 1]`. `1.0 - abs(facing)` or `0.5 + 0.5 * sin(x)` can round just below 0, `pow()` of a negative base is NaN on Apple GPUs, and bloom's mip chain spreads one NaN pixel into a full-screen black flash.
- **React hooks lint rules:** eslint-config-next 16 enables eslint-plugin-react-hooks 7's React Compiler rules (`react-hooks/immutability`, `refs`, `purity`, …) as errors, though the compiler itself is off. They forbid mutating hook return values in components. Mutate uniforms per frame through module-level helpers (`setUniform()` in `components/World/utils.ts`) and keep per-frame state in plain objects or classes. Tag additive glow materials with `asGlow()` so the light theme can switch their blending.
- **Shadows** are decided once (off on lite devices): toggling them recompiles every lit material.
- **Camera:** never aim the camera at a point on its own path, or at fixed points from its moving position, without a rate limit. When changing `flight.ts` or `CameraRig.tsx`, simulate all 30 ordered pairs of the six navigable stations (turn rate, total rotation, clearance) at desktop and phone sizes, not just the flight that looked wrong. No harness is checked in: `flight.ts` (`planFlight`, `flightPosition`, `flightRotation`) is plain three.js maths, so write a throwaway script.
- **3D project screens** fetch shots through `/_next/image` but resize and flip them themselves in a worker (`imageDecoder.ts`), then upload via `queueUpload`. Don't rely on `/_next/image` to resize: it can return the full-size original.
- **DOM lookups of page content** must be scoped to `#main-content`: the outgoing page's ghost keeps its classes for about a second.

### Every feature must degrade

- **World off** (`html[data-world='off']`). Triggers: no WebGL API or the canvas fails to start, Save-Data, or the header's `WorldToggle` (localStorage `world` = `'off'`). Crawlers still get the world; they only skip the loading screen. With the world off, 2D station renders (`.station-fallback`) replace the canvas, and the projects ride still works with screenshots in its HUD.
- **No JavaScript:** content is semantic server-rendered HTML. Entrance animations render opacity 0 into the server HTML, so `ThemeScript` emits a `<noscript>` style that shows them. It also starts failsafe timers: if `html[data-hydrated]` hasn't appeared after 4s (22s while the loading screen is up), it sets `html[data-failsafe]`, which reveals them; `PageTransition` removes it on the first route change. `tests/e2e/no-js.spec.ts` covers this.
- **Reduced motion:** the canvas renders on demand, the camera snaps instead of flying, ambient motion stops.
- **Lite devices** (`liteQuery`: `(max-width: 760px), (pointer: coarse)`): sd hulls, fewer particles, no shadows, quality capped at medium.
- The canvas is `aria-hidden`; everything a visitor reads or operates stays in the DOM (WCAG 2.1 AA).

### Debugging aids

- `html` data attributes: `data-world`, `data-world-mode`, `data-world-tier`, `data-boot`, `data-hydrated`, `data-failsafe`.
- localStorage: `world` (`'off'` disables the world), `theme`, `sound`, `signals` (free-roam finds), `world-tilt`, `world-loaded-at` (remove it to see the loading screen again).
- ⌘K / Ctrl+K toggles the command palette: pages, projects, links, world modes (tour, free roam, 3D toggle), actions (sound, theme, copy email, CV) and a toy terminal.
- ⌥⇧S / Alt+Shift+S toggles the stats overlay: FPS and frame times, renderer counters from `StatsProbe` (draw calls, triangles, textures, programs, canvas size / DPR), quality tier, camera position and speed, mode and flight progress.

## Conventions

Code conventions are in AGENTS.md › Key Conventions and › Styling: import grouping, camelCase for every identifier including constants (never `SCREAMING_SNAKE_CASE`), BEM classes, one folder per component, theme tokens and the shared page system in `app/page.scss`. Nothing enforces import order, so follow the file you're in. Beyond those:

- **Copy:** no em-dashes in user-facing text (content.json, metadata, OG text, `llms.txt`, UI strings); use a colon, comma, parentheses or full stop (en-dashes in date ranges are fine). British spelling. Titles read `Section: Topic | Lewis Hadden` (`pageMetadata()` appends the name).
- **Smooth scroll is Lenis** (`ReactLenis root` in `ClientProviders`). A new dialog or overlay stops it while open (`useLenis()?.stop()` / `start()`, as `ProjectDetailsModal` and `MobileMenu` do); inner scrollers get `data-lenis-prevent`; code scrolls with `lenis.scrollTo`.
- **Entrance animations** use `Reveal` / `RevealGroup` / `RevealItem` / `ScrambleText` from `components/Motion` (already gated on `useBooted()`), with `m.*` rather than `motion.*`: `LazyMotion` loads only `domAnimation`, so the `layout` and `drag` features aren't loaded.

## Git and deployment

Vercel builds a preview for every pull request and deploys `main` to production; DigitalOcean only manages DNS (the DigitalOcean pipeline steps in README.md predate the move). Recent work lands as squash-merged PRs into `main`; AGENTS.md and README.md also describe the older Git Flow (`develop`, `release/vX.Y.Z`). Commit and PR titles are plain-English sentences about the visible effect (e.g. "Keep the 3D world from reacting under page content (#64)"). Bodies say what was wrong, why, and what the fix does, with measurements for perf work.
