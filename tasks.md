# tasks.md — OK RICH task list

Phase 3 · Tasks · 2026-08-30 · approved together with plan.md ("los").
One commit per numbered step (Conventional Commits). A step is done only when its check passes.
Environment: Node 24.14, npm 11, Docker 29 + Compose v5, Playwright Chromium present.

## T1 chore: scaffold

- [ ] `package.json` (private, type module, scripts from plan §6), pinned devDependencies, `npm install` → lockfile
- [ ] `tsconfig.json` strict, `eslint.config.js` (typescript-eslint recommended), `.prettierrc`, `.prettierignore`
- [ ] `vite.config.ts`: `loadEnv`, validation (B2, B3), placeholder resolution (C4), multi-page input, head-injection plugin
- [ ] `site.config.ts` with variables + element table (plan §3)
- [ ] `.env.example`, `.env` (local, gitignored, placeholder values), README stub
- Check: `npm run typecheck && npm run lint && npm run format:check` pass on the empty project; `vite build` fails with empty `VITE_STRIPE_PAYMENT_LINK_URL`

## T2 feat: pure drag + scale (TDD)

- [ ] `tests/unit/drag.test.ts`, `tests/unit/stage.test.ts` written first (red)
- [ ] `src/drag.ts` (clamp, delta, isDrag) verbatim from the reference; `src/stage.ts` `computeScale`
- Check: `npm run test:unit` green, coverage ≥ 90 % on both files

## T3 feat: markup, CSS, composition

- [ ] `index.html` with all 19 elements in mobile DOM order, `data-pin` ids, `no-drag` children, placeholders SVG 4:5 / 3:4
- [ ] `styles/base.css` (reset, dot grid, type scale), `windows.css` (reference §3), `stickers.css`, `pinboard.css` (stacked default, `.is-board` absolute)
- [ ] `tests/unit/config-integrity.test.ts`
- Check: page renders stacked without JS; `npm run test:unit` green

## T4 feat: pinboard wiring

- [ ] `src/pinboard.ts` (`initPinboard` from reference §2 + `applyLayout`), `src/stage.ts` DOM part (`fitStage`, resize re-clamp), `src/main.ts` (media query switch)
- Check: manual drag at 1440 and 1280 in `vite dev`; positions unchanged on resize; stacked at 375

## T5 feat: pages and assets

- [ ] `thanks/index.html` + `src/thanks.ts`; `impressum/`, `privacy/`, `terms/` (DE then EN, `TODO-LEGAL` marks); `404.html`
- [ ] `public/favicon.svg`, `public/robots.txt`, `scripts/og.html` + `scripts/make-og.mjs` → `public/og.png`
- Check: all six pages build; OG file is 1200×630

## T6 test: e2e, guards, audit

- [ ] `tests/e2e/playwright.config.ts` (desktop 1280×800, mobile 375×812, webServer = preview)
- [ ] `tests/e2e/smoke.spec.ts` (spec §7), `tests/e2e/a11y.spec.ts` (axe, all pages)
- [ ] `tests/unit/build-guards.test.ts` (child-process builds)
- [ ] `scripts/lighthouse.mjs` → `reports/lighthouse.html`
- Check: `npm test` green; Lighthouse ≥ 95 ×3 locally; transfer ≤ 150 KB excl. images

## T7 chore: nginx, Docker, compose

- [ ] `nginx/default.conf.template`, `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `docker-compose.local.yml`
- Check: `docker compose -f docker-compose.yml -f docker-compose.local.yml up --build` → curl shows CSP header, `/`, `/thanks`, `/impressum`, `/privacy`, `/terms` 200, `/nope` 404 with own page

## T8 docs + ci

- [ ] `docs/stripe-setup.md`, `docs/n8n-workflow.md`, `n8n/okrich-stripe.json`
- [ ] `README.md` (dev, build, deploy, swapping images/copy/positions), `HANDOFF.md`, `CLAUDE.md` pointer line
- [ ] `.github/workflows/ci.yml`
- Check: workflow YAML valid; README commands reproduced once from a clean clone

## Phase 5 (after T8)

- [ ] `analysis.md`: gates vs. results, budget numbers, open items, Hetzner rollout checklist
