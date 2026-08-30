// src/drag.ts — pure drag logic, separated for unit tests (docs/drag-reference.md §2).

export type Rect = { x: number; y: number; w: number; h: number };
export type Bounds = { w: number; h: number };

/** Keeps at least `margin` px of the element inside the stage on every side. */
export function clamp(r: Rect, b: Bounds, margin = 24): { x: number; y: number } {
  const x = Math.min(Math.max(r.x, margin - r.w), b.w - margin);
  const y = Math.min(Math.max(r.y, margin - r.h), b.h - margin);
  return { x, y };
}

/** Pointer moves in screen px, the element lives in design px → divide by the stage scale. */
export function delta(
  startClient: [number, number],
  client: [number, number],
  scale: number,
): [number, number] {
  return [(client[0] - startClient[0]) / scale, (client[1] - startClient[1]) / scale];
}

/** A movement counts as a drag once the Manhattan distance exceeds the threshold. */
export function isDrag(dx: number, dy: number, threshold = 3): boolean {
  return Math.abs(dx) + Math.abs(dy) > threshold;
}
