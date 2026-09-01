/* global document, window, getComputedStyle */
// scripts/check-mobile.mjs — measures the stacked layout against docs/MOBILE-BRIEF.md.
// Usage: node scripts/check-mobile.mjs [baseUrl]   (default http://localhost:4173)
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const WIDTHS = [320, 344, 360, 375, 390, 393, 412, 414, 430, 480, 540, 600, 720, 767];
const LANDSCAPE = [
  { w: 667, h: 375 },
  { w: 844, h: 390 },
];

const CTA_MAX_TOP = 340; // brief item 2 — see the note there on why not 100
const MIN_TAP = 44; // brief item 3
const MIN_FONT = 14; // brief item 5
const MAX_HEIGHT_375 = 5400; // brief item 8 — raised when all 27 elements came back

const browser = await chromium.launch();
const failures = [];
const rows = [];

async function measure(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(250);
  const r = await page.evaluate(
    ({ minTap, minFont }) => {
      const de = document.documentElement;
      const vw = de.clientWidth;
      const bleeding = [];
      const smallTaps = [];
      const smallText = [];
      for (const el of document.querySelectorAll('body *')) {
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        const name = el.dataset.pin
          ? `[${el.dataset.pin}]`
          : el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : '');
        if (box.right > vw + 1 || box.left < -1) bleeding.push(name);
        if (el.matches('a, button')) {
          if (box.height < minTap || box.width < minTap)
            smallTaps.push(`${name} ${Math.round(box.width)}x${Math.round(box.height)}`);
        }
        const fs = parseFloat(getComputedStyle(el).fontSize);
        const ownText = [...el.childNodes].some(
          (n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0,
        );
        if (ownText && fs < minFont) smallText.push(`${name} ${fs}px`);
      }
      const btn = document.querySelector('a.btn');
      const btnBox = btn ? btn.getBoundingClientRect() : null;
      const stageKids = [...document.querySelectorAll('.stage > *')];
      return {
        docH: Math.round(de.scrollHeight),
        hScroll: de.scrollWidth - de.clientWidth,
        ctaTop: btnBox ? Math.round(btnBox.top + window.scrollY) : null,
        ctaHref: btn ? btn.getAttribute('href') : null,
        visible: stageKids.filter((el) => el.getBoundingClientRect().height > 0).length,
        total: stageKids.length,
        bleeding: [...new Set(bleeding)],
        smallTaps: [...new Set(smallTaps)],
        smallText: [...new Set(smallText)],
      };
    },
    { minTap: MIN_TAP, minFont: MIN_FONT },
  );
  await page.close();
  return r;
}

for (const w of WIDTHS) {
  const r = await measure(w, 800);
  const bad = [];
  if (r.hScroll > 0) bad.push(`hScroll ${r.hScroll}`);
  if (r.bleeding.length) bad.push(`bleeds: ${r.bleeding.slice(0, 3).join(', ')}`);
  if (r.ctaTop === null || r.ctaTop > CTA_MAX_TOP) bad.push(`ctaTop ${r.ctaTop}`);
  if (r.ctaHref !== '/pay') bad.push(`ctaHref ${r.ctaHref}`);
  if (r.smallTaps.length) bad.push(`taps: ${r.smallTaps.slice(0, 2).join(', ')}`);
  if (r.smallText.length) bad.push(`text: ${r.smallText.slice(0, 2).join(', ')}`);
  if (w === 375 && r.docH > MAX_HEIGHT_375) bad.push(`docH ${r.docH} > ${MAX_HEIGHT_375}`);
  // The real requirement: on the smallest phone still in use the whole button is on screen.
  if (w === 320 && r.ctaTop !== null && r.ctaTop + 54 > 568)
    bad.push(`CTA below the fold on 320x568 (${r.ctaTop} + 54 > 568)`);
  if (bad.length) failures.push(`${w}px: ${bad.join(' | ')}`);
  rows.push({
    w,
    docH: r.docH,
    ctaTop: r.ctaTop,
    shown: `${r.visible}/${r.total}`,
    issues: bad.length || '',
  });
}

for (const { w, h } of LANDSCAPE) {
  const r = await measure(w, h);
  const bad = [];
  if (r.hScroll > 0) bad.push(`hScroll ${r.hScroll}`);
  if (r.bleeding.length) bad.push(`bleeds: ${r.bleeding.slice(0, 3).join(', ')}`);
  if (bad.length) failures.push(`${w}x${h} landscape: ${bad.join(' | ')}`);
  rows.push({
    w: `${w}x${h}`,
    docH: r.docH,
    ctaTop: r.ctaTop,
    shown: `${r.visible}/${r.total}`,
    issues: bad.length || '',
  });
}

console.table(rows);
await browser.close();

if (failures.length) {
  console.error(
    `\n${failures.length} check(s) failed:\n` + failures.map((f) => '  - ' + f).join('\n'),
  );
  process.exit(1);
}
console.log('\nAll mobile checks passed.');
