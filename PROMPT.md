# PROMPT.md — Kickoff for Claude Code (v2)

Read `CLAUDE.md` (project constitution, approved) and `docs/drag-reference.md`
(binding implementation reference for the pinboard) before doing anything.
Phase 0 is done. Start with Phase 1.

## Project variables (edit before starting)

- DOMAIN: ok-rich.com # alternatives: richok.lol, makemerich.lol
- SITE_TITLE: OK RICH
- OWNER_NAME: T
- CURRENCY: EUR
- MIN_AMOUNT: 5
- SUGGESTED_AMOUNTS: 5, 10, 50
- STRIPE_PAYMENT_LINK_URL: https://buy.stripe.com/REPLACE_ME
- N8N_WEBHOOK_URL: https://n8n.REPLACE_ME/webhook/okrich-stripe
- UMAMI_SCRIPT_URL: https://umami.REPLACE_ME/script.js
- UMAMI_WEBSITE_ID: REPLACE_ME
- WHY_PARAGRAPH: "[PLACEHOLDER — owner writes this himself]"

## What we are building

A single-page website that exists for one purpose: to make the owner rich.
Visitors pay any amount (min MIN_AMOUNT). All they get is a personal, real
photograph of the owner's thumbs-up, taken for them and emailed within 7 days.
Tone: playful, self-aware, absurd. Look: a digital pinboard of overlapping
retro-macOS-style windows and small decorative stickers on a dotted grid,
casual copy, kaomoji. Reference for the _technique_ is the reference site; do not
copy its assets, copy or layout.

## Pinboard: about 20 elements on a 1440×900 stage

Windows (`.win`, draggable, title bar with three dots, caption):

1. `headline` — SITE_TITLE very large, centered; sub-headline "This page
   exists for one purpose only: to make me rich. I want to prove that life's
   a game." NOT draggable, always centered, z-index above all others.
2. `cta` — button "Make me rich →" (plain `<a>` to STRIPE_PAYMENT_LINK_URL)
   plus the line "You get: one (1) personal thumbs-up photo, taken by me,
   for you. Delivered by email within 7 days. That's it." and suggested
   amounts as text chips (SUGGESTED_AMOUNTS). NOT draggable.
3. `trade-offer` — meme layout: "I receive: $$$" / "You receive:" +
   `public/img/thumb.webp`.
4. `kid` — `public/img/kid.webp`, caption "me, already planning this".
5. `why` — WHY_PARAGRAPH.
6. `footer` — links /impressum, /privacy, /terms; "Made in Germany. No
   cookies. Seriously."

Stickers (`.sticker`, draggable, each with a small rotation between -10° and
10°, purely decorative, `aria-hidden="true"`), ~12–14 of them:
kaomoji `^ ω ^`, `¯\_(ツ)_/¯`, `(¬_¬)`, `{ ^-^ }`; a "HELLO my name is: rich
(soon)" name tag; a price tag "€5 → 👍"; a "100 % legit" stamp; a beach
ball SVG; a folder icon SVG; a "paid" stamp; a tiny thumbs-up emoji cluster;
a loading bar at 99 %; a "you are here" arrow pointing at the CTA.
Positions for all ~20 elements live in `site.config.ts` as design-px
coordinates; choose a balanced composition around the centered headline
and keep the CTA unobstructed at 1280 px and 1440 px.

Behaviour: exactly as `docs/drag-reference.md` (stage scale, pointer drag,
clamp, click-swallow, mobile stacking). Mobile order: headline, cta,
trade-offer, kid, why, footer; stickers hidden below 768 px.

Pages: `/`, `/thanks` ("Payment received. Now I go take your photo. Check
your inbox within 7 days." + copy-link and X/Twitter share intent),
`/impressum`, `/privacy`, `/terms` (all with TODO-LEGAL markers).

## Deliverables beyond the site

- `Dockerfile` (node build → nginx:alpine), `nginx.conf` with the CSP from
  CLAUDE.md §5, `docker-compose.yml` (container `okrich-web`, proxy network
  only, commented Traefik/Caddy/Coolify label variants).
- `docs/stripe-setup.md`: click-by-click Payment Link setup — customer
  chooses price, MIN_AMOUNT floor, collect email, custom field "Anything you
  want me to know? (optional)", terms acceptance with the digital-content
  consent text, success URL `https://DOMAIN/thanks`, webhook endpoint
  N8N_WEBHOOK_URL for `checkout.session.completed`.
- `docs/n8n-workflow.md` + `n8n/okrich-stripe.json`: Stripe trigger with
  signature verification → idempotency on session id → email to owner
  (amount, buyer email, custom field) → confirmation email to buyer.
- `public/og.png` 1200×630, `README.md` (dev, build, deploy, swapping
  images/copy/positions), `.env.example`, GitHub Actions CI (lint,
  typecheck, build, unit + e2e tests, `npm audit`, CycloneDX SBOM artifact).

## Known context (do not ask)

- Solo founder in Germany; income runs through his existing business.
- Hetzner host with Docker, TLS reverse proxy, Umami and n8n already running.
- Owner adds the two photos later; ship placeholder SVGs with the right
  aspect ratio (thumb 4:5, kid 3:4).
- Deployment is verified locally first with `docker compose up`; the
  Hetzner rollout is a separate, later step.

Begin with Phase 1: write `spec.md` (include the EARS criteria from
`docs/drag-reference.md` §4) and `clarify.md`, then ask for approval.
