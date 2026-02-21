# Portfolio Next.js

This repo contains the code for my online web portfolio. It is built using [Next.js](https://nextjs.org/) (v16).

## Setup local development

### Pre-requisites

- Ensure you are running Node `v25.4.0`. If you have NVM installed, you can simply run `nvm use`
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
- Bump the package.json version to the new release version
- Create a pull request from your release branch into `main`
- Once the changes have been approved, merge the pull request as a squash merge
- The `production` pipeline will trigger, deploying to the DigitalOcean project `portfolio`
- Lastly, create a pull request from `main` back into `develop` and merge.

## npm scripts

### Build and dev scripts

- `dev` – start Next.js dev server
- `build` – full production build (next build + image optimization + PurgeCSS + sitemap generation)
- `start` – serve the static export from the `out` directory
- `analyze` – analyzes application bundle with [@next/bundle-analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)

### Testing scripts

- `test` – full test suite: prettier:check + lint + typecheck
- `typecheck` – checks TypeScript types
- `lint` – runs ESLint + Stylelint
- `prettier:check` – checks files with Prettier

### Other scripts

- `prettier:write` – formats all files with Prettier
- `lint:fix` – auto-fix ESLint + Stylelint issues
