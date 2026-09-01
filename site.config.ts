/**
 * site.config.ts — the single place for project variables and the pinboard composition.
 * Values come from .env (VITE_* keys); vite.config.ts fails the build when a required one is empty.
 * Positions are design pixels on the 1440×900 stage (docs/drag-reference.md §1).
 */

export const STAGE = {
  width: 1440,
  height: 1840,
  /** Below this viewport width the stage is not scaled and elements stack in DOM order. */
  breakpoint: 768,
  /** Minimum px of an element that must stay inside the stage when dragged. */
  clampMargin: 24,
} as const;

export type PinKind = 'win' | 'sticker';

export interface PinElement {
  /** Matches the `data-pin` attribute in index.html. */
  id: string;
  kind: PinKind;
  /** Design px from the stage's top-left corner. */
  x: number;
  y: number;
  /** Decorative rotation in degrees, applied through the --rot custom property. */
  rotate?: number;
  draggable: boolean;
  /** Initial stacking order; drags raise elements from Z_DRAG_START upwards, capped at Z_DRAG_MAX. */
  z: number;
  /** Stickers with real content that also appear in the stacked mobile layout (.m-show). */
  mobile?: boolean;
}

export const Z_DRAG_START = 30;
export const Z_DRAG_MAX = 800;

// Playwright and other non-Vite loaders have no import.meta.env; positions must still be importable.
const env: Partial<ImportMetaEnv> = import.meta.env ?? {};

const umami =
  env.VITE_UMAMI_SCRIPT_URL && env.VITE_UMAMI_WEBSITE_ID
    ? { scriptUrl: env.VITE_UMAMI_SCRIPT_URL, websiteId: env.VITE_UMAMI_WEBSITE_ID }
    : null;

export const site = {
  domain: env.VITE_DOMAIN ?? '',
  url: `https://${env.VITE_DOMAIN ?? ''}`,
  title: env.VITE_SITE_TITLE ?? '',
  ownerName: env.VITE_OWNER_NAME ?? 'T',
  currency: env.VITE_CURRENCY ?? 'EUR',
  minAmount: Number(env.VITE_MIN_AMOUNT ?? '5'),
  suggestedAmounts: (env.VITE_SUGGESTED_AMOUNTS ?? '5, 10, 50')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n)),
  /** Dodo Payments static link of the 1 EUR product; /pay adds name and quantity. */
  payUrl: env.VITE_PAY_URL ?? '',
  /** Public n8n endpoint with the live totals; empty means "no live numbers". */
  statsUrl: env.VITE_STATS_URL ?? '',
  /** Targets for the two progress meters, in euros. */
  millionGoalEur: 1_000_000,
  carGoalEur: Number(env.VITE_CAR_GOAL_EUR ?? '200000'),
  umami,
} as const;

/** Composition from plan.md §3. Windows first (mobile DOM order), stickers after. */
export const elements: readonly PinElement[] = [
  { id: 'headline', kind: 'win', x: 372, y: 196, draggable: false, z: 1000 },
  { id: 'cta', kind: 'win', x: 452, y: 510, draggable: false, z: 900 },
  { id: 'board', kind: 'win', x: 450, y: 940, draggable: true, z: 9 },
  { id: 'trade-offer', kind: 'win', x: 26, y: 60, draggable: true, z: 1 },
  { id: 'kid', kind: 'win', x: 1136, y: 58, draggable: true, z: 2 },
  { id: 'faq', kind: 'win', x: 20, y: 430, draggable: true, z: 3 },
  { id: 'testimonials', kind: 'win', x: 1100, y: 410, draggable: true, z: 4 },
  { id: 'goal', kind: 'win', x: 1064, y: 650, draggable: true, z: 5 },
  { id: 'wall', kind: 'win', x: 510, y: 1150, draggable: true, z: 6 },
  { id: 'ideas', kind: 'win', x: 530, y: 1500, draggable: true, z: 7 },
  { id: 'footer', kind: 'win', x: 1120, y: 1349, draggable: true, z: 8 },
  {
    id: 'garage',
    kind: 'sticker',
    x: 418,
    y: 26,
    rotate: -5,
    draggable: true,
    z: 10,
    mobile: true,
  },
  { id: 'sticky', kind: 'sticker', x: 600, y: 20, rotate: 3, draggable: true, z: 11, mobile: true },
  { id: 'meme', kind: 'sticker', x: 790, y: 26, rotate: 6, draggable: true, z: 12, mobile: true },
  {
    id: 'counter',
    kind: 'sticker',
    x: 1176,
    y: 916,
    rotate: 0,
    draggable: true,
    z: 13,
    mobile: true,
  },
  {
    id: 'sample',
    kind: 'sticker',
    x: 978,
    y: 26,
    rotate: -5,
    draggable: true,
    z: 25,
    mobile: true,
  },
  { id: 'dad', kind: 'sticker', x: 860, y: 1150, rotate: -1, draggable: true, z: 24, mobile: true },
  { id: 'kao-1', kind: 'sticker', x: 900, y: 1390, rotate: -6, draggable: true, z: 14 },
  { id: 'kao-2', kind: 'sticker', x: 906, y: 952, rotate: 4, draggable: true, z: 15 },
  { id: 'kao-3', kind: 'sticker', x: 1330, y: 300, rotate: -3, draggable: true, z: 16 },
  { id: 'kao-4', kind: 'sticker', x: 1010, y: 500, rotate: 7, draggable: true, z: 17 },
  {
    id: 'sticky-life',
    kind: 'sticker',
    x: 30,
    y: 1112,
    rotate: -3,
    draggable: true,
    z: 12,
    mobile: true,
  },
  {
    id: 'onlythumbs',
    kind: 'sticker',
    x: 238,
    y: 1150,
    rotate: 2,
    draggable: true,
    z: 17,
    // Carries the joke and an alt text, so it counts as content, not ornament:
    // config-integrity.test.ts requires aria-hidden on anything without this flag.
    mobile: true,
  },
  { id: 'nametag', kind: 'sticker', x: 26, y: 1337, rotate: -4, draggable: true, z: 18 },
  { id: 'legit', kind: 'sticker', x: 26, y: 352, rotate: -9, draggable: true, z: 26 },
  { id: 'cert', kind: 'sticker', x: 278, y: 1306, rotate: -5, draggable: true, z: 20 },
  { id: 'thumbs', kind: 'sticker', x: 1214, y: 1293, rotate: 3, draggable: true, z: 22 },
  {
    id: 'hashtag',
    kind: 'sticker',
    x: 1120,
    y: 996,
    rotate: -2,
    draggable: true,
    z: 31,
    mobile: true,
  },
  { id: 'loading', kind: 'sticker', x: 900, y: 1290, rotate: -2, draggable: true, z: 23 },
  { id: 'blink-1', kind: 'sticker', x: 330, y: 588, rotate: -6, draggable: true, z: 27 },
  { id: 'blink-2', kind: 'sticker', x: 1022, y: 564, rotate: 6, draggable: true, z: 28 },
  { id: 'blink-3', kind: 'sticker', x: 1024, y: 664, rotate: 0, draggable: true, z: 29 },
];
