# Environment Variables

Configuration guide for environment variables required for the portfolio.

## Overview

This project uses environment variables for configuration. Copy `.env.SAMPLE` to `.env.local` and fill in the values.

---

## Required Variables

### Site Configuration

```bash
# Production site URL (required)
NEXT_PUBLIC_SITE_URL=https://portfolio.lewishadden.co.uk

# Alternative site URL for sitemap generation
SITE_URL=https://portfolio.lewishadden.co.uk
```

**Purpose:**
- Used for canonical URLs
- Open Graph URLs
- Sitemap generation
- JSON-LD structured data

**Note:** Must be the full production URL with protocol (https://)

---

## Optional Variables

### Google Site Verification

```bash
# Google Search Console verification code
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=your-verification-code-here
```

**Purpose:**
- Verify site ownership in Google Search Console
- Enable indexing and crawling

**How to get:**
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add your property
3. Choose "HTML tag" verification method
4. Copy the `content` value from the meta tag
5. Add to `.env.local`

**Example:**
```html
<!-- Google provides: -->
<meta name="google-site-verification" content="abc123xyz" />

<!-- Add to .env.local: -->
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=abc123xyz
```

---

### Google Analytics

```bash
# Google Analytics 4 Measurement ID
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Purpose:**
- Track website visitors
- Monitor traffic sources
- Measure conversions

**How to get:**
1. Create account at [Google Analytics](https://analytics.google.com/)
2. Set up a GA4 property
3. Get Measurement ID (starts with G-)
4. Add to `.env.local`

---

### API Configuration

```bash
# Backend API URL (for contact form)
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

**Purpose:**
- Contact form submission
- Serverless function endpoints

**Note:** Currently used by the contact form component

---

## Development vs Production

### Local Development (`.env.local`)

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Production (`.env.production`)

```bash
NEXT_PUBLIC_SITE_URL=https://portfolio.lewishadden.co.uk
SITE_URL=https://portfolio.lewishadden.co.uk
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=abc123xyz
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_API_URL=https://api.portfolio.lewishadden.co.uk
```

---

## Environment Files

### File Structure

```
/
├── .env.SAMPLE          # Template with all variables
├── .env.local           # Local development (git ignored)
├── .env.production      # Production values (git ignored)
└── .env.test            # Test environment (git ignored)
```

### Load Order

Next.js loads environment variables in this order:
1. `.env.$(NODE_ENV).local` (e.g., `.env.production.local`)
2. `.env.local` (not loaded when `NODE_ENV` is `test`)
3. `.env.$(NODE_ENV)` (e.g., `.env.production`)
4. `.env`

---

## Usage in Code

### Client-Side Variables

Variables prefixed with `NEXT_PUBLIC_` are available in the browser:

```typescript
// app/layout.tsx
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
```

### Server-Side Only Variables

Variables without `NEXT_PUBLIC_` prefix are only available server-side:

```typescript
// next-sitemap.config.js
siteUrl: process.env.SITE_URL || 'http://localhost:3000'
```

---

## Security Best Practices

### ✅ DO

- Keep `.env.local` and `.env.production` in `.gitignore`
- Use different values for dev and production
- Store sensitive keys only server-side (no `NEXT_PUBLIC_`)
- Rotate keys regularly
- Use environment variables in CI/CD

### ❌ DON'T

- Commit environment files to git
- Share `.env` files in Slack/email
- Use production keys in development
- Expose API keys client-side
- Hardcode sensitive values

---

## Deployment

### DigitalOcean

Set environment variables in the App Platform dashboard:

1. Go to your app settings
2. Navigate to "Environment Variables"
3. Add each variable as a key-value pair
4. Save and redeploy

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Set environment variables
vercel env add NEXT_PUBLIC_SITE_URL production
vercel env add NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION production
vercel env add NEXT_PUBLIC_GA_MEASUREMENT_ID production
```

### Netlify

1. Go to Site Settings → Build & Deploy → Environment
2. Add each variable
3. Redeploy

---

## Troubleshooting

### Variables Not Loading

**Issue:** Environment variables are undefined

**Solutions:**
1. Restart dev server after adding new variables
2. Check variable names (case-sensitive)
3. Verify `.env.local` is in root directory
4. Ensure `NEXT_PUBLIC_` prefix for client-side

### Build Errors

**Issue:** Build fails with missing environment variables

**Solutions:**
1. Check all required variables are set
2. Verify syntax (no spaces around `=`)
3. Remove quotes if not needed
4. Check for typos

### Wrong Environment

**Issue:** Using dev values in production

**Solutions:**
1. Set `NODE_ENV=production` correctly
2. Use platform environment variable settings
3. Don't commit `.env.local` to git

---

## Example Configuration

### Complete `.env.local` Example

```bash
# Site Configuration
NEXT_PUBLIC_SITE_URL=https://portfolio.lewishadden.co.uk
SITE_URL=https://portfolio.lewishadden.co.uk

# SEO
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=abc123xyz456

# Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# API
NEXT_PUBLIC_API_URL=https://api.portfolio.lewishadden.co.uk

# Optional: Development
NODE_ENV=development
```

---

## Validation

To verify environment variables are loaded:

```typescript
// Add to a component temporarily
console.log('Site URL:', process.env.NEXT_PUBLIC_SITE_URL);
console.log('GA ID:', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
```

Or check in browser console:
```javascript
console.log(process.env.NEXT_PUBLIC_SITE_URL);
```

---

## Additional Resources

- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [dotenv Documentation](https://github.com/motdotla/dotenv)
- [12 Factor App - Config](https://12factor.net/config)

---

**Last Updated:** January 19, 2026  
**Version:** 1.0
