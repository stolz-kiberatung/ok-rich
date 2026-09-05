// src/thanks.ts — what this page says, and the copy-link button.
//
// Dodo returns the visitor here for every ending of a checkout, not only a paid one. Letting the
// 15-minute window run out lands on this page exactly like a successful payment does, so without
// the switch below the page tells someone their money arrived when nothing was charged.
//
// The `status` parameter is Dodo's own hint for the interface. Their documentation is explicit
// that it is not proof of payment, and it is not used as proof here: this page unlocks nothing,
// it only decides which sentence to show. What actually follows a payment is the confirmation
// email, sent from the signature-verified webhook.

interface Copy {
  lead: string;
  note: string;
}

/** Shown for any status that is not one of the four below, including nonsense in the URL. */
const GENERIC: Copy = {
  lead: 'The payment did not complete.',
  note: 'Nothing was charged and no photo is on its way. The button below starts again from the top.',
};

/**
 * Dodo's terminal states, with the wording each one deserves.
 *
 * A Map rather than an object literal, because `status` comes straight out of the query string.
 * With a plain object, `?status=toString` reaches Object.prototype, `NOT_PAID[status]` answers
 * with a function instead of undefined, the `??` fallback never fires, and the page renders the
 * literal word "undefined" where the sentence about the money belongs. Found 2026-09-05. A Map
 * has no prototype chain to walk into, so a hostile key simply misses.
 */
const NOT_PAID = new Map<string, Copy>(
  Object.entries({
    expired: {
      lead: 'The checkout expired before it was paid.',
      note: 'Nothing was charged and no photo is on its way. Checkouts time out after a few minutes. The button below starts a fresh one.',
    },
    cancelled: {
      lead: 'You stopped at the checkout.',
      note: 'Nothing was charged and no photo is on its way. No hard feelings. The button below starts again if you change your mind.',
    },
    failed: {
      lead: 'The payment did not go through.',
      note: 'Nothing was charged and no photo is on its way. Your bank or card provider refused it, and they can tell you why. The button below tries again.',
    },
    pending: {
      lead: 'Your payment is still being processed.',
      note: 'Some payment methods take a moment. If it goes through you get a confirmation email, and the photo follows within 7 days. Nothing more to do here.',
    },
  }),
);

function applyStatus(): void {
  const status = (new URLSearchParams(location.search).get('status') ?? '').trim().toLowerCase();
  // No parameter at all means a direct visit or an older link. Keep the paid text: someone who
  // really did pay must not be told otherwise, and this page grants nothing either way.
  if (status === '' || status === 'succeeded') return;

  const copy = NOT_PAID.get(status) ?? GENERIC;

  const paid = document.getElementById('paid-block');
  const unpaid = document.getElementById('unpaid-block');
  const share = document.getElementById('share-actions');
  const title = document.getElementById('thanks-title');
  const caption = document.querySelector<HTMLElement>('.bar .caption');
  const lead = document.getElementById('unpaid-lead');
  const note = document.getElementById('unpaid-note');

  if (paid) paid.hidden = true;
  if (unpaid) unpaid.hidden = false;
  // Sharing a payment that never happened makes no sense.
  if (share) share.hidden = true;
  if (title) title.textContent = status === 'pending' ? 'Still pending.' : 'Nothing was charged.';
  if (caption) caption.textContent = 'payment_status.txt';
  if (lead) lead.textContent = copy.lead;
  if (note) note.textContent = copy.note;
  document.title = document.title.replace('Payment received', 'Payment status');
}

applyStatus();

const button = document.getElementById('copy-link') as HTMLButtonElement | null;
const wrap = document.getElementById('share-url-wrap');
const input = document.getElementById('share-url') as HTMLInputElement | null;

function showFallback(): void {
  if (!wrap || !input) return;
  wrap.hidden = false;
  input.focus();
  input.select();
}

if (button) {
  const url = button.dataset.url ?? `${location.origin}/`;
  const label = button.textContent;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      button.textContent = 'Copied ✓';
      window.setTimeout(() => {
        button.textContent = label;
      }, 2000);
    } catch {
      showFallback();
    }
  });
}
