import { describe, expect, it } from 'vitest';
import { formatEur, padCount, parseStats, percentOf } from '../../src/stats';

describe('percentOf', () => {
  it('renders four decimals', () => {
    expect(percentOf(0, 1_000_000)).toBe('0.0000');
    expect(percentOf(5, 1_000_000)).toBe('0.0005');
    expect(percentOf(12_345, 1_000_000)).toBe('1.2345');
  });

  it('clamps to the 0–100 range', () => {
    expect(percentOf(-10, 1000)).toBe('0.0000');
    expect(percentOf(5000, 1000)).toBe('100.0000');
  });

  it('survives nonsense input', () => {
    expect(percentOf(Number.NaN, 1000)).toBe('0.0000');
    expect(percentOf(100, 0)).toBe('0.0000');
  });
});

describe('formatEur', () => {
  it('groups thousands and appends the symbol', () => {
    expect(formatEur(0)).toBe('0 €');
    expect(formatEur(1234)).toBe('1,234 €');
    expect(formatEur(1_000_000)).toBe('1,000,000 €');
  });

  it('keeps at most two decimals and never goes negative', () => {
    expect(formatEur(12.5)).toBe('12.5 €');
    expect(formatEur(-5)).toBe('0 €');
  });
});

describe('padCount', () => {
  it('pads to six digits', () => {
    expect(padCount(0)).toBe('000000');
    expect(padCount(42)).toBe('000042');
    expect(padCount(1234567)).toBe('1234567');
  });

  it('floors and clamps', () => {
    expect(padCount(4.9)).toBe('000004');
    expect(padCount(-3)).toBe('000000');
    expect(padCount(Number.NaN)).toBe('000000');
  });
});

describe('parseStats', () => {
  it('accepts a well-formed payload', () => {
    expect(parseStats({ raised: 25, visitors: 7 })).toEqual({
      raised: 25,
      visitors: 7,
      contributors: [],
    });
    expect(parseStats({ raised: '25', visitors: '7', sales: 2 })).toEqual({
      raised: 25,
      visitors: 7,
      contributors: [],
    });
  });

  it('sorts contributors by amount and drops malformed entries', () => {
    const parsed = parseStats({
      raised: 60,
      visitors: 3,
      contributors: [
        { name: 'Ada', amount: 10 },
        { name: 'Grace', amount: 50 },
        { name: 'no amount' },
        { amount: 5 },
      ],
    });
    expect(parsed?.contributors).toEqual([
      { name: 'Grace', amount: 50 },
      { name: 'Ada', amount: 10 },
    ]);
  });

  it('rejects anything else', () => {
    expect(parseStats(null)).toBeNull();
    expect(parseStats('nope')).toBeNull();
    expect(parseStats({ raised: 'abc', visitors: 1 })).toBeNull();
    expect(parseStats({ visitors: 1 })).toBeNull();
  });
});
