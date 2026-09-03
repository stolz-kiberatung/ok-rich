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

// Was 340 until 2026-09-03. The owner then put three stickers (sample photo, life advice, todo
// note) ahead of the hero on the phone, knowingly trading the first-screen button for the
// pinboard feel. The button must still come right after the hero; this bound only says
// "not further down than the stickers plus hero make it": measured 627–638 px at 320–390 px on
// 2026-09-03, so 700 catches anything new creeping in above the button. Brief item 2.
const CTA_MAX_TOP = 700;
const MIN_TAP = 44; // brief item 3
const MIN_FONT = 14; // brief item 5
// Brief item 8. 5400 until ideas.txt was added on 2026-09-01, 5700 until 2026-09-03. Raised to
// 6000 the day the script started measuring with eight names on the board (see BOARD_FIXTURE):
// the phone shows them in one column, which is about 240 px more than the empty "Nobody yet"
// line this ceiling was calibrated against. Measured 5736 px at 375 px with the fixture.
const MAX_HEIGHT_375 = 6000;

const browser = await chromium.launch();
const failures = [];
const rows = [];

// The board is measured FULL, not empty. Until 2026-09-03 this script saw the page with the
// "Nobody yet" line only, and the two-column contributors list ran out of the window on every
// phone the moment real names arrived. Eight rows, names at the 40-character limit of
// src/name.ts, the amounts as wide as the formatter makes them. Needs VITE_STATS_URL set to
// anything non-empty in the build under test (a `.invalid` host is fine, the route answers first).
const BOARD_FIXTURE = {
  raised: 1234,
  visitors: 4711,
  contributors: Array.from({ length: 8 }, (_, i) => ({
    name: `Maximiliane-Alexandra von Hohenlohe ${i + 1}`.slice(0, 40),
    amount: 1000 - i * 100,
  })),
};

async function measure(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.route('**/okrich-stats*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(BOARD_FIXTURE),
    }),
  );
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForSelector('.board-name', { timeout: 5000 }).catch(() => {
    failures.push(`${width}px: board never rendered its rows (is VITE_STATS_URL set?)`);
  });
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
  // The 320x568 fold check went with the owner's 2026-09-03 decision (see CTA_MAX_TOP). Kept as
  // a printed note, not a failure, so the trade-off stays visible in every run.
  if (w === 320 && r.ctaTop !== null && r.ctaTop + 54 > 568)
    console.log(
      `  note: CTA below the fold on 320x568 (${r.ctaTop} + 54 > 568), accepted by owner`,
    );
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
