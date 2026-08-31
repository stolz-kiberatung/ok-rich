// src/pay.ts — the name-and-amount form on /pay.
// The form works without JavaScript: its fields are exactly the query parameters the Dodo
// Payments static link understands. JS only mirrors the name into the metadata field, so the
// board name survives even if the buyer edits the billing name at checkout.

const form = document.getElementById('payform') as HTMLFormElement | null;
const nameInput = document.getElementById('contributor-name') as HTMLInputElement | null;
const metaInput = document.getElementById('meta-name') as HTMLInputElement | null;
const amountInput = document.getElementById('contributor-amount') as HTMLInputElement | null;

/** Board names are short, single-line and free of characters that break a URL or the layout. */
export function cleanName(raw: string, max = 40): string {
  return raw
    .split('')
    .filter((ch) => ch.codePointAt(0)! >= 0x20)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

if (form && nameInput && metaInput) {
  const sync = () => {
    metaInput.value = cleanName(nameInput.value);
  };
  nameInput.addEventListener('input', sync);
  form.addEventListener('submit', () => {
    nameInput.value = cleanName(nameInput.value);
    sync();
    if (amountInput) {
      amountInput.value = String(Math.max(0, Math.floor(Number(amountInput.value) || 0)));
    }
  });
  sync();
}
