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

1. DNS A/AAAA for `okrich.lol` (and `www`) → host; wait for propagation.
2. Clone the repo on the host, create `.env` with live values (Payment Link, Umami, `UMAMI_ORIGIN`).
3. Uncomment the proxy label block (Traefik / Caddy / Coolify) in `docker-compose.yml`; ensure the
   `proxy` network name matches the host's.
4. `docker compose up -d --build`; `docker compose ps` shows healthy.
5. From outside: `curl -sI https://okrich.lol/` shows the CSP header and HSTS (from the proxy);
   `/thanks`, `/terms` 200; `/nope` 404.
6. Stripe: switch the Payment Link and webhook endpoint to live; n8n workflow active; one real
   5 EUR self-purchase → owner email + buyer confirmation arrive → refund.
7. Umami: website appears in the dashboard after the first visit; CTA event `make-me-rich` counted.
8. Remove `TODO-LEGAL` guard: `grep -r TODO-LEGAL impressum privacy terms` returns nothing.
