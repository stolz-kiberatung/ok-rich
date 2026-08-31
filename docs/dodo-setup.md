# docs/dodo-setup.md — Dodo Payments, click by click

Goal: the visitor fills in a name and an amount on `/pay`, lands on a Dodo checkout that already
knows both, and after payment their name appears on the Top contributors board.

Dodo Payments is a **Merchant of Record**: Dodo is the seller towards the buyer and handles VAT
and sales tax worldwide, then pays you out. That is the main practical difference to a plain
payment processor, and it is why the legal pages name Dodo the way they do.

Do everything in **Test mode** first, pay once with a test card, then repeat in Live mode.

## 1. The product: one euro, bought many times

Dodo products have a fixed price; there is no "pay what you want" pricing. So the product is
**one share of one euro**, and the amount the visitor picks becomes the **quantity**. That is the
same trick comparable sites use ("$1 at a time"), and it is what lets people pay any whole amount
without a backend.

1. Dashboard → **Products → Add product**.
2. Name: `Thumbs-up support (1 € per share)`.
   Description: `One personal thumbs-up photo, taken for you and emailed within 7 days. Each
share is 1 €; the number of shares is your amount.`
3. Pricing: **One-time**, currency `EUR`, price `100` (that is 1.00 € in the smallest unit).
4. Tax category: `digital_products`.
5. Save and copy the product id (`pdt_…`).

## 2. The payment link

The static link is simply:

```
https://checkout.dodopayments.com/buy/pdt_xxxxxxxx
```

Put exactly that into the site's `.env`:

```
VITE_PAY_URL=https://checkout.dodopayments.com/buy/pdt_xxxxxxxx
PAY_ORIGIN=https://checkout.dodopayments.com
```

`VITE_PAY_URL` becomes the `action` of the form on `/pay`; `PAY_ORIGIN` is what the nginx CSP
allows as a form target. Rebuild the container after changing either.

The form sends these query parameters, which Dodo understands on a static link:

| Field                   | Meaning                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `fullName`              | prefills the buyer name, and is the fallback name for the board |
| `quantity`              | the amount in euros (one share = 1 €), minimum 5                |
| `redirect_url`          | `https://ok-rich.com/thanks`                                    |
| `metadata_display_name` | the cleaned board name, set by JS; the webhook prefers this     |

Nothing here is secret: the link, the product id and the amount are all public by nature.

## 3. Checkout settings

1. **Settings → Checkout**: collect the email address (required for delivery).
2. Add a custom field if you want the optional message: label
   `Anything you want me to know? (optional)`, type text, not required.
3. **Terms acceptance**: point it at `https://ok-rich.com/terms` and use this text, German first,
   because it is what makes the right of withdrawal expire (§ 356 Abs. 5 BGB):

   ```
   Ich verlange ausdrücklich, dass mit der Ausführung des Vertrags vor Ablauf der
   Widerrufsfrist begonnen wird. Mir ist bekannt, dass ich mit Beginn der Ausführung mein
   Widerrufsrecht verliere. / I expressly request that performance begins before the end of
   the withdrawal period. I understand that I lose my right of withdrawal once it has begun.
   (Terms: https://ok-rich.com/terms)
   ```

4. Branding: business name and support email `ok@ok-rich.com`, so the receipt is recognisable.

## 4. The webhook

1. **Developer → Webhooks → Create Webhook**.
2. URL: the production URL of the _Dodo webhook_ node in n8n, e.g.
   `https://n8n.example.com/webhook/okrich-payment`.
3. Event: `payment.succeeded` only.
4. Copy the signing secret (`whsec_…`) into the n8n host environment as `DODO_WEBHOOK_SECRET`.
   It never goes into this repository.
5. Send a test event from the dashboard and check the n8n execution.

The n8n Code node verifies the signature the way the Standard Webhooks spec requires: HMAC-SHA256
over `webhook-id.webhook-timestamp.raw_body`, compared in constant time, with the base64 key from
the secret. It also rejects events older than five minutes and processes each `webhook-id` once.
Details and the import steps: `docs/n8n-workflow.md`.

## 5. Test the whole path

1. `/pay`, name `Test Person`, amount `5`.
2. Checkout shows 5 × 1 € = 5 €, name prefilled. Pay with a Dodo test card.
3. You land on `https://ok-rich.com/thanks`.
4. n8n shows one execution; you get the notification mail, the buyer gets the confirmation.
5. Reload the front page: `Test Person 5 €` stands on the Top contributors board, the millionaire
   meter moved, and the visitor counter is running.
6. Refund the test payment in the dashboard. Note: a refund does **not** reduce the counters
   automatically. Correct them by editing the workflow's static data if a real refund happens.

## 6. Go live

- [ ] Live-mode product and link created; `VITE_PAY_URL` updated; container rebuilt.
- [ ] Live webhook endpoint with the live signing secret in n8n.
- [ ] One real 5 € purchase by yourself, end to end, then refunded.
- [ ] All `TODO-LEGAL` markers filled in on `/impressum`, `/privacy`, `/terms`.
