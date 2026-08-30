// scripts/lighthouse.mjs — Lighthouse (desktop preset) against the production build.
// Usage: npm run build && npm run audit:lighthouse
// Writes reports/lighthouse.html + .json and exits 1 when a category is below 95.
// CI runs it with continue-on-error because shared runners jitter; locally it blocks a release.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';

const PORT = 4175;
const THRESHOLD = 95;
const CATEGORIES = ['performance', 'accessibility', 'best-practices'];

async function waitFor(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`preview server did not answer at ${url}`);
}

const preview = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore' },
);

let chrome;
let exitCode = 0;
try {
  await waitFor(`http://localhost:${PORT}/`);
  chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ['--headless=new', '--no-sandbox'],
  });
  const result = await lighthouse(
    `http://localhost:${PORT}/`,
    { port: chrome.port, output: ['html', 'json'], onlyCategories: CATEGORIES, logLevel: 'error' },
    desktopConfig,
  );
  if (!result) throw new Error('lighthouse returned no result');
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/lighthouse.html', result.report[0]);
  writeFileSync('reports/lighthouse.json', result.report[1]);
  for (const id of CATEGORIES) {
    const score = Math.round((result.lhr.categories[id]?.score ?? 0) * 100);
    const ok = score >= THRESHOLD;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${id.padEnd(16)} ${score}`);
    if (!ok) exitCode = 1;
  }
  console.log('report: reports/lighthouse.html');
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  try {
    if (chrome) await chrome.kill();
  } catch {
    // chrome-launcher cannot always remove its temp profile on Windows; harmless
  }
  preview.kill();
}
process.exit(exitCode);
