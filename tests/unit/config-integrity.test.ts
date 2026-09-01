import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STAGE, elements } from '../../site.config';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const domIds = [...html.matchAll(/data-pin="([^"]+)"/g)].map((m) => m[1] as string);
const configIds = elements.map((e) => e.id);

const MOBILE_ORDER = [
  'headline',
  'cta',
  'board',
  'trade-offer',
  'kid',
  'faq',
  'testimonials',
  'goal',
  // ideas.txt sits before the wall on purpose: first what you get, then what to do with it.
  'ideas',
  'wall',
  'footer',
];

describe('site.config.ts ↔ index.html', () => {
  it('declares exactly the elements that exist in the DOM', () => {
    expect([...configIds].sort()).toEqual([...domIds].sort());
  });

  it('has no duplicate ids on either side', () => {
    expect(new Set(configIds).size).toBe(configIds.length);
    expect(new Set(domIds).size).toBe(domIds.length);
  });

  it('keeps the windows in the mobile DOM order, footer last on the stage', () => {
    const windows = domIds.filter((id) => elements.find((e) => e.id === id)?.kind === 'win');
    expect(windows).toEqual(MOBILE_ORDER);
    expect(domIds[domIds.length - 1]).toBe('footer');
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

  // `mobile: true` used to mean "also show this on a phone" and was paired with an `m-show`
  // class. Since 2026-09-01 every sticker shows on a phone, so the class was removed and the
  // flag kept only its second meaning: this element carries content, not decoration. Content
  // gets read out; ornaments are hidden from assistive technology.
  it('hides purely decorative stickers from assistive technology, but never the content ones', () => {
    for (const e of elements.filter((e) => e.kind === 'sticker')) {
      const openingTag = html.match(new RegExp(`<[^>]*data-pin="${e.id}"[^>]*>`))?.[0] ?? '';
      if (e.mobile) {
        expect(openingTag, e.id).not.toContain('aria-hidden');
      } else {
        expect(openingTag, e.id).toContain('aria-hidden="true"');
      }
    }
  });

  it('no element still carries the retired m-show class', () => {
    expect(html).not.toContain('m-show');
  });
});
