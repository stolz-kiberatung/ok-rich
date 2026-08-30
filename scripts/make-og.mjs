// scripts/make-og.mjs — renders scripts/og.html to public/og.png (1200×630) with Playwright.
// Usage: npm run og   (reads VITE_DOMAIN and VITE_SITE_TITLE from .env)

import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

function loadEnvFile(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // no .env: fall back to process.env and defaults
  }
  return out;
}

const env = { ...loadEnvFile('.env'), ...process.env };
const domain = env.VITE_DOMAIN || 'okrich.lol';
const title = env.VITE_SITE_TITLE || 'OK RICH';

const html = readFileSync('scripts/og.html', 'utf8')
  .replaceAll('{{DOMAIN}}', domain)
  .replaceAll('{{TITLE}}', title);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(200);
const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
writeFileSync('public/og.png', png);
console.log(`public/og.png written (${png.length} bytes) for ${domain}`);
