import { describe, expect, it } from 'vitest';
import { KONAMI, konamiStep, tapStep } from '../../src/easter-egg';

/**
 * The easter egg is hidden on purpose, so nothing on the page hints at it except the console and
 * a comment in the source. What must hold is the unlocking logic: the full sequence opens it, a
 * wrong key does not leave a half-open door, and ordinary typing never trips it by accident.
 */

function feed(keys: string[]): { pos: number; unlocked: boolean } {
  let pos = 0;
  let unlocked = false;
  for (const k of keys) {
    const r = konamiStep(pos, k);
    pos = r.pos;
    unlocked ||= r.unlocked;
  }
  return { pos, unlocked };
}

describe('Konami code', () => {
  it('unlocks on the full sequence', () => {
    expect(feed([...KONAMI]).unlocked).toBe(true);
  });

  it('accepts B and A in either case', () => {
    const keys = [...KONAMI.slice(0, 8), 'B', 'A'];
    expect(feed(keys).unlocked).toBe(true);
  });

  it('starts over after the sequence completes', () => {
    expect(feed([...KONAMI]).pos).toBe(0);
  });

  it('does not unlock on a wrong key in the middle', () => {
    const keys = [...KONAMI];
    keys[5] = 'ArrowUp';
    expect(feed(keys).unlocked).toBe(false);
  });

  it('recovers when a wrong key is itself the start of a new attempt', () => {
    // up up up down down ...: the third "up" must not throw the whole attempt away
    expect(feed(['ArrowUp', ...KONAMI]).unlocked).toBe(true);
  });

  it('never unlocks from ordinary typing', () => {
    expect(feed('make me rich, ba ba ba'.split('')).unlocked).toBe(false);
  });
});

describe('seven quick taps', () => {
  it('unlocks on the seventh tap inside the window', () => {
    let taps: number[] = [];
    let unlocked = false;
    for (let i = 0; i < 7; i++) {
      const r = tapStep(taps, 1000 + i * 200);
      taps = r.taps;
      unlocked ||= r.unlocked;
    }
    expect(unlocked).toBe(true);
    expect(taps).toEqual([]);
  });

  it('does not unlock when the taps are too slow', () => {
    let taps: number[] = [];
    let unlocked = false;
    for (let i = 0; i < 7; i++) {
      const r = tapStep(taps, 1000 + i * 1000);
      taps = r.taps;
      unlocked ||= r.unlocked;
    }
    expect(unlocked).toBe(false);
  });
});
