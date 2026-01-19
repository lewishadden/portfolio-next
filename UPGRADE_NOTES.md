# Next.js 15 Upgrade Notes

## What Was Upgraded

### Core Dependencies

- ✅ **Next.js**: `14.2.18` → `15.1.3` (Latest stable)
- ✅ **React**: `18.2.0` → `18.3.1` (Latest React 18)
- ✅ **React DOM**: `18.2.0` → `18.3.1`
- ✅ **@types/react**: `18.2.65` → `18.3.18`
- ✅ **@types/react-dom**: Added `18.3.5`
- ✅ **@mantine/core**: `7.11.2` → `7.16.4`
- ✅ **@mantine/hooks**: `7.11.2` → `7.16.4`
- ✅ **@next/bundle-analyzer**: `14.1.3` → `15.1.3`
- ✅ **@next/eslint-plugin-next**: `14.1.3` → `15.1.3`

### Node Version

- ✅ **Node.js**: `20.9.0` → `20.18.0` (Updated in package.json and .nvmrc)

## Verification

✅ All checks passed:

- TypeScript compilation: **Success**
- Production build: **Success**
- Development server: **Success**
- Static export: **Success**
- Image optimization: **Success**
- Sitemap generation: **Success**

## Why React 18 Instead of React 19?

While Next.js 15 supports React 19, several of your dependencies don't yet:

- `@mantine/core` and `@mantine/hooks` (require React 18)
- `react-animate-on-scroll` (requires React < 19)
- `react-headroom` (requires React ^16.3.0 || ^17 || ^18)
- `next-image-export-optimizer` (requires React ^18)

**Recommendation**: Stay on React 18 until these libraries add React 19 support. Next.js 15 works perfectly with React 18.

## Known Warnings

### 1. SCSS Deprecation Warnings

Location: `components/Background/Background.scss`

The Sass `random()` function is deprecated in favor of `math.random()`. This is a non-breaking warning but should be addressed:

```scss
// Current (deprecated)
$circleSize: random($particleBaseSize);

// Should be updated to:
@use 'sass:math';
$circleSize: math.random($particleBaseSize);
```

### 2. Node Version Mismatch

You're running Node `22.12.0` but package.json specifies `20.18.0`. This is fine - Next.js 15 supports Node 18.18+ through 22.x. Consider updating package.json engines to be less restrictive:

```json
"engines": {
  "node": ">=20.18.0",
  "npm": ">=10.0.0"
}
```

## Next.js 15 Key Features You Can Now Use

1. **Improved Caching**: Better caching strategies with more granular control
2. **Better Performance**: Enhanced compiler optimizations
3. **Turbopack**: Available in dev mode (use `next dev --turbo`)
4. **Enhanced Static Export**: Better support for static site generation
5. **Improved Error Messages**: More helpful debugging information

## Testing Recommendations

1. Test all interactive features thoroughly
2. Verify contact form functionality
3. Check project image carousels
4. Test responsive layouts on mobile
5. Verify animations work correctly
6. Test navigation and smooth scrolling

## Future Upgrades

Once the following libraries support React 19, you can upgrade:

- Monitor Mantine v8 beta/stable release
- Check for `react-animate-on-scroll` alternatives (consider `framer-motion`)
- Watch for `react-headroom` updates

## Quick Commands

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run all tests
npm run test
```

## Rollback Instructions

If you need to rollback:

```bash
git checkout HEAD -- package.json package-lock.json .nvmrc next.config.js
npm install
```

---

**Upgrade completed successfully on**: January 19, 2026
**Next.js Version**: 15.1.3 (from 14.2.18)
**Build Status**: ✅ Passing
