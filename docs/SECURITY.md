# docs/SECURITY.md — attack surface and what is closed

Written 2026-09-01 from measurements against the running container, not from a checklist. This
is the public copy: the host-level findings and the operational to-do list live in the private
operations handoff and are not reproduced here.

There is no such thing as "safe from every attack". What follows is the honest split: what the
site structurally cannot do wrong, and what was fixed on this pass.

## The attack surface, smallest to largest

| Surface               | Exposure                                                                             | Assessment                                                                    |
| --------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| The static site       | nginx serving pre-built files, no backend, no database, no server-side form handling | **Very small.** Nothing to inject into, nothing to query                      |
| Buyer-controlled text | the board name, the delivery address, anything added to the checkout URL by hand     | **The real one.** See below                                                   |
| n8n                   | two public webhooks plus a login page                                                | **The largest.** A Node process, and it holds credentials                     |
| The host              | SSH, Docker, the reverse proxy                                                       | Key-only SSH, firewall, fail2ban, unattended upgrades, rate limiting          |
| Supply chain          | 8 dev dependencies, zero runtime dependencies                                        | `npm audit`: 0 vulnerabilities. Nothing ships to the browser but our own code |

## What the site structurally cannot do wrong

Verified, not assumed:

- **No HTML injection sinks exist.** No `innerHTML`, `outerHTML`, `insertAdjacentHTML`,
  `document.write`, `eval` or `new Function` anywhere in `src/`. Every value reaches the page
  through `textContent`, which cannot become markup.
- **Proven by attack, not by reading.** A hostile stats payload containing
  `<img src=x onerror=…>`, `<script>…</script>`, a `javascript:` URL, a 5000-character name and a
  type-confused object was served to the running container: no script ran, no element was
  injected, no page error, and two of the six entries were rejected outright by the type filter.
  The test lives in `tests/e2e/hostile-payload.spec.ts`.
- **The CSP has no escape hatch**: `script-src 'self'` and `style-src 'self'` with no
  `unsafe-inline`, plus `object-src 'none'`, `frame-src 'none'`, `worker-src 'none'`,
  `frame-ancestors 'none'`, `base-uri 'self'`, `form-action` limited to the checkout host, and
  `upgrade-insecure-requests`. Even a successful injection would have nothing to execute.
- **No cookies, no local storage, no accounts.** There is no session to steal.
- **No secrets in the repository.** The webhook signing key lives only in the n8n host
  environment; the workflow file in `n8n/` carries a placeholder for the mail credential.

## Closed on this pass (2026-09-01)

0. **Name moderation, reused rather than reinvented.** `src/moderation/` is a two-tier blocklist
   (severe terms matched as substrings after leetspeak and homoglyph normalisation, the vendored
   LDNOOBW profanity list matched only as whole tokens so "Scunthorpe" stays playable), wired up
   in `src/moderation/index.ts`. Because the effective check has to run server-side, the module is
   **bundled into the n8n Code node** by `scripts/sync-blocklist.mjs`; `npm test` fails if the
   workflow copy is stale, and a unit test **executes** the generated block rather than reading it,
   so "present" can never be mistaken for "working". A blocked name is filed as `anonymous`, the
   payment stands, and the notification mail flags it.

1. **The board name was a paid billboard.** It arrives as a query parameter on a static payment
   link, so the cleaning in `src/pay.ts` ran in the attacker's own browser and could simply be
   skipped. Server-side, n8n only collapsed whitespace and cut to 40 characters. For the price of
   the minimum payment, anyone could have put a URL, a slur, or a `U+202E` bidi override, which
   reverses the entire rendered line, onto the front page.
   Now: identical rules in three places (`src/name.ts`, the n8n webhook, and again at render time
   in `src/stats.ts`), stripping control and format characters by named Unicode class, collapsing
   zalgo stacks, and removing anything that reads as a link. Eight unit tests pin the contract.
2. **Hostile characters were pasted literally into source.** They are invisible in a diff, which
   is exactly why they work. Everything now matches on `\p{Cc}` / `\p{Cf}` instead.
3. **The buyer's message reached nobody.** It was never carried into the notification mail. It is
   now extracted, stripped of control characters, capped at 500 characters, and, this is the
   prompt-injection part, wrapped in an explicit `BEGIN/END UNTRUSTED BUYER MESSAGE` block with a
   line stating it is data, not instructions. Anyone, human or assistant, reading that inbox sees
   the boundary.
4. **Headers**: `frame-src`, `worker-src`, `manifest-src`, `upgrade-insecure-requests` and
   `Cross-Origin-Resource-Policy`, including on the image location.
5. **Rate limiting in front of n8n**: tight on the login, generous on the public counter (mobile
   networks share addresses), with an IPv6 prefix key so an attacker with their own IPv6 range
   cannot walk around it.
6. **Refunds reduce the counters automatically** (2026-09-03): `refund.succeeded` on the same
   verified webhook takes the money off the total and the entry off the board, partial refunds
   included, with a per-payment ledger so two payments under one name stay correct.
7. **Board maintenance without touching stored data**: a manual branch in the payment workflow
   either anonymises an entry or removes it and corrects the total. It is reachable only through
   the n8n UI, so no new public endpoint exists.

## Closed on the 2026-09-04 pass (the repository went public that day)

Publishing the code turns every "an attacker would have to guess this" into "an attacker reads
this". The board name was attacked from that side of the table, with the shipped code, and three
things gave way.

8. **The board name was an advertising slot for the price of one minimum payment.** The link
   filter was a strip-on-sight regex with a ten-entry TLD list. Every cheap evasion used a TLD
   outside it, and the list was now readable: `t.me/pumpgroup`, `bit.ly/…`, `casino-bonus.ru`,
   `discord.gg/…` all reached the front page unchanged, as did `buy now at spam . com` (a space
   either side of the dot defeats the pattern) and a plain phone number, which is not a domain at
   all. Fixed by `looksLikeAd()` in `src/moderation/adlike.ts`: a yes/no question asked on a
   normalised probe (unicode full-stop look-alikes, spelled-out "dot", spaced dots, digit runs)
   against a long TLD list. It does not modify the name, because every attempt to normalise
   separators before stripping mangles real names. A name that answers yes is filed as
   `anonymous` exactly like a blocklisted one. It is bundled into the n8n Code node by
   `scripts/sync-blocklist.mjs`, so the workflow copy can no longer drift from the source the way
   the TLD list did. `tests/unit/adlike.test.ts` keeps every one of the bypasses as a test, and
   an equally long list of real names ("Dr. No", "St. Pauli", "J. R. R. Tolkien") as the
   false-positive half; the three-character rule in the probe exists because that half failed.

9. **An unauthenticated request could fill the host's disk, for free.** A POST to the payment
   webhook carrying the three Standard Webhooks header names but no body reached
   `item.binary.data.data`, threw a TypeError, and the workflow stores every errored execution.
   No signature and no payment required, and the path is in this repository. Both the raw body and
   the JSON parse now fail closed and return nothing, the same way a bad signature already did.

10. **The visitor-hash salt had a fallback.** `$env.OKRICH_IP_SALT || 'okrich-static-salt'` was
    fine while the string was private. A known salt makes a SHA-256 of an IPv4 address enumerable
    in seconds, which would quietly make the privacy policy's "only a salted hash is kept"
    untrue whenever the variable went missing. It now throws when the variable is unset, like the
    webhook secret two nodes over.

## What moderation still does not do

Catch an insult nobody has listed, or one aimed at a specific person. The blocklist is a floor,
not a fix; the manual branch above is the answer for everything it misses.

## How to re-check

```bash
npm test                                  # includes the hostile-payload e2e test
node scripts/sync-blocklist.mjs --check   # workflow copy of the blocklist is current
npm audit                                 # dev dependencies
```

Against a running container: `curl -sI https://<host>/ | grep -i -E "content-security|strict-transport|x-content-type|referrer|permissions"` must show every header on every location, including `/img/`.
