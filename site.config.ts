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
}

export const Z_DRAG_START = 30;
export const Z_DRAG_MAX = 800;

const env = import.meta.env;

const umami =
  env.VITE_UMAMI_SCRIPT_URL && env.VITE_UMAMI_WEBSITE_ID
    ? { scriptUrl: env.VITE_UMAMI_SCRIPT_URL, websiteId: env.VITE_UMAMI_WEBSITE_ID }
    : null;

export const site = {
  domain: env.VITE_DOMAIN,
  url: `https://${env.VITE_DOMAIN}`,
  title: env.VITE_SITE_TITLE,
  ownerName: env.VITE_OWNER_NAME ?? 'T',
  currency: env.VITE_CURRENCY ?? 'EUR',
  minAmount: Number(env.VITE_MIN_AMOUNT ?? '5'),
  suggestedAmounts: (env.VITE_SUGGESTED_AMOUNTS ?? '5, 10, 50')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n)),
  stripePaymentLinkUrl: env.VITE_STRIPE_PAYMENT_LINK_URL,
  umami,
  whyParagraph: env.VITE_WHY_PARAGRAPH ?? '',
  /** Prepared text for the "Share on X" link on /thanks. */
  shareText: 'I paid a stranger for a thumbs-up. Best money I ever spent.',
} as const;

/** Composition from plan.md §3. Windows first (mobile DOM order), stickers after. */
export const elements: readonly PinElement[] = [
  { id: 'headline', kind: 'win', x: 360, y: 190, draggable: false, z: 1000 },
  { id: 'cta', kind: 'win', x: 440, y: 480, draggable: false, z: 900 },
  { id: 'trade-offer', kind: 'win', x: 50, y: 70, draggable: true, z: 1 },
  { id: 'kid', kind: 'win', x: 1090, y: 60, draggable: true, z: 2 },
  { id: 'why', kind: 'win', x: 110, y: 610, draggable: true, z: 3 },
  { id: 'footer', kind: 'win', x: 1000, y: 730, draggable: true, z: 4 },
  { id: 'kao-1', kind: 'sticker', x: 430, y: 110, rotate: -6, draggable: true, z: 10 },
  { id: 'kao-2', kind: 'sticker', x: 960, y: 130, rotate: 4, draggable: true, z: 11 },
  { id: 'kao-3', kind: 'sticker', x: 1060, y: 560, rotate: -3, draggable: true, z: 12 },
  { id: 'kao-4', kind: 'sticker', x: 700, y: 800, rotate: 7, draggable: true, z: 13 },
  { id: 'nametag', kind: 'sticker', x: 700, y: 90, rotate: -4, draggable: true, z: 14 },
  { id: 'pricetag', kind: 'sticker', x: 1040, y: 505, rotate: 8, draggable: true, z: 15 },
  { id: 'legit', kind: 'sticker', x: 150, y: 420, rotate: -9, draggable: true, z: 16 },
  { id: 'beachball', kind: 'sticker', x: 1340, y: 520, rotate: 0, draggable: true, z: 17 },
  { id: 'folder', kind: 'sticker', x: 40, y: 520, rotate: 5, draggable: true, z: 18 },
  { id: 'paid', kind: 'sticker', x: 1140, y: 330, rotate: -7, draggable: true, z: 19 },
  { id: 'thumbs', kind: 'sticker', x: 1030, y: 640, rotate: 3, draggable: true, z: 20 },
  { id: 'loading', kind: 'sticker', x: 470, y: 790, rotate: -2, draggable: true, z: 21 },
  { id: 'arrow', kind: 'sticker', x: 225, y: 545, rotate: 6, draggable: true, z: 22 },
];
