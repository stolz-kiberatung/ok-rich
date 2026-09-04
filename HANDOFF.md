# HANDOFF.md — OK RICH, current state

This is the public copy of the project. The operational handoff (hosts, credentials, incident
log) lives in a private repository and is deliberately not part of this one. What is here is the
state of the code: what it does, how it is built, which rules the tests enforce.

## What this is

A one-page joke site on **ok-rich.com**. A visitor enters a display name on `/pay`, picks the
amount inside the payment provider's checkout (pay what you want, minimum 5 EUR), and receives one
personal thumbs-up photo by email within 7 days. Their name then appears on the Top contributors
board on the front page.

Vite + vanilla TypeScript (strict) + plain CSS, **no runtime dependencies**, served as a static
nginx container. Constitution: `CLAUDE.md`. Phase documents: `spec.md`, `clarify.md`, `plan.md`,
`tasks.md`, `analysis.md` (the reasoning behind every decision, read bottom up).

## Run it

```powershell
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build   # → localhost:8080
npm test              # lint, prettier, tsc, unit tests, build, Playwright e2e
npm run audit:mobile  # 14 widths + 2 landscape against docs/MOBILE-BRIEF.md
npm run dev           # hot reload on localhost:5173
```

Copy `.env.example` to `.env`. With placeholder values the payment link and the live counters are
inert; the page still renders and every test passes.

## Where things are

| Concern                                                        | File                                                                       |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Variables (from `.env`) and all element positions              | `site.config.ts`                                                           |
| Env validation, placeholder images, head injection, clean URLs | `vite.config.ts`                                                           |
| Pinboard markup, 1440-wide stage                               | `index.html`, positions in `site.config.ts`                                |
| Drag maths / scale maths / DOM wiring / entry                  | `src/drag.ts`, `src/stage.ts`, `src/pinboard.ts`, `src/main.ts`            |
| Live counters and the contributors board                       | `src/stats.ts`                                                             |
| The board-name form + optional gift-delivery field             | `pay/index.html`, `src/pay.ts`                                             |
| Board-name rules (clean + block), shared with the webhook      | `src/name.ts`, `src/moderation/` (bundled by `scripts/sync-blocklist.mjs`) |
| Mobile contract (every requirement is a check)                 | `docs/MOBILE-BRIEF.md`, enforced by `scripts/check-mobile.mjs`             |
| Styles, in cascade order                                       | `src/styles/board.css` → base, windows, stickers, pinboard, extras         |
| Styles for the text pages                                      | `src/styles/page.css` → base, windows, pages                               |
| Pages                                                          | `pay/`, `thanks/`, `impressum/`, `privacy/`, `terms/`, `404.html`          |
| Tests                                                          | `tests/unit/*.test.ts`, `tests/e2e/*.spec.ts`                              |
| Helper scripts                                                 | `scripts/{shots,make-og,make-icons,convert-image,lighthouse,check-mobile}` |
| Ops                                                            | `Dockerfile`, `nginx/default.conf.template`, `docker-compose*.yml`, `ops/` |
| Payments and automation                                        | `docs/dodo-setup.md`, `docs/n8n-workflow.md`, `n8n/okrich-payments.json`   |
| CI                                                             | `.github/workflows/ci.yml`                                                 |

## How the moving parts fit together

**Layout.** The stacked mobile layout is the plain CSS default and also the no-JavaScript
fallback. At ≥ 768 px `main.ts` adds `.is-board`, `applyLayout()` writes `left`/`top` from
`site.config.ts` through the CSSOM (never as inline `style` attributes, so the CSP holds), and the
whole stage is scaled with `transform: scale(min(1, width / 1440))`. On the phone every sticker
stacks in DOM order and can be moved by finger; the three attention arrows are the only elements
hidden there, because stacked vertically they would point at nothing.

**The stage grows.** `STAGE.height` is only a starting value. When live contributors arrive, the
board window gets taller and `growStageBelow()` moves everything below it down by exactly that
amount, so every designed gap survives.

**Payment.** The CTA links to `/pay`. That form's field names _are_ the query parameters the
payment provider's static link accepts, so it works without JavaScript. The amount is asked inside
the provider's checkout (pay what you want with a minimum), not on the site.

**Counters.** `VITE_STATS_URL` points at a public n8n endpoint returning
`{raised, visitors, contributors[]}`. Without it the page removes the visitor card rather than
inventing a number. n8n verifies the provider's webhooks per the Standard Webhooks spec, keeps the
running totals in workflow static data, takes refunds off the board automatically, and writes the
photo mail as a Gmail draft from one of a set of fixed templates. No language model is involved:
no third party sees buyer data.

## Rules that are easy to break

- **No inline styles or scripts** in served HTML (CSP `style-src 'self'`).
- **One CSS entry per page type** that `@import`s the rest in order. Per-stylesheet `<link>` tags
  silently reverse the cascade under Vite.
- **Vertical rhythm: write base spacing with `:where()`, always.** `tests/e2e/rhythm.spec.ts`
  walks every window body on all seven pages and fails if two flow elements sit closer than 8 px.
- **`.board` also matches `<main class="board">`.** Scope window-body rules to `.body.board`.
- **Mobile visibility is opt-out, not opt-in.** Every sticker shows on a phone; only
  `.blink-arrow` is hidden. `mobile: true` in `site.config.ts` means "carries content", and a unit
  test uses it to require `aria-hidden` on everything without it.
- **The contributors board is measured full, not empty.** `check-mobile.mjs` serves eight
  40-character names before measuring; the two-column grid once ran out of the window because
  nobody had looked at it with real names on it.
- **Every `data-pin` in `index.html` must exist in `elements`** and vice versa; a unit test
  enforces it.
- **`PAY_ORIGIN`, `STATS_ORIGIN` and `UMAMI_ORIGIN` are build args**, rendered into the nginx
  config at image build time. Changing them requires a rebuild, not a restart.
- **nginx `add_header` inside a `location` drops every inherited header**, which is why the
  security headers are repeated per location on purpose.
- **Allowed devDependencies only** (constitution §4): vite, typescript, eslint + typescript-eslint,
  prettier, vitest, @playwright/test, @axe-core/playwright, lighthouse.
- **A console-error filter must match `location().url`, not only `text()`.** Chromium reports a
  failed request's URL only in the message location.
- **When editing config or markup from a script, assert the replacement happened.** Silent no-op
  replacements cost several rounds.

## Open (engineering, deliberately deferred)

- Wall of Thumbs is a "coming soon" teaser: the tiles are placeholders, nothing is wired up.
- Lighthouse is non-blocking in CI by design (shared runners jitter); run it locally before a
  release.
- No keyboard-driven drag, no persisted window positions (spec §8, out of scope).
