// scripts/make-icons.mjs — renders public/favicon.svg to the PNG icons browsers still ask for.
// Usage: npm run icons   (after changing favicon.svg)

import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync('public/favicon.svg', 'utf8');
const targets = [
  [96, 'public/favicon.png'],
  [180, 'public/apple-touch-icon.png'],
];

const browser = await chromium.launch();
for (const [size, out] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;width:${size}px;height:${size}px}` +
      `svg{width:${size}px;height:${size}px;display:block}</style>${svg}`,
  );
  await page.waitForTimeout(150);
  const png = await page.screenshot({ omitBackground: true });
  writeFileSync(out, png);
  console.log(`${out} ${size}×${size} (${(png.length / 1024).toFixed(1)} KB)`);
  await page.close();
}
await browser.close();
