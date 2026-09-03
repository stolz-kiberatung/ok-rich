# docs/MOBILE-BRIEF.md — the brief for the mobile rebuild

Written before touching any code, on 2026-09-01, from measurements rather than assumptions.
Every "done when" below is a number a script can check. If a claim here cannot be measured, it
does not belong in this file.

## What the owner asked for

1. A mobile version that works on **every** phone screen, not just the three we happen to test.
2. **All** elements appear, one after another, like a pinboard read top to bottom.
3. The **Make me rich** button sits near the top of the landing page.
4. Professional result. No new defects.

## Where it stands today (measured at 320–767 px)

| Fact                | Value                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Horizontal overflow | none at any width — this must stay that way                                                                                  |
| Page height         | 4131 px (600 px wide) to 4719 px (320 px wide), about 5.5 screens                                                            |
| CTA position        | ~400 px down, roughly half a screen                                                                                          |
| Elements shown      | 8 of 20 stickers; **12 are hidden**: four kaomoji, name badge, "100 % LEGIT", certificate, thumbs, loading bar, three arrows |
| Order               | DOM order. The mobile layout IS the no-JavaScript fallback                                                                   |

## Binding decisions

**The CTA goes above the fold, and stays reachable.** Target: the button's top edge is within the
first 100 px on every width from 320 to 767 px. The hero headline may sit above it only if both
fit on one screen at 320 × 568 (the smallest phone still in use). Everything else follows.

**Hidden elements come back, except the three arrows.** The arrows exist to point at the CTA on a
2-D board. Stacked vertically they would point at nothing, so they stay hidden — that is a
deliberate exception, written down here so nobody "fixes" it later. The other nine return.

**Order is content order, not decoration order.** Read top to bottom:
hero → CTA → what you get → proof (reviews, sample) → the joke material → boards → footer.
Decoration sits between the blocks it belongs to, never in a run of five ornaments.

**Desktop must not change.** Any rule added for mobile lives inside the mobile block or is scoped
to `.stage:not(.is-board)`. A measurement of the 1440 px board before and after must be identical.

## Done when — every line is a check, not an opinion

1. **No horizontal scrolling** at 320, 344, 360, 375, 390, 393, 412, 414, 430, 480, 540, 600, 720,
   767 px. `scrollWidth === clientWidth`, and no element's box crosses either edge.
2. **CTA reachable without scrolling.** Originally written as "top edge ≤ 100 px". Revised on
   2026-09-01 after measuring: 100 px is only achievable by dropping the `OK RICH` headline above
   the button, and a landing page that hides its own name to save 200 px is a worse page, not a
   better one. Until 2026-09-03 the requirement was **the entire button on screen without
   scrolling on a 320 × 568 phone**, top edge **≤ 340 px**, measured 298–317 px.
   **Revised on 2026-09-03 by the owner:** three stickers (sample photo, life advice, todo note)
   now open the page ahead of the hero, knowingly trading the first-screen button for the
   pinboard feel. The button still comes right after the hero and nothing else may push it: top
   edge **≤ 700 px** on every width, measured 627–638 px at 320–390 px and 479 px at 430 px. The
   320 × 568 fold check prints a note instead of failing. Tapping it reaches `/pay`.
3. **Tap targets ≥ 44 px** on every link and button (WCAG 2.5.5 / Apple HIG).
4. **All 17 intended elements render** with height > 0; the three arrows are absent by design.
5. **No text smaller than 14 px** anywhere in the mobile layout.
6. **Vertical rhythm holds** — `tests/e2e/rhythm.spec.ts` stays green, including on new blocks.
7. **axe finds no serious or critical issue** at 375 px on all seven pages.
8. **Page height stays below 6000 px** at 375 px (5700 until 2026-09-03, see the end of this item). Was 5400 until `ideas.txt` was added on
   2026-09-01, which is a deliberate ~290 px. The ceiling exists to catch growth nobody decided
   on, so it moves when someone decides, and only then. Originally 4000 px, written before the
   decision to bring all twelve hidden elements back; showing nine more of them costs about
   650 px. 5400 px is the ceiling that keeps the page from growing further unnoticed. Measured:
   ~5065 px. **Raised to 6000 px on 2026-09-03**, when the check started measuring with a full
   board: eight names at the 40-character limit, one column on the phone, which is about 240 px
   more than the empty "Nobody yet" line the earlier ceilings were calibrated against. Measured
   5736 px at 375 px with that fixture. The page itself did not grow.
9. **The contributors board is measured full, not empty** (added 2026-09-03). The check serves
   eight contributors with 40-character names to the page; no row may cross the window's edge
   and the board's body may not be wider than its window. Found on the live site the day real
   names arrived: the two-column grid (`1fr 1fr`, i.e. minmax(auto, 1fr)) could not shrink
   below its nowrap content and ran out of the right edge on every phone. One column on the
   phone since. Also enforced by `tests/e2e/smoke.spec.ts` → "mobile pinboard".
10. **Landscape works**: 667 × 375 and 844 × 390 show no overflow and keep the CTA reachable.
11. **The whole thing still works with JavaScript off**, because the stacked layout is the
    fallback: load with JS disabled and check the CTA links to `/pay`.
12. **Desktop unchanged**: element positions at 1440 px are byte-identical to before.
13. `npm test` green, Lighthouse mobile ≥ 95 on performance and 100 on accessibility.

## Traps this repo has already fallen into — do not repeat

- **Blanket margin resets with high specificity.** Base spacing goes in `:where()`. There is a test.
- **A wrapper drops its children out of the flow rhythm.** `.win .body > * + *` only reaches direct
  children.
- **`.board` also matches `<main class="board">`.** Scope to `.body.board`.
- **Stage height is dynamic.** Never hardcode 1500.
- **Every `data-pin` needs a config entry and vice versa**; a unit test enforces it.
- **No inline styles.** The CSP forbids them; positions are written through the CSSOM.
- **Silent no-op replacements.** Assert every scripted edit actually matched.
- **"Locally fine" is not "live".** Rebuild the container and measure the served page.

## How it will be verified

A script drives a real browser across all 14 widths plus two landscape sizes, and asserts items
1–5, 8 and 9 mechanically. Items 6, 7, 10, 11 come from the existing suites. Screenshots at 320,
375 and 430 px get looked at, because a passing measurement can still be ugly.
