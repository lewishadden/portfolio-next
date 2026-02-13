/**
 * Post-build script to inline critical CSS using critters.
 * Processes all HTML files in the out/ directory to:
 * 1. Inline above-fold critical CSS in <style> tags
 * 2. Convert remaining <link rel="stylesheet"> to async loading
 */
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import Critters from 'critters';

const outDir = resolve('out');

async function getHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getHtmlFiles(fullPath)));
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Convert remaining render-blocking <link rel="stylesheet"> to async loading.
 * Uses the media="print" onload="this.media='all'" pattern.
 */
function deferNonCriticalCss(html) {
  // Match <link> tags with rel="stylesheet" that DON'T have media="print" already
  // and are NOT inside <script> tags (RSC payload)
  const parts = [];
  let lastIndex = 0;
  let inScript = false;

  // Simple state machine to avoid modifying CSS links inside <script> tags
  const tagRegex = /<\/?script[^>]*>|<link\s[^>]*rel="stylesheet"[^>]*\/?>/gi;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[0];

    if (tag.toLowerCase().startsWith('<script')) {
      inScript = true;
      continue;
    }
    if (tag.toLowerCase().startsWith('</script')) {
      inScript = false;
      continue;
    }

    // Only process <link> tags outside of <script> blocks
    if (!inScript && tag.startsWith('<link') && !tag.includes('media="print"')) {
      parts.push(html.slice(lastIndex, match.index));
      // Add media="print" and onload to make it non-render-blocking
      const deferred = tag.replace(
        'rel="stylesheet"',
        'rel="stylesheet" media="print" onload="this.media=\'all\'"'
      );
      parts.push(deferred);
      lastIndex = match.index + tag.length;
    }
  }

  parts.push(html.slice(lastIndex));
  return parts.join('');
}

async function inlineCriticalCss() {
  const critters = new Critters({
    path: outDir,
    preload: 'media',
    inlineFonts: false,
    compress: true,
    pruneSource: false,
    reduceInlineStyles: true,
    mergeStylesheets: true,
  });

  const htmlFiles = await getHtmlFiles(outDir);
  console.log(`Inlining critical CSS for ${htmlFiles.length} HTML file(s)...`);

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, 'utf-8');
    try {
      let processed = await critters.process(html);
      // Also defer any remaining render-blocking stylesheet links
      processed = deferNonCriticalCss(processed);
      await writeFile(htmlFile, processed, 'utf-8');
      const relative = htmlFile.replace(outDir + '/', '');
      console.log(`  ✓ ${relative}`);
    } catch (err) {
      console.warn(`  ✗ ${htmlFile}: ${err.message}`);
    }
  }

  console.log('Critical CSS inlining complete.');
}

inlineCriticalCss().catch((err) => {
  console.error('Critical CSS inlining failed:', err);
  process.exit(1);
});
