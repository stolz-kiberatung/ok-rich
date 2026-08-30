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
import { initStats } from './stats';

// Live totals (millionaire meter, sports car fund, visitor counter). Fails silently by design.
void initStats();

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
