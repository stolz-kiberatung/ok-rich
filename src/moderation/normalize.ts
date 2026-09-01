/**
 * Normalization helpers for nickname moderation. Pure functions only.
 * Pipeline: NFKC-normalize → strip invisibles → lowercase → map
 * leetspeak/homoglyphs → collapse repeats. Matching always runs on the
 * normalized form; the raw input is what gets displayed if accepted.
 */

/**
 * Zero-width and invisible characters that can hide blocked terms.
 *
 * Matched by named Unicode class rather than pasted literally. As literals they are invisible in
 * a diff and trip eslint's no-irregular-whitespace — which is precisely the property that makes
 * them useful to an attacker. \p{Cf} covers the joiners, the bidi overrides and the byte-order
 * mark, \p{Cc} the control characters. A handful of exotic format codepoints outside both
 * classes (U+034F, the Khmer inherent vowels, U+180E) are deliberately not listed: writing
 * them out means pasting invisible characters back into this file, and NFKC normalisation
 * plus the zalgo collapse already blunt them.
 */
const INVISIBLE_CHARS = /[\p{Cc}\p{Cf}]/gu;

/** Unicode-normalize (NFKC) and strip invisible/zero-width characters. */
export function stripInvisible(input: string): string {
  return input.normalize('NFKC').replace(INVISIBLE_CHARS, '');
}

/**
 * Leetspeak / homoglyph substitutions applied BEFORE blocklist matching so
 * "h1tl3r"-style evasions resolve to the plain term. Extend as evasion
 * patterns show up in reports.
 */
const SUBSTITUTIONS: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '2': 'z',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'i',
  '+': 't',
  '€': 'e', // €
  '£': 'l', // £
  '¢': 'c', // ¢
  à: 'a',
  á: 'a',
  â: 'a',
  ä: 'a',
  å: 'a',
  è: 'e',
  é: 'e',
  ê: 'e',
  ë: 'e',
  ì: 'i',
  í: 'i',
  î: 'i',
  ï: 'i',
  ò: 'o',
  ó: 'o',
  ô: 'o',
  ö: 'o',
  ù: 'u',
  ú: 'u',
  û: 'u',
  ü: 'u',
  ß: 'ss',
  ç: 'c',
  ñ: 'n',
};

export function mapHomoglyphs(input: string): string {
  let result = '';
  for (const char of input) {
    result += SUBSTITUTIONS[char] ?? char;
  }
  return result;
}

/** Collapse runs of the same character ("heeello" → "helo") for matching. */
export function collapseRepeats(input: string): string {
  return input.replace(/(.)\1+/g, '$1');
}

/**
 * Full normalization used for matching against blocklist/reserved names.
 * Returns spaced, squashed, raw and repeat-collapsed variants so multi-word
 * ("h i t l e r") and repeat ("nnaazzii") evasions are caught, while exact
 * matchers can still see the un-collapsed tokens.
 */
export function normalizeForMatching(input: string): {
  normalized: string;
  collapsed: string;
  /** Collapsed, separators stripped. */
  squashed: string;
  /** Un-collapsed, separators stripped. */
  squashedRaw: string;
  /** Individual word tokens (raw + collapsed), for exact-token matching. */
  tokens: string[];
  /** Digit-PRESERVING squashed forms (for hate number codes like 1488). */
  digitSquashed: string[];
  /** Digit-preserving word tokens (so "88" as a word is catchable). */
  digitTokens: string[];
} {
  const normalized = mapHomoglyphs(stripInvisible(input).toLowerCase());
  const collapsed = collapseRepeats(normalized);
  const squashed = collapsed.replace(/[\s\-']/g, '');
  const squashedRaw = normalized.replace(/[\s\-']/g, '');
  const rawTokens = normalized.split(/[\s\-']+/).filter(Boolean);
  const tokens = Array.from(
    new Set([...rawTokens, ...rawTokens.map(collapseRepeats), squashed, squashedRaw]),
  );

  // Digit-preserving path: lowercased + invisible-stripped, but NOT mapped,
  // so "1488" stays "1488" instead of becoming "iabb".
  const plain = stripInvisible(input).toLowerCase();
  const plainSquashed = plain.replace(/[\s\-']/g, '');
  const digitSquashed = Array.from(new Set([plainSquashed, collapseRepeats(plainSquashed)]));
  // Word tokens PLUS maximal digit runs — so a two-letter/number hate code
  // embedded in a single token ("rival88", "otter28") is catchable now that
  // names can't contain spaces. A longer run ("otter1988") stays its own
  // token and never equals the short "88" code.
  const digitRuns = plainSquashed.match(/\d+/g) ?? [];
  const digitTokens = Array.from(
    new Set([...plain.split(/[\s\-']+/).filter(Boolean), ...digitRuns]),
  );

  return { normalized, collapsed, squashed, squashedRaw, tokens, digitSquashed, digitTokens };
}
