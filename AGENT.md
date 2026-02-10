# AGENT.md

## Project Overview

This is a **Next.js portfolio website** using the App Router with Static Site Generation (SSG). It is a single-page application with hash-based navigation across sections (Home, About, Experience, Projects, Skills, Contact). The site supports dark/light theme switching and targets WCAG 2.1 AA accessibility.

## Tech Stack

- **Framework:** Next.js 16 (App Router, `output: 'export'` for static builds)
- **Language:** TypeScript (strict mode)
- **Runtime:** Node.js 25.4.0 (see `.nvmrc`)
- **Package Manager:** npm
- **Styling:** SCSS/Sass, Bootstrap 5 + React Bootstrap, Mantine UI, CSS Modules (selective)
- **Testing:** Jest + React Testing Library
- **Linting:** ESLint (Airbnb + Mantine + Next.js configs), Stylelint (standard-scss), Prettier
- **Other:** Formik + Yup (forms), react-awesome-slider, react-type-animation, @iconify/react

## Getting Started

```bash
nvm use              # Switch to the correct Node version
npm install          # Install dependencies
cp .env.SAMPLE .env  # Set up environment variables
npm run dev          # Start development server
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build (Next.js + image optimization + PurgeCSS + sitemap) |
| `npm run start` | Serve the static export (`out/`) |
| `npm run test` | Full test suite (prettier + lint + typecheck + jest) |
| `npm run jest` | Run Jest tests only |
| `npm run jest:watch` | Jest in watch mode |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `npm run lint` | ESLint + Stylelint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run prettier:check` | Check formatting |
| `npm run prettier:write` | Auto-format with Prettier |
| `npm run analyze` | Bundle analysis |

## Project Structure

```
├── app/                  # Next.js App Router (layout, pages, global styles)
├── api/                  # Backend APIs
│   ├── express/          # Express.js server (Docker)
│   └── serverless/       # Serverless functions (DigitalOcean)
├── components/           # React components (feature-based)
├── config/               # App configuration
├── content/              # Content data (JSON)
├── contexts/             # React contexts (Theme)
├── icons/                # SVG icon components
├── public/static/        # Static assets (images in WebP)
├── test-utils/           # Testing utilities
├── types/                # TypeScript type definitions
└── utils/                # Utility functions
```

## Code Conventions

### Components

- **One component per directory** under `components/`.
- **File naming:** PascalCase for components (`ComponentName.tsx`), co-located styles (`ComponentName.scss`).
- **Subcomponents** are nested inside the parent directory (e.g., `Contact/ContactForm/`).
- **Barrel exports** via `index.ts` where used (e.g., `ThemeToggle/index.ts`).
- Functional components only; use TypeScript interfaces from `types/index.d.ts` for props.

### App Router

- Components are **server components by default**.
- Client components must include the `'use client'` directive at the top of the file.
- The app is a single-page layout — all sections render on `app/page.tsx` with anchor-based navigation.

### Styling

- **SCSS** is the primary styling approach, co-located with components.
- **CSS Modules** (`.module.css`) are used selectively for `Layout` and `PageNotFound`.
- **Theme variables** are defined in `app/theme-variables.scss`.
- **Global styles** live in `app/globals.scss`.
- Bootstrap and Mantine provide base UI components; custom SCSS handles component-specific styles.

### TypeScript

- Strict mode is enabled.
- Shared type definitions go in `types/index.d.ts`.
- Path aliases are configured: `@/*`, `components/*`, `contexts/*`, `utils/*`, `config`, `icons`, `scss/*`.

### Formatting & Linting

- **Prettier:** 100 char print width, single quotes, ES5 trailing commas, 2-space tabs.
- **ESLint:** Airbnb base with TypeScript, Mantine, Next.js, and Jest plugins.
- **Stylelint:** standard-scss config with relaxed rules for flexible SCSS patterns.
- Always run `npm run test` before committing — it checks formatting, linting, types, and tests.

### Accessibility

- Use semantic HTML elements and ARIA labels/landmarks.
- Support keyboard navigation and visible focus styles.
- Respect `prefers-reduced-motion` for animations.
- Target WCAG 2.1 AA compliance.

## Environment Variables

Environment variables are defined in `.env` (copy from `.env.SAMPLE`):

- `NEXT_PUBLIC_API_URL` — Backend API URL
- `NEXT_PUBLIC_SITE_URL` — Public site URL
- `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` — Google Analytics measurement ID

Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

## Git Conventions

- **Branches:** `main` (production), `develop` (development), `feature/*`, `bugfix/*`, `release/vX.X.X`
- **Flow:** Features branch from `develop`; releases branch from `develop`; squash merge to `main` for production.
- **Versioning:** Semantic versioning (semver).
