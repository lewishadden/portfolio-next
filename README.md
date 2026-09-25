# Portfolio Next.js

This repo contains the code for my online web portfolio. It is built using [Next.js](https://nextjs.org/) (v16).

## Setup local development

### Pre-requisites

- Ensure you are running Node 24 (`v24.13.1`, see `.nvmrc`). If you have NVM installed, you can simply run `nvm use`
- Copy `.env.SAMPLE` to `.env` and configure your environment variables

### Install project dependencies

- Run `npm install`

### Run the development server

- Run `npm run dev` to start the dev server.
- Make any required code changes. The dev server watches for changes and rebuilds in real-time.

## Design & 3D world

The site uses the "Orbit" design (dark sci-fi glow with a light "daylight lab" theme) — see
`docs/superpowers/specs/2026-09-24-orbit-redesign.md`.

A single persistent WebGL canvas (three.js + React Three Fiber, `components/World`) sits behind every
page. Each route is a station in space; navigating flies the camera between them and page scroll moves
it within a station. The canvas is lazy-loaded after first paint, renders on demand for
`prefers-reduced-motion`, and is skipped entirely (2D station renders only) without WebGL, with
Save-Data, or when the visitor switches it off with the cube button in the header (remembered).

- **Quality tiers** — a `PerformanceMonitor` steps the world between high / medium / low (pixel ratio
  and post-processing) as the frame rate allows. Phones and touch devices start at medium.
- **Model prefetch** — hovering or focusing a link starts downloading the next station's model.
- **Projects** — every project has its own page at `/projects/<slug>`. From the grid, a card opens
  in a modal at that same URL (Back closes it; a refresh shows the full page), and the 3D helix turns
  that project's screen to the camera.

### 3D models

The station models (`public/static/models/*.glb`) were generated with Higgsfield (image → 3D).
To replace or re-optimise them, export raw GLBs with the same file names into a folder and run:

```sh
node scripts/optimize-models.mjs path/to/raw-glbs
```

This applies meshopt compression and 1024px WebP textures. A missing model degrades to a procedural
hologram, so the site never breaks on a failed download.

### Generated data

- `node scripts/generate-iconify-bundle.mjs` — offline icon bundle (run after adding icon names;
  dev builds warn in the console about any icon missing from it)
- `node scripts/generate-globe-points.mjs` — land dots for the contact-page globe
- `node scripts/generate-og-renders.mjs` — PNG copies of the station renders for the Open Graph
  images (`app/_og`); every route has an `opengraph-image.tsx` built on the shared `app/_og/OgImage.tsx`

### Contact form

`app/api/sendmail/route.ts` validates the payload with the same rules as the form
(`utils/contactValidation.ts`), caps the body size, drops bots (hidden honeypot field + minimum fill
time) with a fake success, and rate limits each IP to 5 messages per 10 minutes. The limiter is
in-memory, so it is per server instance and resets on deploy — enough for a single Node server; use a
shared store (e.g. Redis) if the site ever runs on several instances. SMTP settings come from
`SMTP_HOST`, `SMTP_PORT`, `SMTP_EMAIL` and `SMTP_PASS`.

## Contributing

### Add a new feature

- Create a new branch from `develop` following the Git Flow branching convention
- Make any code changes following Next.js best practices.
- Add or update end-to-end tests in `tests/e2e`
- Run `npm run verify` and `npm run test:e2e` before opening a pull request (CI runs both)

### Deploying the Static Web App to Development Env

- Create a pull request from your branch back into `develop`
- Once the changes have been approved, merge the pull request
- The `develop` pipeline will trigger, deploying to the DigitalOcean project `portfolio-dev`

### Deploying the Static Web App to Production Env

- Create a new release branch from develop in the format `release/vx.x.x` (Use semantic versioning for the new release version)
- Bump the package.json version to the new release version
- Create a pull request from your release branch into `main`
- Once the changes have been approved, merge the pull request as a squash merge
- The `production` pipeline will trigger, deploying to the DigitalOcean project `portfolio`
- Lastly, create a pull request from `main` back into `develop` and merge.

## npm scripts

### Build and dev scripts

- `dev` – start Next.js dev server
- `build` – production build (`next build`)
- `start` – serve the production build (`next start`; the site needs a Node server for the contact API)
- `analyze` – analyzes application bundle with [@next/bundle-analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
- `purgecss` – removes unused CSS from the `.next` output

### Testing scripts

- `verify` – full check suite: prettier:check + lint + typecheck
- `test:e2e` – Playwright end-to-end suite (accessibility, project routes, 3D fallbacks, contact API,
  SEO). Runs against a production build: `npm run build && npm run test:e2e` starts `next start` on
  port 3100 for you. First run `npx playwright install chromium`; set `PLAYWRIGHT_BASE_URL` to test an
  already running server, or `PLAYWRIGHT_CHROMIUM_PATH` to use an existing Chromium
- `typecheck` – checks TypeScript types
- `lint` – runs ESLint + Stylelint
- `prettier:check` – checks files with Prettier

### Other scripts

- `prettier:write` – formats all files with Prettier
- `lint:fix` – auto-fix ESLint + Stylelint issues
