// src/main.ts — entry for the pinboard page. Board layout is an enhancement on top of the stacked DOM.

import { STAGE } from '../site.config';
import {
  applyLayout,
  clearLayout,
  fitStage,
  growStageBelow,
  initMobileDrag,
  initPinboard,
  reclampAll,
  unfitStage,
} from './pinboard';
import { initStats } from './stats';

/**
 * Live totals, then make room for them: when names arrive the contributors board grows, and
 * everything below it moves down by exactly that much so the designed gaps survive. offsetHeight
 * is used because it is the unscaled layout height, unaffected by the stage transform.
 */
async function loadLiveNumbers(): Promise<void> {
  const board = document.querySelector<HTMLElement>('[data-pin="board"]');
  const before = board?.offsetHeight ?? 0;
  await initStats();
  const stageEl = document.getElementById('stage');
  const wrap = stageEl?.parentElement;
  if (!board || !stageEl || !wrap || !stageEl.classList.contains('is-board')) return;
  const grown = board.offsetHeight - before;
  if (grown > 0) {
    growStageBelow(stageEl, wrap, (parseFloat(board.style.top) || 0) + before, grown);
  }
}

void loadLiveNumbers();

const stage = document.getElementById('stage');
const wrapper = stage?.parentElement;

if (stage && wrapper) {
  const media = window.matchMedia(`(min-width: ${STAGE.breakpoint}px)`);
  let teardown: (() => void) | null = null;
  let mobileTeardown: (() => void) | null = null;
  let scale = 1;

  // Phone: the sticker cluster is movable by finger. Switched off before the board takes over,
  // so its inline transforms never fight the board's absolute positions.
  const enableMobileDrag = () => {
    if (mobileTeardown) return;
    mobileTeardown = initMobileDrag(stage);
  };
  const disableMobileDrag = () => {
    if (!mobileTeardown) return;
    mobileTeardown();
    mobileTeardown = null;
  };

  const enableBoard = () => {
    if (teardown) return;
    disableMobileDrag();
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
    enableMobileDrag();
  };

  const onResize = () => {
    if (!teardown) return;
    scale = fitStage(stage, wrapper);
    reclampAll(stage);
  };

  media.addEventListener('change', (e) => (e.matches ? enableBoard() : disableBoard()));
  window.addEventListener('resize', onResize);
  if (media.matches) enableBoard();
  else enableMobileDrag();
}
