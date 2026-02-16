# AGENTS.md

## Project Overview

This is a **Next.js 16** portfolio website using **Static Site Generation (SSG)**. It is built with **React 19**, **TypeScript**, and **SCSS**. The site is a single-page portfolio with sections: Home, About, Experience, Projects, Skills, Contact, and Footer.

## Tech Stack

- **Framework:** Next.js 16 (App Router, SSG via `next build` + static export)
- **Language:** TypeScript
- **Styling:** SCSS (BEM naming convention), CSS Modules (for select components)
- **Icons:** `@iconify/react`
- **Forms:** Formik + Yup
- **Animations:** animate.css, react-type-animation
- **Testing:** Jest + React Testing Library
- **Linting:** ESLint, Stylelint, Prettier
- **Package Manager:** npm
- **Node Version:** See `.nvmrc`
- **Backend APIs:** Serverless (DigitalOcean) and Express (Bun) email endpoints in `api/`

## Project Structure

```
app/              # Next.js App Router (layout, pages, global styles, theme variables)
components/       # React components, each with its own .tsx, .scss, and test files
config/           # App configuration (header links, GitHub URL)
content/          # Static content (content.json — the single data source)
contexts/         # React contexts (ThemeContext)
icons/            # Custom SVG icon components
public/           # Static assets served at root
types/            # TypeScript type definitions (index.d.ts)
utils/            # Utility functions (serverUtils.ts for reading content)
test-utils/       # Shared test utilities (custom render, re-exports from @testing-library/react)
api/              # Backend API implementations (serverless + express)
docs/             # Documentation (accessibility, SEO, etc.)
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
  - `<ComponentName>.test.tsx` — Jest tests (when present)
- Components marked `'use client'` are client components; otherwise they are server components.

### Styling

- Use **SCSS** with **BEM naming**: `.block__element--modifier`
- Theme variables are defined in `app/theme-variables.scss` as CSS custom properties on `[data-theme='dark']` and `[data-theme='light']`
- Reference theme values via `var(--variable-name)` (e.g., `var(--bg-primary)`, `var(--text-primary)`, `var(--accent-primary)`)
- Gradient variables: `--gradient-start`, `--gradient-mid`, `--gradient-end`
- Support both dark (default) and light themes; use `[data-theme='light'] &` for light-theme overrides
- Respect `prefers-reduced-motion` — see `app/globals.scss`

### TypeScript Types

- All shared types are in `types/index.d.ts`
- Key interfaces: `ResumeData`, `BasicInfo`, `Project`, `Theme`, `Experience`, `ExperienceItem`, `Skills`, `Icon`, `Contact`, `Technology`, `Social`, `ContactInfo`, `SectionName`
- Use `@/types` path alias form for imports

### Data Flow

- Content is loaded from `content/content.json` via `utils/serverUtils.ts` (`getPageContent()`)
- Page data is fetched in `app/page.tsx` (server component) and passed as props to child components
- No client-side data fetching for portfolio content; it's all SSG

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
npm run build        # Full production build (next build + image optimization + PurgeCSS + sitemap)
```

### Testing

```sh
npm run test         # Full test suite: prettier:check + lint + typecheck + jest
npm run jest         # Run Jest unit tests only
npm run jest:watch   # Run Jest in watch mode
```

### Linting & Formatting

```sh
npm run lint              # ESLint + Stylelint
npm run lint:fix          # Auto-fix ESLint + Stylelint issues
npm run prettier:check    # Check formatting
npm run prettier:write    # Auto-format all files
npm run typecheck         # TypeScript type checking (tsc --noEmit)
```

## Testing Guidelines

- Tests use **Jest** with **React Testing Library**
- Test setup is in `jest.setup.cjs` (includes `@testing-library/jest-dom`, mocks for `matchMedia`, `ResizeObserver`, `scrollIntoView`)
- Import test utilities from `test-utils/` (which re-exports `@testing-library/react` + custom `render` + `userEvent`)
- Jest config is in `jest.config.cjs` using `next/jest`
- Test environment: `jest-environment-jsdom`

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
- JSON-LD structured data schemas: Person, WebSite, BreadcrumbList, ProfilePage
- Sitemap generated via `next-sitemap` (config in `next-sitemap.config.js`)
- Google Tag Manager integration via `GoogleTagManagerDeferred` component

## Git Workflow

- **Git Flow** branching model
- Branch from `develop` for features
- Release branches: `release/vx.x.x` (semantic versioning)
- PRs into `develop` deploy to dev environment
- PRs into `main` (squash merge) deploy to production
- After merging to `main`, merge `main` back into `develop`

## Important Notes

- The site is statically exported (`output: 'export'` in Next.js config) — no server-side rendering at runtime
- PurgeCSS runs post-build to remove unused CSS (config in `purgecss.config.cjs`)
- Images are optimized with `next-image-export-optimizer`
- The `api/` directory contains standalone backend services (not Next.js API routes) — a serverless function and an Express/Bun server for sending contact form emails
- PostCSS config (`postcss.config.cjs`) includes `postcss-simple-vars` with breakpoint variables
