// src/stage.ts — pure stage-scale calculations (docs/drag-reference.md §1). DOM wiring lives in pinboard.ts.

import { STAGE } from '../site.config';

/** scale = min(1, viewportWidth / stageWidth); nonsense input falls back to 1. */
export function computeScale(viewportWidth: number, stageWidth: number = STAGE.width): number {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return 1;
  return Math.min(1, viewportWidth / stageWidth);
}

/** True when the viewport is wide enough for the scaled pinboard instead of the stacked layout. */
export function isBoardViewport(
  viewportWidth: number,
  breakpoint: number = STAGE.breakpoint,
): boolean {
  return viewportWidth >= breakpoint;
}

/** Height the wrapper must reserve so the page flows correctly below the scaled stage. */
export function scaledStageHeight(scale: number): number {
  return STAGE.height * scale;
}
