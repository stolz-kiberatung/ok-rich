# clarify.md — Phase 1 clarifications

> **Historical document.** Written during the spec-driven build (30 August to early September 2026) and kept as a record of how decisions were made. Parts are superseded: payment moved from
> Stripe to Dodo Payments, and several checklists here were completed or replaced. The current
> state is in `README.md`, `docs/` and the code.

2026-08-30 · companion to `spec.md`. Max three open questions (constitution §2);
everything else was resolved by reference or by an assumption listed in `spec.md` §9.

## Open questions (recommended default in bold; silence = default)

**Q1 — Tablet readability vs. the 768 px breakpoint.** Between 768 and 1023 px
the stage renders at scale 0.53–0.71, so a 20 px design font shows at 10.7 px on
a 768 px tablet. Options:

- **(a) keep 768 px as in PROMPT.md and size all window copy ≥ 24 design px, headline ≥ 140 design px** — simplest, matches the reference model, costs a little visual density at 1440 px.
- (b) raise the stacking breakpoint to 1024 px — tablets get the mobile stack, desktop unchanged, fewer readability edge cases, but deviates from PROMPT.md and drag-reference §1.

**Q2 — Two quality-gate tools are required by §7 but not in the §4 devDependency allow-list.**
The Lighthouse ≥ 95 gate needs `lighthouse`; automated accessibility checks in the
Playwright suite need `@axe-core/playwright`. Options:

- **(a) approve both as devDependencies; `npm run audit` runs Lighthouse locally against the production build (report in CI as a non-blocking artifact, because Lighthouse scores fluctuate on shared runners); axe runs inside the e2e suite and blocks.**
- (b) approve none; Lighthouse is run manually in Chrome DevTools before each release, accessibility relies on Lighthouse only.

**Q3 — Repository.** The working folder is a local `Hobbyprojekte/okrich` folder
(outside the business folder, as the app playbook requires; trivially movable).
The CI deliverable presumes GitHub. Options:

- **(a) `git init` there during Phase 2, GitHub repo `okrich`, private** — Actions minutes are free within the private-repo quota and more than enough for this size.
- (b) public repo — CI unlimited, but copy, legal skeletons and the Stripe link are public from day one.

## Resolved by reference (no question needed)

| Topic                                          | Decision                                                                                                                  | Source                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Domain, title, owner, currency, minimum, chips | ok-rich.com, OK RICH, T, EUR, 5, 5/10/50                                                                                  | PROMPT.md variables     |
| Stack                                          | Vite + vanilla TS strict + plain CSS, no runtime deps                                                                     | CLAUDE.md §4            |
| Payment                                        | Stripe Payment Link as a plain `<a>`, no Stripe JS                                                                        | CLAUDE.md §4, §5        |
| Pinboard mechanics                             | stage 1440×900, scale = min(1, width/1440), Pointer Events, 3 px threshold, 24 px clamp, click-swallow, stacking < 768 px | drag-reference §1–2     |
| Window look                                    | CSS-only chrome, three dots, gradient border, drop shadow                                                                 | drag-reference §3       |
| Mobile order                                   | headline, cta, trade-offer, kid, why, footer; stickers hidden                                                             | PROMPT.md               |
| CSP, no inline, two origins only               | as written                                                                                                                | CLAUDE.md §5            |
| Consent banner                                 | none; Umami cookieless + EU self-hosted; reasoning on /privacy                                                            | CLAUDE.md §6            |
| CTA wording and price line                     | "Make me rich →" + product/price/delivery next to it                                                                      | CLAUDE.md §6            |
| Withdrawal                                     | Widerrufsbelehrung + § 356 Abs. 5 BGB consent text on /terms and in the Payment Link                                      | CLAUDE.md §6            |
| Quality gates                                  | tsc, eslint, prettier, vite build, Vitest ≥ 90 %, Playwright smoke, budgets                                               | CLAUDE.md §7            |
| Photos                                         | owner supplies later; placeholders 4:5 and 3:4                                                                            | PROMPT.md known context |
| Deployment                                     | verified locally with `docker compose up`; Hetzner later                                                                  | PROMPT.md known context |

## Decided by assumption — reasoning for the non-obvious ones (full list: spec.md §9)

- **Inline `left/top` vs. CSP `style-src 'self'`.** The reference says "inline left/top", the constitution forbids inline styles. A `style=""` attribute in HTML is blocked by that CSP; `el.style.left = …` from a script is not. Positions are therefore applied by JS from `site.config.ts` (A1, P11). Side effect: without JS the page shows the stacked layout, which is exactly the accessible fallback the constitution asks for.
- **`clientWidth` instead of `innerWidth`** (A2): `innerWidth` includes the scrollbar; with it the stage would be about 15 px too wide whenever the page scrolls.
- **Local compose override** (deliverable 3): the production compose file has no published port and needs the external proxy network, so `docker compose up` alone cannot be verified locally. `docker-compose.local.yml` adds port 8080 and drops the network.
- **Placeholder resolution at build time** (A9): the constitution wants "images missing → placeholder, no layout shift" and "owner adds photos later". A file-exists check in `vite.config.ts` gives drop-in replacement without touching HTML.
- **Umami origin via nginx `envsubst`** (A7): the CSP lives in nginx, the origin lives in `.env`; the official nginx image substitutes `${VAR}` in `/etc/nginx/templates/*.template` at start, so one `.env` feeds both build and runtime.
- **`/thanks` is unverified** (Out of Scope): without a backend the success page cannot prove a payment; the owner's email from n8n is the source of truth. `noindex` keeps it out of search.

## Privacy and legal flags for the owner's `TODO-LEGAL` pass (DSGVO)

1. Google Workspace as email processor means a US transfer → mention the EU-US Data Privacy Framework / SCCs on `/privacy` (recipient list per CLAUDE.md §6).
2. Retention: buyer email and optional message live in n8n executions and the mailbox; propose deletion 30 days after the photo is sent, and prune n8n execution data accordingly (A13).
3. The optional free-text field can contain third-party data or unwanted requests → `/terms` reserves the right to refuse and refund.
4. Legal basis for losing the withdrawal right: the constitution chose § 356 Abs. 5 BGB (digital content). A photo made for one person may also fall under § 312g Abs. 2 Nr. 1 BGB (custom-made goods); the lawyer decides, the consent text covers the first case.
5. Roles: Stripe is an independent controller for the checkout; n8n on Hetzner is processing on the owner's behalf (Hetzner AVV exists); Umami collects no personal data.
6. The owner's existing business appears in `/impressum`; the site's income is booked there (known context, not a question).
