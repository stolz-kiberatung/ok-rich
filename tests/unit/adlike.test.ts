/**
 * tests/unit/adlike.test.ts — the board name must not become an advertising slot.
 *
 * Written 2026-09-04 from an attacker pass over the repository on the day it was made public.
 * Every string in "walks around the old filter" is a real bypass of the previous rule
 * (`cleanName`'s ten-entry TLD list), reproduced by running the shipped code against it. They are
 * kept as tests so the same walk-around cannot come back.
 */
import { describe, expect, it } from 'vitest';
import { looksLikeAd } from '../../src/moderation/adlike';

describe('looksLikeAd', () => {
  it('catches what the old ten-entry TLD list let through', () => {
    // Each of these reached the board unchanged before 2026-09-04.
    for (const name of [
      'Free crypto: t.me/pumpgroup',
      'bit.ly/free-money-now',
      'casino-bonus.ru',
      'Visit fans-4u-xyz.tv today',
      'shop here: deal.link',
      'my-site.info',
      'discord.gg/abcdef',
      'buy now at spam . com',
      'spam .com',
      'spam dot com',
      'spam (dot) com',
      'spam。com',
      'spam. com',
      'call 0800 555 0199 now',
    ]) {
      expect(looksLikeAd(name), name).toBe(true);
    }
  });

  it('still catches what the old list did catch', () => {
    for (const name of [
      'http://evil.example',
      'https://buy.now',
      'www.spam.net',
      'shop.xyz',
      'my.shop',
    ]) {
      expect(looksLikeAd(name), name).toBe(true);
    }
  });

  it('leaves real display names alone', () => {
    // The cost of a false positive is a paid entry filed as anonymous, so this list matters as
    // much as the one above. Initials, particles, apostrophes, non-Latin scripts and numbers that
    // are part of a name all have to survive.
    for (const name of [
      'Ada L.',
      'Ada L. Smith',
      'J. R. R. Tolkien',
      'Benni M.',
      "Tobias' Mom",
      'Get a job noob',
      'Anna von Berg',
      'Jean-Luc Picard',
      'Ente 🦆',
      'Марина',
      '山田太郎',
      'Player 1',
      'Agent 007',
      'Dr. No',
      'Marshall P.',
      'anonymous',
      'C3PO and R2D2',
      'Blink 182',
      'St. Pauli',
      'Mr. X',
      'Prof. Klein',
    ]) {
      expect(looksLikeAd(name), name).toBe(false);
    }
  });

  it('handles empty and junk input without throwing', () => {
    expect(looksLikeAd('')).toBe(false);
    expect(looksLikeAd('   ')).toBe(false);
    expect(looksLikeAd(undefined as unknown as string)).toBe(false);
    expect(looksLikeAd(null as unknown as string)).toBe(false);
  });

  it('does not modify the name it is given', () => {
    // The whole point of a predicate over a strip regex: normalising separators would mangle
    // "Ada L. Smith". The probe is internal; the caller's string is untouched.
    const name = 'Ada L. Smith';
    looksLikeAd(name);
    expect(name).toBe('Ada L. Smith');
  });
});
