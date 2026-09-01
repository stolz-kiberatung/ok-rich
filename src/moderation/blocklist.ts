import { collapseRepeats } from './normalize';
import { VENDORED_BLOCKLIST } from './blocklist.vendor';

/**
 * Two-tier nickname blocklist — filter at creation + report hook + human
 * review later, the way leaderboard-bearing games do it in practice.
 *
 * Digits are ALLOWED in nicknames, so every tier must resist digit evasion:
 * matching runs on the leetspeak/homoglyph-mapped form (n1gger → nigger,
 * paj33t → pajeet, 4dolf → adolf) AND on a digit-preserving form so pure
 * number codes (1488, 1933) and mixed codes are caught as written.
 *
 * TIER 1 — SEVERE (substring match, aggressive):
 *   Hate slurs, extremist names/orgs and hate codes. Matched as substrings
 *   after normalization and against repeat-collapsed forms. A rare false
 *   positive is an acceptable cost here; a slur on a public leaderboard is
 *   not.
 *
 * TIER 2 — VENDORED PROFANITY (exact-token match, conservative):
 *   The LDNOOBW list (CC-BY-4.0) matched only as whole tokens / whole names
 *   to avoid the Scunthorpe problem.
 *
 * // TODO: before public launch, expand locale coverage further and wire the
 * // report hook to a review queue. A filter is the floor, not the fix.
 */

/** Tier 1 — severe terms and stems (letter forms). Substring-matched. */
const SEVERE_SUBSTRINGS: readonly string[] = [
  // --- Nazi figures (full names or unambiguous surnames only — common
  //     surnames like Hess/Röhm/Frank need the first name to match) ---
  'hitler',
  'adolf hitler',
  'rudolf hess',
  'goebbels',
  'himmler',
  'eichmann',
  'mengele',
  'goring', // Göring after umlaut folding
  'goering',
  'heydrich',
  'kaltenbrunner',
  'bormann',
  'ribbentrop',
  'julius streicher',
  'ernst rohm',
  'reinhard heydrich',
  'amon goth',
  'klaus barbie',
  'george lincoln rockwell',
  'anders breivik',
  'brenton tarrant',
  'dylann roof',
  // --- Nazi orgs / structures (multilingual) ---
  'nazi',
  'schutzstaffel',
  'waffen ss',
  'waffenss',
  'gestapo',
  'sturmabteilung',
  'einsatzgruppe',
  'hitlerjugend',
  'hitler jugend',
  'bund deutscher madel',
  'totenkopfverband',
  'ss totenkopf',
  'nsdap',
  'wehrwolf',
  'werwolf division',
  'atomwaffen division',
  'combat 18',
  'blood and honour',
  'blood & honour',
  'hammerskin',
  'aryan brotherhood',
  'aryan nation',
  'stormfront',
  // --- Slogans / ideology / codes ---
  'sieg heil',
  'heilhitler',
  'heil dir hitler',
  'meine ehre heisst treue',
  'blut und ehre',
  'blut und boden',
  'arbeit macht frei',
  'deutschland erwache',
  'auslander raus', // Ausländer raus after folding
  'ausländer raus',
  'white power',
  'whitepower',
  'white pride',
  'whitepride',
  'rahowa',
  'racial holy war',
  'day of the rope',
  'great replacement',
  'goyim know',
  'hakenkreuz',
  'swastika',
  'schwarze sonne',
  'wolfsangel',
  'reichsadler',
  'fourteen words',
  '14 words',
  'kukluxklan',
  'third reich',
  'thirdreich',
  'drittes reich',
  'drittesreich',
  'viertes reich',
  'fourth reich',
  'der fuhrer',
  'derfuhrer',
  'mein kampf',
  'meinkampf',
  // --- Holocaust references / denial (multilingual) ---
  'auschwitz',
  'holocaust',
  'holohoax',
  'holocaust luge', // Holocaustlüge after folding
  'endlosung', // Endlösung after folding
  'gaskammer',
  'gas chamber',
  'zyklon',
  'oven dodger',
  'six million more',
  '6 million more',
  // --- Antisemitic terms (DE/EN) ---
  'judenschwein',
  'judensau',
  'judenhass',
  'judenfrei',
  'judenrein',
  'juden raus',
  'judenraus',
  'untermensch',
  'herrenrasse',
  'master race',
  'volksverrater', // Volksverräter after folding
  // --- Anti-Black slurs (EN/DE) ---
  'nigg',
  'negro',
  'coon',
  // --- Antisemitic slurs ---
  'kike',
  'zyklon',
  // --- Anti-Asian slurs ---
  'chink',
  'gook',
  // --- Anti-Latino slurs ---
  'spic',
  'wetback',
  'beaner',
  // --- Anti-South-Asian / anti-Arab slurs (incl. 4chan-era coinages) ---
  'pajeet',
  'paki',
  'raghead',
  'towelhead',
  'shitskin',
  'mudslime',
  'currymuncher',
  // --- Anti-Roma (DE) ---
  'zigeuner',
  // --- Anti-LGBTQ slurs ---
  'faggot',
  'fagot',
  'tranny',
  'dyke',
  'schwuchtel',
  // --- Ableist slurs ---
  'retard',
  // --- Sexual violence ---
  'rapist',
  'rape',
  'vergewaltiger',
] as const;

/**
 * Hate number codes, matched on the DIGIT-PRESERVING form:
 * 88 = HH, 18 = AH, 1488/14 88 = "14 words" + HH, 1933 = seizure of power,
 * 420 (as 4/20, Hitler's birthday, only in the combined 1488-style codes).
 * Substrings so "otter1488" and "kampf1933" are caught; the short codes 88
 * and 18 are matched as whole tokens only, so "Otter1988" stays playable.
 */
const SEVERE_DIGIT_SUBSTRINGS: readonly string[] = ['1488', '8814', '1933', '6mwe', 'c18'];
const SEVERE_DIGIT_TOKENS: ReadonlySet<string> = new Set([
  '88', // HH
  '18', // AH
  '14', // 14 words
  '28', // Blood & Honour
  'hh',
  'kz',
  'sa',
  'ss',
  'wpww', // white pride world wide
  'gtkrwn',
  'za88',
  'zog', // exact token only — substring would hit "Herzog"
]);

/** Precomputed: severe terms + repeat-collapsed forms, spaces stripped. */
const SEVERE_MATCHERS: readonly string[] = Array.from(
  new Set(
    SEVERE_SUBSTRINGS.flatMap((term) => {
      const flat = term.replace(/\s/g, '');
      return [flat, collapseRepeats(flat)];
    }),
  ),
);

/** Tier 2 — exact-token set (vendored list + collapsed variants). */
const EXACT_TOKENS: ReadonlySet<string> = new Set(
  VENDORED_BLOCKLIST.flatMap((term) => {
    const flat = term.replace(/\s/g, '');
    return [flat, collapseRepeats(flat)];
  }),
);

export interface BlocklistInput {
  /** Substring candidates on the letter-mapped form (raw and collapsed). */
  substringCandidates: readonly string[];
  /** Exact candidates: word tokens and the full squashed name (mapped). */
  exactCandidates: readonly string[];
  /** Digit-preserving candidates: squashed forms with digits kept. */
  digitCandidates: readonly string[];
  /** Digit-preserving word tokens. */
  digitTokens: readonly string[];
}

/** Returns true when the name hits any tier. */
export function matchesBlocklist(input: BlocklistInput): boolean {
  if (
    input.substringCandidates.some((candidate) =>
      SEVERE_MATCHERS.some((term) => candidate.includes(term)),
    )
  ) {
    return true;
  }
  if (
    input.digitCandidates.some((candidate) =>
      SEVERE_DIGIT_SUBSTRINGS.some((code) => candidate.includes(code)),
    )
  ) {
    return true;
  }
  if (input.digitTokens.some((token) => SEVERE_DIGIT_TOKENS.has(token))) {
    return true;
  }
  return input.exactCandidates.some((token) => EXACT_TOKENS.has(token));
}
