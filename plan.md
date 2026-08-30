# plan.md — OK RICH implementation plan

Phase 2 · Plan · 2026-08-30 · status: **approved 2026-08-30 (defaults from clarify.md)**
Based on `spec.md` (approved with clarify defaults: 768 px breakpoint + copy ≥ 24 design px;
`lighthouse` and `@axe-core/playwright` approved as devDependencies; private GitHub repo).

## 1. Repository layout

```
okrich/
  index.html                 pinboard (all 19 elements as static markup)
  thanks/index.html          /thanks
  impressum/index.html  privacy/index.html  terms/index.html   (DE then EN)
  404.html
  site.config.ts             variables from env + element table (positions, rotation, z)
  vite.config.ts             env validation, multi-page input, placeholder resolution, head injection
  src/
    drag.ts                  pure: clamp, delta, isDrag            (unit-tested)
    stage.ts                 pure: computeScale; DOM: fitStage, resize + media-query wiring
    pinboard.ts              initPinboard (reference §2) + applyLayout (positions from config)
    main.ts                  entry for /: applyLayout → fitStage → initPinboard
    thanks.ts                copy-link button
    styles/  base.css  windows.css  stickers.css  pinboard.css  pages.css
  public/
    img/thumb-placeholder.svg (4:5)  img/kid-placeholder.svg (3:4)  (owner drops thumb.webp / kid.webp here)
    og.png  favicon.svg  robots.txt
  scripts/  og.html  make-og.mjs      Playwright screenshot 1200×630 → public/og.png
  tests/
    unit/drag.test.ts  stage.test.ts  config-integrity.test.ts  build-guards.test.ts
    e2e/smoke.spec.ts  a11y.spec.ts  playwright.config.ts
  nginx/default.conf.template     CSP with ${UMAMI_ORIGIN}, headers, caching, 404
  Dockerfile  docker-compose.yml  docker-compose.local.yml  .dockerignore
  docs/  drag-reference.md  stripe-setup.md  n8n-workflow.md
  n8n/okrich-stripe.json
  .github/workflows/ci.yml
  README.md  HANDOFF.md  .env.example  .gitignore  CLAUDE.md  PROMPT.md  spec.md  clarify.md
```

Tooling (all devDependencies, exact versions pinned): vite, typescript, eslint + typescript-eslint,
prettier, vitest + `@vitest/coverage-v8` (Vitest's own coverage provider, needed for the ≥ 90 % gate),
@playwright/test, @axe-core/playwright, lighthouse. Node 22 LTS. No runtime dependencies.

## 2. Configuration and build

- Env keys carry Vite's mandatory `VITE_` prefix: `VITE_DOMAIN`, `VITE_SITE_TITLE`, `VITE_OWNER_NAME`,
  `VITE_CURRENCY`, `VITE_MIN_AMOUNT`, `VITE_SUGGESTED_AMOUNTS`, `VITE_STRIPE_PAYMENT_LINK_URL`,
  `VITE_UMAMI_SCRIPT_URL`, `VITE_UMAMI_WEBSITE_ID`, `VITE_WHY_PARAGRAPH`. `UMAMI_ORIGIN` (runtime, nginx).
- `vite.config.ts` calls `loadEnv`, validates (B2, B3) and throws with the variable name; resolves
  `THUMB_SRC`/`KID_SRC` by `fs.existsSync('public/img/*.webp')` (C4) and passes them via `define`.
- `site.config.ts` is the only reader of `import.meta.env`; exports `site` (variables) and
  `elements: PinElement[]` with `{ id, kind: 'win' | 'sticker', x, y, rotate?, draggable, z }`.
- Multi-page build: `build.rollupOptions.input` lists the six HTML files; nginx `try_files $uri $uri/`
  serves `/thanks` from `thanks/index.html`.
- Shared `<head>` (meta, OG tags, optional Umami tag) is injected by a 20-line `transformIndexHtml`
  plugin in `vite.config.ts`, so no HTML file carries env-dependent markup by hand.
- Text substitution in HTML (`%VITE_SITE_TITLE%` etc.) uses Vite's built-in env replacement.

## 3. Markup and layout

- `index.html`: `<main class="board"><div class="stage" id="stage"> … </div></main>`. Each element is
  `<section class="win abs" data-pin="headline">` or `<div class="sticker abs" data-pin="kao-1" aria-hidden="true">`,
  in the mobile DOM order (windows first, stickers last). Interactive children stop `pointerdown`
  propagation; passive children carry `no-drag`.
- Default CSS = stacked layout (no-JS and < 768 px). `main.ts` adds `.is-board` to `.stage` when
  `matchMedia('(min-width: 768px)')` matches; `.is-board > .abs { position: absolute }` and `applyLayout`
  writes `left/top` (design px) and `--rot` (rotation via `transform: rotate(var(--rot))`) from the config
  through the CSSOM (P11). On media-query change the class toggles and drag is (de)initialised.
- Scale: `computeScale(clientWidth) = min(1, clientWidth / 1440)`; `fitStage` sets `transform: scale()`
  and the wrapper height `900 * scale`; wrapper is `max-width: 1440px; margin-inline: auto; overflow: hidden`
  (P10, P12). Resize re-clamps every element (constitution §8).
- z-order: windows 1–4 in DOM order, stickers 10–22, `cta` 900, `headline` 1000; `topZ` for drags starts
  at 30 and never reaches 900 in practice (guarded: cap at 800).
- Typography (Q1 default): body copy 24 design px, captions 22, links 26, CTA button 34, headline 168.
  System stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; kaomoji in `.kao`.

### Initial composition (design px, stage 1440×900; sizes are CSS widths, heights follow content)

| id                     | x    | y   | w   | rot | notes                                     |
| ---------------------- | ---- | --- | --- | --- | ----------------------------------------- |
| headline               | 360  | 190 | 720 | 0   | fixed, z 1000                             |
| cta                    | 440  | 480 | 560 | 0   | fixed, z 900; corridor 440–1000 × 480–755 |
| trade-offer            | 50   | 70  | 300 | 0   | thumb image 160×200                       |
| kid                    | 1090 | 60  | 280 | 0   | kid image 210×280                         |
| why                    | 110  | 610 | 320 | 0   |                                           |
| footer                 | 1000 | 730 | 400 | 0   |                                           |
| kao-1 `^ ω ^`          | 430  | 110 | –   | −6  |                                           |
| kao-2 `¯\_(ツ)_/¯`     | 960  | 130 | –   | 4   |                                           |
| kao-3 `(¬_¬)`          | 1060 | 560 | –   | −3  |                                           |
| kao-4 `{ ^-^ }`        | 700  | 800 | –   | 7   |                                           |
| nametag                | 700  | 90  | 220 | −4  | tucked under the headline's top edge      |
| pricetag               | 1040 | 505 | 150 | 8   | right of CTA                              |
| legit                  | 150  | 420 | 140 | −9  | under trade-offer, left of headline       |
| beachball              | 1340 | 520 | 64  | 0   | inline SVG                                |
| folder                 | 40   | 520 | 72  | 5   | inline SVG                                |
| paid                   | 1140 | 330 | 120 | −7  | stamped on the kid photo                  |
| thumbs                 | 1030 | 640 | –   | 3   | right column below the price tag          |
| loading                | 470  | 790 | 200 | −2  | below CTA                                 |
| arrow "you are here →" | 225  | 545 | 170 | 6   | points at the CTA                         |

Final values after the 1440 px screenshot rounds in Phase 4 (2026-08-30); source of truth is
`site.config.ts`. No window overlaps another window's content, nothing enters the CTA corridor.

## 4. Pages

- `/thanks`: one centered window; copy-link button (`navigator.clipboard.writeText`, on failure the URL
  is shown in a selected `<input readonly>`); "Share on X" → `https://x.com/intent/post?text=…&url=…`
  (rel noopener noreferrer); `<meta name="robots" content="noindex">`.
- Legal pages: one centered window, `<article lang="de">` then `<article lang="en">`, `TODO-LEGAL`
  markers as visible `<mark>` blocks so they cannot ship unnoticed (an e2e test fails on `TODO-LEGAL`
  only when `CI_RELEASE=1`, so development stays green).
- `404.html`: same look, link home; nginx `error_page 404 /404.html`.

## 5. nginx, Docker, compose

- Image: `nginxinc/nginx-unprivileged:1.27-alpine` (non-root, listens on 8080). Template
  `nginx/default.conf.template` → `/etc/nginx/templates/` (built-in envsubst, A7).
- Headers: CSP from constitution §5 with `${UMAMI_ORIGIN}` in `script-src`/`connect-src`;
  `X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin-when-cross-origin`,
  `Permissions-Policy camera=(), microphone=(), geolocation=()`, `X-Frame-Options DENY`.
  HSTS stays on the reverse proxy. `/assets/*` → `Cache-Control: public, max-age=31536000, immutable`;
  HTML → `no-cache`. gzip on. Server tokens off.
- `Dockerfile`: stage 1 `node:22-alpine`, `ARG` per `VITE_*` variable, `npm ci`, `npm run build`;
  stage 2 copies `dist/` and the template. `.dockerignore` excludes `node_modules`, `tests`, `.env*`.
- `docker-compose.yml`: service `web`, `container_name: okrich-web`, `build.args` from `.env`,
  `environment: UMAMI_ORIGIN`, `networks: [proxy]` (external), no `ports`, `restart: unless-stopped`,
  commented label blocks for Traefik, Caddy (caddy-docker-proxy) and Coolify.
- `docker-compose.local.yml`: `ports: ["8080:8080"]`, default network. Verification command in README.

## 6. Tests and quality gates

- Vitest (`tests/unit`): `drag.ts` and `computeScale` with edge cases (clamp at all four sides, scale < 1,
  threshold boundary); coverage threshold 90 % on those files. `config-integrity.test.ts` compares
  `data-pin` ids in `index.html` with `elements`. `build-guards.test.ts` runs `vite build` in a child
  process with an empty Stripe URL / half Umami config and expects a non-zero exit.
- Playwright (`tests/e2e`): projects `desktop` (1280×800, Chromium) and `mobile` (375×812, Chromium
  mobile). Smoke per spec §7 (drag delta via `page.mouse`, click-swallow, CTA href, footer links 200,
  console errors collected). `a11y.spec.ts` runs axe on all six pages, blocking on serious/critical.
  Web server: `vite preview` on the production build.
- `npm run audit:lighthouse`: builds, serves `dist/`, runs Lighthouse (desktop preset) and writes
  `reports/lighthouse.html`; CI uploads it as a non-blocking artifact.
- Scripts: `dev`, `build`, `preview`, `lint`, `format:check`, `typecheck`, `test:unit`, `test:e2e`, `test`,
  `audit:lighthouse`, `og`.

## 7. CI (`.github/workflows/ci.yml`)

On push and PR: checkout → Node 22 (`npm ci`) → `lint`, `format:check`, `typecheck` → `test:unit`
(coverage) → `build` with dummy `VITE_*` env (A8) → `npx playwright install --with-deps chromium` →
`test:e2e` → `npm audit --audit-level=high` → `npx @cyclonedx/cyclonedx-npm --output-file sbom.json`
(artifact) → Lighthouse artifact (continue-on-error). Playwright report uploaded on failure.

## 8. Stripe and n8n (documentation deliverables)

- `docs/stripe-setup.md`: Payment Link with "customer chooses price", min 5 EUR, collect email, custom
  field "Anything you want me to know? (optional)", terms-acceptance with the § 356 Abs. 5 BGB consent
  text (DE + EN), success URL `https://okrich.lol/thanks`, receipts on, webhook endpoint for
  `checkout.session.completed`, test-mode walkthrough with card 4242.
- `n8n/okrich-stripe.json` nodes: **Stripe Trigger** (signature verified by n8n) → **Code** "guard":
  reject if `now − event.created > 300 s`; idempotency via `$getWorkflowStaticData('global').seen`
  (ring buffer of the last 500 session ids; no extra service) → **IF** new → **Gmail** to owner
  (amount/100 + currency, buyer email, custom field, session id) → **Gmail** to buyer (confirmation,
  7-day promise) → **Code** "log": masked email only (`t***@…`). Credentials referenced by name,
  never embedded. `docs/n8n-workflow.md` explains import, credentials, test event, and pruning of
  execution data (A13).

## 9. Implementation order (Phase 4, one commit per step)

1. `chore:` scaffold — package.json, tsconfig strict, eslint/prettier, vite.config.ts with env validation, `.env.example`, `.gitignore`, README stub.
2. `feat:` `drag.ts` + `stage.ts` pure functions with unit tests first (TDD), coverage gate.
3. `feat:` `index.html` markup + CSS (stacked layout first, then board layout), `site.config.ts` composition, placeholders.
4. `feat:` `pinboard.ts`, `main.ts`, media-query switching, resize re-clamp; config-integrity test.
5. `feat:` `/thanks`, legal pages, 404, head injection, OG generator, favicon, robots.
6. `test:` Playwright smoke + axe; build-guard tests; Lighthouse script; fix findings.
7. `chore:` nginx template, Dockerfile, compose files; local `docker compose up` verified with curl for headers and routes.
8. `docs:` stripe-setup, n8n workflow + JSON, README, HANDOFF.md; `ci:` GitHub Actions; first push.

Estimate: 8 steps ≈ 2 working days including the verification loops.

## 10. Risks and mitigations

- Pointer capture + `preventDefault` on `pointerdown` blocks text selection and native link drag inside windows: intended; links remain clickable because they stop propagation (P9). Verified by e2e.
- Vite may inline small assets as `data:` URIs in CSS — allowed by `img-src data:`. `assetsInlineLimit` stays default; fonts none.
- Emoji rendering differs per OS (A15); the OG image is rendered once on the owner's machine, so it is stable.
- Lighthouse scores vary on CI runners; therefore non-blocking there, blocking locally before release (documented in README).
- n8n static data is per workflow and survives restarts, but not a workflow re-import; documented, acceptable for the expected volume.
