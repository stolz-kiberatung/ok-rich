// src/moderation/index.ts — is this board name allowed to appear on the front page?
//
// The blocklist, the normaliser and the vendored profanity list come from the owner's Vital Rival
// project (src/lib/moderation), taken over on 2026-09-01. They are used unchanged so that a fix
// in either project can be carried across by copying the file, not by re-deriving the logic.
//
// What is NOT taken over is Vital Rival's nickname shape: there a name is one token of letters and
// digits with no spaces, here it is a display name like "Ada L." Only the blocklist half applies.
//
// Attribution: the tier-2 list is LDNOOBW (CC BY 4.0), see blocklist.vendor.ts.

import { matchesBlocklist } from './blocklist';
import { normalizeForMatching } from './normalize';

/**
 * True when the name must not go on the board.
 *
 * Two tiers, both resistant to the usual evasions (leetspeak, homoglyphs, repeated letters,
 * spaced-out letters, digit codes):
 *   1. severe terms — hate slurs, extremist names, hate number codes — matched as substrings
 *   2. general profanity — matched only as whole tokens, so ordinary names survive
 *
 * Deliberately conservative in one direction: a paid entry that is wrongly rejected costs the
 * buyer a retry, while a slur on a public page costs considerably more.
 */
export function isBlockedName(raw: string): boolean {
  const name = String(raw ?? '').trim();
  if (!name) return false;
  const n = normalizeForMatching(name);
  return matchesBlocklist({
    substringCandidates: [n.normalized, n.collapsed, n.squashed, n.squashedRaw],
    exactCandidates: n.tokens,
    digitCandidates: n.digitSquashed,
    digitTokens: n.digitTokens,
  });
}

// Re-exported so the generated n8n bundle carries it too: the board name has to be judged
// server-side, and a second hand-written copy inside the workflow JSON is exactly how the old
// ten-entry TLD list drifted out of step with this one. See adlike.ts for what it catches.
export { looksLikeAd } from './adlike';
