// src/easter-egg.ts — judge mode. Nothing on the page points here; the console and a comment in
// the page source do. Up up down down left right left right B A on a keyboard, or seven quick taps
// on the headline on a phone, opens a small window and lets it rain thumbs.
//
// Built with textContent and CSSOM only (no innerHTML, no inline style attributes), so it lives
// inside the same CSP as the rest of the page. Reduced motion gets the window without the rain.

export const KONAMI: readonly string[] = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

const TAPS_NEEDED = 7;
const TAP_WINDOW_MS = 2000;

/**
 * One key of the Konami code. On a wrong key the attempt falls back to the longest part of the
 * code that the keys so far still match, so "up up up down down ..." is not thrown away.
 */
export function konamiStep(pos: number, rawKey: string): { pos: number; unlocked: boolean } {
  const key = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey;
  if (key === KONAMI[pos]) {
    return pos + 1 === KONAMI.length
      ? { pos: 0, unlocked: true }
      : { pos: pos + 1, unlocked: false };
  }
  const seen = [...KONAMI.slice(0, pos), key];
  for (let len = Math.min(seen.length, KONAMI.length - 1); len > 0; len--) {
    const tail = seen.slice(-len);
    if (tail.every((k, i) => k === KONAMI[i])) return { pos: len, unlocked: false };
  }
  return { pos: 0, unlocked: false };
}

/** One tap on the headline: seven inside two seconds unlock it. */
export function tapStep(taps: number[], now: number): { taps: number[]; unlocked: boolean } {
  const recent = [...taps.filter((t) => now - t < TAP_WINDOW_MS), now];
  return recent.length >= TAPS_NEEDED
    ? { taps: [], unlocked: true }
    : { taps: recent, unlocked: false };
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function rainThumbs(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rain = el('div', 'thumb-rain');
  rain.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 28; i++) {
    const drop = el('span', 'thumb-drop', '👍');
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.animationDelay = `${Math.random() * 1.2}s`;
    drop.style.animationDuration = `${2.2 + Math.random() * 1.6}s`;
    drop.style.fontSize = `${22 + Math.random() * 26}px`;
    rain.append(drop);
  }
  document.body.append(rain);
  window.setTimeout(() => rain.remove(), 5000);
}

function openJudgeMode(): void {
  if (document.getElementById('judge-mode')) return;
  const before = document.activeElement as HTMLElement | null;

  const win = el('section', 'win judge');
  win.id = 'judge-mode';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-labelledby', 'judge-title');

  const bar = el('div', 'bar');
  const dots = el('span', 'dots');
  dots.setAttribute('aria-hidden', 'true');
  dots.append(el('span'), el('span'), el('span'));
  bar.append(dots, el('span', 'caption', 'judge.exe'));

  const body = el('div', 'body');
  const title = el('h2', '', 'Judge mode unlocked 👍');
  title.id = 'judge-title';
  const close = el('button', 'btn', 'Totally not a bribe');
  close.type = 'button';
  const mail = el('a', '', 'email');
  mail.href =
    'mailto:ok@ok-rich.com?subject=' + encodeURIComponent('Judge mode: one thumb, please');
  const offer = el('p');
  offer.append('Send me an ', mail, " and you'll get one for free.");
  body.append(
    title,
    el('p', '', 'Hi Tony, Dudu and Andrej.'),
    el('p', '', "I'd offer you a bribe, but all I have is a thumb."),
    offer,
    close,
  );
  win.append(bar, body);

  const shut = () => {
    win.remove();
    document.removeEventListener('keydown', onEsc);
    before?.focus?.();
  };
  const onEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') shut();
  };
  close.addEventListener('click', shut);
  document.addEventListener('keydown', onEsc);

  document.body.append(win);
  close.focus();
  rainThumbs();
}

export function initEasterEgg(): void {
  console.info(
    '%c👍 OK RICH',
    'font: 700 20px system-ui',
    '\nHello, source reader. There is a judge mode.\n' +
      '↑ ↑ ↓ ↓ ← → ← → B A, or tap the headline seven times.',
  );

  let pos = 0;
  document.addEventListener('keydown', (e) => {
    const r = konamiStep(pos, e.key);
    pos = r.pos;
    if (r.unlocked) openJudgeMode();
  });

  const headline = document.getElementById('site-title');
  let taps: number[] = [];
  headline?.addEventListener('click', () => {
    const r = tapStep(taps, Date.now());
    taps = r.taps;
    if (r.unlocked) openJudgeMode();
  });
}
