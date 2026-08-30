# docs/n8n-workflow.md — Stripe → owner email + buyer confirmation

Export: `n8n/okrich-stripe.json`. Four nodes, no extra services:

```
Stripe webhook (Webhook, raw body)
  → Verify, dedupe, extract (Code)   signature · age ≤ 5 min · idempotency on session id
      → Email owner (Gmail)          amount, buyer email, message, session id
      → Confirm to buyer (Gmail)     "payment received, photo within 7 days"
```

Why a Webhook node instead of n8n's Stripe Trigger: the Code node verifies the
`Stripe-Signature` header itself (HMAC-SHA256, constant-time compare) and rejects events older
than 300 s, which is what the constitution requires and what you can read and audit in one place.

## 1. Host prerequisites (n8n docker compose on Hetzner)

Add to the n8n service environment and restart n8n:

```
STRIPE_WEBHOOK_SECRET=whsec_...          # from the Stripe webhook endpoint (docs/stripe-setup.md §5)
NODE_FUNCTION_ALLOW_BUILTIN=crypto       # lets the Code node require('crypto')
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
