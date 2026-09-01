import { describe, expect, it } from 'vitest';
import { isBlockedName } from '../../src/moderation';

/**
 * Taken over from Vital Rival on 2026-09-01. These tests are the contract for OK RICH's board:
 * ordinary names must survive, and the usual evasion tricks must not.
 */
describe('isBlockedName', () => {
  it('lets ordinary board names through', () => {
    for (const ok of ['Ada L.', 'Tobias', 'Jean-Luc', "O'Brien", 'Müller', '東京', 'anonymous']) {
      expect(isBlockedName(ok), ok).toBe(false);
    }
  });

  it('does not fall for the Scunthorpe problem', () => {
    for (const ok of ['Scunthorpe', 'Essex', 'Analyst Anna', 'Cassiopeia', 'Klaus Assmann']) {
      expect(isBlockedName(ok), ok).toBe(false);
    }
  });

  it('blocks severe terms even when spelled around', () => {
    for (const bad of ['hitler', 'H1TL3R', 'h i t l e r', 'hhhiiitler', 'AdolfHitler']) {
      expect(isBlockedName(bad), bad).toBe(true);
    }
  });

  it('blocks hate number codes', () => {
    for (const bad of ['1488', 'ada 88', 'rival1488']) {
      expect(isBlockedName(bad), bad).toBe(true);
    }
  });

  it('blocks plain profanity as a whole word', () => {
    expect(isBlockedName('arschloch')).toBe(true);
    expect(isBlockedName('asshole')).toBe(true);
  });

  it('handles empty and junk input without throwing', () => {
    expect(isBlockedName('')).toBe(false);
    expect(isBlockedName('   ')).toBe(false);
  });
});
