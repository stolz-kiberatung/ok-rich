import { describe, expect, it } from 'vitest';
import { clamp, delta, isDrag } from '../../src/drag';

const stage = { w: 1440, h: 900 };

describe('clamp', () => {
  it('leaves an element that is fully inside untouched', () => {
    expect(clamp({ x: 100, y: 200, w: 300, h: 150 }, stage)).toEqual({ x: 100, y: 200 });
  });

  it('keeps at least 24 px visible on the left and top', () => {
    expect(clamp({ x: -500, y: -500, w: 300, h: 150 }, stage)).toEqual({ x: -276, y: -126 });
  });

  it('keeps at least 24 px visible on the right and bottom', () => {
    expect(clamp({ x: 5000, y: 5000, w: 300, h: 150 }, stage)).toEqual({ x: 1416, y: 876 });
  });

  it('honours a custom margin', () => {
    expect(clamp({ x: -500, y: 5000, w: 100, h: 100 }, stage, 50)).toEqual({ x: -50, y: 850 });
  });

  it('is exact at the boundary', () => {
    expect(clamp({ x: 1416, y: 876, w: 300, h: 150 }, stage)).toEqual({ x: 1416, y: 876 });
    expect(clamp({ x: -276, y: -126, w: 300, h: 150 }, stage)).toEqual({ x: -276, y: -126 });
  });
});

describe('delta', () => {
  it('returns screen deltas unchanged at scale 1', () => {
    expect(delta([10, 10], [130, 90], 1)).toEqual([120, 80]);
  });

  it('divides screen deltas by the stage scale', () => {
    expect(delta([0, 0], [120, 80], 0.5)).toEqual([240, 160]);
  });

  it('handles negative movement', () => {
    expect(delta([100, 100], [40, 70], 0.8)).toEqual([-75, -37.5]);
  });
});

describe('isDrag', () => {
  it('is false at or below the 3 px threshold', () => {
    expect(isDrag(0, 0)).toBe(false);
    expect(isDrag(2, 1)).toBe(false);
    expect(isDrag(3, 0)).toBe(false);
  });

  it('is true above the threshold, using the Manhattan distance', () => {
    expect(isDrag(2, 2)).toBe(true);
    expect(isDrag(-4, 0)).toBe(true);
  });

  it('accepts a custom threshold', () => {
    expect(isDrag(5, 5, 10)).toBe(false);
    expect(isDrag(6, 5, 10)).toBe(true);
  });
});
