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
  World/          # Persistent WebGL world: canvas, camera rig, stations, shaders, post-processing
  Motion/         # Shared animation primitives (Reveal, SplitText, ScrambleText)
config/           # App configuration (GitHub URL)
content/          # Static content (content.json — the single data source)
contexts/         # React contexts (ThemeContext)
hooks/            # Custom React hooks (useWorldPreference, useRouteKey, useFocusTrap, etc.)
icons/            # Custom SVG icon components
public/           # Static assets served at root (3D models in public/static/models)
types/            # TypeScript type definitions (index.d.ts)
utils/            # Utility functions (serverUtils.ts, seo.ts, contactValidation.ts, rateLimit.ts, projectPaths.ts)
scripts/          # Generators (icon bundle, globe land points, OG renders, model optimisation, IndexNow)
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
- `useWorldPreference` — `{ enabled, supported, setEnabled }` for the 3D world: WebGL/Save-Data support plus the visitor's persisted on/off choice (localStorage `world`)

### Data Flow

- Content is loaded from `content/content.json` via `utils/serverUtils.ts` (`getPageContent()`)
- Page data is fetched in each `app/**/page.tsx` (server components) and passed as props to child components
- The root layout passes a small serialisable slice of content (`WorldContent`: project images, skill icons, experience count) to the 3D world
- No client-side data fetching for portfolio content
- The contact form submits to `/api/sendmail` (Next.js API route) which sends email via nodemailer
- Project routes: each project in `content.json` has a unique `slug`. `app/projects/[slug]/page.tsx` is statically generated (`dynamicParams = false`). On the grid, a card is a real link to `/projects/<slug>`; a plain click `history.pushState`s that URL and the modal opens from the pathname (`utils/projectPaths.ts`), so Back closes it and a refresh shows the full page. The modal and page share `components/Projects/ProjectBody`

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

- `World.tsx` (DOM side, in the root layout) decides whether to render: it sets `html[data-world='on'|'off']` (off for no WebGL / Save-Data / the header's `WorldToggle`, via `useWorldPreference`; `ThemeScript` applies a saved "off" before hydration), feeds scroll + pointer into `worldStore`, and lazy-loads `WorldCanvas` on `requestIdleCallback` so three.js never blocks first paint. Switching the world off unmounts the canvas. Hovering/focusing an internal link prefetches that station's model (`prefetchStationModel` in `routes.ts`)
- `WorldCanvas.tsx` is the single `<Canvas>`: lighting, local `Environment` lightformers (no HDR downloads), nebula, starfield, dust, stations and `Effects` (bloom, velocity-driven chromatic aberration, vignette). A drei `PerformanceMonitor` moves between quality tiers (`quality.ts`: DPR + which post-processing passes run); lite (touch / narrow) devices top out at medium, and the current tier is exposed as `html[data-world-tier]`
- On `/projects/<slug>` (page or modal) `World` passes the project's index as `focusProject`; `ProjectsStation` turns the helix to bring that screen in front of the camera, enlarges it and dims the rest
- `stations.ts` maps routes to station positions (`stationForPath`) and defines each station's camera pose for page scroll (`stationCamera`). `CameraRig.tsx` flies between stations and writes camera speed to `worldStore.velocity` (drives FOV kick / aberration / star stretch)
- Stations (`stations/*.tsx`) mount on first visit and stay mounted; each hides itself when the camera is far away (`stationInRange`)
- Materials: build station materials with a module-level factory + `useThemedMaterials(factory, theme)`; mutate uniforms per frame only through helpers like `setUniform()` (the React Compiler lint rules forbid mutating hook return values in components). Additive glow materials are tagged with `asGlow()` so light mode can switch them to normal blending
- Models are GLBs in `public/static/models` loaded via `<Model>` (meshopt supported, **no Draco** — it would fetch a decoder from a CDN). A missing/failed model falls back to a procedural `HoloCore`
- `prefers-reduced-motion`: the canvas renders on demand and the camera snaps instead of flying
- The contact form calls `requestLaunch()` from `worldStore` after a successful send — the rocket on `/contact` launches
- Regenerate the globe's land dots with `node scripts/generate-globe-points.mjs`; regenerate the icon bundle with `node scripts/generate-iconify-bundle.mjs` (reads local `@iconify-json/*` packages first, then the Iconify API)
