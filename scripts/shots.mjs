/* global document, getComputedStyle */
// scripts/shots.mjs — screenshots per viewport width for a quick visual check.
// Usage: node scripts/shots.mjs [baseUrl] [outDir]   (default http://localhost:4173, reports/shots)

import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4173';
const out = process.argv[3] ?? 'reports/shots';
mkdirSync(out, { recursive: true });

const homeSizes = [
  [1440, 900],
  [1280, 800],
  [1024, 768],
  [375, 812],
];
const pages = ['/pay', '/thanks', '/impressum', '/privacy', '/terms', '/404.html'];
const pageSizes = [
  [1280, 800],
  [375, 812],
];

const browser = await chromium.launch();

for (const [w, h] of homeSizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/home-${w}.png`, fullPage: true });
  const info = await page.evaluate(() => {
    const stage = document.getElementById('stage');
    const cta = document.querySelector('[data-pin="cta"]');
    return {
      isBoard: stage.classList.contains('is-board'),
      transform: stage.style.transform,
      docW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      ctaLeft: Math.round(cta.getBoundingClientRect().left),
      ctaWidth: Math.round(cta.getBoundingClientRect().width),
      btnFontPx: getComputedStyle(document.querySelector('.btn')).fontSize,
    };
  });
  console.log(
    'home',
    w,
    JSON.stringify(info),
    errors.length ? 'ERRORS: ' + errors.join(' | ') : 'ok',
  );
  await page.close();
}

for (const path of pages) {
  for (const [w, h] of pageSizes) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    const res = await page.goto(base + path, { waitUntil: 'networkidle' });
    const name = path.replace(/[^a-z0-9]+/gi, '') || 'home';
    await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: true });
    const docW = await page.evaluate(() => document.documentElement.scrollWidth);
    console.log(
      path,
      w,
      'status',
      res?.status(),
      'scrollWidth',
      docW,
      errors.length ? 'ERRORS: ' + errors.join(' | ') : 'ok',
    );
    await page.close();
  }
}

await browser.close();
