// src/pay.ts — the board-name form on /pay.
// The form works without JavaScript: its fields are exactly the query parameters the Dodo
// Payments static link understands. JS only mirrors the name into the metadata field, so the
// board name survives even if the buyer edits the billing name at checkout.
// The amount is NOT asked here: the product is a Pay-What-You-Want product with a minimum,
// so the buyer picks the amount inside Dodo's own checkout.

import { cleanName } from './name';

const form = document.getElementById('payform') as HTMLFormElement | null;
const nameInput = document.getElementById('contributor-name') as HTMLInputElement | null;
const metaInput = document.getElementById('meta-name') as HTMLInputElement | null;

if (form && nameInput && metaInput) {
  const sync = () => {
    metaInput.value = cleanName(nameInput.value);
  };
  nameInput.addEventListener('input', sync);
  form.addEventListener('submit', () => {
    nameInput.value = cleanName(nameInput.value);
    sync();
  });
  sync();
}
