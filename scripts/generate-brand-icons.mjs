/**
 * Draws the site's icons from the LH orbital monogram
 * (components/BrandMark/markGeometry.ts), so they always match the header:
 *
 *   app/icon.svg        browser tabs: the small variant, light or dark with the OS
 *   app/icon.png        512px, on the site's dark tile
 *   app/apple-icon.png  180px home-screen icon (iOS rounds the corners itself)
 *   app/favicon.ico     16, 32 and 48px for browsers that only read .ico (mid tones:
 *                       it can't follow the theme, so it reads on light and dark tabs)
 *
 * Run after changing the mark:  node scripts/generate-brand-icons.mjs
 */
import { writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

import { brandMarkSvg } from '../components/BrandMark/markGeometry.ts';

const app = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');
const tile = '#05060d';

const png = (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

/** An .ico holding PNG images (supported everywhere .ico is) */
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map(({ data }) => data)]);
}

await writeFile(
  path.join(app, 'icon.svg'),
  brandMarkSvg({ size: 64, pad: 0.02, small: true, adaptive: true })
);
await writeFile(
  path.join(app, 'icon.png'),
  await png(brandMarkSvg({ size: 512, background: tile, pad: 0.1 }))
);
await writeFile(
  path.join(app, 'apple-icon.png'),
  await png(brandMarkSvg({ size: 180, background: tile, pad: 0.12, tileRadius: 0 }))
);
const sizes = [16, 32, 48];
const images = await Promise.all(
  sizes.map(async (size) => ({
    size,
    data: await png(brandMarkSvg({ size, pad: 0.02, small: true, theme: 'mid' })),
  }))
);
await writeFile(path.join(app, 'favicon.ico'), ico(images));
console.log('Wrote app/icon.svg, icon.png, apple-icon.png and favicon.ico');
