# Portfolio Next.js

This repo contains the code for my online web portfolio. It is built using [Next.js](https://nextjs.org/) (v15), [React Bootstrap](https://react-bootstrap.netlify.app/) + [Mantine](https://mantine.dev/).

The repo is setup for Static Site Generation to maximise performance and includes comprehensive **WCAG 2.1 Level AA accessibility** features.

## ♿ Accessibility

This portfolio is built with accessibility as a priority:

- ✅ **Keyboard Navigation** - Full keyboard support with visible focus indicators
- ✅ **Screen Reader Optimized** - ARIA landmarks, labels, and semantic HTML
- ✅ **Motion Preferences** - Respects `prefers-reduced-motion` settings
- ✅ **Skip Links** - Skip to main content for keyboard users
- ✅ **Form Accessibility** - Proper labels, error messages, and validation

See [ACCESSIBILITY.md](./ACCESSIBILITY.md) for comprehensive documentation and [ACCESSIBILITY_QUICK_REFERENCE.md](./ACCESSIBILITY_QUICK_REFERENCE.md) for quick tips.

## Setup local development

### Pre-requisites

- Ensure you are running Node `v20.18.0` or higher. If you have NVM installed, you can simply run `nvm use`
- Copy `.env.SAMPLE` to `.env` and configure your environment variables

### Install project dependencies

- Run `npm install`

### Run the development server

- Run `npm run dev` to start the dev server.
- Make any required code changes. The dev server watches for changes and rebuilds in real-time.

## Contributing

### Add a new feature

- Create a new branch from `develop` following the Git Flow branching convention
- Make any code changes following Next.js best practices.
- Add any new unit tests

### Deploying the Static Web App to Development Env

- Create a pull request from your branch back into `develop`
- Once the changes have been approved, merge the pull request
- The `develop` pipeline will trigger, deploying to the DigitalOcean project `portfolio-dev`

### Deploying the Static Web App to Production Env

- Create a new release branch from develop in the format `release/vx.x.x` (Use semantic versioning for the new release version)
- Bump the package.json version version to the new release version
- Create a pull request from your release branch into `main`
- Once the changes have been approved, merge the pull request as a squash merge
- The `production` pipeline will trigger, deploying to the DigitalOcean project `portfolio`
- Lastly, create a pull request from `main` back into `develop` and merge.

## npm scripts

### Build and dev scripts

- `dev` – start dev server
- `build` – bundle application for production
- `start` - start the HTTP web server
- `analyze` – analyzes application bundle with [@next/bundle-analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)

### Testing scripts

- `typecheck` – checks TypeScript types
- `lint` – runs ESLint
- `prettier:check` – checks files with Prettier

### Other scripts

- `prettier:write` – formats all files with Prettier
- `lint:fix` – fixes all resolvable ESLint errors
