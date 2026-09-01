# CLAUDE.md — Project Constitution: OK RICH (ok-rich.com)

This file is the single source of truth for how this project is built.
When a request conflicts with this file, stop and ask before proceeding.

## 1. Purpose

A one-page joke website. Visitors pay any amount (min 5 EUR) and receive
exactly one thing: a personal, real thumbs-up photo of the owner, taken for
them and sent by email within 7 days. Tone: playful, self-aware, absurd.
Reference look: the reference site (overlapping retro-macOS windows on a plain
background, casual copy).

## 2. Working mode (spec-driven, non-negotiable)

Phases: 0 Constitution → 1 Specify (`spec.md`, `clarify.md`) → 2 Plan
(`plan.md`) → 3 Tasks (`tasks.md`) → 4 Implement → 5 Analyze (`analysis.md`).

- Never write application code before `plan.md` is approved.
- At each phase boundary: summarise in ≤ 10 lines, ask ONE approval question, wait.
- Documents stay at 1–3 pages. `spec.md` must contain an "Out of Scope" section.
- Max 3 open questions per phase; everything else: make a reasonable
  assumption and list it under "Assumptions" in the document.

## 3. Language

- Code, comments, commits, docs: English.
- Site copy: English.
- **No em dashes (—) in user-facing copy.** Use a full stop, a comma or a colon. Page titles are
  the one exception, where the dash separates page name from site name. Enforced by
  `tests/e2e/copy.spec.ts` across all seven pages, so new copy is covered automatically.
- Legal pages (/impressum, /privacy, /terms): English, following the model of a comparable site
  (owner decision, 30.08.2026). One exception stays German: the Widerrufsbelehrung on /terms,
  because § 356 (5) BGB only extinguishes the right of withdrawal if the consumer was instructed
  in a language they understand. Residual risk noted in analysis.md.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).

## 4. Stack boundaries

- Static site only. Vite + vanilla TypeScript (`strict: true`) + plain CSS.
- No frontend framework, no UI/CSS library, no runtime npm dependencies.
- Allowed devDependencies: vite, typescript, eslint (+ typescript-eslint),
  prettier, vitest, @playwright/test. Anything else needs approval.
- No backend, no database. Payment = Stripe Payment Link (external URL).
  Post-payment automation lives in the owner's n8n, documented in
  `docs/n8n-workflow.md`, exported to `n8n/okrich-stripe.json`.
- Deployment: multi-stage Dockerfile (node build → nginx:alpine),
  `nginx.conf` with security headers, `docker-compose.yml` for the
  existing Hetzner host behind an existing TLS reverse proxy.

## 4a. Pinboard model (binding — see `docs/drag-reference.md`)

- Fixed-size stage 1440×900 design px; elements are absolutely positioned
  children with inline `left/top` in design px, declared in `site.config.ts`.
- Stage fits the viewport via `transform: scale()` (transform-origin top
  left); positions never change with viewport size. Below 768 px: no scale,
  elements stack in DOM order, drag disabled.
- Drag = Pointer Events + `setPointerCapture`, `touch-action: none`,
  scale-corrected deltas, 3 px drag threshold, click-swallow after drag,
  clamp to stage with 24 px margin, z-index raise on grab. No library.
- ~20 elements → writing `left/top` per move is fine; no rAF batching, no
  `transform` for position (transform is reserved for the element's
  decorative rotation).
- Non-interactive children carry `.no-drag` (`pointer-events: none`);
  interactive children stop `pointerdown` propagation.

## 5. Security principles

- No secrets in the repo. Ever. Not even test keys. `.env*` is gitignored;
  `.env.example` documents variable names only.
- The site loads exactly two origins: itself and the self-hosted Umami
  host. CSP in nginx: `default-src 'self'; script-src 'self' <umami-host>;
connect-src 'self' <umami-host>; img-src 'self' data:; style-src 'self';
frame-ancestors 'none'; base-uri 'self'; form-action 'self'`.
- No inline scripts or styles. No CDN fonts (system font stack or
  self-hosted WOFF2).
- Stripe is a plain `<a href>` — no Stripe JS on the page.
- Every external link: `rel="noopener noreferrer"`.
- Dependency hygiene: `npm audit --audit-level=high` in CI; lockfile committed;
  `npm ci` only. Generate a CycloneDX SBOM (`@cyclonedx/cyclonedx-npm`) in CI
  as an artifact.
- Webhook (n8n side): verify Stripe signature, reject events older than
  5 min, idempotency keyed on `checkout.session.id`, never log card data
  or full email addresses.

## 6. Privacy & legal (German law)

- No cookies, no localStorage, no fingerprinting. Umami is cookieless and
  self-hosted in the EU → no consent banner; this reasoning is written into
  the privacy page.
- Personal data (email, optional message, amount) is processed by Stripe
  and n8n only; the site itself stores nothing.
- Pages that must exist before launch, with `TODO-LEGAL` markers where the
  owner/lawyer fills content: `/impressum` (§ 5 DDG), `/privacy`
  (DSGVO Art. 13; recipients: Stripe, Hetzner, Google Workspace for email),
  `/terms` incl. Widerrufsbelehrung and the digital-content consent text
  (§ 356 Abs. 5 BGB). The exact consent text also goes into
  `docs/stripe-setup.md` for the Payment Link "terms acceptance" field.
- Button wording on the CTA must not hide that this is a paid order
  (§ 312j BGB): the CTA reads "Make me rich →" and the line directly next to
  it states price, product and delivery time.

## 7. Quality gates (must pass before every commit)

- `tsc --noEmit`, `eslint .`, `prettier --check .`, `vite build`.
- Vitest: `src/drag.ts` pure functions (`clamp`, `delta`, `isDrag`) and the
  stage-scale calculation ≥ 90 % coverage.
- Playwright smoke test: page loads; CTA href equals the configured
  Payment Link; all footer links resolve (200); at 1280 px a window
  dragged by (120, 80) screen px ends up offset by (120, 80) / scale design
  px; a click after a drag does not follow a link; at 375 px windows are
  stacked and a drag does not move them; no console errors.
- Performance budget: ≤ 150 KB transferred on first load excluding images;
  images WebP with explicit width/height; Lighthouse ≥ 95 on Performance,
  Accessibility, Best Practices.
- Accessibility: every window reachable by keyboard; drag is an
  enhancement, never required to reach content; `prefers-reduced-motion`
  respected; colour contrast ≥ 4.5:1.

## 8. Error handling & edge cases to design for

- Payment Link URL missing/empty at build time → build fails loudly.
- Viewport resize/orientation change → windows re-clamped into view.
- Images missing → placeholder SVG with same aspect ratio, no layout shift.
- Umami host unreachable → page works identically (script is `defer`,
  no dependency on it).

## 9. Out of scope for v1

User accounts, own checkout or backend, live counter, "Wall of Thumbs"
gallery, dark mode, i18n of site copy, PayPal as separate button (PayPal
only if available inside the Stripe Payment Link), SEO beyond
title/description/OG image, A/B testing.

## 10. Project variables (single place, `site.config.ts`)

DOMAIN, SITE_TITLE, OWNER_NAME, CURRENCY, MIN_AMOUNT, STRIPE_PAYMENT_LINK_URL,
UMAMI_SCRIPT_URL, UMAMI_WEBSITE_ID, WHY_PARAGRAPH. Values come from
`.env` via `import.meta.env`; build fails if a required one is empty.

## 11. Working files (added 2026-08-30)

Read `HANDOFF.md` first in every session: it holds the current state, what is verified and
what is open. Phase documents: `spec.md`, `clarify.md`, `plan.md`, `tasks.md`, `analysis.md`.
