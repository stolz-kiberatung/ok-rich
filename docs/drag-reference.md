# docs/drag-reference.md — Pinboard & drag implementation reference

The pointer-capture drag model this site uses, written down so it is implemented
exactly like this and not re-invented. No third-party assets, copy or design.

## 1. Stage model

- The pinboard is a fixed-size stage: `.stage { position: relative; width: 1440px; height: 900px; isolation: isolate; }`
- Every pinboard element is a child of `.stage` with `class="abs draggable"`,
  positioned by inline `left/top` in **design pixels** (1440-space).
- On load and on `resize`, JS fits the stage to the viewport:
  `scale = min(1, window.innerWidth / 1440)`; apply
  `stage.style.transform = \`scale(${scale})\``with`transform-origin: top left`and set the wrapper height to`900 * scale` so the page flows correctly.
- Below 768 px: stage is NOT scaled; `.stage` becomes `width: 100%; height: auto`,
  children become `position: static` and stack in DOM order; drag is disabled.
- Background dot grid: `background-image: radial-gradient(#00000021 1px, transparent 1.3px); background-size: 34px 34px;`

## 2. Drag handler (Pointer Events, ~20 elements → `left/top` is fine)

```ts
// src/drag.ts — pure logic is separated for unit tests
export type Rect = { x: number; y: number; w: number; h: number };
export type Bounds = { w: number; h: number };

export function clamp(r: Rect, b: Bounds, margin = 24): { x: number; y: number } {
  // keep at least `margin` px of the element inside the stage on every side
  const x = Math.min(Math.max(r.x, margin - r.w), b.w - margin);
  const y = Math.min(Math.max(r.y, margin - r.h), b.h - margin);
  return { x, y };
}

export function delta(
  startClient: [number, number],
  client: [number, number],
  scale: number,
): [number, number] {
  // pointer moves in screen px, element lives in design px → divide by scale
  return [(client[0] - startClient[0]) / scale, (client[1] - startClient[1]) / scale];
}

export function isDrag(dx: number, dy: number, threshold = 3): boolean {
  return Math.abs(dx) + Math.abs(dy) > threshold;
}
```

```ts
// src/pinboard.ts — DOM wiring
export function initPinboard(stage: HTMLElement, getScale: () => number): () => void {
  const ac = new AbortController();
  let topZ = 10;
  for (const el of stage.querySelectorAll<HTMLElement>(':scope > .draggable')) {
    el.style.touchAction = 'none';
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
        el.style.zIndex = String(++topZ);
        el.classList.add('dragging');
        el.setPointerCapture(ev.pointerId);

        const onMove = (e: PointerEvent) => {
          const [dx, dy] = delta(origin, [e.clientX, e.clientY], scale);
          if (!moved && isDrag(dx, dy)) moved = true;
          const { x, y } = clamp(
            { x: startX + dx, y: startY + dy, w: el.offsetWidth, h: el.offsetHeight },
            { w: stage.offsetWidth, h: stage.offsetHeight },
          );
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
        };
        const onUp = () => {
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp);
          el.removeEventListener('pointercancel', onUp);
          el.classList.remove('dragging');
          if (moved) {
            // swallow the click that follows a drag so links inside windows don't fire
            window.addEventListener(
              'click',
              (c) => {
                c.stopPropagation();
                c.preventDefault();
              },
              { capture: true, once: true, signal: ac.signal },
            );
          }
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
```

Notes:

- `setPointerCapture` keeps events flowing to the element even when the
  pointer outruns it (the cleaner equivalent of window-level move/up listeners).
- All non-interactive children (images, icons, text) get `class="no-drag"`:
  `.no-drag { pointer-events: none; -webkit-user-drag: none; user-select: none; }`
  Interactive children (links, the CTA button) keep pointer events and must
  stop propagation on `pointerdown` so they are clickable without starting a drag.
- `.draggable { cursor: grab; user-select: none; } .draggable.dragging { cursor: grabbing; }`
- No `requestAnimationFrame` batching is needed at ~20 elements; a single
  `left/top` write per `pointermove` is well under frame budget.
- `@media (prefers-reduced-motion: reduce)`: no entrance animations; drag stays.

## 3. Window styling (CSS only, no images)

```css
.win {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  padding: 8px 4px 4px;
  border-radius: 8px;
  border: 1px solid transparent;
  background:
    linear-gradient(#fff, #f3f3f3) padding-box,
    linear-gradient(#e6e6e6, #bdbdbd) border-box;
  filter: drop-shadow(0 10px 12px rgba(0, 0, 0, 0.12));
}
.win .bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 4px 8px;
}
.win .dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 4px;
}
.kao {
  white-space: nowrap;
  line-height: 1;
  font-weight: 400;
}
```

Each element may carry a small rotation (`transform: rotate(-8deg)`) — rotation
is set on the element itself; the drag handler never touches `transform`.

## 4. Acceptance criteria to copy into spec.md (EARS)

- WHEN a visitor presses the primary pointer on a draggable window and moves
  more than 3 px, the window SHALL follow the pointer 1:1 in design-pixel
  space regardless of stage scale.
- WHEN a window is released after a drag, the system SHALL suppress the
  following click event exactly once.
- WHEN a window would leave the stage, the system SHALL clamp it so that at
  least 24 px remain visible on every side.
- WHEN the viewport is narrower than 768 px, windows SHALL be stacked in DOM
  order and SHALL NOT be draggable.
- WHEN the viewport is resized, the stage SHALL rescale without any window
  changing its design-pixel position.
- WHILE a window is being dragged, it SHALL have the highest z-index.
