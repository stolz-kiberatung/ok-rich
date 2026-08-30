import { describe, expect, it } from 'vitest';
import { computeScale, isBoardViewport, scaledStageHeight } from '../../src/stage';

describe('computeScale', () => {
  it('is 1 at exactly the design width', () => {
    expect(computeScale(1440)).toBe(1);
  });

  it('never exceeds 1 on wide screens', () => {
    expect(computeScale(1920)).toBe(1);
  });

  it('shrinks proportionally below the design width', () => {
    expect(computeScale(1280)).toBeCloseTo(0.8889, 4);
    expect(computeScale(720)).toBe(0.5);
  });

  it('falls back to 1 for nonsense input', () => {
    expect(computeScale(0)).toBe(1);
    expect(computeScale(-10)).toBe(1);
    expect(computeScale(Number.NaN)).toBe(1);
  });

  it('accepts a custom stage width', () => {
    expect(computeScale(500, 1000)).toBe(0.5);
  });
});

describe('isBoardViewport', () => {
  it('is true from the breakpoint upwards', () => {
    expect(isBoardViewport(768)).toBe(true);
    expect(isBoardViewport(1440)).toBe(true);
  });

  it('is false below the breakpoint', () => {
    expect(isBoardViewport(767)).toBe(false);
    expect(isBoardViewport(375)).toBe(false);
  });

  it('accepts a custom breakpoint', () => {
    expect(isBoardViewport(900, 1024)).toBe(false);
  });
});

describe('scaledStageHeight', () => {
  it('scales the 900 px design height', () => {
    expect(scaledStageHeight(1)).toBe(900);
    expect(scaledStageHeight(0.5)).toBe(450);
  });
});
