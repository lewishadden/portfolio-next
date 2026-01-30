import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const contentPath = path.resolve('content/content.json');
const outputPath = path.resolve('icons/iconify-collections.json');

const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));

const iconNames = new Set();
const collectIcons = (value) => {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach(collectIcons);
    return;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, val]) => {
      if (key === 'class' || key === 'icon' || key === 'thumbnail') {
        if (typeof val === 'string') iconNames.add(val);
      } else {
        collectIcons(val);
      }
    });
  }
};

collectIcons(content);

const byPrefix = {};
iconNames.forEach((name) => {
  if (!name.includes(':')) return;
  const [prefix, icon] = name.split(':');
  if (!byPrefix[prefix]) byPrefix[prefix] = new Set();
  byPrefix[prefix].add(icon);
});

const require = createRequire(import.meta.url);
const collections = {};
Object.entries(byPrefix).forEach(([prefix, icons]) => {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const iconSet = require(`@iconify-json/${prefix}/icons.json`);
  const filteredIcons = {};

  icons.forEach((iconName) => {
    if (iconSet.icons && iconSet.icons[iconName]) {
      filteredIcons[iconName] = iconSet.icons[iconName];
    }
  });

  if (Object.keys(filteredIcons).length > 0) {
    collections[prefix] = {
      prefix,
      icons: filteredIcons,
      width: iconSet.width,
      height: iconSet.height,
    };
  }
});

fs.writeFileSync(outputPath, JSON.stringify({ collections }, null, 2));
console.log(`Wrote ${Object.keys(collections).length} collections to ${outputPath}`);
