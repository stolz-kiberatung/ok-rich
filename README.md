# OK RICH

A one-page site with one purpose: to make the owner rich. Visitors pay any amount (min 5 EUR)
through a Dodo Payments Payment Link and receive one personal, real thumbs-up photo by email within
7 days. Retro-window pinboard, draggable, no framework, no cookies, no backend.

- Constitution and rules: `CLAUDE.md` · current state: `HANDOFF.md`
- Spec-driven phase documents: `spec.md`, `clarify.md`, `plan.md`, `tasks.md`, `analysis.md`

## Stack

Vite 8 · TypeScript (strict) · plain CSS · zero runtime dependencies. Tests with Vitest and
Playwright (+ axe). Served by an unprivileged nginx container. Payment = Dodo Payments Payment Link
(plain `<a href>`), post-payment automation in the owner's n8n.

## Develop

```bash
cp .env.example .env          # fill in VITE_PAY_URL at least
npm ci
npm run dev                   # http://localhost:5173
```

`vite build` fails on purpose when `VITE_DOMAIN`, `VITE_SITE_TITLE` or
`VITE_PAY_URL` is empty, or when only one of the two Umami variables is set.

## Check

```bash
npm test                      # lint, prettier, tsc, unit (coverage ≥ 90 %), build, e2e + axe
npm run audit:lighthouse      # desktop Lighthouse against the production build → reports/
node scripts/shots.mjs        # screenshots at 1440/1280/1024/375 px → reports/shots/ (preview must run)
npm run og                    # regenerate public/og.png from scripts/og.html
```

## Build and run in Docker

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
# → http://localhost:8080  (routes, 404 page, CSP headers, gzip, immutable assets)
```

`docker-compose.yml` alone is the production shape: no published ports, attached to the external
`proxy` network, labels for Traefik / Caddy / Coolify commented inside. The nginx config is
rendered at image build from `nginx/default.conf.template` with the `UMAMI_ORIGIN` build arg.

## Deploy (Hetzner, later step)

1. Put the repo on the host, fill `.env` with live values (Payment Link, Umami, `UMAMI_ORIGIN`).
2. Uncomment the label block for your reverse proxy in `docker-compose.yml`.
3. `docker compose up -d --build`. The proxy terminates TLS and should add HSTS.
4. Dodo Payments and n8n: `docs/dodo-setup.md`, `docs/n8n-workflow.md`.

## Swapping things

| What                                                   | Where                                                                                                            |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Photos                                                 | drop `public/img/thumb.webp` (4:5) and `public/img/kid.webp` (3:4); the build picks them up, placeholders vanish |
| Copy                                                   | `index.html` (pinboard), `thanks/index.html`, legal pages under `impressum/`, `privacy/`, `terms/`               |
| Title, domain, amounts, goal fund, payment link, Umami | `.env`                                                                                                           |
| Positions, rotation, z-order of the 19 elements        | `elements` in `site.config.ts` (design px on a 1440×900 stage)                                                   |
| Window widths and typography                           | `src/styles/pinboard.css` (widths), `src/styles/windows.css` (type)                                              |
| Share text on `/thanks`                                | `SHARE_TEXT` in `vite.config.ts`                                                                                 |
| Suggested amount chips                                 | `VITE_SUGGESTED_AMOUNTS` in `.env` (text only; Dodo Payments has the real minimum)                               |
| OG image layout                                        | `scripts/og.html`, then `npm run og`                                                                             |

Converting a photo for the board: `node scripts/convert-image.mjs tasks.json` (rotate, crop,
resize, WebP; see the task JSON shape at the top of the script).

Adding a sticker: markup in `index.html` (with `aria-hidden="true"`), an entry in `elements`, CSS
in `stickers.css`. The config-integrity unit test fails until both sides match.

## Layout model in one paragraph

The stage is 1440×900 design px. On viewports ≥ 768 px JavaScript adds `.is-board`, applies
`left/top` from `site.config.ts` through the CSSOM and scales the stage with
`transform: scale(min(1, width / 1440))`. Below 768 px (and without JavaScript) the plain CSS
stacks the windows in DOM order and hides the stickers. Drag uses Pointer Events with pointer
capture, a 3 px threshold, clamping to 24 px, a z-index raise on grab and a one-shot click
swallow after a drag. Details: `docs/drag-reference.md`.

## CI

`.github/workflows/ci.yml`: lint, prettier, tsc, unit, build, Playwright (Chromium), `npm audit`
(high+), CycloneDX SBOM artifact, Lighthouse artifact (non-blocking), Docker image build with a
container smoke test.
