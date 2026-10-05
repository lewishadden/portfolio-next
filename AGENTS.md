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
- `/projects` is a walk round the 3D helix, not a grid: every project is a step (`.proj-step`), and the page writes which one the middle of the viewport is on, as a fractional index, to `worldStore.projectFocus`; `ProjectsStation` turns and raises the helix to bring that screen to the front (settling on each project rather than stopping between two). A sticky index (`Jump to a project`) scrolls to any step. With the world off (`html[data-world='off']`) the same steps become a plain list showing each project's own screenshot

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
- Projects page tests run with the world off, so they exercise the plain-list layout and the index; the helix itself needs WebGL
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
- `ThemeScript` runs as an inline script before hydration to prevent theme flash on page load

## 3D World (`components/World`)

- `World.tsx` (DOM side, in the root layout) decides whether to render: it sets `html[data-world='on'|'off']` (off for no WebGL / Save-Data / the header's `WorldToggle`, via `useWorldPreference`; `ThemeScript` applies a saved "off" before hydration), feeds scroll + pointer into `worldStore`, and lazy-loads `WorldCanvas` on `requestIdleCallback` so three.js never blocks first paint. An error boundary around the canvas is the real WebGL test: if the renderer can't start it reports the world unsupported. Switching the world off unmounts the canvas. Hovering/focusing an internal link prefetches that station's model and hull (`prefetchStationModel` in `routes.ts`). It also mounts the DOM overlays: `NavRadar` (a 3D, to-scale sector map during flights: stations on height stalks over a grid, the real flight curve, the camera, a scale bar and the distance left), `WorldTooltip`, `TourOverlay` and `ExploreHud`
- DOM-safe modules: `routes.ts` (station positions, paths, names, hull URLs), `worldStore.ts` (pointer, scroll, camera, flight / dock events, hover + tooltip, page links) and `worldMode.ts` import nothing from three.js, so the header, palette and overlays can use them without pulling the 3D bundle
- `WorldCanvas.tsx` is the single `<Canvas>`: `Lighting` (a shadow-casting sun that follows the current station, hemisphere fill, violet bounce), the deep sky (`Nebula`, `Starfield` + `BrightStars`, `Landmarks`: planet, moon, sun flare; `Asteroids`; `Dust`; directions and placement in `sky.ts`), stations, `Beacons` (glow + label for every station) and `Effects` (bloom, velocity-driven chromatic aberration, vignette). `QualityGovernor` mounts a drei `PerformanceMonitor` to move between quality tiers (`quality.ts`: DPR + which post-processing passes run), but only while nothing is warming up and the camera isn't flying, so loading work never reads as a slow device; lite (touch / narrow) devices top out at medium, and the current tier is exposed as `html[data-world-tier]`. `Effects` keeps one `EffectComposer` for every tier (low just drops bloom) with identical Bloom args, so a tier change never recompiles the scene's shaders. Shadows are decided once (off on lite devices): toggling them later would recompile every lit material
- Deep sky: `Nebula` bakes the sky once, in strips over several frames, into a half-float equirectangular texture (3072×1536 on desktop, 1024 on lite devices); the dome samples it with a cubic filter and adds fine star grain at screen resolution where the bake's alpha says (a small repeating noise texture, two taps). The Milky Way is built in its own frame (`sky.ts`: `galacticNormal`, `galacticCentre`, `galacticEast`): a thin disc with faint wings, thicker and brighter towards the bulge, textured by star clouds and cut by filamentary dust lanes that absorb and redden what is behind them; noise for anything in the band is sampled with the across-plane axis stretched so features run along it. Nebulae are local: `sky.ts` `nebulae` lists the star-forming complexes (direction, radius, hydrogen-pink vs oxygen-teal) strung along the plane, one placed behind the stations for the pages' backdrop; each has a ragged outline, billowy gas with filaments, dust pillars in silhouette and a lit core. Keep the band's peak below the bloom threshold (`palettes.bloomThreshold`): above it bloom smears the whole band into a halo of fog. The same bake is filtered (PMREM) into `scene.environment`, so hulls reflect the sky they sit in. A same-sized placeholder environment is installed first so materials compile against the final shader variant
- Warm-up (`warmup.tsx`): WebGL compiles a shader on first draw and blocks the main thread, so nothing new is drawn before its shaders are compiled with `renderer.compileAsync` (parallel compile) and its textures uploaded one per frame. The canvas stays paused (`frameloop='never'`) and hidden until `WarmupGate` reports the initial scene warm; each station is wrapped in `<Precompiled>` (hidden until compiled), `<Model>` shows its placeholder (`HoloCore` by default) until the GLB is compiled and uploaded, and the composer's passes are precompiled via `precompileComposer`. Register new async GPU work (bakes, uploads) with `useWarmupTask()`. Shader-error checks (`gl.debug.checkShaderErrors`) are off in production — they cost a GPU round trip per shader
- Camera: `stations.ts` maps routes to station positions (`stationForPath`) and defines each station's camera pose for page scroll (`stationCamera`). On narrow (stacked) layouts `stationFraming` pulls the camera back until the station's framing box fits the screen width and the stage slot above the copy (`.hero__stage` / `.page-head__stage` — keep `slotTop` / `slotHeight` in step with them); objects that follow the camera use `framedHeight`. `CameraRig.tsx` flies between stations along a planned path (`flight.ts`: a cubic Bézier that climbs as it leaves, arcs over any station in the way and settles onto the destination's pose, walked at constant speed with smootherstep easing). The rotation is planned too (`flightRotation`): the start view blends into the destination's, leaning a little into the direction of travel when that is roughly ahead, and the camera banks into heading changes. Never aim the camera at points from its moving position mid-flight: that is what used to wobble and flip it round. Every station is framed looking the same way (-Z), so flights back towards Home pull back without turning round; when changing either, check every pair of stations (all 30 flights) for turn rate, total rotation and clearance, not just the one that looked wrong. It emits flight events (`onFlight`: start / approach / end), publishes the path for `NavRadar` and writes camera speed to `worldStore.velocity` (FOV kick / aberration / star stretch). `PageTransition` holds the new page's copy until the camera is on approach, so text arrives with the camera
- Stations (`stations/*.tsx`) mount on first visit and stay mounted; each hides itself when the camera is far away (`stationInRange`). Each hosts a bespoke hull (`StationHull`: Higgsfield image-to-3D craft, `hd` on desktop, `sd` on lite devices) next to its hero model, plus code-built parts (`parts.tsx`: solar arrays, trusses, antennas, habitat ring, nav lights). Hulls turn slowly with their parts (`Spin`; the contact dish sweeps instead, as its data link leaves from a fixed point), and stay still for reduced motion. The experience hull appears once, beside the pulsing beam; the role nodes on the beam are the click targets. `hull.ts` derives a glow from each hull's colour texture (lit windows, accent strips) so bloom picks it up
- Interaction: R3F listens on `document.body` (`eventSource`, `eventPrefix="client"`) through `worldEvents` (`interaction.ts`), which only raycasts where the pointer is over open space, never page content. Hovering something interactive sets `html[data-world-hover]` (the cursor ring reads it) and can show a `worldTip` label (`WorldTooltip`). The astronaut and the helmet track the pointer, lean in on hover and do a trick on click (`reaction.ts`); the contact globe drag-spins (and holds text selection off for the drag: the press lands on the page too); skill badges and experience pods call `focusOnPage()` (see `useWorldFocus`); project screens call `navigateTo()` to open the project. Project screens are "living": they cycle a project's screenshots and slowly scroll tall full-page captures
- Modes (`worldMode.ts`, `page` / `tour` / `explore`): `html[data-world-mode]` hides the page and `World` makes `#main-content`, the header and footer `inert`. The guided tour (`TourOverlay`) flies stop to stop with captions from `content.json` `tour`, lingers 6.5s after the camera lands, and holds while the pointer is over its card or a control in it has keyboard focus; it warms the next stop's station while it lingers. Explore mode (`ExploreControls` + `ExploreHud`) hands the camera to the visitor: WASD / arrows, Space / C, Shift to boost; the mouse steers by where it rests (a dead zone at the centre, shown by the HUD's reticle; hovering HUD controls holds course), while touch drags the view and gets a flight pad; hulls push back; within docking range a prompt docks (opens that page). Its stations mount one at a time. Start either with `launchWorldMode()`, which switches the world on first if needed; `RoamButton` (bottom right) toggles free roam on every page
- Materials: build station materials with a module-level factory + `useThemedMaterials(factory, theme)`; mutate uniforms per frame only through helpers like `setUniform()` (the React Compiler lint rules forbid mutating hook return values in components; per-frame state lives in plain objects or classes changed through module-level functions). Additive glow materials are tagged with `asGlow()` so light mode can switch them to normal blending
- Models are GLBs in `public/static/models` loaded via `<Model>` (three's `GLTFLoader` with meshopt and KTX2 via the self-hosted Basis transcoder in `public/static/basis`; **no Draco** — it would fetch a decoder from a CDN). A missing/failed model falls back to a procedural `HoloCore`. Station hulls live in `public/static/models/stations/{hd,sd}/<station>.glb`, built from the raw image-to-3D exports with `node scripts/optimize-stations.mjs <raw-dir>` (simplify + meshopt; KTX2 textures: ETC1S colour / ORM, UASTC normals)
- `prefers-reduced-motion`: the canvas renders on demand and the camera snaps instead of flying
- The contact form calls `requestLaunch()` from `worldStore` after a successful send — the rocket on `/contact` launches (so does `sudo hire lewis` in the command palette)
- `StatsProbe` publishes renderer stats (draw calls, triangles, programs, canvas size) to `worldStore.stats` for the stats overlay
- Regenerate the globe's land dots with `node scripts/generate-globe-points.mjs` and the contact page's dotted map (`components/Contact/LocationMap/mapData.json`) with `node scripts/generate-map-points.mjs`; regenerate the icon bundle with `node scripts/generate-iconify-bundle.mjs` (reads local `@iconify-json/*` packages first, then the Iconify API)
