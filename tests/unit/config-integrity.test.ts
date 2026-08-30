import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STAGE, elements } from '../../site.config';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const domIds = [...html.matchAll(/data-pin="([^"]+)"/g)].map((m) => m[1] as string);
const configIds = elements.map((e) => e.id);

const MOBILE_ORDER = ['headline', 'cta', 'trade-offer', 'kid', 'why', 'footer'];

describe('site.config.ts ↔ index.html', () => {
  it('declares exactly the elements that exist in the DOM', () => {
    expect([...configIds].sort()).toEqual([...domIds].sort());
  });

  it('has no duplicate ids on either side', () => {
    expect(new Set(configIds).size).toBe(configIds.length);
    expect(new Set(domIds).size).toBe(domIds.length);
  });

  it('keeps the windows in the mobile DOM order, stickers after them', () => {
    const windows = domIds.filter((id) => elements.find((e) => e.id === id)?.kind === 'win');
    expect(windows).toEqual(MOBILE_ORDER);
    const firstSticker = domIds.findIndex(
      (id) => elements.find((e) => e.id === id)?.kind === 'sticker',
    );
    expect(firstSticker).toBe(MOBILE_ORDER.length);
  });

  it('marks headline and cta as fixed and above everything else', () => {
    const fixed = elements.filter((e) => !e.draggable).map((e) => e.id);
    expect(fixed.sort()).toEqual(['cta', 'headline']);
    const headline = elements.find((e) => e.id === 'headline');
    const cta = elements.find((e) => e.id === 'cta');
    const maxOther = Math.max(...elements.filter((e) => e.draggable).map((e) => e.z));
    expect(headline?.z).toBeGreaterThan(cta?.z ?? 0);
    expect(cta?.z).toBeGreaterThan(maxOther);
  });

  it('keeps every position inside the stage and rotations within ±10°', () => {
    for (const e of elements) {
      expect(e.x, e.id).toBeGreaterThanOrEqual(0);
      expect(e.y, e.id).toBeGreaterThanOrEqual(0);
      expect(e.x, e.id).toBeLessThan(STAGE.width);
      expect(e.y, e.id).toBeLessThan(STAGE.height);
      if (e.rotate !== undefined) expect(Math.abs(e.rotate), e.id).toBeLessThanOrEqual(10);
    }
  });

  it('hides every sticker from assistive technology', () => {
    for (const e of elements.filter((e) => e.kind === 'sticker')) {
      const tag = new RegExp(`data-pin="${e.id}"[^>]*aria-hidden="true"`);
      expect(html, e.id).toMatch(tag);
    }
  });
});
