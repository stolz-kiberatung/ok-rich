// src/stats.ts — live totals from the owner's n8n endpoint.
// The site itself stores nothing; it only reads a public JSON document and fills two meters
// plus the visitor counter. Without a configured endpoint the counter card removes itself and
// the meters keep the build-time value, so the page never shows an invented number.

import { cleanName } from './name';
import { STAGE, site } from '../site.config';

export interface Contributor {
  name: string;
  amount: number;
}

export interface Stats {
  /** Euros taken so far. */
  raised: number;
  /** Page views counted by the endpoint. */
  visitors: number;
  /** Paid names for the board, highest first. */
  contributors: Contributor[];
}

/** Share of a goal in percent, four decimals, clamped to [0, 100]. */
export function percentOf(raised: number, goal: number): string {
  if (!Number.isFinite(raised) || !Number.isFinite(goal) || goal <= 0) return '0.0000';
  const pct = (Math.max(0, raised) / goal) * 100;
  return Math.min(100, pct).toFixed(4);
}

/** 1234 → "1,234 €" */
export function formatEur(amount: number): string {
  const n = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const rounded = Number.isInteger(n) ? n : Math.round(n * 100) / 100;
  return `${rounded.toLocaleString('en-US')} €`;
}

/** 42 → "000042" for the retro counter display. */
export function padCount(count: number, digits = 6): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return String(n).padStart(digits, '0');
}

/** Accepts only a well-formed payload; anything else is treated as "no data". */
export function parseStats(payload: unknown): Stats | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const raw = payload as Record<string, unknown>;
  const raised = Number(raw.raised);
  const visitors = Number(raw.visitors);
  if (!Number.isFinite(raised) || !Number.isFinite(visitors)) return null;
  const list = Array.isArray(raw.contributors) ? raw.contributors : [];
  const contributors = list
    .map((entry) => entry as Record<string, unknown>)
    .filter((entry) => typeof entry?.name === 'string' && Number.isFinite(Number(entry.amount)))
    .map((entry) => ({
      // Defence in depth: the webhook already cleans this, but the page must not depend on the
      // endpoint being intact. A name that arrives with a bidi override or zero-width characters
      // gets neutralised here too, one layer before it is rendered.
      name: cleanName(String(entry.name)),
      amount: Math.max(0, Number(entry.amount)),
    }))
    .sort((a, b) => b.amount - a.amount);
  return { raised: Math.max(0, raised), visitors: Math.max(0, visitors), contributors };
}

/** Fetches the totals. Returns null on any error, so the page simply keeps its build-time state. */
export async function loadStats(url: string, timeoutMs = 4000): Promise<Stats | null> {
  if (!url) return null;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, credentials: 'omit', mode: 'cors' });
    if (!res.ok) return null;
    return parseStats(await res.json());
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function setFill(selector: string, percent: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (el) el.style.width = `${percent}%`;
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** Writes the live numbers into both meters and the visitor counter. */
export function applyStats(stats: Stats): void {
  const millionPct = percentOf(stats.raised, site.millionGoalEur);
  const carPct = percentOf(stats.raised, site.carGoalEur);
  setText('million-percent', `${millionPct} %`);
  setText('car-percent', `${carPct} % complete`);
  setText('million-note', `${formatEur(stats.raised)} of ${formatEur(site.millionGoalEur)}`);
  setFill('.meter-fill', millionPct);
  setFill('.goal-fill', carPct);
  setText('visitor-count', padCount(stats.visitors));
  renderBoard(stats.contributors);
}

/** Renders the Top contributors board; keeps the "nobody yet" line when the list is empty. */
export function renderBoard(contributors: Contributor[], limit = 8): void {
  const list = document.getElementById('board-list');
  if (!list) return;
  const top = contributors.slice(0, limit);
  if (top.length === 0) return;
  list.textContent = '';
  top.forEach((c, i) => {
    const li = document.createElement('li');
    if (i === 0) li.className = 'top';
    const rank = document.createElement('span');
    rank.className = 'board-rank';
    rank.textContent = `#${i + 1}`;
    const name = document.createElement('span');
    name.className = 'board-name';
    name.textContent = c.name;
    const amount = document.createElement('span');
    amount.className = 'board-amount';
    amount.textContent = formatEur(c.amount);
    li.append(rank, name, amount);
    list.append(li);
  });
}

/** Removes the visitor card when no live source is configured or reachable. */
function dropVisitorCard(): void {
  const card = document.querySelector('[data-pin="counter"]');
  card?.remove();
}

/** Entry point used by main.ts. Never throws; the page works without it. */
export async function initStats(): Promise<void> {
  // Build-time percentages are already in the markup; only the fills need JS (no inline styles).
  for (const fill of document.querySelectorAll<HTMLElement>('.goal-fill, .meter-fill')) {
    fill.style.width = `${Math.min(100, Math.max(0, parseFloat(fill.dataset.percent ?? '0')))}%`;
  }
  const stats = await loadStats(site.statsUrl);
  if (!stats) {
    dropVisitorCard();
    return;
  }
  applyStats(stats);
  // The card may have been laid out before the numbers arrived; keep it inside the stage.
  const card = document.querySelector<HTMLElement>('[data-pin="counter"]');
  const stage = document.getElementById('stage');
  if (card && stage?.classList.contains('is-board')) {
    const maxLeft = STAGE.width - STAGE.clampMargin;
    if ((parseFloat(card.style.left) || 0) > maxLeft) card.style.left = `${maxLeft}px`;
  }
}
