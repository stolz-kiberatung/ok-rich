// src/name.ts — pure rules for the one piece of attacker-controlled text on the front page.
// No DOM access, so it is unit-testable and can be reasoned about on its own.

/**
 * Board names are short, single-line, and free of anything that breaks the layout, impersonates
 * another entry, or turns a paid slot into an advertising slot.
 *
 * This copy runs in the browser and is therefore a convenience, NOT a defence: the field is a
 * query parameter on a static payment link, so anyone can skip this page and send whatever they
 * like straight to the checkout.
 *
 * The decision that counts is server-side. Since 2026-09-04 the link rule there is no longer a
 * hand-copied twin of the one below but `looksLikeAd()` in src/moderation/adlike.ts, which the n8n
 * workflow receives from scripts/sync-blocklist.mjs and which therefore cannot drift out of step.
 * The strip below stays as a tidy-up for the preview on /pay and catches the obvious case. It is
 * deliberately not the filter: a strip-on-sight TLD list is exactly what was walked around with
 * "t.me/x" and "spam . com" on the day this repository went public. Whatever it misses, the server
 * files as `anonymous`.
 *
 * Hostile characters are matched by named Unicode class, never pasted literally: as literals they
 * are invisible in a diff, which is precisely why they work as an attack.
 */
export function cleanName(raw: string, max = 40): string {
  return (
    raw
      // \p{Cc} is every control character, \p{Cf} every format character — that covers the
      // zero-width space, the joiners, and the bidi overrides such as U+202E that let a single
      // entry reverse or reorder the whole rendered line. Named classes on purpose: written as
      // literal ranges, those characters are invisible in a diff, which is why they work.
      .replace(/[\p{Cc}\p{Cf}]/gu, '')
      // More than two stacked combining marks is "zalgo" and spills onto neighbouring rows.
      .replace(/(\p{M})\p{M}{2,}/gu, '$1')
      // A board entry is a name, not a link: a paid slot must not become an advertising slot.
      .replace(/(?:https?:\/\/|www\.)\S*/gi, '')
      .replace(/[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|io|de|co|xyz|shop|app|ai)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max)
      .trim()
  );
}
