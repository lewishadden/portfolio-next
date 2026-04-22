# AGENTS.md

## Project Overview

This is a **Next.js 16** portfolio website built with **React 19**, **TypeScript**, and **SCSS**. The site is a single-page portfolio with sections: Home, About, Experience, Projects, Skills, Contact, and Footer. It uses server-side rendering with a Next.js API route for the contact form email endpoint.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** SCSS (BEM naming convention), CSS Modules (for select components)
- **Icons:** `@iconify/react`
- **Forms:** Formik + Yup
- **Animations:** Framer Motion (scroll-driven), react-type-animation (typing effect)
- **Linting:** ESLint, Stylelint, Prettier
- **Package Manager:** npm
- **Node Version:** See `.nvmrc` (v24.x)
- **Email:** `nodemailer` via Next.js API route (`app/api/sendmail/route.ts`)
- **Geolocation:** `@vercel/functions` (used in `app/layout.tsx` to pass geo data to analytics)
- **Legacy APIs:** Serverless (DigitalOcean) and Express (Bun) endpoints in `api/` (unused, kept for reference)

## Project Structure

```
app/              # Next.js App Router (layout, page, API routes, global styles, theme variables)
components/       # React components, each with its own .tsx and .scss
config/           # App configuration (GitHub URL)
content/          # Static content (content.json — the single data source)
contexts/         # React contexts (ThemeContext)
hooks/            # Custom React hooks (useActiveSection, useCountUp, useFocusTrap, etc.)
icons/            # Custom SVG icon components
public/           # Static assets served at root
types/            # TypeScript type definitions (index.d.ts)
utils/            # Utility functions (serverUtils.ts, buildPyramidRows.ts)
api/              # Legacy backend API implementations (serverless + express), unused
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
- There are no test files — no testing infrastructure is currently set up.

### Styling

- Use **SCSS** with **BEM naming**: `.block__element--modifier`
- Theme variables are defined in `app/theme-variables.scss` as CSS custom properties on `[data-theme='dark']` and `[data-theme='light']`
- Reference theme values via `var(--variable-name)` (e.g., `var(--bg-primary)`, `var(--text-primary)`, `var(--accent-primary)`)
- Gradient variables: `--gradient-start`, `--gradient-mid`, `--gradient-end`
- Support both dark (default) and light themes; use `[data-theme='light'] &` for light-theme overrides
- Respect `prefers-reduced-motion` — see `app/globals.scss`

### TypeScript Types

- All shared types are in `types/index.d.ts`
- Key interfaces: `ResumeData`, `Global`, `Header`, `Home`, `StatItem`, `About`, `Highlight`, `Experience`, `ExperienceItem`, `Projects`, `Project`, `Technology`, `Skills`, `SkillCategory`, `SkillIcon`, `Contact`, `ContactInfo`, `SocialLink`, `Footer`, `NavItem`, `Theme`, `CtaPair`, `Cta`, `Icon`
- Use `@/types` path alias form for imports

### Custom Hooks (`hooks/`)

- `useActiveSection` — detects which section is in viewport via scroll/resize listeners
- `useColumns` — responsive column count via rAF-throttled resize
- `useCountUp` — animates a number from 0 to target with cubic easing, triggers on intersection
- `useFocusTrap` — traps keyboard focus within a container (used in modals and mobile menu)
- `useHeadroom` — returns whether the header should be visible (pin/unpin on scroll direction)
- `useInViewport` — simple IntersectionObserver ref + boolean
- `useMediaQuery` — subscribes to a CSS media query, SSR-safe
- `useReducedMotion` — returns `prefers-reduced-motion: reduce`, SSR-safe
- `useReveal` / `useGlobalReveal` — scroll-triggered reveal for individual elements and `.reveal` class globally
- `useScrollProgress` — tracks scroll percentage, sets `--scroll-pct` CSS variable
- `useTilt` — 3D tilt effect on mousemove using perspective transforms

### Data Flow

- Content is loaded from `content/content.json` via `utils/serverUtils.ts` (`getPageContent()`)
- Page data is fetched in `app/page.tsx` (server component) and passed as props to child components
- No client-side data fetching for portfolio content
- The contact form submits to `/api/sendmail` (Next.js API route) which sends email via nodemailer

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
- JSON-LD structured data schemas: Person, WebSite, ProfilePage
- Sitemap generated natively via `app/sitemap.ts` (no extra package needed — serves `/sitemap.xml` at runtime)
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
- The `api/` directory contains legacy standalone backend services (a DigitalOcean serverless function and an Express/Bun server) — these are no longer used; the contact form email is handled by `app/api/sendmail/route.ts`
- SMTP configuration is provided via environment variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_EMAIL`, `SMTP_PASS`
- The `Contact` component is lazy-loaded via `LazyContact.tsx` (dynamic import, SSR disabled) to reduce initial bundle size
- `ThemeScript` runs as an inline script before hydration to prevent theme flash on page load
- `Background` component uses a canvas-based particle system with `requestIdleCallback` for deferred rendering; respects `prefers-reduced-motion`
