import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withBundleAnalyzer({
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['@iconify/react'],
    inlineCss: true,
  },
  // Public files default to max-age=0; models and renders change rarely, and a
  // cached GLB is what makes link-hover prefetching (World/routes.ts) pay off.
  async headers() {
    const cache = [
      { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
    ];
    return [
      { source: '/static/models/:path*', headers: cache },
      { source: '/static/images/illustrations/:path*', headers: cache },
    ];
  },
  images: {
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 year
  },
});
