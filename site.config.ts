/**
 * site.config.ts — the single place for project variables and the pinboard composition.
 * Values come from .env (VITE_* keys); vite.config.ts fails the build when a required one is empty.
 * Positions are design pixels on the 1440×900 stage (docs/drag-reference.md §1).
 */

export const STAGE = {
  width: 1440,
  height: 900,
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
  stripePaymentLinkUrl: env.VITE_STRIPE_PAYMENT_LINK_URL ?? '',
  umami,
} as const;

/** Composition from plan.md §3. Windows first (mobile DOM order), stickers after. */
export const elements: readonly PinElement[] = [
  { id: 'headline', kind: 'win', x: 360, y: 180, draggable: false, z: 1000 },
  { id: 'cta', kind: 'win', x: 440, y: 470, draggable: false, z: 900 },
  { id: 'trade-offer', kind: 'win', x: 40, y: 38, draggable: true, z: 1 },
  { id: 'kid', kind: 'win', x: 1140, y: 30, draggable: true, z: 2 },
  { id: 'faq', kind: 'win', x: 20, y: 330, draggable: true, z: 3 },
  { id: 'testimonials', kind: 'win', x: 1090, y: 305, draggable: true, z: 4 },
  { id: 'goal', kind: 'win', x: 1100, y: 515, draggable: true, z: 5 },
  { id: 'wall', kind: 'win', x: 905, y: 748, draggable: true, z: 6 },
  { id: 'footer', kind: 'win', x: 1100, y: 800, draggable: true, z: 8 },
  { id: 'garage', kind: 'sticker', x: 422, y: 8, rotate: -5, draggable: true, z: 10, mobile: true },
  { id: 'sticky', kind: 'sticker', x: 585, y: 12, rotate: 3, draggable: true, z: 11, mobile: true },
  { id: 'meme', kind: 'sticker', x: 782, y: 8, rotate: 6, draggable: true, z: 12, mobile: true },
  {
    id: 'counter',
    kind: 'sticker',
    x: 700,
    y: 775,
    rotate: 0,
    draggable: true,
    z: 13,
    mobile: true,
  },
  {
    id: 'sample',
    kind: 'sticker',
    x: 950,
    y: 6,
    rotate: -5,
    draggable: true,
    z: 25,
    mobile: true,
  },
  { id: 'dad', kind: 'sticker', x: 450, y: 768, rotate: -1, draggable: true, z: 24, mobile: true },
  { id: 'kao-1', kind: 'sticker', x: 240, y: 305, rotate: -6, draggable: true, z: 14 },
  { id: 'kao-2', kind: 'sticker', x: 1240, y: 258, rotate: 4, draggable: true, z: 15 },
  { id: 'kao-3', kind: 'sticker', x: 1315, y: 185, rotate: -3, draggable: true, z: 16 },
  { id: 'kao-4', kind: 'sticker', x: 998, y: 450, rotate: 7, draggable: true, z: 17 },
  { id: 'nametag', kind: 'sticker', x: 1075, y: 10, rotate: -4, draggable: true, z: 18 },
  { id: 'legit', kind: 'sticker', x: 30, y: 265, rotate: -9, draggable: true, z: 26 },
  { id: 'cert', kind: 'sticker', x: 255, y: 8, rotate: -5, draggable: true, z: 20 },
  { id: 'paid', kind: 'sticker', x: 1200, y: 205, rotate: -7, draggable: true, z: 21 },
  { id: 'thumbs', kind: 'sticker', x: 1180, y: 148, rotate: 3, draggable: true, z: 22 },
  { id: 'loading', kind: 'sticker', x: 30, y: 15, rotate: -2, draggable: true, z: 23 },
  { id: 'blink-1', kind: 'sticker', x: 335, y: 545, rotate: -6, draggable: true, z: 27 },
  { id: 'blink-2', kind: 'sticker', x: 1002, y: 520, rotate: 6, draggable: true, z: 28 },
  { id: 'blink-3', kind: 'sticker', x: 1012, y: 606, rotate: 0, draggable: true, z: 29 },
];
