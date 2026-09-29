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
  resizeStageBelow,
  unfitStage,
} from './pinboard';
import { initEasterEgg } from './easter-egg';
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
initEasterEgg();

/**
 * The Wall of Thumbs ships with its later tiles already `hidden` in the markup (progressive
 * enhancement: no flash of the full grid before this runs, and nothing to see here without JS
 * either). The toggle reveals them and, on the board, has to make room the same way the
 * contributors board does: everything below the window moves down by exactly the height the
 * window gained, and back up again on collapse.
 */
function initWallExpand(): void {
  const wall = document.querySelector<HTMLElement>('[data-pin="wall"]');
  const grid = document.getElementById('wall-grid');
  const toggle = document.getElementById('wall-toggle');
  if (!wall || !grid || !toggle) return;
  const extra = [...grid.querySelectorAll<HTMLElement>('.wall-tile[hidden]')];
  if (extra.length === 0) return; // Everything already fits in the collapsed row.

  const total = grid.children.length;
  toggle.hidden = false;
  toggle.textContent = `Show all photos (${total})`;

  toggle.addEventListener('click', () => {
    const stageEl = document.getElementById('stage');
    const wrap = stageEl?.parentElement;
    const isBoard = Boolean(stageEl?.classList.contains('is-board'));
    const before = wall.offsetHeight;
    const wasExpanded = toggle.getAttribute('aria-expanded') === 'true';

    for (const tile of extra) tile.hidden = wasExpanded;
    toggle.setAttribute('aria-expanded', String(!wasExpanded));
    toggle.textContent = wasExpanded ? `Show all photos (${total})` : 'Show fewer photos';

    if (!isBoard || !stageEl || !wrap) return;
    const delta = wall.offsetHeight - before;
    resizeStageBelow(stageEl, wrap, (parseFloat(wall.style.top) || 0) + before, delta);
  });
}

initWallExpand();

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
