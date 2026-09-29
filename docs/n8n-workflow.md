# docs/n8n-workflow.md — Dodo payment → emails, totals and the contributors board

Export: `n8n/okrich-payments.json`. One workflow, two endpoints, no extra services:

```
POST /webhook/okrich-payment (raw body)
  → Verify, dedupe, count (Code)   signature · age ≤ 5 min · idempotency · raised += amount
      → Email owner (Gmail)        amount, buyer email, message, session id
      → Confirm to buyer (Gmail)   "payment received, photo within 7 days"
      → Write the photo mail (Code) → Draft photo mail (Gmail draft)   see §4c

GET /webhook/okrich-stats
  → Count visit, read totals (Code)  one visit per IP hash per 12 h
      → Respond with totals          {"raised":…, "visitors":…, "sales":…}
```

Both endpoints live in the **same** workflow on purpose: they share `$getWorkflowStaticData`,
which is where the running totals are kept. Splitting them would break the shared counter.

Why a Webhook node instead of n8n's Dodo trigger: the Code node verifies the signature itself
(HMAC-SHA256, constant-time compare) and rejects events older than 300 s, which is what the
constitution requires and what you can read and audit in one place. Dodo follows the
**Standard Webhooks** spec, so the headers the node reads are `webhook-id`,
`webhook-timestamp` and `webhook-signature` — not a single `Dodo-Signature` header.

## 1. Host prerequisites (n8n docker compose on Hetzner)

Add to the n8n service environment and restart n8n:

```
DODO_WEBHOOK_SECRET=whsec_...          # from the Dodo webhook endpoint (docs/dodo-setup.md §4)
NODE_FUNCTION_ALLOW_BUILTIN=crypto       # lets the Code nodes require('crypto')
OKRICH_IP_SALT=<random 32+ chars>        # salt for the visitor-counter IP hash (never logged)
EXECUTIONS_DATA_PRUNE=true               # keep execution data short-lived (privacy, A13)
EXECUTIONS_DATA_MAX_AGE=720              # hours = 30 days
N8N_CONCURRENCY_PRODUCTION_LIMIT=1       # one production execution at a time, see below
```

**`N8N_CONCURRENCY_PRODUCTION_LIMIT=1` is required, not tuning.** The visitor counter and the
payment branch share the workflow's static data, and n8n writes that object whole at the end of an
execution, last write wins. A page view that finishes while a payment execution is still waiting on
Gmail would otherwise write back the board as it was before the payment. The counter also writes
only when something changed, but only the serialisation closes the race. Verify it after every
change with `docker compose exec n8n printenv N8N_CONCURRENCY_PRODUCTION_LIMIT`.

On this host the values live in `/opt/n8n/.env` (mode 600) and `docker-compose.yml` only carries
`${VARIABLE}` references, so the compose file stays safe to copy around. Changing `.env` needs
`docker compose up -d n8n` — the container is recreated, a restart alone does not re-read it.

`N8N_BLOCK_ENV_ACCESS_IN_NODE` must be `false` so `$env.DODO_WEBHOOK_SECRET` is readable in the
Code node. **Correction from 2026-09-02:** this used to be the default and needed no explicit
setting. On n8n 2.32.5 it is not — the Code node failed with `access to env vars denied` on both
`$env` reads until the variable was set explicitly in `docker-compose.yml`. Set it, don't rely on
the default. The secret itself still lives only in the n8n environment, never in this repo.

## 2. Import and wire up

The export carries a fixed `"id"` (`OKRICHWORKFLOW01`) on purpose. Without it the CLI import
fails with `SQLITE_CONSTRAINT: NOT NULL constraint failed: workflow_entity.id`, and every future
import would create a duplicate instead of updating the workflow that is already there. Keep the
id when re-exporting from the n8n UI.

The payment branch acts only on payments whose `product_cart` contains `OKRICH_PRODUCT_ID`,
a constant near the top of the payment logic in `Verify, dedupe, count`. Set it to your own Dodo
product id before importing. A Dodo account can sell several products, and every one of them
fires the same webhook; without the filter, any sale lands on this board.

**Either** in the browser, **or** from the shell on the host — the CLI route, which is what was
actually used on 2026-09-02:

```bash
# on the laptop
scp n8n/okrich-payments.json deploy@<host>:/tmp/okrich-payments.json
# on the server
docker cp /tmp/okrich-payments.json n8n-n8n-1:/tmp/okrich-payments.json
docker compose -f /opt/n8n/docker-compose.yml exec -T n8n   n8n import:workflow --input=/tmp/okrich-payments.json
docker compose -f /opt/n8n/docker-compose.yml exec -T n8n n8n list:workflow
```

Re-running the import overwrites the workflow of the same id. **It also drops
`$getWorkflowStaticData`**, which is where the totals and the contributors board live — so a
re-import after go-live resets the board to zero. Export the running workflow first if that
matters. **Verified 2026-09-03:** `n8n export:workflow --id=…` carries `staticData` (totals,
board, ledger) in the file, so the safe route is export → merge the change into the export →
import the merged file. **It also resets the credential fields** of every node to whatever the
file says; the repo file says `REPLACE_WITH_CREDENTIAL_ID`, so after any import open all four
Gmail nodes in the UI and pick the credential again, then save. The 2026-09-03 refund import
skipped that step and both real payments that day errored on the mail nodes (board updated,
mails not sent).

The Gmail credential reference in the file is the placeholder `REPLACE_WITH_CREDENTIAL_ID`; after
the import both Gmail nodes show an empty credential field until step 3 below.

1. n8n → **Workflows → Import from file** → `n8n/okrich-payments.json`.
2. Open **Email owner**: check the recipient (preset: ok@ok-rich.com).
3. Open both Gmail nodes and select your **Gmail OAuth2** credential (Google Workspace account
   that will also send the photos). Create it under Credentials if missing; Google Cloud OAuth
   client with the Gmail send scope, redirect URL from n8n.
4. Save, then **Activate** the workflow. Open the Webhook node and copy the **Production URL**,
   e.g. `https://n8n.example.com/webhook/okrich-payment`. That is `N8N_WEBHOOK_URL`.
5. Register that URL in Dodo with the events `payment.succeeded` **and** `refund.succeeded`
   (docs/dodo-setup.md §4) and put the signing secret into `DODO_WEBHOOK_SECRET`. The workflow
   acknowledges any other event type and does nothing with it.

## 3. Test

- Dodo Dashboard → Webhooks → your endpoint → **Send test event** →
  `payment.succeeded`. Expect: one execution, both emails sent (the test payload has a
  placeholder buyer email; the confirmation to it will bounce, that is fine).
- Or with the Dodo CLI: `dodo wh listen https://n8n.example.com/webhook/okrich-payment`,
  then `dodo wh trigger payment.success`.
- Replay the same event: the execution stops after the Code node (duplicate session id).
- Tamper with the signature (send the JSON with curl without a valid header): the Code node
  logs `rejected: bad signature` and sends nothing. The webhook still answers 200, which is
  intended: Dodo only needs a 2xx, and invalid requests must not learn anything.

## 4. Data handling

- The Code node logs only a masked address (`t***@example.com`). No card data ever reaches n8n;
  Dodo sends none in this event.
- Workflow settings: successful executions are **not** stored (`saveDataSuccessExecution: none`),
  errors are, and pruning removes them after 30 days.
- The owner email contains the buyer's full email address on purpose: it is the delivery address
  for the photo. Delete it after sending the photo (privacy policy §7).
- Idempotency uses `$getWorkflowStaticData('global').seen`, a ring buffer of the last 500 session
  ids. It persists across restarts but not across a workflow re-import; after a re-import, Dodo's
  own retry window (3 days) is the only overlap to watch.

## 4b. Taking an entry off the board

Anyone who pays can put 40 characters on the front page. The blocklist catches slurs and hate
codes, but not an ordinary insult, and it cannot know that a payment was later charged back. So
there is a manual branch in this same workflow.

**Why it lives here and not in an admin workflow:** the board is kept in
`$getWorkflowStaticData('global')`, which is scoped to one workflow. A separate admin workflow
would look at empty data.

**Why a manual trigger and not an admin webhook:** the n8n login already authenticates, and it is
rate limited to 10 attempts a minute at the reverse proxy. An admin webhook would add a second
public endpoint plus a second secret to store, for something needed a few times a year. If you
ever want to do this from a phone without opening n8n, that is the trade to revisit.

**How:**

1. Open the workflow in n8n.
2. Open **What to change** and set:
   - `name` — the entry exactly as it appears on the board (case does not matter)
   - `mode` — `anonymise` or `remove`
3. Click **Execute workflow** on **Fix the board (manual)**.
4. Read the output: it reports how many entries were affected, the new total, and lists the board.

| Mode        | Use it when                               | Effect on the entry  | Effect on the total                  |
| ----------- | ----------------------------------------- | -------------------- | ------------------------------------ |
| `anonymise` | the name is unwanted, the payment is fine | shows as `anonymous` | unchanged, the money was really paid |
| `remove`    | the payment is gone (refund, chargeback)  | disappears           | reduced by that amount               |

A wrong name changes nothing and prints the current board so you can copy the exact spelling.
Every run appends to `store.audit` (last 100 kept), so "who took that down and when" has an answer.

## 4c. The photo mail is written for you

Every accepted payment also produces a **Gmail draft** in the `ok@ok-rich.com` mailbox, addressed
to the person who should get the photo. The owner opens Drafts, attaches the thumb, sends. Nothing
leaves the mailbox on its own.

- **Recipient** is `sendPhotoTo` from the verification node: the address the buyer typed on `/pay`
  (gift), otherwise the payment email from Dodo. Same rule the owner mail already prints.
- **Text** comes from `Write the photo mail`, a Code node with eight templates for a buyer and five
  for a gift recipient, chosen from the payment id (same payment, same joke; a redelivered event
  writes the identical draft, and the unit tests can pin it). Tone matches the site. No em dashes.
- **A gift recipient learns the buyer's board name only**, never the buyer's email. An anonymous
  buyer is introduced as "someone who wishes to stay anonymous".
- **The checkout message is never quoted.** It is free text from a stranger; for a gift it would
  be forwarded to someone who never agreed to receive it. It stays in the owner mail, between the
  UNTRUSTED markers, for the owner to quote by hand if they want.
- Tests: `tests/unit/photo-draft.test.ts` runs the node's real code.

Adding or changing templates: edit `scripts/add-photo-draft.py` (the JS lives there as a string),
run it against `n8n/okrich-payments.json`, then re-import. To merge into the **running** workflow
without losing the board, export it first and run the script on the export (see §2 note on
`staticData`): `python scripts/add-photo-draft.py live-export.json`.

**Gmail scope.** The draft is created through the same Gmail OAuth2 credential as the other three
Gmail nodes. n8n's Gmail credential requests the compose and modify scopes, which cover drafts;
if the first draft fails with an insufficient-scope error, reconnect the credential once in the
n8n UI so Google re-issues the token with the current scopes.

## 5. Failure modes

| Symptom                                               | Cause                                                       | Fix                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| Execution stops at the Code node, log `bad signature` | wrong `DODO_WEBHOOK_SECRET` or test vs live secret mixed up | copy the secret of the endpoint that is actually sending |
| `Cannot find module 'crypto'`                         | `NODE_FUNCTION_ALLOW_BUILTIN` not set                       | add the env var, restart n8n                             |
| `DODO_WEBHOOK_SECRET is not set`                      | env var missing or env access blocked                       | set it; check `N8N_BLOCK_ENV_ACCESS_IN_NODE`             |
| Gmail node fails with 401                             | OAuth token expired / scope missing                         | reconnect the credential                                 |
| Dodo shows failed deliveries                          | workflow inactive or URL changed                            | activate, re-copy the production URL                     |

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
rolling window capped at 5000 entries). `raised` only grows inside the signature-verified payment
branch, so it cannot be inflated from outside.
