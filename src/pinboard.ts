// src/pinboard.ts — DOM wiring for the pinboard (docs/drag-reference.md §1–2).
// Pure maths lives in drag.ts and stage.ts; this file only touches elements.

import { STAGE, Z_DRAG_MAX, Z_DRAG_START, elements } from '../site.config';
import { clamp, delta, isDrag } from './drag';
import { computeScale, scaledStageHeight } from './stage';

// The stage grows when a window below the fold gets taller (contributors arriving), so the
// height is state, not a constant. Clamping and the wrapper height both read it.
let stageHeight = STAGE.height;
const bounds = () => ({ w: STAGE.width, h: stageHeight });

export function getStageHeight(): number {
  return stageHeight;
}

/** Writes positions, rotation, z-index and draggability from site.config.ts through the CSSOM. */
export function applyLayout(stage: HTMLElement): void {
  for (const spec of elements) {
    const el = stage.querySelector<HTMLElement>(`[data-pin="${spec.id}"]`);
    if (!el) continue;
    el.style.left = `${spec.x}px`;
    el.style.top = `${spec.y}px`;
    el.style.zIndex = String(spec.z);
    if (spec.rotate !== undefined) el.style.setProperty('--rot', `${spec.rotate}deg`);
    el.classList.toggle('draggable', spec.draggable);
  }
}

/** Removes everything applyLayout and drags wrote, so the stacked layout is clean again. */
export function clearLayout(stage: HTMLElement): void {
  for (const el of stage.querySelectorAll<HTMLElement>(':scope > .abs')) {
    el.style.removeProperty('left');
    el.style.removeProperty('top');
    el.style.removeProperty('z-index');
    el.style.removeProperty('--rot');
    el.classList.remove('draggable', 'dragging');
  }
}

/** Scales the stage to the viewport and reserves the scaled height on the wrapper. Returns the scale. */
export function fitStage(stage: HTMLElement, wrapper: HTMLElement): number {
  const scale = computeScale(document.documentElement.clientWidth);
  stage.style.transform = `scale(${scale})`;
  stage.style.height = `${stageHeight}px`;
  wrapper.style.height = `${scaledStageHeight(scale, stageHeight)}px`;
  return scale;
}

/**
 * Makes room for a window that grew (the contributors board when names arrive): everything that
 * starts below `fromY` moves down by `delta`, so every gap stays exactly as designed, and the
 * stage itself gets taller instead of letting the content collide.
 */
export function growStageBelow(
  stage: HTMLElement,
  wrapper: HTMLElement,
  fromY: number,
  delta: number,
): void {
  if (!Number.isFinite(delta) || delta <= 0) return;
  for (const el of stage.querySelectorAll<HTMLElement>(':scope > .abs')) {
    const top = parseFloat(el.style.top);
    if (Number.isFinite(top) && top >= fromY) el.style.top = `${top + delta}px`;
  }
  stageHeight += delta;
  fitStage(stage, wrapper);
}

export function unfitStage(stage: HTMLElement, wrapper: HTMLElement): void {
  stageHeight = STAGE.height;
  stage.style.removeProperty('transform');
  stage.style.removeProperty('height');
  wrapper.style.removeProperty('height');
}

/** After a resize or orientation change, pulls every element back into the stage (constitution §8). */
export function reclampAll(stage: HTMLElement): void {
  for (const el of stage.querySelectorAll<HTMLElement>(':scope > .draggable')) {
    const { x, y } = clamp(
      {
        x: parseFloat(el.style.left) || 0,
        y: parseFloat(el.style.top) || 0,
        w: el.offsetWidth,
        h: el.offsetHeight,
      },
      bounds(),
      STAGE.clampMargin,
    );
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }
}

/** Swallows the click that the browser fires right after a drag, and only that one. */
function swallowNextClick(): void {
  const swallow = (c: Event) => {
    c.stopPropagation();
    c.preventDefault();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  // The synthetic click arrives in the same task as pointerup. If none arrives (touch drags
  // do not produce one), the listener must not linger and eat the visitor's next real click.
  window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 100);
}

/** Pointer-event drag for every `.draggable` child of the stage. Returns a teardown function. */
export function initPinboard(stage: HTMLElement, getScale: () => number): () => void {
  const ac = new AbortController();
  let topZ = Z_DRAG_START;

  // Links and buttons inside windows stay clickable and never start a drag.
  for (const control of stage.querySelectorAll<HTMLElement>('.draggable a, .draggable button')) {
    control.addEventListener('pointerdown', (ev) => ev.stopPropagation(), { signal: ac.signal });
  }

  for (const el of stage.querySelectorAll<HTMLElement>(':scope > .draggable')) {
    el.addEventListener(
      'pointerdown',
      (ev) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        const scale = getScale();
        const startX = parseFloat(el.style.left) || 0;
        const startY = parseFloat(el.style.top) || 0;
        const origin: [number, number] = [ev.clientX, ev.clientY];
        let moved = false;
        topZ = topZ < Z_DRAG_MAX ? topZ + 1 : Z_DRAG_START;
        el.style.zIndex = String(topZ);
        el.classList.add('dragging');
        el.setPointerCapture(ev.pointerId);

        const onMove = (e: PointerEvent) => {
          const [dx, dy] = delta(origin, [e.clientX, e.clientY], scale);
          if (!moved && isDrag(dx, dy)) moved = true;
          if (!moved) return;
          const { x, y } = clamp(
            { x: startX + dx, y: startY + dy, w: el.offsetWidth, h: el.offsetHeight },
            bounds(),
            STAGE.clampMargin,
          );
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
        };
        const onUp = () => {
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp);
          el.removeEventListener('pointercancel', onUp);
          el.classList.remove('dragging');
          if (moved) swallowNextClick();
        };
        el.addEventListener('pointermove', onMove, { signal: ac.signal });
        el.addEventListener('pointerup', onUp, { signal: ac.signal });
        el.addEventListener('pointercancel', onUp, { signal: ac.signal });
      },
      { signal: ac.signal },
    );
  }
  return () => ac.abort();
}
