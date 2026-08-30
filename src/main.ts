// src/main.ts — entry for the pinboard page. Board layout is an enhancement on top of the stacked DOM.

import { STAGE } from '../site.config';
import {
  applyLayout,
  clearLayout,
  fitStage,
  initPinboard,
  reclampAll,
  unfitStage,
} from './pinboard';

// Sports car fund: the bar width comes from the build-time percentage (CSSOM, no inline styles).
for (const fill of document.querySelectorAll<HTMLElement>('.goal-fill')) {
  const pct = Math.min(100, Math.max(0, parseFloat(fill.dataset.percent ?? '0')));
  fill.style.width = `${pct}%`;
}

// Retro visitor counter: deterministic slow count derived from the clock, no storage, no server.
const counter = document.getElementById('visitor-count');
if (counter) {
  const n = 1287 + Math.floor((Date.now() / 1000 - 1_780_000_000) / 913);
  counter.textContent = String(Math.max(n, 1288)).padStart(6, '0');
}

const stage = document.getElementById('stage');
const wrapper = stage?.parentElement;

if (stage && wrapper) {
  const media = window.matchMedia(`(min-width: ${STAGE.breakpoint}px)`);
  let teardown: (() => void) | null = null;
  let scale = 1;

  const enableBoard = () => {
    if (teardown) return;
    stage.classList.add('is-board');
    applyLayout(stage);
    scale = fitStage(stage, wrapper);
    teardown = initPinboard(stage, () => scale);
  };

  const disableBoard = () => {
    if (!teardown) return;
    teardown();
    teardown = null;
    stage.classList.remove('is-board');
    clearLayout(stage);
    unfitStage(stage, wrapper);
  };

  const onResize = () => {
    if (!teardown) return;
    scale = fitStage(stage, wrapper);
    reclampAll(stage);
  };

  media.addEventListener('change', (e) => (e.matches ? enableBoard() : disableBoard()));
  window.addEventListener('resize', onResize);
  if (media.matches) enableBoard();
}
