# docs/stripe-setup.md — Payment Link, click by click

Goal: one Stripe Payment Link where the buyer picks the amount (min 5 EUR), leaves an email and an
optional message, accepts the terms with the digital-content consent, and lands on `/thanks`.
Everything below happens in the Stripe Dashboard; the site only links to the resulting URL.

Do this first in **Test mode** (toggle top right), walk through a payment with card
`4242 4242 4242 4242`, then repeat in Live mode and put the live URL into `.env`.

## 1. Product and price

1. Dashboard → **Product catalog** → **+ Add product**.
2. Name: `One (1) personal thumbs-up photo`.
   Description: `A real photo of me giving you a thumbs-up, taken for you, emailed within 7 days.`
3. Price: choose **Customer chooses price**.
   - Currency: `EUR`.
   - **Minimum**: `5.00` (this is the MIN_AMOUNT floor; Stripe enforces it).
   - Preset amount (optional): `10.00`. Suggested amounts on the site are text only.
   - Type: one-time.
4. Tax: leave "Tax behaviour" at your default. If you run under § 19 UStG (Kleinunternehmer), do not
   enable Stripe Tax for this product. `TODO-LEGAL: confirm with your tax adviser.`
5. Save the product.

## 2. Payment Link

1. **Payment Links** → **+ New**.
2. Select the product from step 1. Quantity: fixed at 1 (do not allow quantity changes).
3. **Collect customer information**:
   - Email: required (always on for Payment Links).
   - Name: optional; leave off. Address: off. Phone: off.
4. **Custom fields** → add one:
   - Type: Text.
   - Label: `Anything you want me to know? (optional)`
   - Optional: yes. Max length: 255 (Stripe's default).
5. **Require customers to accept your terms of service**: on.
   - Terms URL: `https://okrich.lol/terms`.
   - Custom text (Stripe shows this as the checkbox label). Paste exactly, German first:

     ```
     Ich verlange ausdrücklich, dass mit der Ausführung des Vertrags vor Ablauf der
     Widerrufsfrist begonnen wird. Mir ist bekannt, dass ich mit Beginn der Ausführung mein
     Widerrufsrecht verliere. / I expressly request that performance of the contract begins
     before the end of the withdrawal period. I understand that I lose my right of withdrawal
     once performance has begun. (AGB: https://okrich.lol/terms)
     ```

     This is the § 356 Abs. 5 BGB consent; the same wording is on `/terms`.
6. **After payment** → "Don't show confirmation page" → **Redirect customers to your website**:
   `https://okrich.lol/thanks` (no `session_id` parameter; the site does not read it).
7. **Advanced**:
   - Allow promotion codes: off.
   - Allow business customers to provide tax IDs: off.
   - Payment methods: leave the defaults (cards, Link, PayPal, Klarna, giropay/EPS as available for
     your account). PayPal only exists here, not as a separate button on the site.
8. Create the link. Copy the URL (`https://buy.stripe.com/…`).

## 3. Put the URL into the site

```
VITE_STRIPE_PAYMENT_LINK_URL=https://buy.stripe.com/xxxxxxxx
```

Rebuild (`npm run build` or `docker compose … up --build`). The CTA is a plain link; nothing else
changes.

## 4. Receipts and emails from Stripe

1. **Settings → Business → Customer emails**: enable "Successful payments" so buyers get a Stripe
   receipt. Set the support email and the public business name (`TODO-LEGAL: as in Impressum`).
2. **Settings → Business → Public details**: statement descriptor, e.g. `OKRICH.LOL THUMBS UP`
   (max 22 characters), so nobody disputes a charge they do not recognise.

## 5. Webhook to n8n

1. **Developers → Webhooks → + Add endpoint**.
2. Endpoint URL: the n8n production URL of the Stripe Trigger node, e.g.
   `https://n8n.example.com/webhook/okrich-stripe` (n8n shows it after you activate the workflow).
3. Events: only `checkout.session.completed`.
4. After saving, reveal the **Signing secret** (`whsec_…`) and paste it into the n8n Stripe
   credential (see `docs/n8n-workflow.md`). The secret never goes into this repository.
5. Send a test event from the endpoint page and check the n8n execution.

## 6. Go-live checklist

- [ ] Live-mode Payment Link created with identical settings; URL in `.env`.
- [ ] Live webhook endpoint pointing at the same n8n URL, live signing secret in n8n.
- [ ] `/terms`, `/privacy`, `/impressum` filled in (no `TODO-LEGAL` left).
- [ ] One real payment of 5 EUR by yourself; owner email and buyer confirmation arrive; refund it.
