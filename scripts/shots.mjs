import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'reports/shots';
const sizes = [
  [1440, 900],
  [1280, 800],
  [1024, 768],
  [375, 812],
];
const browser = await chromium.launch();
for (const [w, h] of sizes) {
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
    const btn = document.querySelector('.btn');
    return {
      isBoard: stage.classList.contains('is-board'),
      transform: stage.style.transform,
      wrapperH: stage.parentElement.style.height,
      docW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      ctaRect: cta.getBoundingClientRect().toJSON(),
      btnFontPx: getComputedStyle(btn).fontSize,
      bodyFontPx: getComputedStyle(document.querySelector('.why p')).fontSize,
    };
  });
  console.log(
    w,
    JSON.stringify(info),
    errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no console errors',
  );
  await page.close();
}
await browser.close();
