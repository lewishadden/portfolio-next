# SEO Checklist

Quick reference checklist for SEO verification and monitoring.

## Pre-Launch Checklist

### Meta Tags ✅
- [x] Title tag (60 chars) with primary keywords
- [x] Meta description (155 chars) compelling
- [x] Keywords meta tag with targeted terms
- [x] Author, creator, publisher tags
- [x] Canonical URL set
- [x] Viewport meta tag (mobile-friendly)
- [x] Language declaration (en-GB)
- [x] Favicon configured

### Open Graph & Social ✅
- [x] og:title
- [x] og:description
- [x] og:image (1200x630px)
- [x] og:url
- [x] og:type (website)
- [x] og:locale (en_GB)
- [x] Twitter Card (summary_large_image)
- [x] Twitter creator (@lewishadden)

### Structured Data (JSON-LD) ✅
- [x] Person schema with complete info
- [x] WebSite schema
- [x] BreadcrumbList schema
- [x] ProfilePage schema
- [x] All schemas linked with @id
- [x] Contact information included
- [x] Skills (knowsAbout) listed
- [x] Social profiles (sameAs) linked

### Technical SEO ✅
- [x] Robots.txt created and optimized
- [x] XML sitemap generated
- [x] Sitemap submitted to Search Console
- [x] Clean URL structure (/#section)
- [x] HTTPS enabled
- [x] Mobile-friendly (responsive)
- [x] Fast loading (<3s)
- [x] No broken links
- [x] 404 page exists
- [x] Gzip compression enabled
- [x] Browser caching configured

### Performance (Core Web Vitals) ✅
- [x] LCP target: <2.5s
- [x] FID target: <100ms
- [x] CLS target: <0.1
- [x] Images optimized (WebP)
- [x] Images lazy loaded
- [x] Code splitting enabled
- [x] Bundle size optimized
- [x] Unused code removed

### Content SEO ✅
- [x] H1 tag (one per page) - "Lewis Hadden"
- [x] H2-H6 hierarchy maintained
- [x] Keywords in title
- [x] Keywords in first 100 words
- [x] Keywords in headings
- [x] Content length 1500+ words
- [x] Images have alt text
- [x] Internal links present
- [x] Contact information visible
- [x] Call-to-action clear

### Semantic HTML ✅
- [x] `<main>` landmark
- [x] `<nav>` for navigation
- [x] `<section>` for content sections
- [x] `<footer>` for footer
- [x] `<article>` where appropriate
- [x] `<header>` for page/section headers
- [x] Proper heading hierarchy
- [x] Lists use `<ul>` or `<ol>`

### Security Headers ✅
- [x] X-Frame-Options
- [x] X-Content-Type-Options
- [x] X-DNS-Prefetch-Control
- [x] Referrer-Policy
- [x] Permissions-Policy

---

## Post-Launch Actions

### Immediate (Day 1) 📋
- [ ] Verify site is live at production URL
- [ ] Submit sitemap to Google Search Console
- [ ] Submit sitemap to Bing Webmaster Tools
- [ ] Set up Google Analytics 4
- [ ] Test all meta tags with:
  - [ ] Google Rich Results Test
  - [ ] Facebook Sharing Debugger
  - [ ] LinkedIn Post Inspector
  - [ ] Twitter Card Validator

### Week 1 📋
- [ ] Check Google Search Console for crawl errors
- [ ] Monitor indexing status
- [ ] Set up Google My Business (if applicable)
- [ ] Check robots.txt is accessible
- [ ] Verify sitemap.xml is accessible
- [ ] Run Lighthouse audit (target: 90+ SEO score)
- [ ] Check mobile-friendliness test
- [ ] Test page speed on PageSpeed Insights

### Week 2-4 📋
- [ ] Monitor search console for:
  - [ ] Impressions
  - [ ] Clicks
  - [ ] Average position
  - [ ] Coverage issues
- [ ] Check for duplicate content issues
- [ ] Review search queries generating traffic
- [ ] Look for crawl anomalies

### Monthly Tasks 📋
- [ ] Review Google Analytics data
- [ ] Check Core Web Vitals report
- [ ] Update content with new projects
- [ ] Add new blog posts (if applicable)
- [ ] Check backlink profile
- [ ] Monitor competitor rankings
- [ ] Review and update keywords
- [ ] Check for 404 errors
- [ ] Update sitemap if structure changed

### Quarterly Tasks 📋
- [ ] Full SEO audit with Screaming Frog
- [ ] Content freshness check
- [ ] Broken link audit
- [ ] Image optimization review
- [ ] Mobile UX review
- [ ] Load time optimization
- [ ] Keyword research update
- [ ] Competitor analysis
- [ ] Backlink outreach

---

## Testing Tools

### Before Launch
```bash
# Build and test locally
npm run build
npm start

# Run Lighthouse
Open Chrome DevTools → Lighthouse → Run SEO audit

# Check bundle size
npm run analyze
```

### After Launch

**Google Tools:**
- [Google Search Console](https://search.google.com/search-console)
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [Rich Results Test](https://search.google.com/test/rich-results)
- [Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)

**Social Media Validators:**
- [Facebook Debugger](https://developers.facebook.com/tools/debug/)
- [LinkedIn Inspector](https://www.linkedin.com/post-inspector/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)

**Schema Validators:**
- [Schema.org Validator](https://validator.schema.org/)
- [JSON-LD Playground](https://json-ld.org/playground/)

**Performance:**
- [GTmetrix](https://gtmetrix.com/)
- [WebPageTest](https://www.webpagetest.org/)
- [Pingdom](https://tools.pingdom.com/)

**SEO Audits:**
- [Ahrefs Site Audit](https://ahrefs.com/)
- [SEMrush](https://www.semrush.com/)
- [Screaming Frog](https://www.screamingfrogseo.co.uk/)

---

## Target Metrics

### Search Console (3 Months)
- Impressions: 1,000+
- Clicks: 50+
- Average position: <20
- CTR: >3%

### Rankings (6 Months)
- "Lewis Hadden": #1
- "Lewis Hadden developer": Top 3
- "Full stack developer UK": Top 50
- "[Your City] full stack developer": Top 20

### Performance (Lighthouse)
- Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 100

### Core Web Vitals
- LCP: <2.5s (Good) ✅
- FID: <100ms (Good) ✅
- CLS: <0.1 (Good) ✅
- All pages: 75th percentile

---

## Common Issues & Solutions

### Issue: Site not appearing in search

**Check:**
1. Search Console → Coverage → Check indexed pages
2. Robots.txt not blocking site
3. Sitemap submitted correctly
4. No manual actions or penalties

**Solution:**
- Wait 2-4 weeks for initial indexing
- Use "Request Indexing" in Search Console
- Share site on social media for crawling

---

### Issue: Poor rankings

**Check:**
1. Keyword competition level
2. Content quality and length
3. Backlink profile
4. Page speed

**Solution:**
- Create more content
- Build quality backlinks
- Optimize existing content
- Improve technical SEO

---

### Issue: High bounce rate

**Check:**
1. Page load time
2. Mobile experience
3. Content relevance
4. Clear CTA

**Solution:**
- Optimize images
- Improve content
- Add internal links
- Enhance UX

---

## Environment Variables

Required for production:

```bash
# .env.local
NEXT_PUBLIC_SITE_URL=https://portfolio.lewishadden.co.uk
SITE_URL=https://portfolio.lewishadden.co.uk
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=your-code-here
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

## Quick Links

- [Google Search Console](https://search.google.com/search-console)
- [Google Analytics](https://analytics.google.com/)
- [Bing Webmaster Tools](https://www.bing.com/webmasters)
- [Sitemap](https://portfolio.lewishadden.co.uk/sitemap.xml)
- [Robots.txt](https://portfolio.lewishadden.co.uk/robots.txt)

---

## Support

For SEO help:
- **Documentation:** See [SEO.md](./SEO.md)
- **Reddit:** r/SEO
- **Stack Exchange:** seo.stackexchange.com
- **Google Help:** support.google.com/webmasters

---

**Version:** 1.0  
**Last Updated:** January 19, 2026  
**Next Review:** February 2026
