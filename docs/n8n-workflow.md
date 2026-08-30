# docs/n8n-workflow.md — Stripe → owner email + buyer confirmation

Export: `n8n/okrich-stripe.json`. One workflow, two endpoints, no extra services:

```
POST /webhook/okrich-stripe (raw body)
  → Verify, dedupe, count (Code)   signature · age ≤ 5 min · idempotency · raised += amount
      → Email owner (Gmail)        amount, buyer email, message, session id
      → Confirm to buyer (Gmail)   "payment received, photo within 7 days"

GET /webhook/okrich-stats
  → Count visit, read totals (Code)  one visit per IP hash per 12 h
      → Respond with totals          {"raised":…, "visitors":…, "sales":…}
```

Both endpoints live in the **same** workflow on purpose: they share `$getWorkflowStaticData`,
which is where the running totals are kept. Splitting them would break the shared counter.

Why a Webhook node instead of n8n's Stripe Trigger: the Code node verifies the
`Stripe-Signature` header itself (HMAC-SHA256, constant-time compare) and rejects events older
than 300 s, which is what the constitution requires and what you can read and audit in one place.

## 1. Host prerequisites (n8n docker compose on Hetzner)

Add to the n8n service environment and restart n8n:

```
STRIPE_WEBHOOK_SECRET=whsec_...          # from the Stripe webhook endpoint (docs/stripe-setup.md §5)
NODE_FUNCTION_ALLOW_BUILTIN=crypto       # lets the Code nodes require('crypto')
OKRICH_IP_SALT=<random 32+ chars>        # salt for the visitor-counter IP hash (never logged)
EXECUTIONS_DATA_PRUNE=true               # keep execution data short-lived (privacy, A13)
EXECUTIONS_DATA_MAX_AGE=720              # hours = 30 days
```

`N8N_BLOCK_ENV_ACCESS_IN_NODE` must stay `false` (the default) so `$env.STRIPE_WEBHOOK_SECRET`
is readable in the Code node. The secret lives only in the n8n environment, never in this repo.

## 2. Import and wire up

1. n8n → **Workflows → Import from file** → `n8n/okrich-stripe.json`.
2. Open **Email owner**: replace `owner@example.com` with your address.
3. Open both Gmail nodes and select your **Gmail OAuth2** credential (Google Workspace account
   that will also send the photos). Create it under Credentials if missing; Google Cloud OAuth
   client with the Gmail send scope, redirect URL from n8n.
4. Save, then **Activate** the workflow. Open the Webhook node and copy the **Production URL**,
   e.g. `https://n8n.example.com/webhook/okrich-stripe`. That is `N8N_WEBHOOK_URL`.
5. Register that URL in Stripe with the event `checkout.session.completed`
   (docs/stripe-setup.md §5) and put the signing secret into `STRIPE_WEBHOOK_SECRET`.

## 3. Test

- Stripe Dashboard → Webhooks → your endpoint → **Send test event** →
  `checkout.session.completed`. Expect: one execution, both emails sent (the test payload has a
  placeholder buyer email; the confirmation to it will bounce, that is fine).
- Or with the Stripe CLI: `stripe listen --forward-to https://n8n.example.com/webhook/okrich-stripe`
  then `stripe trigger checkout.session.completed`.
- Replay the same event: the execution stops after the Code node (duplicate session id).
- Tamper with the signature (send the JSON with curl without a valid header): the Code node
  logs `rejected: bad signature` and sends nothing. The webhook still answers 200, which is
  intended: Stripe only needs a 2xx, and invalid requests must not learn anything.

## 4. Data handling

- The Code node logs only a masked address (`t***@example.com`). No card data ever reaches n8n;
  Stripe sends none in this event.
- Workflow settings: successful executions are **not** stored (`saveDataSuccessExecution: none`),
  errors are, and pruning removes them after 30 days.
- The owner email contains the buyer's full email address on purpose: it is the delivery address
  for the photo. Delete it after sending the photo (privacy policy §7).
- Idempotency uses `$getWorkflowStaticData('global').seen`, a ring buffer of the last 500 session
  ids. It persists across restarts but not across a workflow re-import; after a re-import, Stripe's
  own retry window (3 days) is the only overlap to watch.

## 5. Failure modes

| Symptom                                               | Cause                                                         | Fix                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| Execution stops at the Code node, log `bad signature` | wrong `STRIPE_WEBHOOK_SECRET` or test vs live secret mixed up | copy the secret of the endpoint that is actually sending |
| `Cannot find module 'crypto'`                         | `NODE_FUNCTION_ALLOW_BUILTIN` not set                         | add the env var, restart n8n                             |
| `STRIPE_WEBHOOK_SECRET is not set`                    | env var missing or env access blocked                         | set it; check `N8N_BLOCK_ENV_ACCESS_IN_NODE`             |
| Gmail node fails with 401                             | OAuth token expired / scope missing                           | reconnect the credential                                 |
| Stripe shows failed deliveries                        | workflow inactive or URL changed                              | activate, re-copy the production URL                     |

## 6. The public stats endpoint (live counters on the site)

The site shows two real numbers: the millionaire meter above the CTA button and the sports car
fund. Both come from this endpoint, together with the retro visitor counter.

1. Activate the workflow and copy the **production URL** of the _Stats endpoint_ node, e.g.
   `https://n8n.example.com/webhook/okrich-stats`.
2. Put it into the site's `.env`:

   ```
   VITE_STATS_URL=https://n8n.example.com/webhook/okrich-stats
   STATS_ORIGIN=https://n8n.example.com
   ```

   `VITE_STATS_URL` is read by the page, `STATS_ORIGIN` goes into the nginx CSP `connect-src`
   at image build time. Rebuild the container after changing either.

3. The _Respond with totals_ node sets `Access-Control-Allow-Origin: https://ok-rich.com`.
   Change that value if you serve the site from another host, otherwise the browser blocks it.
4. Check it: `curl https://n8n.example.com/webhook/okrich-stats` returns
   `{"raised":0,"visitors":1,"sales":0}` and the number rises on the next call from another IP.

**Honesty by design:** when `VITE_STATS_URL` is empty or the endpoint is unreachable, the page
removes the visitor card instead of inventing a number, and both meters keep the build-time value
from `VITE_RAISED_EUR`. Nothing on the page ever shows a made-up count.

**Counting rules:** one visit per IP hash per 12 hours (salted SHA-256, address never stored,
rolling window capped at 5000 entries). `raised` only grows inside the signature-verified Stripe
branch, so it cannot be inflated from outside.
