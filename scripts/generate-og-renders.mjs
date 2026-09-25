/**
 * Converts the station renders in public/static/images/illustrations (WebP)
 * into small PNGs in app/_og/renders for the Open Graph images — next/og
 * (satori) can only embed PNG, JPEG and GIF. The PNGs are read at build
 * time and never served to visitors.
 *
 * Decodes and resizes in headless Chromium (the Playwright test browser), so
 * no native image library is needed. Set PLAYWRIGHT_CHROMIUM_PATH to use an
 * existing Chromium binary instead of the one Playwright installs.
 *
 * Re-run after changing a render:  node scripts/generate-og-renders.mjs
 */
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { chromium } from '@playwright/test';

const root = new URL('..', import.meta.url).pathname;
const source = path.join(root, 'public/static/images/illustrations');
const out = path.join(root, 'app/_og/renders');
const maxSize = 480;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
const page = await browser.newPage();
await mkdir(out, { recursive: true });

for (const file of (await readdir(source)).filter((f) => f.endsWith('.webp')).sort()) {
  const dataUrl = `data:image/webp;base64,${(await readFile(path.join(source, file))).toString('base64')}`;
  const png = await page.evaluate(
    async ({ src, max }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png').split(',')[1];
    },
    { src: dataUrl, max: maxSize }
  );
  const target = path.join(out, file.replace(/\.webp$/, '.png'));
  await writeFile(target, Buffer.from(png, 'base64'));
  console.log(`${path.relative(root, target)} (${Math.round(Buffer.byteLength(png, 'base64') / 1024)} KB)`);
}

await browser.close();
