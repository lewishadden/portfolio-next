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
- Test-writing rules (fixtures, `openHydrated()`, `@webgl`, role locators while the page ghost exists, `no-js.spec.ts`) are in AGENTS.md › Component Structure, and what each spec covers plus the gotchas (stale computed styles at calm and still, clicking header chrome mid-flight, starting the tour from the palette) in AGENTS.md › Commands › Testing. Set a motion level in a test through localStorage `motion`.
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
- SEO: inner routes set metadata with `pageMetadata()` (`utils/seo.ts`) and JSON-LD with `components/Seo/PageJsonLd`; the home page uses the root layout's `metadata` and its own inline ProfilePage JSON-LD; the layout adds Person + WebSite JSON-LD everywhere. Every route has an `opengraph-image.tsx` built on `app/_og/OgImage.tsx`. Keep `utils/seo.ts` out of client code: it imports the whole of `content.json` (the project modal's tab title uses `projectTitle` from `utils/projectPaths.ts` for that reason).
- `app/layout.tsx` composes the shell. `ThemeScript` sits in `<head>` and runs before first paint. `ClientProviders` (theme context, `IconifyLoader`, Lenis, Framer `LazyMotion` + `MotionConfig` with `reducedMotion` from the motion level; sets `html[data-hydrated]` on mount) wraps, in order: `BootScreen`, the skip link, `World`, `ScrollProgress`, `Header`, `RoamButton` (fixed bottom right, but early in the tab order on purpose), `<main id="main-content" tabIndex={-1}>` containing `PageTransition` (which wraps the page), `Footer` (the HUD console, with the Motion control), `Cursor`, `CommandPalette`, `StatsOverlay`. The layout hands client code small serialisable slices of `content.json` (`WorldContent` for the world, `PaletteData` for the palette) rather than the whole file.
- Projects: `/projects/[slug]` is SSG with `dynamicParams = false`. On `/projects`, "View details" is a real link; a plain click `history.pushState`s the URL and the modal opens from the pathname (`utils/projectPaths.ts`), so Back closes it and a refresh shows the full page. Modal and page share `components/Projects/ProjectBody`. The `/projects` page itself is a scroll runway that drives the camera down a helix of screens (details in AGENTS.md).

**Adding or changing a project:** add an item to `content.json` `projects.items` with a unique `slug`, a `thumbnail` (Iconify `prefix:name`) and `images[]`. Each image needs:

- a `url` under `/static/images/projects/<slug>/`;
- an `alt` (also its gallery caption);
- a `size` equal to the file's real pixels;
- `"fullPage": true` for top-to-bottom captures.

Screenshots are WebP (q90, or lossless when that's no bigger), never AVIF, and at most 8192px per side. Then regenerate the icon bundle for a new icon, bump `global.contentUpdated` and update `public/llms.txt`. The page, sitemap entry, OG card, palette entry and 3D screen all come from `content.json`.

### Where three.js may be imported

three.js is reached only through `next/dynamic`: `WorldCanvas` (loaded by `World.tsx` on `requestIdleCallback`, `ssr: false`) and the header logo's own small canvas `BrandMark3D` (loaded by `HeaderMark.tsx`). Everything the root layout imports statically must stay three-free, which is why the header HUD (`HeaderHud`) and the mobile menu hologram (`MenuHolo`) are hand-written plain WebGL. The DOM-safe world modules are:

- `components/World/routes.ts` (station keys, positions, paths, names, model and hull URLs, `liteQuery`, `rangeBetween`, `sectorCentre` / `sectorRadius`)
- `worldStore.ts`, `worldMode.ts`, `pointerLock.ts`, `pageInputs.ts`
- `boot.ts`, `bootMemory.ts`, `signalStore.ts`, `ride.ts`, `skillsOrbit.ts`
- everything `World.tsx` imports statically: the overlays `NavRadar`, `WorldTooltip`, `TourOverlay`, `ExploreHud`, `SignalsHud` and `Waypoints`
- `StationFallback.tsx` (the pages import it)
- outside `components/World`: `utils/motion.ts`, `components/HeaderHud/course.ts`, `components/StationReadout/hail.ts`, `components/Sound/detector.ts` and `haptics.ts`

`types.ts` and `bloomMask.ts` may only use `import type` from three. Check the split with `npm run analyze`.

### The world: DOM side and WebGL side

- **`World.tsx`** (in the root layout) decides whether the world runs, sets `html[data-world='on'|'off']` and lazy-loads `WorldCanvas`. Its inputs are `useWorldPreference`: WebGL support, Save-Data and the visitor's toggle. It wraps the canvas in an error boundary that is the real WebGL test (`reportWebGLUnavailable`), and mounts the DOM overlays and the page inputs (`pageInputs.ts`). It also runs the hand-back from the tour and free roam (`html[data-world-mode='returning']`), the cruise flag (`html[data-flight='cruise']`, which lifts the veil), intent warm-up (`worldStore.intent`: the station a finger is down on, or the page nav in view, mounts and warms before the click) and haptics.
- **`worldStore.ts`** is the bus between the two sides: a plain mutable object plus small event emitters. DOM listeners write to it (scroll, pointer, which section / role / category / project is at the reading line, the `[data-reading]` rects, the glass to keep clear of, the phone world window, link-hover previews, what page element is pointed at); `useFrame` callbacks read it every frame. Nothing re-renders React per frame. Its APIs include `onFlight` (subscribe to start / approach / end), `emitCue(cue, { at, strength })` (sound and haptics), `setPreview`, `showcase` / `onShowcase` (a station shows off: a tour stop, a hail), `setChrome` (the mobile menu or a phone modal covers the world, so it stops drawing), `setIntent`, `focusOnPage` and `navigateTo`.
- **The page talks to the world through data attributes under `#main-content`:**
  - `data-world-section` is indexed against `companions[station]` in `stations.ts`, so adding, removing or reordering one on home, about or contact changes the camera poses;
  - `data-world-category` marks the skills categories;
  - `data-world-target="skill:<name>"|"role:<index>"|"contact:<name>"|"globe:home"|"about:portrait"` and `data-world-project="<index>"` name what a page element stands for: pointing at or focusing one lights it in 3D (`worldStore.targetHover`), and a click on a skill badge or role pod scrolls to its element (`hooks/useWorldFocus.ts`, page mode only);
  - `data-reading` (`="large"` on headings) marks text over the world, which the readability guard keeps at 4.5:1 (keep each box tight to its text);
  - `data-world-window` marks the phone spacers where the camera frames the station again (`components/WorldWindow`).
- **`WorldCanvas.tsx`** is the world's single `<Canvas>`. Its `frameloop` is `'never'` until warm-up finishes and while page chrome covers the world, `'demand'` at the still motion level (except in free roam) and `'always'` otherwise; `CoverPause` carries R3F's clock on across frameloop changes. Events come from `document.body` through `worldEvents` in `interaction.ts`, whose `filter` drops every hit unless the pointer is over open space (never page content, dialogs included). Don't give the Canvas an `eventPrefix`: R3F would swap in its own compute and skip that check.
- A station mounts when first visited, then stays mounted and hides itself when far away (`stationInRange`). The tour also pre-mounts its next stop, and free roam mounts the rest one at a time.

### How a navigation becomes a flight

1. When a flight will follow (world live with the page showing, `html[data-world-mode='page']`; full motion; link to another station), a capture-phase click on an internal link clones `#main-content` (and the footer if on screen) into an inert, `aria-hidden` `.page-ghost`. So do `popstate` and `snapshotPage(href)` from code (the palette, `World`'s navigate handler). The code is in `components/PageTransition/pageSnapshot.ts`. The clone has ids, names and `data-world-*` stripped. `releaseSnapshot` shows it on the route change and it leaves the way the camera turns; it's dropped after 3s if no navigation follows.
2. On the next frame `CameraRig` plans a path from the camera's current pose (`planFlight` in `flight.ts`). It's either an "ahead" cubic Bézier (`planAhead`) whose view locks onto the destination, or, when the destination is behind and over 30 units away, an "about-turn" arc (`planAbout`). The rig writes `worldStore.flight` and fires `emitFlight('start', station)`, which `onFlight` listeners receive.
3. On final approach (`'approach'`) `PageTransition` reveals the new page's copy (held in any mode while the world is on screen, so pages opened from the tour or free roam wait too), swinging in from the side the camera turns towards after an about-turn, so text arrives with the camera; the destination station powers up (`power.tsx`) and projects the heading (`HeadingProjector`). With sound on, a swell plays as the flight sets off, the `power` cue on approach, and clamps plus a chime on arrival (`'end'`). `CourseLine` draws the course in space, and `NavRadar` plots it until the approach.
4. Once docked, page scroll drives the camera: the DOM writes reading state into `worldStore` and `stationCamera()` in `stations.ts` turns it into a pose per station (`stationFraming` handles narrow, stacked layouts, phone world windows included).

Below full motion there is no flight: the camera cuts (the canvas dips out and back, `html[data-world-cut]`) and emits only `'end'`, which plays the soft `arrive` chord.

A full page load shows `BootScreen` while the world downloads and warms up (`reportBoot` / `readyBoot` / `finishBoot` in `boot.ts`). `ThemeScript` raises `html[data-boot='loading']` before first paint, and only when the world will run:

- not switched off;
- WebGL API present, no Save-Data;
- not a crawler;
- not loaded in the last 30 minutes (`bootMemory.ts`, localStorage `world-loaded-at`).

Entrance animations wait on `useBooted()` / `whenBooted()` and play as the screen lifts into the camera's warp in.

`worldMode.ts` holds the world's mode: `page`, `tour` or `explore` (free roam), mirrored to `html[data-world-mode]`, which also reads `returning` while the page waits for the camera to come back from a mode (so ask `html[data-world-mode='page']`, not the store, whether the page is showing). Start a mode with `launchWorldMode('tour' | 'explore', enableWorld)`, which switches the world on first if needed and, for explore, requests pointer lock inside the click or key press. `worldMode.exit()` returns to `page`, and `restoreFocus()` puts keyboard focus back where it was. Open a page from anywhere with `navigateFromMode(path)`: from a mode it navigates and stays in the mode until the page arrives (`arrivedAt`), so the camera flies there in one move.

### Stations

Each station is `components/World/stations/<Name>Station.tsx`:

- **Materials:** built by a module-level factory passed to `useThemedMaterials(factory, theme, station)` (`stationHooks.ts`).
- **Power:** the tree is wrapped in `<StationScope station>`.
- **Hull:** `<StationHull>`, `hd` on desktop and `sd` on lite devices.
- **Code-built parts:** from `parts.tsx`.
- **Hero GLB (optional):** home, about, experience, contact and lost have one, via `<Model>`; projects and skills are code-built. `<Model>` loads with meshopt + KTX2 through the self-hosted Basis transcoder in `public/static/basis`. **No Draco**: it would fetch a decoder from a CDN. `<Model>` shows one procedural `HoloCore` (outside `Suspense`, materials shared per theme and never disposed) while loading and if the GLB fails.
- **Showcase:** a station answers `showcase()` (a tour stop, a hail) through `useShowcase` (`reaction.ts`) or its own `onShowcase` listener; at still a hail is a ping and a nav-light blink.
- **Still level:** idle motion runs on `ambientTime()` (`clock.ts`); a station that answers the page redraws once when what it answers changes (`useRedrawOnTargetHover` / `useRedrawOnPageChange` in `reaction.ts`); anything that plays out over time asks for frames (`repaintFor` in `stations/stillFrames.ts`).

**A new route needs a new station:** `stationForPath()` sends unknown path segments to the 404 `lost` station. Adding a key to `stationKeys` (`routes.ts`; its order is the tour, radar and number-key order) makes tsc flag:

- the other `routes.ts` tables;
- `shots` in `stations.ts`;
- `stationVoices` in `components/Sound/spatial.ts`;
- `emitterOffsets` in `HeadingProjector.tsx`;
- `scenes` in `components/StationReadout/StationReadout.tsx`.

These must be done by hand:

- a `stationCamera` case unless the default static pose will do, plus optional `beaconHeights` / `companions`;
- a showcase answer (`useShowcase`) and its line in `components/StationReadout/hail.ts`, or the station offers no hail;
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
- **Post-processing:** `Effects` builds the same three passes on every quality tier, once (`themeChain` retunes them in place on a theme change; pass keys never carry the theme). Tiers (`quality.ts`: `ultra`, `high`, `medium`, `low`; the current one is on `html[data-world-tier]`) only change four things: pixel ratio, bloom's internal resolution, whether colour fringes and sun shafts run (high and ultra), and how many gas clouds draw. Adding or dropping a pass per tier rebuilds the composer and makes the world flicker; a new effect goes inside an existing pass, as the readability guard (`ReadingGuardEffect`, pass 2) does. Its limits come from the theme's text colours (`guardLimits` in `optics.ts`): update them with the tokens, and never put `--text-muted` inside a `[data-reading]` block. Renderer tone mapping is off: `HighlightRolloffEffect` is the only tone curve, and `toneMapped: false` on a material does nothing. The renderer isn't antialiased; SMAA is the antialiasing.
- **Bloom:** project screens are masked out of bloom (`maskBloom()`, `bloomMask.ts`); mask anything else that must keep its own brightness the same way. Keep the sky below the bloom threshold.
- **Shader NaNs:** clamp every `pow()` base to `[0, 1]`. `1.0 - abs(facing)` or `0.5 + 0.5 * sin(x)` can round just below 0, `pow()` of a negative base is NaN on Apple GPUs, and bloom's mip chain spreads one NaN pixel into a full-screen black flash. Bakes too: a NaN baked into the sky blacks out every frame with it in view (use `x * x`, not `pow(x, 2.0)`, for signed x).
- **Shaders:** production doesn't check shader errors (`checkShaderErrors` is off), so a broken shader silently draws nothing: compile new ones in dev. `patch` is reserved in GLSL ES 3.00. An alpha above 1 only works with additive blending: cap it at 1 when `uLight` is set, or the light theme draws black. Never build a mirrored frame inside a shader (three flips culling only for a mirrored `matrixWorld`, so every face turns inside out).
- **Theme switches** must not relink programs: build materials once and retheme them in place where you can, never key `useThemedMaterials` on something that changes at runtime, and let replaced sets go through `retireMaterials` (`ThemeRetire` precompiles the scene, hidden objects included, before disposing them).
- **Instanced geometry** whose instance count can change while mounted is keyed on that count: three caps draws at the count it first drew with.
- **Render targets:** set a target's `scissor` / `scissorTest` before `renderer.setRenderTarget(target)` (three applies them only there), never through `renderer.setScissor`, which sets the canvas's own.
- **Clock:** idle motion in frame callbacks reads `ambientTime(state)` (`clock.ts`), never `clock.elapsedTime`: at still the clock jumps by the whole gap between demand frames, and R3F restarts it at 0 on every frameloop change. Event stamps (clicks, power-ons, hails) go through `pastStamp(stamp, t)` every frame, ahead of any early return such as a station's range test.
- **React hooks lint rules:** eslint-config-next 16 enables eslint-plugin-react-hooks 7's React Compiler rules (`react-hooks/immutability`, `refs`, `purity`, …) as errors, though the compiler itself is off. They forbid mutating hook return values in components. Mutate uniforms per frame through module-level helpers (`setUniform()` in `components/World/utils.ts`) and keep per-frame state in plain objects or classes. Tag additive glow materials with `asGlow()` so the light theme can switch their blending.
- **Shadows** are decided once (off on lite devices): toggling them recompiles every lit material.
- **Camera:** never aim the camera at a point on its own path, or at fixed points from its moving position, without a rate limit. When changing `flight.ts` or `CameraRig.tsx`, simulate all 30 ordered pairs of the six navigable stations (turn rate, total rotation, clearance) at desktop and phone sizes, not just the flight that looked wrong. No harness is checked in: `flight.ts` (`planFlight`, `flightPosition`, `flightRotation`) is plain three.js maths, so write a throwaway script. For the projects ride (`stepRide` / `rideGoal` in `stations.ts`) also simulate turn rate, total rotation and clearance to every screen, covering 1, 3, 7 and 14-screen hops, index glides, End and the pager wrap, at 60 and 120Hz. Code that glides the runway more than a few screens names its destination (`worldStore.projectRideTo`, and Lenis `userData: { rideTo }`). Never feed a curve's `getPointAt` an eased value that isn't clamped to 1 (`smootherstep` rounds over it). Anything posed from the page's measures reads them only for the page's own station in page mode (`stationCamera`'s `reading`), and must survive a one-measure lag at still. The settled camera follows at most 35 units/s; flights, cuts and helix hops are exempt.
- **3D project screens** fetch shots through `/_next/image` but resize and flip them themselves in a worker (`imageDecoder.ts`), then upload via `queueUpload`. Don't rely on `/_next/image` to resize: it can return the full-size original.
- **DOM lookups of page content** must be scoped to `#main-content`: the outgoing page's ghost keeps its classes for about a second.
- **DOM chrome that waits on a flight** asks `flightUnderWay()` (`components/HeaderHud/course.ts`), not `worldStore.flight.active`; things that keep out of the page's heading check `pageCopyShown()`, since `worldStore.copy` is measured at opacity 0 too.
- **Touch gates:** Chrome sends the first touchmove past its own slop as its only cancelable one, so a gate that claims a drag (the contact globe) must decide on that move, under 8dp / 300% zoom (2.67 CSS px).
- **No more than 3 flashes a second** at any motion level: hails have a cooldown, and global key toggles ignore `e.repeat`.

### Every feature must degrade

- **World off** (`html[data-world='off']`). Triggers: no WebGL API or the canvas fails to start, Save-Data, or the header's `WorldToggle` (localStorage `world` = `'off'`). Crawlers still get the world; they only skip the loading screen. With the world off, a still sky (star tiles from `app/_stars.scss`) and 2D station renders with alt text (`.station-fallback`) replace the canvas, the phone world windows close, `RoamButton` reads "Turn on 3D", and the projects ride still works with screenshots in its HUD.
- **No JavaScript:** content is semantic server-rendered HTML. Entrance animations render opacity 0 into the server HTML, so `ThemeScript` emits a `<noscript>` style that shows them. It also starts failsafe timers: if `html[data-hydrated]` hasn't appeared after 4s (22s while the loading screen is up), it sets `html[data-failsafe]`, which reveals them; `PageTransition` removes it on the first route change. The failsafes never mark the world off (a slow start would close and reopen the world windows): only a clear failure does (an app script failing to load or parse, a failed one in the resource timings, or no app at the 25s give-up). `tests/e2e/no-js.spec.ts` covers this.
- **Motion levels** (`utils/motion.ts`, `html[data-motion]`, set by `ThemeScript` before first paint; localStorage `motion`, else the OS setting): `full`; `calm`, where the page holds its motion back and the camera cuts, but the world keeps rendering and its ambient life runs; `still` (what OS reduced motion gets), where the canvas renders on demand (every frame in free roam), the camera cuts and nothing ambient moves. Styles use the `reduced-motion` / `full-motion` mixins in `app/_motion.scss` (never the raw media query), code asks `motionLevel() !== 'full'` or `useMotionLevel()` / `useReducedMotion()`. Every new animation must be right at all three levels.
- **Lite devices** (`liteQuery`: `(max-width: 760px), (pointer: coarse)`): sd hulls, fewer particles, no shadows, quality capped at medium.
- The canvas is `aria-hidden`; everything a visitor reads or operates stays in the DOM (WCAG 2.1 AA).

### Debugging aids

- `html` data attributes: `data-world`, `data-world-expected`, `data-world-mode` (`returning` included), `data-world-tier`, `data-world-cut`, `data-flight`, `data-motion`, `data-boot`, `data-hydrated`, `data-failsafe`.
- localStorage: `world` (`'off'` disables the world), `theme`, `motion` (`full`, `calm` or `still`; absent follows the OS), `sound`, `haptics` (`'off'` disables haptics), `signals` (free-roam finds), `roam-trained` (remove it to see free roam's coach again), `world-tilt`, `world-loaded-at` (remove it to see the loading screen again).
- ⌘K / Ctrl+K toggles the command palette: pages (with their course previewed and range shown), projects, links, world modes (tour, free roam, 3D toggle, Hail the station), actions (sound, theme, motion level, haptics on touch devices that vibrate, copy email, CV) and a toy terminal.
- ⌥⇧S / Alt+Shift+S toggles the stats overlay: FPS and frame times, renderer counters from `StatsProbe` (draw calls, triangles, textures, programs, canvas size / DPR), quality tier, camera position and speed, mode and flight progress.

## Conventions

Code conventions are in AGENTS.md › Key Conventions and › Styling: import grouping, camelCase for every identifier including constants (never `SCREAMING_SNAKE_CASE`), BEM classes, one folder per component, theme tokens and the shared page system in `app/page.scss`. Nothing enforces import order, so follow the file you're in. Beyond those:

- **Copy:** no em-dashes in user-facing text (content.json, metadata, OG text, `llms.txt`, UI strings); use a colon, comma, parentheses or full stop (en-dashes in date ranges are fine). British spelling. Titles read `Section: Topic | Lewis Hadden` (`pageMetadata()` appends the name).
- **Smooth scroll is Lenis** (`ReactLenis root` in `ClientProviders`). A new dialog or overlay holds it while open with `useLenisHold(active)` (`hooks/useLenisHold.ts`, as the palette, `MobileMenu` and `BootScreen` do; `ProjectDetailsModal`'s scroll lock uses `holdLenis`): Lenis's `stop()` / `start()` aren't counted, so bare calls let one overlay's close scroll the page under another. Inner scrollers get `data-lenis-prevent` (`data-lenis-prevent-horizontal` for one that only scrolls sideways); code scrolls with `lenis.scrollTo`.
- **Entrance animations** use `Reveal` / `RevealGroup` / `RevealItem` / `ScrambleText` from `components/Motion` (already gated on `useBooted()`; below full motion `MotionConfig` drops their movement), with `m.*` rather than `motion.*`: `LazyMotion` loads only `domAnimation`, so the `layout` and `drag` features aren't loaded.
- **Layout:** on wide layouts page copy keeps to the left (caps of `min(46rem, 58vw)` and friends, AGENTS.md › Styling) so the station has the right side; new controls are 44px to tap on coarse pointers; CSS 3D lifts need `preserve-3d` on every element between the context and the lifted one.
- `next.config.js` sets `agentRules: false`: without it `next dev` rewrites AGENTS.md and CLAUDE.md with its generated agent-rules block on every start.

## Git and deployment

Vercel builds a preview for every pull request and deploys `main` to production; DigitalOcean only manages DNS (the DigitalOcean pipeline steps in README.md predate the move). Recent work lands as squash-merged PRs into `main`; AGENTS.md and README.md also describe the older Git Flow (`develop`, `release/vX.Y.Z`). Commit and PR titles are plain-English sentences about the visible effect (e.g. "Keep the 3D world from reacting under page content (#64)"). Bodies say what was wrong, why, and what the fix does, with measurements for perf work.
