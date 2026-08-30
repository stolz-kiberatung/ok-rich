# spec.md — OK RICH (okrich.lol)

Phase 1 · Specify · 2026-08-30 · status: **approved 2026-08-30 (defaults from clarify.md)**
Inputs: `CLAUDE.md` (constitution), `docs/drag-reference.md` (binding pinboard
reference), `PROMPT.md` (kickoff v2). This document adds only what those do not
already fix; where it references a section, that section is authoritative.

## 1. Goal

One static page. A visitor pays any amount (min 5 EUR) through a Stripe Payment
Link and receives exactly one personal, real thumbs-up photo of the owner by
email within 7 days. v1 is done when a stranger can land, laugh, pay and get
the photo, and the owner is notified without touching a server.

## 2. Actors and journeys

| Actor                       | Journey                                                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visitor, desktop (≥ 768 px) | lands → reads headline → plays with windows → clicks "Make me rich →" → Stripe checkout (amount, email, optional message, consent) → `/thanks` (copy link, share on X) |
| Visitor, mobile (< 768 px)  | same, windows stacked, stickers hidden, no drag                                                                                                                        |
| Owner                       | receives one email per payment (amount, buyer email, message) → takes the photo → emails it within 7 days                                                              |
| Buyer                       | receives an automatic confirmation email (n8n), later the photo (owner, manual)                                                                                        |

## 3. Functional requirements (EARS)

### 3.1 Pinboard — copied verbatim from `docs/drag-reference.md` §4 (binding)

- P1 WHEN a visitor presses the primary pointer on a draggable window and moves more than 3 px, the window SHALL follow the pointer 1:1 in design-pixel space regardless of stage scale.
- P2 WHEN a window is released after a drag, the system SHALL suppress the following click event exactly once.
- P3 WHEN a window would leave the stage, the system SHALL clamp it so that at least 24 px remain visible on every side.
- P4 WHEN the viewport is narrower than 768 px, windows SHALL be stacked in DOM order and SHALL NOT be draggable.
- P5 WHEN the viewport is resized, the stage SHALL rescale without any window changing its design-pixel position.
- P6 WHILE a window is being dragged, it SHALL have the highest z-index.

### 3.2 Pinboard — additions

- P7 WHEN JavaScript is unavailable or fails, the system SHALL show all windows stacked in DOM order (the mobile layout) with every text and link usable.
- P8 The `headline` window SHALL always hold the highest z-index and the `cta` window the second-highest, so no dragged element can cover either; both are not draggable.
- P9 WHEN a visitor presses the primary pointer on a link or button inside a window, the system SHALL NOT start a drag and SHALL deliver the click.
- P10 WHEN an element is dragged partly outside the stage, the page SHALL NOT scroll horizontally.
- P11 Positions and rotations SHALL be applied at runtime from `site.config.ts` through the CSSOM (`el.style.*`), never as `style="…"` attributes in HTML, so CSP `style-src 'self'` holds.
- P12 WHEN the viewport is wider than 1440 px, the stage SHALL stay at scale 1 and be centered horizontally; the dot grid covers the whole page background.
- P13 Stickers SHALL carry `aria-hidden="true"`, be hidden below 768 px and have a fixed rotation between −10° and 10° declared in `site.config.ts` (deterministic, no runtime randomness).

### 3.3 Content and payment

- C1 The CTA SHALL be a plain `<a href="STRIPE_PAYMENT_LINK_URL" rel="noopener noreferrer">` labelled "Make me rich →", opening in the same tab (Stripe returns to `/thanks`).
- C2 Directly next to the CTA the page SHALL state product, price rule and delivery (§ 312j BGB): "You get: one (1) personal thumbs-up photo, taken by me, for you. Delivered by email within 7 days. That's it." plus text chips `5 € · 10 € · 50 €` and "you choose, min. 5 €".
- C3 The headline window SHALL show SITE_TITLE and the sub-headline from `PROMPT.md` verbatim.
- C4 IF `public/img/thumb.webp` or `public/img/kid.webp` is absent at build time, THEN the build SHALL reference the placeholder SVG with the same aspect ratio (4:5, 3:4); every image has explicit `width`/`height`; dropping the real file in requires no code change.
- C5 Every external link SHALL carry `rel="noopener noreferrer"`.

### 3.4 Pages

| Route                              | Content                                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                | the pinboard                                                                                                                                                                                                                                |
| `/thanks`                          | "Payment received. Now I go take your photo. Check your inbox within 7 days." · "Copy link" button (Clipboard API; fallback: the URL is shown as selectable text) · "Share on X" link to the X post intent with a prepared text · `noindex` |
| `/impressum`, `/privacy`, `/terms` | one centered, non-draggable window on the dot grid; German first, then English; German binding; `TODO-LEGAL` markers where the owner or lawyer fills content                                                                                |
| `404`                              | own page, same look, link back to `/` (served by nginx `error_page`)                                                                                                                                                                        |

Legal skeletons (content behind `TODO-LEGAL`): `/impressum` § 5 DDG · `/privacy` DSGVO Art. 13 with recipients Stripe, Hetzner, Google Workspace, the no-cookie/no-consent-banner reasoning (Umami, cookieless, self-hosted in the EU), retention period · `/terms` product, price, delivery, Widerrufsbelehrung, digital-content consent text (§ 356 Abs. 5 BGB), right to refuse/refund, personal-use licence for the photo.

### 3.5 Configuration and build

- B1 All variables of `CLAUDE.md` §10 are read from `.env` via `import.meta.env` inside `site.config.ts`; nothing else reads `import.meta.env`.
- B2 IF `STRIPE_PAYMENT_LINK_URL`, `DOMAIN` or `SITE_TITLE` is empty, or the Stripe URL does not start with `https://`, THEN `vite build` SHALL fail with a message naming the variable.
- B3 `UMAMI_SCRIPT_URL` and `UMAMI_WEBSITE_ID` are optional as a pair: IF only one is set THEN the build SHALL fail; IF both are empty THEN no analytics script is emitted.
- B4 Element positions (design px), rotation and draggability live in `site.config.ts` keyed by element id; a test SHALL fail when config ids and DOM ids diverge.

### 3.6 Analytics

- A1 WHEN Umami is configured, the page SHALL load `UMAMI_SCRIPT_URL` with `defer` and `data-website-id`; the CTA click SHALL be tracked via `data-umami-event="make-me-rich"`. No cookies, no storage.
- A2 WHEN the Umami host is unreachable, the page SHALL behave identically.

### 3.7 Post-payment automation (n8n, outside the site)

- N1 WHEN Stripe posts `checkout.session.completed` to `N8N_WEBHOOK_URL`, the workflow SHALL verify the Stripe signature and reject events older than 5 minutes.
- N2 The workflow SHALL process each `checkout.session.id` at most once.
- N3 The workflow SHALL email the owner (amount, currency, buyer email, custom field) and send the buyer a confirmation email.
- N4 The workflow SHALL never log card data or full email addresses.

## 4. Element inventory (19 elements on the 1440×900 stage)

| id            | type    | drag | content                                                                      | zone (exact px in plan.md) |
| ------------- | ------- | ---- | ---------------------------------------------------------------------------- | -------------------------- |
| headline      | win     | no   | SITE_TITLE + sub-headline                                                    | center                     |
| cta           | win     | no   | button, § 312j line, chips                                                   | center, below headline     |
| trade-offer   | win     | yes  | "I receive: $$$" / "You receive:" + thumb image                              | top left                   |
| kid           | win     | yes  | kid image, caption "me, already planning this"                               | top right                  |
| why           | win     | yes  | WHY_PARAGRAPH                                                                | bottom left                |
| footer        | win     | yes  | links /impressum /privacy /terms · "Made in Germany. No cookies. Seriously." | bottom right               |
| kao-1 … kao-4 | sticker | yes  | `^ ω ^` · `¯\_(ツ)_/¯` · `(¬_¬)` · `{ ^-^ }`                                 | gaps around the windows    |
| nametag       | sticker | yes  | "HELLO my name is: rich (soon)"                                              | near headline              |
| pricetag      | sticker | yes  | "€5 → 👍"                                                                    | near CTA                   |
| legit         | sticker | yes  | "100 % legit" stamp                                                          | near trade-offer           |
| beachball     | sticker | yes  | inline SVG                                                                   | free corner                |
| folder        | sticker | yes  | inline SVG                                                                   | free corner                |
| paid          | sticker | yes  | "PAID" stamp                                                                 | near kid                   |
| thumbs        | sticker | yes  | 👍👍👍 cluster                                                               | near CTA                   |
| loading       | sticker | yes  | loading bar at 99 %                                                          | near why                   |
| arrow         | sticker | yes  | "you are here" arrow                                                         | pointing at the CTA        |

Mobile DOM order: headline, cta, trade-offer, kid, why, footer; stickers last.
Composition rule: at initial positions no window covers another window's text, image or link, and nothing covers the CTA; stickers may overlap window edges. Because the stage scales uniformly, a composition that is clean at 1440 px is identical at 1280 px.

## 5. Non-functional requirements (measurable; details in `CLAUDE.md` §5–7)

- Performance: ≤ 150 KB transferred on first load excluding images; Lighthouse ≥ 95 on Performance, Accessibility, Best Practices; images WebP with explicit dimensions.
- Readability: at 768 px the stage scale is 0.533, so body copy in windows SHALL be ≥ 24 design px (≥ 12.8 rendered px) and link text ≥ 26 design px. See `clarify.md` Q1.
- Accessibility: contrast ≥ 4.5:1; every interactive element keyboard-reachable in DOM order; `prefers-reduced-motion` respected; no entrance animations in v1 (motion = cursor and shadow changes only).
- Security: CSP exactly as `CLAUDE.md` §5 with the Umami origin injected at deploy time; no inline scripts or styles; no CDN; system font stack; `npm ci`, lockfile, `npm audit --audit-level=high`, CycloneDX SBOM in CI.
- Privacy: the site stores nothing, sets no cookies, uses no storage APIs.

## 6. Deliverables (Definition of Done for v1)

1. Site: `/`, `/thanks`, `/impressum`, `/privacy`, `/terms`, `404`; `site.config.ts`; placeholder SVGs; `public/og.png` 1200×630 with a reproducible generator.
2. Tests: Vitest for `clamp`, `delta`, `isDrag`, `computeScale` (≥ 90 % coverage); Playwright smoke suite (§ 7).
3. Ops: `Dockerfile`, `nginx.conf`, `docker-compose.yml` (container `okrich-web`, proxy network only, commented Traefik/Caddy/Coolify labels), `docker-compose.local.yml` (port 8080, no external network) for the local verification.
4. Docs: `README.md`, `.env.example`, `docs/stripe-setup.md`, `docs/n8n-workflow.md`, `n8n/okrich-stripe.json`, `HANDOFF.md`.
5. CI: GitHub Actions — lint, typecheck, prettier, build, unit, e2e, `npm audit`, SBOM artifact.

## 7. Acceptance tests

- Unit: pure drag functions and scale calculation, ≥ 90 % coverage.
- Playwright at 1280 px: page loads; CTA href equals the configured Payment Link; footer links resolve (200); a window dragged by (120, 80) screen px ends at +(120, 80)/scale design px; a click after a drag does not navigate; a click on the CTA without drag navigates; no console errors.
- Playwright at 375 px: windows stacked in the mobile order; a drag does not move them; stickers not visible.
- Build guards: empty `STRIPE_PAYMENT_LINK_URL` → `vite build` exits non-zero; half-configured Umami → non-zero.
- Config integrity: every id in `site.config.ts` exists in `index.html` and vice versa.
- Docker: `docker compose -f docker-compose.yml -f docker-compose.local.yml up` serves `http://localhost:8080` with the CSP header present and `/thanks`, `/impressum`, `/privacy`, `/terms` returning 200.

## 8. Out of Scope

Everything in `CLAUDE.md` §9 (accounts, own checkout/backend, live counter, gallery, dark mode, i18n of site copy, separate PayPal button, SEO beyond title/description/OG, A/B tests), plus: keyboard-driven dragging; persisting window positions; verifying payment on `/thanks` (the page is reachable without paying); invoices, receipts and tax handling (Stripe receipts only); automatic photo delivery; any owner dashboard; Stripe custom checkout domain; the Hetzner rollout itself (separate step).

## 9. Assumptions (reasonable defaults; correct me if wrong)

- A1 No-JS and < 768 px share one layout: the stacked DOM order. JS adds the absolute-positioned pinboard at ≥ 768 px (drag is an enhancement, never required).
- A2 Stage scale uses `document.documentElement.clientWidth` instead of `window.innerWidth` so the vertical scrollbar never causes horizontal overflow; same intent as the reference.
- A3 Trade-offer text stays "I receive: $$$" verbatim (meme convention) although the currency is EUR.
- A4 Suggested amounts are non-interactive text chips; Stripe "customer chooses price" cannot be pre-filled from a link.
- A5 The Stripe success URL is `https://okrich.lol/thanks` without `session_id`, so no identifiers land in Umami or logs.
- A6 The `/thanks` share text: "I paid a stranger for a thumbs-up. Best money I ever spent. okrich.lol" — owner may change it in `site.config.ts`.
- A7 The Umami origin for the CSP is injected at container start through the nginx image's built-in `envsubst` template mechanism (no extra dependency); the same value is passed as a build arg for the script tag.
- A8 CI builds with dummy, non-secret values (`STRIPE_PAYMENT_LINK_URL=https://buy.stripe.com/test_ci`) set in the workflow file.
- A9 Placeholder images are resolved in `vite.config.ts` (file exists → real path, else placeholder) and exposed as build-time constants.
- A10 The OG image is generated by a Playwright script from an HTML template (`scripts/og.html`), so no image library is needed.
- A11 Legal pages are bilingual in one document: German block first, English block below, no language switcher.
- A12 n8n: Stripe Trigger node (signature verification built in) plus an explicit timestamp check and an idempotency store (n8n Data Table or workflow static data, decided in plan.md); emails via the existing Google Workspace account configured inside n8n only.
- A13 Buyer email and message are kept in n8n executions and the owner's mailbox until the photo is sent, then deleted after 30 days (`TODO-LEGAL` on /privacy).
- A14 Playbook §9 of the previous app (T3 stack, Better Auth, Hono, shadcn) does not apply: no auth, no backend, and the constitution mandates vanilla. Adopted from the playbook instead: day-one tests with screenshots per width, an own 404 page, security headers, `HANDOFF.md` + a pointer in `CLAUDE.md`.
- A15 Fonts: system font stack only; kaomoji glyphs (`ω`, `ツ`, `¬`) and emoji render from system fonts and will look slightly different per OS. Accepted.

## 10. Open questions

Three, in `clarify.md`. Each has a recommended default that applies if not answered.
