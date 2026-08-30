# analysis.md — Phase 5, v1 against the gates

2026-08-30 · status: **v1 complete locally; owner inputs and Hetzner rollout outstanding**

## 1. Constitution §7 gates vs. results

| Gate                                                           | Required               | Result                                                                                           | Evidence                                |
| -------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `tsc --noEmit`, `eslint .`, `prettier --check .`, `vite build` | pass                   | pass                                                                                             | `npm test`                              |
| Vitest coverage on `drag.ts`, `stage.ts`                       | ≥ 90 %                 | 100 % statements/branches/functions/lines                                                        | `npm run test:unit`                     |
| Playwright: load, CTA href, footer links 200                   | pass                   | pass                                                                                             | `tests/e2e/smoke.spec.ts`               |
| Drag (120, 80) screen px at 1280 → (120, 80)/scale design px   | pass                   | pass (135 × 90 design px at scale 0.889)                                                         | smoke: "a window dragged by…"           |
| Click after drag does not follow a link                        | pass                   | pass                                                                                             | smoke: "a drag that ends over a link…"  |
| 375 px: stacked, drag does not move                            | pass                   | pass                                                                                             | smoke: mobile project                   |
| No console errors                                              | pass                   | pass on all pages, both projects                                                                 | smoke + shots                           |
| Transfer ≤ 150 KB excluding images                             | pass                   | about 14 KB (HTML 8.8 + CSS 7.7 + JS 6.3, before gzip)                                           | smoke: budget test, `vite build` output |
| Images WebP with explicit width/height                         | pass with placeholders | SVG placeholders with `width`/`height`; WebP once the owner drops the files                      | `index.html`, `vite.config.ts`          |
| Lighthouse Performance / Accessibility / Best Practices ≥ 95   | pass                   | 100 / 100 / 100 (desktop preset, local)                                                          | `npm run audit:lighthouse`              |
| Keyboard reachable, reduced motion, contrast ≥ 4.5:1           | pass                   | axe: no serious/critical on six pages; name-tag red darkened to #c4231b after a contrast finding | `tests/e2e/a11y.spec.ts`                |

## 2. Constitution §5, §6 and §8

| Requirement                                                                                 | Result                                                                                                                            |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| No secrets in repo, `.env*` ignored, `.env.example` names only                              | yes; `.gitattributes`, `.gitignore`, `.dockerignore`                                                                              |
| CSP with exactly two origins, no inline scripts/styles, no CDN fonts                        | yes; positions via CSSOM; verified header on the container                                                                        |
| Stripe as plain `<a>`, `rel="noopener noreferrer"` on external links                        | yes (CTA, share link, Stripe privacy links)                                                                                       |
| `npm ci`, lockfile, `npm audit --audit-level=high`, CycloneDX SBOM in CI                    | yes; local audit: 0 vulnerabilities; SBOM generated (spec 1.6)                                                                    |
| Webhook: signature, 5-min age, idempotency on session id, no card data / full email in logs | designed in `n8n/okrich-stripe.json`; **not executed against a live Stripe event yet** (needs the owner's n8n and Stripe secrets) |
| No cookies/storage, Umami cookieless, consent reasoning on `/privacy`                       | yes; the site sets nothing (verified by inspection: no `localStorage`/`document.cookie` in `src/`)                                |
| Legal pages DE + EN with `TODO-LEGAL`, Widerrufsbelehrung, § 356 Abs. 5 consent text        | yes; 33 `TODO-LEGAL` marks remain for the owner/lawyer                                                                            |
| CTA wording and § 312j line next to it                                                      | yes                                                                                                                               |
| Empty Payment Link → build fails loudly                                                     | yes; unit + child-process test                                                                                                    |
| Resize → re-clamp                                                                           | yes (`reclampAll` on `resize`)                                                                                                    |
| Missing images → placeholder without layout shift                                           | yes (build-time resolution)                                                                                                       |
| Umami unreachable → identical behaviour                                                     | yes; script is `defer`, nothing awaits it                                                                                         |

## 3. Deviations from plan.md (all recorded, none from the constitution)

- Composition coordinates changed after the 1440 px screenshots (legit stamp, arrow, PAID,
  price tag, headline/CTA y); the final table is in `plan.md` §3 and `site.config.ts`.
- `stage.ts` is pure only; `fitStage` moved to `pinboard.ts` because DOM tests would need
  jsdom, which is not an allowed dependency.
- `UMAMI_ORIGIN` is rendered at **image build** (build arg), not by the nginx entrypoint: the
  entrypoint's envsubst needs a writable `conf.d`, which conflicts with a read-only root
  filesystem as uid 101. Trade-off: changing the Umami origin means rebuilding the image
  (seconds), gain: read-only container.
- `SHARE_TEXT` lives in `vite.config.ts`, not `site.config.ts`, so the HTML can carry a working
  share link without JavaScript.
- Clean-URL middleware added to Vite dev/preview so e2e sees the same routing as nginx.
- n8n uses a Webhook + Code node instead of the Stripe Trigger node, so the signature check and
  the 5-minute window are explicit and auditable.
- SBOM includes dev dependencies: there are no runtime dependencies, so the toolchain is the
  only supply chain worth recording.

## 4. Numbers

- 6 commits, 19 pinboard elements, 6 pages, 34 unit tests, 29 e2e tests (×2 projects, 7 skipped
  by project), 100 % coverage on pure modules.
- Build output: `dist/` about 47 KB HTML+CSS+JS uncompressed, 16 KB gzipped, plus 2 SVG
  placeholders (3 KB) and `og.png` (67 KB, only fetched by link previews).
- Container image: `nginxinc/nginx-unprivileged:1.27-alpine` + `dist/`; healthy in about 5 s.

## 5. Open items

Owner (blocking launch): photos, `VITE_WHY_PARAGRAPH`, Stripe link (test + live), n8n import +
host env (`STRIPE_WEBHOOK_SECRET`, `NODE_FUNCTION_ALLOW_BUILTIN=crypto`), all `TODO-LEGAL`,
Umami ids, GitHub repo + first CI run. Details: `HANDOFF.md`.

Engineering (non-blocking): none required for v1. Nice-to-have after launch: a Playwright
visual regression snapshot per width once the real photos are in.

## 6. Hetzner rollout checklist (separate step)

1. DNS A/AAAA for `ok-rich.com` (and `www`) → host; wait for propagation.
2. Clone the repo on the host, create `.env` with live values (Payment Link, Umami, `UMAMI_ORIGIN`).
3. Uncomment the proxy label block (Traefik / Caddy / Coolify) in `docker-compose.yml`; ensure the
   `proxy` network name matches the host's.
4. `docker compose up -d --build`; `docker compose ps` shows healthy.
5. From outside: `curl -sI https://ok-rich.com/` shows the CSP header and HSTS (from the proxy);
   `/thanks`, `/terms` 200; `/nope` 404.
6. Stripe: switch the Payment Link and webhook endpoint to live; n8n workflow active; one real
   5 EUR self-purchase → owner email + buyer confirmation arrive → refund.
7. Umami: website appears in the dashboard after the first visit; CTA event `make-me-rich` counted.
8. Remove `TODO-LEGAL` guard: `grep -r TODO-LEGAL impressum privacy terms` returns nothing.

## v1.1 addendum (2026-08-30, same day)

User-requested pinboard expansion, implemented and verified with the same gates (all green:
34 unit, 29 e2e, Lighthouse rerun below, build guards unchanged):

- Real photos: `thumb.webp` (thumbs-up in front of the site, EXIF rotation honoured), `kid.webp`
  (snorkel photo, cropped 4:3). Placeholders remain as build-time fallback.
- New windows: FAQ (2 questions), reviews (3 obviously-joke testimonials), the goal (AI sports
  car photo + real progress bar from `VITE_RAISED_EUR` / `VITE_CAR_GOAL_EUR`), wall of thumbs
  (static mini gallery: 1 sold + 2 empty slots). Note: constitution §9 lists a Wall-of-Thumbs
  gallery as out of scope; the owner explicitly requested this static, backend-free version.
- New cards/stickers: sticky todo note, certificate of authenticity, dad messenger popup,
  sample polaroid with SOLD stamp, Hot Wheels garage polaroid (generated with Nano Banana via
  Higgsfield), taped "life advice" meme card, retro visitor counter (clock-derived, no storage).
- Removed on request: price tag, beach ball, folder icon, "you are here" arrow.
- CTA spacing reworked; mobile now shows the six content cards (`.m-show`) between the windows.
- Legal flags: testimonials and counter are unmistakably satirical, so no misleading-advertising
  concern. v1.2 replaced the initial real-person meme photo with an AI-generated fictional
  lookalike (same shirt text), resolving the § 22 KUG risk.
- New tool: `scripts/convert-image.mjs` (rotate/crop/resize → WebP via Chromium canvas).

## v1.2 addendum (2026-08-30, evening)

- Meme card photo replaced by a Nano-Banana-generated fictional lookalike (same pose and
  "STOP BEING POOR" shirt) — no real person on the page any more.
- The why window (placeholder paragraph) was removed; its slot went to a third FAQ entry
  ("I paid more than the rest…", full answer verbatim from the owner); `VITE_WHY_PARAGRAPH` was removed from env, config and types.
- Third testimonial replaced ("the guy who sold me the domain").
- Hero sub-line and the whole CTA body are centered (text-wrap: balance on both).
- Composition rebalanced: certificate into the top strip, counter beside Dad in the bottom band,
  thumbs cluster stamped onto the kid photo. Gates rerun: 34 unit, 29 e2e, Lighthouse 98/100/100.

## v1.6 addendum (2026-08-30, legal pages)

Owner decision after reviewing a comparable site (a German sole trader running an English-only site):
the legal pages switch from bilingual to **English**, structured like that model (effective date,
operator and contact, what the service is and is not, payment, refunds, prohibited use, licence,
liability with the German mandatory carve-outs, governing law).

**One deliberate exception:** the Widerrufsbelehrung on /terms stays German. Reason: § 356 (5) BGB
only extinguishes the right of withdrawal if the consumer was properly instructed; an instruction
a German consumer cannot read is attackable, and a defective instruction extends the withdrawal
period to twelve months and fourteen days. Keeping one German block costs nothing and protects the
"no refunds after delivery" position that the whole product depends on.

**Residual risk the owner accepts:** for consumers in Germany, an English-only privacy policy and
legal notice can be challenged (Art. 12 GDPR "clear and plain language"; § 5 DDG "easily
recognisable" for the addressed public). Same risk comparable sites carry. A lawyer pass is still open.

Contact addresses: ok@ok-rich.com (orders, questions, withdrawal, data-subject requests) and
complaints@ok-rich.com (complaints, rights notices). This constitution §6 was updated accordingly.
