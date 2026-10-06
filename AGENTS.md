# AGENTS.md

## Project Overview

This is a **Next.js 16** portfolio website built with **React 19**, **TypeScript**, and **SCSS**. Each section is its own route (`/`, `/about`, `/experience`, `/projects`, `/skills`, `/contact`, plus a page per project at `/projects/[slug]`) sharing a header and footer. Behind every page sits one persistent **WebGL world** (three.js via React Three Fiber) — each route is a "station" in space and navigating flies the camera between them. It uses server-side rendering with a Next.js API route for the contact form email endpoint.

The visual design ("Orbit" — dark sci-fi glow + light "daylight lab" theme) is documented in `docs/superpowers/specs/2026-09-24-orbit-redesign.md`.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** SCSS (BEM naming convention), CSS Modules (for select components)
- **3D:** `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `maath` (see `components/World`)
- **Fonts:** Unbounded (display), Geist (body), Geist Mono (labels), self-hosted variable WOFF2s in `app/_fonts` via `next/font/local` — don't switch back to `next/font/google`: its build-time fetch intermittently breaks Turbopack builds (see `app/_fonts/README.md`)
- **Icons:** `@iconify/react` with an offline bundle (`components/IconifyLoader/iconify-bundle.json`)
- **Forms:** Formik + Yup
- **Animations:** Framer Motion (`m` components under `LazyMotion` + `MotionConfig reducedMotion="user"`), CSS keyframes, Lenis smooth scroll
- **Linting:** ESLint, Stylelint, Prettier
- **Testing:** Playwright end-to-end tests (`tests/e2e`) with `@axe-core/playwright`; GitHub Actions CI (`.github/workflows/ci.yml`)
- **Package Manager:** npm
- **Node Version:** See `.nvmrc` (v24.x)
- **Email:** `nodemailer` via Next.js API route (`app/api/sendmail/route.ts`)
- **Geolocation:** `@vercel/functions` (used in `app/layout.tsx` to pass geo data to analytics)
- **Open Graph images:** `next/og`, one `opengraph-image.tsx` per route built on `app/_og/OgImage.tsx`

## Project Structure

```
app/              # Next.js App Router (layout, pages, API routes, OG images, global styles, theme variables)
  _og/            # Private: shared OG image renderer, its fonts and PNG station renders
components/       # React components, each with its own .tsx and .scss
  World/          # Persistent WebGL world: canvas, camera rig, stations, shaders, post-processing, tour / explore modes
  Motion/         # Shared animation primitives (Reveal, SplitText, ScrambleText)
  CommandPalette/ # ⌘K / Ctrl+K palette (navigation, world modes, actions, toy terminal)
  RoamButton/     # Floating free-roam toggle (explore mode)
  BootScreen/     # Loading screen on a full page load while the 3D world gets ready
  Sound/          # Optional synthesised sound (Web Audio) and its header toggle
  BrandMark/      # The LH orbital monogram: header logo, loading screen, icons, OG cards
  MobileMenu/     # The narrow-screen navigation menu and its WebGL warp backdrop
  StationReadout/ # "Docked at the …" telemetry line under each page heading
  StatsOverlay/   # "Stats for nerds" rendering overlay (Alt+Shift+S)
config/           # App configuration (GitHub URL)
content/          # Static content (content.json — the single data source)
contexts/         # React contexts (ThemeContext)
hooks/            # Custom React hooks (useWorldPreference, useRouteKey, useFocusTrap, etc.)
icons/            # Custom SVG icon components
public/           # Static assets served at root (3D models in public/static/models, Basis transcoder in public/static/basis)
types/            # TypeScript type definitions (index.d.ts)
utils/            # Utility functions (serverUtils.ts, seo.ts, contactValidation.ts, rateLimit.ts, projectPaths.ts)
scripts/          # Generators (icon bundle, globe land points, OG renders, model / station hull optimisation, IndexNow)
tests/e2e/        # Playwright end-to-end tests
```

## Key Conventions

## Import Order and Grouping

All imports in TypeScript/JavaScript files must follow this order, with each group separated by a single blank line:

1. **External imports** (npm packages, e.g., `react`, `@iconify/react`)
2. **Internal JS/TS imports** (project files, e.g., `@/components/...`, `@/utils/...`)
3. **Type imports** (e.g., `import type { MyType } from '@/types'`)
4. **SCSS and CSS imports** (e.g., `import './Component.scss'`)

Each group must be separated by a newline for clarity and consistency.

## Prettier Formatting Rules

- All code must follow the formatting rules enforced by Prettier.
- Run `npm run prettier:check` to verify formatting and `npm run prettier:write` to auto-format code before committing.
- Do not manually override Prettier formatting; use the automated tool for consistency.

### Naming

- All variables, constants, and function parameters must use **camelCase** (e.g., `maxSliderHeight`, `paddingHeight`)
- Do **not** use `SCREAMING_SNAKE_CASE` or `snake_case` for any JavaScript/TypeScript identifiers
- Component names use **PascalCase** (e.g., `ProjectDetailsModal`)
- CSS/SCSS class names use **BEM** (`.block__element--modifier`)

### Component Structure

- Each component lives in `components/<ComponentName>/` with:
  - `<ComponentName>.tsx` — the React component (client or server)
  - `<ComponentName>.scss` — scoped styles using BEM naming (`.component__element--modifier`)
- Components marked `'use client'` are client components; otherwise they are server components.
- End-to-end tests live in `tests/e2e` (Playwright). Import `test`/`expect` from `tests/e2e/fixtures.ts`, which seeds the theme and switches the 3D world off by default (`test.use({ world: 'on' })` to opt in). Open pages with `openHydrated()` before clicking anything client-side — a click that lands before hydration is a plain navigation. Tests that need real WebGL are tagged `@webgl` and run in the separate `chromium-webgl` project; don't add the SwiftShader flags to the default project (they make recent Chrome stall navigations for seconds). There are no unit tests.

### Styling

- Use **SCSS** with **BEM naming**: `.block__element--modifier`
- Theme variables are defined in `app/theme-variables.scss` as CSS custom properties on `[data-theme='dark']` and `[data-theme='light']`
- Reference theme values via `var(--variable-name)` (e.g., `var(--bg-primary)`, `var(--text-primary)`, `var(--accent-primary)`, `var(--surface)`)
- Gradient variables: `--gradient-start`, `--gradient-mid`, `--gradient-end`, and `--gradient-brand` (the ready-made violet → cyan gradient)
- Shared page system lives in `app/page.scss`: `.page`, `.page-head`, `.eyebrow`, `.page-title`, `.page-sub`, `.text-gradient`, `.glass`, `.spotlight` (pair with `usePointerGlow`), `.chip`, `.btn--primary` / `.btn--ghost`, `.page-nav`
- Inner pages start with `<PageHead>` (numbered eyebrow + title with gradient accent word); see `components/About` as the reference page
- Support both dark (default) and light themes; use `[data-theme='light'] &` for light-theme overrides
- Respect `prefers-reduced-motion` — see `app/globals.scss`

### TypeScript Types

- All shared types are in `types/index.d.ts`
- Key interfaces: `ResumeData`, `Global`, `Header`, `Home`, `StatItem`, `About`, `Highlight`, `Experience`, `ExperienceItem`, `Projects`, `Project`, `Technology`, `Skills`, `SkillCategory`, `SkillIcon`, `Contact`, `ContactInfo`, `Footer`, `NavItem`, `Theme`, `CtaPair`, `Cta`, `Icon`
- Use `@/types` path alias form for imports

### Custom Hooks (`hooks/`)

- `usePointerGlow` — sets `--mx` / `--my` on an element for the `.spotlight` glow, with optional 3D tilt
- `useCountUp` — animates a number from 0 to target with cubic easing, triggers on intersection
- `useFocusTrap` — traps keyboard focus within a container (used in modals and mobile menu)
- `useMediaQuery` — subscribes to a CSS media query, SSR-safe
- `useReducedMotion` — returns `prefers-reduced-motion: reduce`, SSR-safe
- `useRouteKey` — identifies the rendered route (layout segments), not the URL; key page transitions and scroll resets on it so shallow `history.pushState` URL changes don't trigger them
- `useScrollProgress` — tracks scroll percentage, sets `--scroll-pct` CSS variable
- `useWorldPreference` — `{ enabled, supported, setEnabled }` for the 3D world: WebGL/Save-Data support plus the visitor's persisted on/off choice (localStorage `world`). Support is a cheap check (no test context is created); `reportWebGLUnavailable()` flips it off when the canvas fails to start
- `useWorldFocus` — listens for clicks on 3D objects that stand for page content (skill badges, experience pods) and scrolls the matching `[data-world-target="skill:<name>"|"role:<index>"]` element into view with a `.world-ping` pulse

### Data Flow

- Content is loaded from `content/content.json` via `utils/serverUtils.ts` (`getPageContent()`)
- Page data is fetched in each `app/**/page.tsx` (server components) and passed as props to child components
- The root layout passes a small serialisable slice of content (`WorldContent` in `components/World/types.ts`: project slugs + up to four images each, tall full-page shots first; skill icons and categories; roles; the tour's captions from `content.json` `tour`) to the 3D world, and a `PaletteData` slice to the command palette
- Project screenshots whose height is more than 1.5× their width are treated as full-page captures (`isFullPage` in `ProjectBody`): the carousel shows them full width in a browser frame (`PageShot`) that pans down on its own (off for reduced motion, paused on hover, stopped for good once the visitor scrolls it) and scrolls by hand (`data-lenis-prevent`)
- `about.recommendations` in `content.json` are quoted verbatim from LinkedIn (`components/Recommendations`); keep the wording exact
- No client-side data fetching for portfolio content
- The contact form submits to `/api/sendmail` (Next.js API route) which sends email via nodemailer
- Project routes: each project in `content.json` has a unique `slug`. `app/projects/[slug]/page.tsx` is statically generated (`dynamicParams = false`). On `/projects`, each project's "View details" is a real link to `/projects/<slug>`; a plain click `history.pushState`s that URL and the modal opens from the pathname (`utils/projectPaths.ts`), so Back closes it and a refresh shows the full page. The modal and page share `components/Projects/ProjectBody`
- `/projects` is a ride down the 3D helix: a runway of scroll (`.projects__tour`, one `--step` of height per project, starting where the sticky stage docks under the header: project i is in front at `docked + step * i`) drives `worldStore.projectFocus` (a fractional index, settled on each project by `settleFocus` in `stations.ts` rather than stopping between two), and the camera rides the helix (`stationCamera`, case `projects`: it orbits down the spiral to face that screen, centred and large) while the helix itself holds still. A sticky stage holds the index (real links to every project page; a plain click scrolls the runway instead) and the HUD (`ProjectHud`): the project in front written round its screen (number, title and stack above, summary and actions below), swapped as the camera moves; nothing else on the page scrolls. At the top of the page the camera holds back on the whole yard beside the page head (`worldStore.projectIntro`, 1 at the top and 0 once the stage docks under the header; `projectIntro()` in `stations.ts`), so the first screen only comes forward, enlarges and lights up as the page scrolls, and its details (`ProjectHud`) stay hidden until the stage docks (`.projects__stage[data-waiting]`); off the page (touring past, flying in) the camera holds back too. Scroll that comes to rest on the ride snaps to the nearest project, or back to the top (Lenis `scrollTo` after `snapAfter` ms of quiet, not while a pointer is down; any scroll input interrupts it); past the last project scrolling is free, and the camera descends with the page (`worldStore.projectTail`, viewport heights scrolled past the last project, turned into a matching drop at the screen's distance), so the last screen scrolls away with its copy rather than sitting under the page nav and footer. Project pages set `worldStore.projectAside` so the camera sits the screen beside the copy instead, further back. With the world off (`html[data-world='off']`) the ride is the same (scroll, snapping and the index all work), but the HUD's middle shows the project's own screenshot, sized to fit the screen's cell, and the first project's details don't wait. Sticky needs no `overflow` other than `clip` on the page's ancestors

### Path Aliases

- `@/*` maps to the project root (configured in `tsconfig.json`)
- `components/*`, `utils/*`, `contexts/*` — directory aliases
- `config` — maps directly to `./config/config.ts`
- `icons` — maps directly to `./icons`
- `scss/*` — maps to `./scss/*`

## Commands

### Development

```sh
npm run dev          # Start Next.js dev server
```

### Building

```sh
npm run build        # Production build (next build)
npm run analyze      # Build with bundle analyzer (ANALYZE=true)
npm run purgecss     # Remove unused CSS from .next output
```

### Linting & Formatting

```sh
npm run lint              # ESLint + Stylelint
npm run lint:fix          # Auto-fix ESLint + Stylelint issues
npm run prettier:check    # Check formatting
npm run prettier:write    # Auto-format all files
npm run typecheck         # TypeScript type checking (tsc --noEmit)
npm run verify            # prettier:check + lint + typecheck (CI script — run before committing)
```

### Testing

```sh
npm run build && npm run test:e2e   # Playwright suite against `next start` on port 3100
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e   # against a running dev server
```

- First run `npx playwright install chromium` (or set `PLAYWRIGHT_CHROMIUM_PATH` to an existing Chromium)
- CI (`.github/workflows/ci.yml`) runs `verify`, `build` and the e2e suite on every pull request
- Projects page tests run with the world off, so they ride the runway with screenshots in place of the helix; the helix itself needs WebGL
- `@webgl` tests run one at a time with a 3-minute budget (software WebGL compiles and draws on the CPU, and two at once starve each other). The tour moves on by itself in real time while every Playwright action is slow, so tests hold it the way a visitor does: the pointer resting on its caption card

## Accessibility

- **WCAG 2.1 Level AA** compliance is a priority
- Use semantic HTML elements (`<section>`, `<nav>`, `<header>`, `<footer>`, `<main>`)
- All sections use `aria-labelledby` pointing to heading IDs
- Interactive elements need `aria-label` when visible text is insufficient
- Decorative icons use `aria-hidden="true"`
- Forms must have proper labels, error messages, and validation
- Support keyboard navigation with visible focus indicators
- Use `.sr-only` class for screen-reader-only text (defined in `globals.scss`)
- Respect `prefers-reduced-motion` media query

## SEO

- Metadata is configured in `app/layout.tsx` (Open Graph, Twitter Cards, robots, etc.)
- JSON-LD structured data schemas: Person, WebSite, ProfilePage; `components/Seo/PageJsonLd` adds each page's WebPage + BreadcrumbList (project pages: ItemPage + CreativeWork)
- Sitemap generated natively via `app/sitemap.ts` (no extra package needed — serves `/sitemap.xml` at runtime), including every project page
- Open Graph: every route has an `opengraph-image.tsx` rendering `app/_og/OgImage.tsx` (station render, title, accent, summary). `pageMetadata()` in `utils/seo.ts` points `og:image` / `twitter:image` at the route's own card. satori can't read WebP/WOFF2, so the renders are PNG copies (`node scripts/generate-og-renders.mjs`) and the fonts are Latin WOFF subsets in `app/_og/fonts`
- Google Analytics via `GoogleAnalyticsDeferred` component (loads after browser idle via `requestIdleCallback`)

## Git Workflow

- **Git Flow** branching model
- Branch from `develop` for features
- Release branches: `release/vx.x.x` (semantic versioning)
- PRs into `develop` deploy to dev environment
- PRs into `main` (squash merge) deploy to production
- After merging to `main`, merge `main` back into `develop`

## Important Notes

- The site requires a Node.js server at runtime (e.g., `next start`, Vercel, or DigitalOcean App Platform) to serve pages and the API route
- Images use the built-in Next.js `<Image>` component with server-side optimization
- The contact form email is handled by `app/api/sendmail/route.ts`. It shares its validation rules and limits with the form (`utils/contactValidation.ts`), caps the body size, silently drops bots (honeypot field + minimum fill time), and rate limits per IP via the in-memory `utils/rateLimit.ts` (per server instance — swap in a shared store if the site is ever scaled out)
- SMTP configuration is provided via environment variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_EMAIL`, `SMTP_PASS`
- The `Contact` component is code-split via `LazyContact.tsx` (dynamic import, SSR kept on for crawlers)
- `ThemeScript` runs as an inline script before hydration to prevent theme flash on page load. When the 3D world will run (not switched off, WebGL API present, no Save-Data, not a crawler) it also sets `html[data-boot='loading']`, which shows the loading screen from first paint
- Loading screen (`components/BootScreen`, state in `components/World/boot.ts`, DOM-safe): on a full page load it covers the page while the world fetches its chunk, downloads models (counted through three's `DefaultLoadingManager`, hooked in `World/downloads.ts` when the chunk loads) and warms up (the warm-up tracker's task counts). `WorldCanvas` reports progress (`reportBoot`) and says when the first view is drawn with nothing loading or warming up (`readyBoot`); the bar fills and the screen lifts (`finishBoot`: `html[data-boot='leaving']`, stars streak past) into the camera's warp in, which `CameraRig` holds until then. Until it lifts the page is `inert`, Lenis is stopped, CSS animations under `#main-content` are paused, and `PageTransition`, `Reveal` / `RevealGroup`, `ScrambleText`, `useCountUp` and other in-view entrances wait (`useBooted()` / `whenBooted()`), so the page's entrance plays as the screen lifts. A skip button appears after a few seconds, and it lifts after 20s regardless. Without the world it never shows and `useBooted()` is true once hydrated. Nor does it show within 30 minutes of the world last loading (`bootMemory.ts`: `World` notes the time once the canvas is ready, `ThemeScript` reads it), since everything is cached by then
- Sound (`components/Sound/sound.ts`): off by default; `SoundToggle` in the header and a command palette entry turn it on, and the choice is remembered (localStorage `sound`; a returning visitor's sound starts on their first click or key press, as browsers require a gesture). Everything is synthesised with Web Audio, no files: a low drone and noise bed, a rush of filtered noise that follows `worldStore.velocity`, and cues the world emits through `emitCue()` in `worldStore.ts` (HUD blips, autopilot, docking clamps, signals found, the rocket, the comms array transmitting). It suspends while the tab is hidden
- Brand mark (`components/BrandMark`): the LH orbital monogram. `markGeometry.ts` is the one source for its geometry (letters and their outlines, tilted ring, station slots) and `brandMarkSvg()` draws it as a standalone SVG for the Open Graph cards and icons; regenerate `app/icon.svg`, `icon.png`, `apple-icon.png` and `favicon.ico` with `node scripts/generate-brand-icons.mjs` after changing it. `markMotion.ts` is how it moves, shared by both live versions: the moon orbits the ring all the time (faster, with a trail, during camera flights, free roam and hovers) and a notch on the ring marks the docked station (Home at the ring's left end, the rest along its front), sliding to the next in step with a flight; reduced motion holds the moon at the notch. The header's `HeaderMark` shows the SVG (`BrandMark.tsx`: depth by drawing order, front to back the ring's near half cutting a gap where it crosses the letters, the letters, the far half) and, once the 3D world is ready (so three.js is loaded and WebGL works), cross-fades to the WebGL model (`BrandMark3D.tsx`: extruded, bevelled letters and a torus ring inclined to match the SVG's ellipse, lit with a local `RoomEnvironment`, swaying slowly and leaning towards the pointer on hover), in its own small transparent canvas. It stays the SVG with 3D effects off, without WebGL or for reduced motion. With `orbit` (the loading screen) the SVG's moon circles on its own via SMIL, so it moves before hydration
- Mobile menu (`components/MobileMenu`, opened by the header's menu button on narrow screens): rendered beside the header, under it (z-index 49), so the bar and its close button stay on top. With 3D effects on, `MenuWarp` draws a starfield with one full-screen shader in plain WebGL (no three.js; its context starts the first time the menu opens): stars streak out from the middle as it opens, slow to a drift through a violet and cyan nebula, and spool back up as it closes; the links swing up out of the depth one by one, each with the craft its page is docked at. Without WebGL or with 3D effects off, a gradient; reduced motion gets one still frame and a fade. Keep it opaque and free of `backdrop-filter` and `clip-path` animation: blurring the live WebGL page behind it every frame is what made the old menu glitch on Android (the header bar drops its blur while the menu is open for the same reason). Lenis stops while it is open
- Station readout (`components/StationReadout`): under each `PageHead` eyebrow (and beside the home hero's badge), the craft the page is docked at and its distance from Home, live from the camera while the world runs

## 3D World (`components/World`)

- `World.tsx` (DOM side, in the root layout) decides whether to render: it sets `html[data-world='on'|'off']` (off for no WebGL / Save-Data / the header's `WorldToggle`, via `useWorldPreference`; `ThemeScript` applies a saved "off" before hydration), feeds scroll + pointer into `worldStore`, and lazy-loads `WorldCanvas` on `requestIdleCallback` so three.js never blocks first paint. An error boundary around the canvas is the real WebGL test: if the renderer can't start it reports the world unsupported. Switching the world off unmounts the canvas. Hovering/focusing an internal link prefetches that station's model and hull (`prefetchStationModel` in `routes.ts`). It also mounts the DOM overlays: `NavRadar` (a 3D, to-scale sector map during flights: stations on height stalks over a grid, the real flight curve, the camera, a scale bar and the distance left), `WorldTooltip`, `TourOverlay` and `ExploreHud`
- DOM-safe modules: `routes.ts` (station positions, paths, names, hull URLs), `worldStore.ts` (pointer, scroll, camera, flight / dock events, hover + tooltip, page links) and `worldMode.ts` import nothing from three.js, so the header, palette and overlays can use them without pulling the 3D bundle
- `WorldCanvas.tsx` is the single `<Canvas>`: `Lighting` (a shadow-casting sun that follows the current station, hemisphere fill, violet bounce), the deep sky (`Nebula`, `Starfield` + `BrightStars`, `Landmarks`: planet, moon, sun flare; `Asteroids`; `Dust`; directions and placement in `sky.ts`), stations, `Beacons` (glow + label for every station) and `Effects` (bloom, velocity-driven chromatic aberration, vignette). `QualityGovernor` mounts a drei `PerformanceMonitor` to move between quality tiers (`quality.ts`: DPR + which post-processing passes run), but only while nothing is warming up and the camera isn't flying, so loading work never reads as a slow device; lite (touch / narrow) devices top out at medium, and the current tier is exposed as `html[data-world-tier]`. `Effects` runs the same passes on every tier, so a tier change never rebuilds the composer, recompiles a shader or shifts the exposure (a tier that dropped bloom read as the whole world flickering between bright and dim); tiers differ in cost only: pixel ratio, bloom's internal resolution (a quarter on low, set through the effect) and aberration held at zero below high. Project screens are displays, not lamps: their shader scales content so white lands at `screenWhite` (per theme), under the bloom threshold (`palettes.bloomThreshold`: 0.6 dark, 0.85 light), so pages read without blooming, after a gentle curve (power 1.15) that deepens mid-tones and text so the dimmed page doesn't look washed out (keep anything that multiplies the colour afterwards, like hover, from pushing white over the threshold); the screen in front (`uFocus`) is solid with faint scanlines; the screen in front swaps in a 1200px copy of its shot once the camera has settled on it (`ScreenShots.sharpen`), dropped again when the camera moves on. Shots are fetched and decoded in a worker (`imageDecoder.ts`: `createImageBitmap`, scaled to 640 or 1200 wide and flipped there, never on the main thread) and uploaded one per frame (`queueUpload`): don't count on `/_next/image` to resize them, it can hand back the full-size original (up to 3024×8206), and uploading those stalled the first flight to the station for over a second. Shadows are decided once (off on lite devices): toggling them later would recompile every lit material
- Deep sky: `Nebula` bakes the sky once, in strips over several frames, into a half-float equirectangular texture (3072×1536 on desktop, 1024 on lite devices); the dome samples it with a cubic filter and adds fine star grain at screen resolution where the bake's alpha says (a small repeating noise texture, two taps). The Milky Way is built in its own frame (`sky.ts`: `galacticNormal`, `galacticCentre`, `galacticEast`): a thin disc with faint wings, thicker and brighter towards the bulge, textured by star clouds and cut by filamentary dust lanes that absorb and redden what is behind them; noise for anything in the band is sampled with the across-plane axis stretched so features run along it. Nebulae are local: `sky.ts` `nebulae` lists the star-forming complexes (direction, radius, hydrogen-pink vs oxygen-teal) strung along the plane, one placed behind the stations for the pages' backdrop; each has a ragged outline, billowy gas with filaments, dust pillars in silhouette and a lit core. Keep the band's peak below the bloom threshold (`palettes.bloomThreshold`): above it bloom smears the whole band into a halo of fog. The same bake is filtered (PMREM) into `scene.environment`, so hulls reflect the sky they sit in. A same-sized placeholder environment is installed first so materials compile against the final shader variant
- Warm-up (`warmup.tsx`): WebGL compiles a shader on first draw and blocks the main thread, so nothing new is drawn before its shaders are compiled with `renderer.compileAsync` (parallel compile) and its textures uploaded one per frame. The canvas stays paused (`frameloop='never'`) and hidden until `WarmupGate` reports the initial scene warm; each station is wrapped in `<Precompiled>` (hidden until compiled), `<Model>` shows its placeholder (`HoloCore` by default) until the GLB is compiled and uploaded, and the composer's passes are precompiled via `precompileComposer`. Register new async GPU work (bakes, uploads) with `useWarmupTask()`. Textures that can arrive together go through `queueUpload()`, which uploads one per frame. Shader-error checks (`gl.debug.checkShaderErrors`) are off in production — they cost a GPU round trip per shader
- Camera: `stations.ts` maps routes to station positions (`stationForPath`) and defines each station's camera pose for page scroll (`stationCamera`). On narrow (stacked) layouts `stationFraming` pulls the camera back until the station's framing box fits the screen width and the stage slot above the copy (`.hero__stage` / `.page-head__stage` — keep `slotTop` / `slotHeight` in step with them); objects that follow the camera use `framedHeight`. `CameraRig.tsx` flies between stations along a planned path (`flight.ts`, built on three's curves). Every station is framed looking the same way (-Z), so a flight is one of two manoeuvres. Ahead (the destination is roughly the way the camera faces): a cubic Bézier that climbs as it leaves, arcs over any station in the way and settles onto the destination's pose; the rotation is planned (`flightRotation`), the start view blending into the destination's with a lean into the direction of travel. About-turn (the destination is behind): one sweeping cubic arc (`planAbout`) that bows out to the side the camera is coming from, passes the station on that side and curls round onto its front, coming in level with the pose from `curlOut` to the side. The camera turns to face the station as it pulls away (`departTurn`, the opposite way to how the arc later rounds it) and then follows the station's bearing (eased by `bearingFollow`, unwrapped frame to frame), so rounding the station turns the view back the other way onto its front: two opposite half turns, never a full spin, with the station in frame from the end of the first turn to arrival (it trails the bearing by at most ~11°). Timings are in seconds (`departTime`, `roundTime`); the speed profile builds slowly through the first turn and `planBrake` solves when to brake so about `roundReach` of the path is left, and slow, as the arc starts rounding the station. Peak turn rate across all about-turns is ~125 deg/s. Following a bearing is safe here only because the brake keeps the camera slow when it is close; anything that aims at a point should be eased and checked. Never aim the camera at a point on its own path or at fixed points from its moving position without a rate limit: that is what used to wobble and flip it round. When changing any of this, simulate every pair of stations (all 30 flights) for turn rate, total rotation and clearance, not just the one that looked wrong; the camera banks into heading changes in both manoeuvres. It emits flight events (`onFlight`: start / approach / end; about-turns are on approach as the arc starts rounding the station), publishes the path for `NavRadar` and writes camera speed to `worldStore.velocity` (FOV kick / aberration / star stretch). A flight to a new page is planned to the top of that page: the rig's eased scroll restarts at 0 rather than easing out from the last page's (which the store can still hold for a frame), or leaving the bottom of a long page aims the flight far below the station until it corrects at the end; switching between the page, tour and free roam keeps the page's scroll. `PageTransition` holds the new page's copy until the camera is on approach, so text arrives with the camera
- Stations (`stations/*.tsx`) mount on first visit and stay mounted; each hides itself when the camera is far away (`stationInRange`). Each hosts a bespoke hull (`StationHull`: Higgsfield image-to-3D craft, `hd` on desktop, `sd` on lite devices) next to its hero model, plus code-built parts (`parts.tsx`: solar arrays, trusses, antennas, habitat ring, nav lights). Hulls turn slowly with their parts (`Spin`; the contact dish sweeps instead, as its data link leaves from a fixed point), and stay still for reduced motion. The experience hull appears once, beside the pulsing beam; the role nodes on the beam are the click targets. `hull.ts` derives a glow from each hull's colour texture (lit windows, accent strips) so bloom picks it up
- Interaction: R3F listens on `document.body` (`eventSource`, `eventPrefix="client"`) through `worldEvents` (`interaction.ts`), which only raycasts where the pointer is over open space, never page content. Hovering something interactive sets `html[data-world-hover]` (the cursor ring reads it) and can show a `worldTip` label (`WorldTooltip`). The astronaut and the helmet track the pointer, lean in on hover and do a trick on click (`reaction.ts`); the contact globe drag-spins (and holds text selection off for the drag: the press lands on the page too); skill badges and experience pods call `focusOnPage()` (see `useWorldFocus`); project screens call `navigateTo()` to open the project. Project screens are "living": they cycle a project's screenshots and slowly scroll tall full-page captures
- Modes (`worldMode.ts`, `page` / `tour` / `explore`): `html[data-world-mode]` hides the page and `World` makes `#main-content`, the header and footer `inert`. The guided tour (`TourOverlay`) flies stop to stop with captions from `content.json` `tour`, lingers 6.5s after the camera lands, and holds while the pointer is over its card or a control in it has keyboard focus; it warms the next stop's station while it lingers. Explore mode (`ExploreControls` + `ExploreHud`) hands the camera to the visitor: WASD / arrows, Space / C, Shift to boost. With a mouse the pointer is locked (`pointerLock.ts`; requested inside the click or key press that starts free roam, since the lock needs a user gesture): the cursor stays put and every movement turns the view at once. Esc is the browser's to free the mouse (the HUD then says "Click to steer"; a click on open space locks it again); an Esc that reaches the page leaves free roam. Where the pointer can't be locked, where the mouse rests keeps the view turning (dead zone at the centre). Touch gets twin thumbsticks (`TouchSticks` in `ExploreHud`): a thumb on the left half of the screen gets a move stick under it (pushed on out to its dashed boost ring, boost; a ring follows the thumb out from the rim so you can see how far is left), one on the right half a look stick that keeps turning the view while held off-centre (`exploreInput.stickX/Y`, its own gentler rates and a squared response in `ExploreControls`), plus rise / sink buttons. Boosting while thrusting (Shift, or the move stick) fires a rocket jet under the middle of the view (`BoostJet`), on desktop and touch alike. Their layer has `touch-action: none`, so the browser never takes a drag for a scroll and cancels it; it lies over the station markers (a thumb landing on one still gets its stick, and a quick tap is passed on to the marker) and under the rest of the HUD. On touch, the sector map moves above the move stick, or hides where there's no room, and on upright phones the autopilot status and dock prompt move under the top bar Finding your way: the fog draws back (`reachOut`, and `setViewRange` keeps distant stations drawn) so the whole line of stations stays in sight, beacons burn bigger and brighter, and `Waypoints` marks every station with its number and distance (projected each frame into `worldStore.waypoints`; off-screen ones ride the screen edge with an arrow, and overlapping markers spread apart). Number keys 0-5 or a click on a marker set the autopilot (`setAutopilot`), which turns, flies, rounds the station's side if coming from behind and parks facing its front; any flight input takes the controls back. Hulls push back; within docking range a prompt docks: a short docking sequence (`setDocking` / `worldStore.docking`: clamps close in, a light sweeps, the camera coasts to a stop facing the station; skipped for reduced motion), then that page opens. Hidden signals (`signalStore.ts` for the data and what has been found, localStorage `signals`; `Signals.tsx` draws them; `SignalsHud.tsx`): a probe, a supply capsule (the CV), an open-source relay (the repo), a comet on a slow orbit and the 404 derelict (`LostStation`, mounted for free roam), off the line of stations with a faint amber glow in free roam only. Flying within reach finds one; the HUD counts them, a detector warms up near an unfound one, and a card shows what it says and carries (page actions go through the docking sequence). Its stations, the derelict and the signals mount one at a time from the first free roam. Start either with `launchWorldMode()`, which switches the world on first if needed; `RoamButton` (bottom right) toggles free roam on every page
- Materials: build station materials with a module-level factory + `useThemedMaterials(factory, theme)`; mutate uniforms per frame only through helpers like `setUniform()` (the React Compiler lint rules forbid mutating hook return values in components; per-frame state lives in plain objects or classes changed through module-level functions). Additive glow materials are tagged with `asGlow()` so light mode can switch them to normal blending
- Models are GLBs in `public/static/models` loaded via `<Model>` (three's `GLTFLoader` with meshopt and KTX2 via the self-hosted Basis transcoder in `public/static/basis`; **no Draco** — it would fetch a decoder from a CDN). A missing/failed model falls back to a procedural `HoloCore`. Station hulls live in `public/static/models/stations/{hd,sd}/<station>.glb`, built from the raw image-to-3D exports with `node scripts/optimize-stations.mjs <raw-dir>` (simplify + meshopt; KTX2 textures: ETC1S colour / ORM, UASTC normals)
- `prefers-reduced-motion`: the canvas renders on demand and the camera snaps instead of flying
- The contact form sets `setTransmitting()` while it sends — the comms array streams packets in an arc over the globe to the Peterborough pin — and calls `requestLaunch()` after a successful send: the rocket on `/contact` launches (so does `sudo hire lewis` in the command palette). Both hold the camera on the globe for a few seconds (`worldStore.showcaseUntil`) instead of following the page down to the form, so they are seen
- `/experience` is a mission log: the page writes which role's card is at the reading line (`worldStore.roleFocus`, fractional), the camera rides down the beam to that role's pod (`stationCamera`) and the pod lights; each card wears a `MissionPatch` (decorative SVG: mission number, company, monogram)
- `StatsProbe` publishes renderer stats (draw calls, triangles, programs, canvas size) to `worldStore.stats` for the stats overlay
- Regenerate the site icons from the brand mark with `node scripts/generate-brand-icons.mjs`
- Regenerate the globe's land dots with `node scripts/generate-globe-points.mjs` and the contact page's dotted map (`components/Contact/LocationMap/mapData.json`) with `node scripts/generate-map-points.mjs`; regenerate the icon bundle with `node scripts/generate-iconify-bundle.mjs` (reads local `@iconify-json/*` packages first, then the Iconify API)
