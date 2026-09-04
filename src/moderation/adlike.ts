// src/moderation/adlike.ts — is this board name an advertisement rather than a name?
//
// Added 2026-09-04 after the repository was made public and the board name was attacked from the
// attacker's side of the table. The old defence was a strip-on-sight regex inside cleanName() with
// a ten-entry TLD list (com net org io de co xyz shop app ai). Two ways through it, both cheap:
//
//   "Free crypto: t.me/pumpgroup"   .me is not on the list, so the link went straight to the board
//   "buy now at spam . com"         a space either side of the dot, and the pattern never matches
//
// Publishing the repository turned this from "an attacker has to guess" into "an attacker reads
// the list", and one board slot costs the price of the minimum payment.
//
// Why a predicate and not a bigger strip regex: stripping mutates the name, and every attempt to
// normalise separators before stripping mangles legitimate names ("Ada L. Smith" would become
// "Ada L.Smith", "J. R. R. Tolkien" would lose its author). So this asks a yes/no question on a
// normalised *probe* and leaves the name itself untouched. A name that answers yes is filed as
// `anonymous`, exactly like a name from the blocklist: the payment stands, the buyer keeps the
// photo, the owner's notification says why, and the manual `Fix the board` branch can undo a false
// positive. Rejecting a display name is cheap; an ad on the front page is not.

/** Unicode look-alikes for the full stop, used to write a domain that no ASCII pattern matches. */
const DOTS = /[。．｡·・․‧]/g;

/**
 * TLDs worth treating as an advertisement. Long on purpose: the previous list had ten entries and
 * every one of the cheap evasions used a TLD outside it. Includes the link shorteners and chat
 * hosts that make a 40-character board slot useful to a spammer (t.me, bit.ly, discord.gg).
 */
const TLD = [
  // generic
  'com',
  'net',
  'org',
  'info',
  'biz',
  'xyz',
  'site',
  'online',
  'store',
  'shop',
  'app',
  'dev',
  'page',
  'web',
  'cloud',
  'digital',
  'world',
  'today',
  'live',
  'life',
  'fun',
  'club',
  'vip',
  'top',
  'one',
  'now',
  'bio',
  'link',
  'ai',
  'io',
  'co',
  'me',
  'tv',
  'cc',
  'gg',
  'gl',
  'sh',
  'fm',
  'im',
  'ws',
  'to',
  'ly',
  'so',
  'st',
  'pw',
  'su',
  'tk',
  'ml',
  'ga',
  'cf',
  'click',
  'space',
  'website',
  'icu',
  'buzz',
  'best',
  'cyou',
  'quest',
  'monster',
  'rest',
  // country codes that actually turn up in spam or are plausible here
  'de',
  'at',
  'ch',
  'uk',
  'us',
  'ca',
  'au',
  'nz',
  'eu',
  'fr',
  'it',
  'es',
  'pt',
  'nl',
  'be',
  'lu',
  'dk',
  'se',
  'no',
  'fi',
  'is',
  'ie',
  'pl',
  'cz',
  'sk',
  'hu',
  'ro',
  'bg',
  'gr',
  'tr',
  'ua',
  'by',
  'ru',
  'kz',
  'cn',
  'jp',
  'kr',
  'in',
  'br',
  'mx',
  'ar',
  'cl',
  'za',
  'ng',
  'ke',
  'ae',
  'sa',
  'il',
  'id',
  'th',
  'vn',
  'ph',
  'my',
  'sg',
  'hk',
  'tw',
  // categories a paid slot must not advertise
  'cam',
  'sex',
  'porn',
  'xxx',
  'adult',
  'casino',
  'bet',
  'poker',
  'loan',
  'credit',
  'crypto',
  'finance',
].join('|');

/** label(.label)*.tld — the labels are ASCII host characters, the TLD comes from the list above. */
const HOSTISH = new RegExp(
  String.raw`(?:^|[^a-z0-9-])[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.(?:${TLD})(?:$|[^a-z0-9-])`,
  'i',
);

/** A URL scheme or a www host, whatever follows it. */
const SCHEME = /(?:https?:\/\/|\bwww\.)/i;

/** Seven or more digits, however they are spaced. A display name is not a phone number. */
const PHONEISH = /(?:\d[\s.\-/()]{0,2}){7,}/;

/**
 * Builds the string the patterns are tested against. Only the probe is normalised; the caller's
 * name is never modified by this module.
 */
function probe(raw: string): string {
  return (
    String(raw ?? '')
      // Unicode full-stop look-alikes become the real thing.
      .replace(DOTS, '.')
      // "spam (dot) com", "spam dot com", "spam [punkt] de"
      .replace(/[\s([{]*\b(?:dot|punkt)\b[\s)\]}]*/gi, '.')
      // "spam . com", "spam .com" and "spam. com" close up so the host pattern sees one token.
      //
      // The label before the dot must be at least three characters. That single condition is what
      // keeps titles and initials out of the trap: "Dr. No" would otherwise close to "dr.no" and
      // .no is Norway, "Ada L. Smith" to "l.smith", "J. R. R. Tolkien" to "r.tolkien". A real host
      // label that short ("t.me") is written without spaces anyway and is matched directly, so the
      // rule costs the attacker nothing to nothing and costs a paying customer their entry.
      // Found by the false-positive half of tests/unit/adlike.test.ts, not by reasoning.
      .replace(/([a-z0-9]{3,})\s*\.\s+([a-z0-9])/gi, '$1.$2')
      .replace(/([a-z0-9]{3,})\s+\.\s*([a-z0-9])/gi, '$1.$2')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** True when the name reads as a link, a domain or a phone number rather than as a name. */
export function looksLikeAd(raw: string): boolean {
  const name = String(raw ?? '').trim();
  if (!name) return false;
  const p = probe(name);
  return SCHEME.test(p) || HOSTISH.test(p) || PHONEISH.test(p);
}
