// src/thanks.ts — copy-link button on /thanks. Clipboard API first, selectable input as fallback.

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
