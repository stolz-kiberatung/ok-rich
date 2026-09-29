import { expect, test, type Page } from '@playwright/test';
import { loadEnv } from 'vite';
import { STAGE } from '../../site.config';

const env = loadEnv('production', process.cwd(), 'VITE_');
const PAY_URL = env.VITE_PAY_URL ?? '';
const DESIGN_WIDTH = STAGE.width;

type Errors = string[];

const STATS_HOST = PAY_URL && env.VITE_STATS_URL ? new URL(env.VITE_STATS_URL).host : '';

/**
 * The live-counter endpoint is optional by design: when it cannot be reached the page drops the
 * visitor card and carries on. Its network error is therefore expected, not a defect, so it is
 * the one console message this collector ignores.
 *
 * Match on the message location as well as its text: a failed request logs
 * "Failed to load resource: net::ERR_NAME_NOT_RESOLVED" with the host only in `location().url`,
 * so a text-only filter let it through whenever DNS gave up before the last assertion ran —
 * which made this an intermittently failing test rather than a failing site.
 */
function collectErrors(page: Page): Errors {
  const errors: Errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (STATS_HOST && (m.text().includes(STATS_HOST) || m.location().url.includes(STATS_HOST)))
      return;
    errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function position(page: Page, id: string): Promise<{ left: number; top: number }> {
  return page.locator(`[data-pin="${id}"]`).evaluate((el) => ({
    left: parseFloat((el as HTMLElement).style.left) || 0,
    top: parseFloat((el as HTMLElement).style.top) || 0,
  }));
}

/** Drags an element by its title bar by (dx, dy) screen px with the mouse. */
async function dragByBar(page: Page, id: string, dx: number, dy: number): Promise<void> {
  const bar = page.locator(`[data-pin="${id}"] .bar`);
  const box = await bar.boundingBox();
  if (!box) throw new Error(`no box for ${id}`);
  // Grab near the bar's right end: stickers may overlap the left corner and would swallow the pointer.
  const x = box.x + box.width - 30;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 5 });
  await page.mouse.move(x + dx, y + dy, { steps: 5 });
  await page.mouse.up();
}

test.describe('pinboard page', () => {
  test('loads without console errors and links the configured Payment Link', async ({ page }) => {
    const errors = collectErrors(page);
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(env.VITE_SITE_TITLE ?? 'OK RICH');
    await expect(page.locator('a.btn')).toHaveAttribute('href', '/pay');
    expect(PAY_URL.startsWith('https://')).toBe(true);
    expect(errors).toEqual([]);
  });

  test('every footer link resolves with 200', async ({ page }) => {
    await page.goto('/');
    const hrefs = await page
      .locator('[data-pin="footer"] a')
      .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''));
    expect(hrefs).toEqual(['/impressum', '/privacy', '/terms']);
    for (const href of hrefs) {
      const res = await page.request.get(href);
      expect(res.status(), href).toBe(200);
    }
  });

  test('first load stays under the 150 KB budget (excluding images)', async ({ page }) => {
    let bytes = 0;
    page.on('response', async (res) => {
      const type = res.headers()['content-type'] ?? '';
      if (type.startsWith('image/')) return;
      try {
        bytes += (await res.body()).length;
      } catch {
        // response body not available (e.g. redirects); ignore
      }
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    expect(bytes).toBeLessThan(150 * 1024);
  });

  test('unknown routes return the custom 404 page', async ({ page }) => {
    const res = await page.goto('/this-does-not-exist');
    expect(res?.status()).toBe(404);
    await expect(page.locator('h1')).toContainText('404');
  });
});

test.describe('desktop pinboard', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop', 'desktop only');
  });

  test('a window dragged by (120, 80) screen px moves by (120, 80) / scale design px', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#stage')).toHaveClass(/is-board/);
    const scale = (await page.evaluate(() => document.documentElement.clientWidth)) / DESIGN_WIDTH;
    const before = await position(page, 'kid');
    await dragByBar(page, 'kid', 120, 80);
    const after = await position(page, 'kid');
    expect(after.left - before.left).toBeCloseTo(120 / scale, 0);
    expect(after.top - before.top).toBeCloseTo(80 / scale, 0);
  });

  test('a dragged window ends on top and is clamped to the stage', async ({ page }) => {
    await page.goto('/');
    // A window in the top right, which since 2026-09-01 is ideas.txt: reviews moved down to sit
    // above the legal notice and is no longer reachable inside the test viewport.
    await dragByBar(page, 'ideas', 40, 40);
    const zBoard = await page
      .locator('[data-pin="ideas"]')
      .evaluate((el) => Number((el as HTMLElement).style.zIndex));
    const zKid = await page
      .locator('[data-pin="kid"]')
      .evaluate((el) => Number((el as HTMLElement).style.zIndex));
    expect(zBoard).toBeGreaterThan(zKid);
    // Fling the window far outside: at least 24 design px must remain visible.
    await dragByBar(page, 'ideas', -3000, -3000);
    const pos = await position(page, 'ideas');
    const size = await page.locator('[data-pin="ideas"]').evaluate((el) => ({
      w: (el as HTMLElement).offsetWidth,
      h: (el as HTMLElement).offsetHeight,
    }));
    expect(pos.left).toBeCloseTo(STAGE.clampMargin - size.w, 0);
    expect(pos.top).toBeCloseTo(STAGE.clampMargin - size.h, 0);
  });

  test('a drag that ends over a link does not navigate; a plain click does', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('[data-pin="footer"] a', { hasText: 'Legal notice' });
    const bar = page.locator('[data-pin="footer"] .bar');
    const barBox = await bar.boundingBox();
    const linkBox = await link.boundingBox();
    if (!barBox || !linkBox) throw new Error('boxes missing');
    await page.mouse.move(barBox.x + 20, barBox.y + barBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(linkBox.x + 10, linkBox.y + 10, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    expect(new URL(page.url()).pathname).toBe('/');

    await link.click();
    await expect(page).toHaveURL(/\/impressum$/);
  });

  test('the CTA is clickable without starting a drag and leads to the form', async ({ page }) => {
    await page.goto('/');
    await page.locator('a.btn').click();
    await expect(page).toHaveURL(/\/pay$/);
    await expect(page.locator('#contributor-name')).toBeVisible();
  });

  test('resizing rescales the stage without changing design positions', async ({ page }) => {
    await page.goto('/');
    const before = await position(page, 'trade-offer');
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(100);
    const after = await position(page, 'trade-offer');
    expect(after).toEqual(before);
    const transform = await page
      .locator('#stage')
      .evaluate((el) => (el as HTMLElement).style.transform);
    expect(transform).toMatch(/scale\(0\.71/);
  });

  test('headline and CTA stay above every dragged element', async ({ page }) => {
    await page.goto('/');
    await dragByBar(page, 'kid', -300, 300);
    const z = await page.evaluate(() =>
      ['headline', 'cta', 'kid'].map((id) =>
        Number((document.querySelector(`[data-pin="${id}"]`) as HTMLElement).style.zIndex),
      ),
    );
    expect(z[0]).toBeGreaterThan(z[1] ?? 0);
    expect(z[1]).toBeGreaterThan(z[2] ?? 0);
  });
});

test.describe('mobile layout', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'mobile', 'mobile only');
  });

  test('windows stack in DOM order, everything shows, drag does nothing', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#stage')).not.toHaveClass(/is-board/);
    const order = [
      'headline',
      'cta',
      'board',
      'trade-offer',
      'kid',
      'faq',
      'ideas',
      // The sticker cluster sits between the ideas and the car on purpose (owner brief,
      // 2026-09-03). `loading` is the last sticker in DOM order, so goal below it proves the
      // whole cluster comes first.
      'loading',
      'goal',
      'wall',
      'testimonials',
      'footer',
    ];
    let lastBottom = -1;
    for (const id of order) {
      const box = await page.locator(`[data-pin="${id}"]`).boundingBox();
      if (!box) throw new Error(`no box for ${id}`);
      expect(box.y, id).toBeGreaterThan(lastBottom);
      lastBottom = box.y + box.height;
    }
    // Since 2026-09-01 the phone shows the whole board, not a curated subset: hiding two thirds
    // of a pinboard threw away the thing the site is. Previously kao-1 and nametag were asserted
    // hidden here — now they must be visible like everything else.
    for (const id of ['kao-1', 'nametag', 'cert', 'thumbs', 'legit', 'loading', 'onlythumbs']) {
      await expect(page.locator(`[data-pin="${id}"]`), id).toBeVisible();
    }
    await expect(page.locator('[data-pin="sticky"]')).toBeVisible();
    await expect(page.locator('[data-pin="dad"]')).toBeVisible();
    await expect(page.locator('[data-pin="sample"]')).toBeVisible();

    // The one deliberate exception: attention arrows point at the CTA in two dimensions and
    // would point at nothing in a single column.
    for (const id of ['blink-1', 'blink-2', 'blink-3']) {
      await expect(page.locator(`[data-pin="${id}"]`), id).toBeHidden();
    }

    const kid = page.locator('[data-pin="kid"]');
    await kid.scrollIntoViewIfNeeded();
    const before = await kid.boundingBox();
    const bar = page.locator('[data-pin="kid"] .bar');
    const barBox = await bar.boundingBox();
    if (!before || !barBox) throw new Error('boxes missing');
    await page.mouse.move(barBox.x + 20, barBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(barBox.x + 120, barBox.y + 90, { steps: 6 });
    await page.mouse.up();
    const after = await kid.boundingBox();
    expect(after?.x).toBe(before.x);
    expect(after?.y).toBe(before.y);
  });
});

test.describe('live counters', () => {
  test('shows real totals when the stats endpoint answers, and no invented number otherwise', async ({
    page,
  }) => {
    // Without a configured endpoint the visitor card must disappear rather than show a guess.
    await page.goto('/');
    await expect(page.locator('[data-pin="counter"]')).toHaveCount(0);
    await expect(page.locator('#million-percent')).toHaveText(/^\d+\.\d{4} %$/);
  });
});

test.describe('growing contributors board', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop', 'desktop only');
  });

  /** Board top, its rendered height and the gap to the section below, all in design pixels. */
  async function geometry(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
      const stage = document.getElementById('stage') as HTMLElement;
      const top = (id: string) =>
        parseFloat((document.querySelector(`[data-pin="${id}"]`) as HTMLElement).style.top);
      const board = document.querySelector('[data-pin="board"]') as HTMLElement;
      return {
        stageHeight: parseFloat(stage.style.height),
        boardHeight: board.offsetHeight,
        gap: top('wall') - (top('board') + board.offsetHeight),
      };
    });
  }

  async function serveContributors(page: import('@playwright/test').Page, count: number) {
    const contributors = Array.from({ length: count }, (_, i) => ({
      name: `Person ${i + 1}`,
      amount: 100 - i * 5,
    }));
    await page.route('**/okrich-stats*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ raised: 460, visitors: 4711, contributors }),
      }),
    );
  }

  test('the stage grows with the list and every gap below it stays as designed', async ({
    page,
  }) => {
    await serveContributors(page, 0);
    await page.goto('/');
    const empty = await geometry(page);

    await serveContributors(page, 8);
    await page.goto('/');
    await expect(page.locator('.board-name')).toHaveCount(8);
    const filled = await geometry(page);

    const grown = filled.boardHeight - empty.boardHeight;
    expect(grown).toBeGreaterThan(0);
    // The stage takes on exactly the extra height the board needed ...
    expect(filled.stageHeight - empty.stageHeight).toBeCloseTo(grown, 0);
    // ... and the designed distance to the section below is untouched.
    expect(filled.gap).toBeCloseTo(empty.gap, 0);
  });
});

test.describe('Wall of Thumbs toggle', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop', 'desktop only');
  });

  /** Stage height and the gap between the wall window and the footer below it. */
  async function geometry(page: Page) {
    return page.evaluate(() => {
      const stage = document.getElementById('stage') as HTMLElement;
      const wall = document.querySelector('[data-pin="wall"]') as HTMLElement;
      const footer = document.querySelector('[data-pin="footer"]') as HTMLElement;
      return {
        stageHeight: parseFloat(stage.style.height),
        gap: parseFloat(footer.style.top) - (parseFloat(wall.style.top) + wall.offsetHeight),
      };
    });
  }

  test('expands every photo and gives the space back below it on collapse', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('#wall-toggle');
    const tiles = page.locator('#wall-grid .wall-tile');
    await expect(toggle).toHaveText('Show all photos (6)');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(tiles.locator('visible=true')).toHaveCount(2);
    const collapsed = await geometry(page);

    await toggle.click();
    await expect(toggle).toHaveText('Show fewer photos');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(tiles.locator('visible=true')).toHaveCount(6);
    const expanded = await geometry(page);
    expect(expanded.stageHeight).toBeGreaterThan(collapsed.stageHeight);
    // The footer moves down by exactly the height the wall gained, so the designed gap holds.
    expect(expanded.gap).toBeCloseTo(collapsed.gap, 0);

    await toggle.click();
    await expect(toggle).toHaveText('Show all photos (6)');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(tiles.locator('visible=true')).toHaveCount(2);
    const collapsedAgain = await geometry(page);
    expect(collapsedAgain).toEqual(collapsed);
  });
});

// The easter egg must open from its two doors, close cleanly, and never cost a console error.
test.describe('judge mode', () => {
  test('opens with the Konami code and closes with Escape', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'desktop only');
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page.locator('#judge-mode')).toHaveCount(0);
    for (const key of [
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
    ]) {
      await page.keyboard.press(key);
    }
    const dialog = page.getByRole('dialog', { name: /judge mode unlocked/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Tony, Dudu and Andrej');
    await expect(dialog).toContainText("I'd offer you a bribe, but all I have is a thumb.");
    await expect(dialog).toContainText("you'll get one for free");
    await expect(dialog.getByRole('link', { name: 'email' })).toHaveAttribute(
      'href',
      /^mailto:ok@ok-rich\.com\?subject=/,
    );
    await expect(dialog.getByRole('button', { name: 'Totally not a bribe' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#judge-mode')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('opens with seven quick taps on the headline', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile', 'mobile only');
    await page.goto('/');
    const title = page.locator('#site-title');
    for (let i = 0; i < 7; i++) await title.click();
    await expect(page.getByRole('dialog', { name: /judge mode unlocked/i })).toBeVisible();
    await page.getByRole('button', { name: 'Totally not a bribe' }).click();
    await expect(page.locator('#judge-mode')).toHaveCount(0);
  });

  test('leaves a note for people who read the source', async ({ request }) => {
    const html = await (await request.get('/')).text();
    expect(html).toContain('Hello, source reader.');
    expect(html).toContain('up up down down left right left right B A');
  });
});

test.describe('pay form', () => {
  test('collects the board name and posts it to the payment provider', async ({ page }) => {
    const res = await page.goto('/pay');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText('Make me rich');
    const form = page.locator('#payform');
    await expect(form).toHaveAttribute('action', PAY_URL);
    await expect(form).toHaveAttribute('method', 'get');
    await page.locator('#contributor-name').fill('  Ada   L.  ');
    await expect(page.locator('#meta-name')).toHaveValue('Ada L.');
    await expect(page.locator('input[name="redirect_url"]')).toHaveValue(/\/thanks$/);
  });

  // Sending the photo elsewhere is optional and must never stand between a buyer and paying.
  test('offers a delivery address without demanding one', async ({ page }) => {
    await page.goto('/pay');
    const gift = page.locator('.gift');
    await expect(gift, 'the field starts folded away').not.toHaveAttribute('open', /.*/);
    const input = page.locator('#deliver-to');
    await expect(input).toHaveAttribute('name', 'metadata_deliver_to');
    await expect(input).toHaveAttribute('type', 'email');
    await expect(input, 'it must not be required').not.toHaveAttribute('required', /.*/);
    await gift.locator('summary').click();
    await expect(input).toBeVisible();
  });

  // The Wall of Thumbs needs consent, and the only way to give it is this box. It must start
  // unticked, send nothing while unticked, and send exactly metadata_wall=yes when ticked.
  test('asks for Wall of Thumbs consent with an unticked box', async ({ page }) => {
    await page.goto('/pay');
    const box = page.locator('#wall-consent');
    await expect(box).toHaveAttribute('type', 'checkbox');
    await expect(box).toHaveAttribute('name', 'metadata_wall');
    await expect(box).toHaveAttribute('value', 'yes');
    await expect(box, 'consent is never pre-ticked').not.toBeChecked();
    await expect(box, 'it must not be required').not.toHaveAttribute('required', /.*/);

    const submitted = async () =>
      page.evaluate(() =>
        new URLSearchParams(
          new FormData(document.getElementById('payform') as HTMLFormElement) as never,
        ).toString(),
      );
    expect(await submitted()).not.toContain('metadata_wall');
    await page.locator('label[for="wall-consent"]').click();
    await expect(box).toBeChecked();
    expect(await submitted()).toContain('metadata_wall=yes');
    await expect(page.locator('body')).not.toContainText(/wall me/i);
  });

  // The amount is chosen inside Dodo's own checkout (Pay What You Want with a minimum),
  // so this page must not ask for it a second time.
  test('does not ask for an amount — Dodo does that', async ({ page }) => {
    await page.goto('/pay');
    await expect(page.locator('#contributor-amount')).toHaveCount(0);
    await expect(page.locator('[name="quantity"]')).toHaveCount(0);
  });
});

test.describe('thanks page', () => {
  test('offers copy link and an X share intent', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/thanks');
    await expect(page.locator('h1')).toContainText('Payment received');
    const share = page.locator('#share-x');
    await expect(share).toHaveAttribute('href', /^https:\/\/x\.com\/intent\/post\?/);
    await expect(share).toHaveAttribute('rel', /noopener/);
    await expect(page.locator('#copy-link')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    expect(errors).toEqual([]);
  });

  /**
   * Dodo returns the visitor here for every ending of a checkout, not only a paid one. Letting
   * the checkout window run out lands on this page exactly like a payment does, and the page then
   * claimed money that was never taken. These cases are the guard against that coming back.
   */
  for (const status of ['expired', 'cancelled', 'failed'] as const) {
    test(`says nothing was charged when the checkout came back as ${status}`, async ({ page }) => {
      await page.goto(`/thanks?status=${status}`);

      await expect(page.locator('h1')).toContainText('Nothing was charged');
      await expect(page.locator('#unpaid-block')).toBeVisible();
      await expect(page.locator('#paid-block')).toBeHidden();
      // Nothing a visitor can read may claim a payment happened. The paid block stays in the
      // document and is only hidden, so this has to check rendered text rather than textContent.
      await expect(page.locator('body')).not.toContainText('Payment received', {
        useInnerText: true,
      });
      await expect(page.locator('body')).not.toContainText('tiny bit richer', {
        useInnerText: true,
      });
      // Sharing a payment that never happened makes no sense.
      await expect(page.locator('#share-actions')).toBeHidden();
      // And there has to be a way onward.
      await expect(page.locator('#unpaid-block a[href="/pay"]')).toBeVisible();
    });
  }

  /**
   * `status` is whatever is in the query string. With the old object-literal lookup, a key that
   * exists on Object.prototype answered with a function instead of undefined, the fallback never
   * fired, and the page printed the literal word "undefined" where the sentence about the money
   * belongs. Found 2026-09-05. The four keys below are the ones a stranger would reach for.
   */
  for (const status of ['toString', 'constructor', '__proto__', 'hasOwnProperty'] as const) {
    test(`falls back to an honest sentence for ?status=${status}`, async ({ page }) => {
      await page.goto(`/thanks?status=${status}`);

      await expect(page.locator('h1')).toContainText('Nothing was charged');
      await expect(page.locator('#unpaid-lead')).toContainText('did not complete');
      await expect(page.locator('#unpaid-note')).toContainText('Nothing was charged');
      // The actual defect: no rendered text anywhere may read "undefined".
      await expect(page.locator('body')).not.toContainText('undefined', { useInnerText: true });
      await expect(page.locator('#paid-block')).toBeHidden();
    });
  }

  test('keeps a pending payment distinct from a failed one', async ({ page }) => {
    await page.goto('/thanks?status=pending');

    await expect(page.locator('h1')).toContainText('Still pending');
    await expect(page.locator('#unpaid-lead')).toContainText('still being processed');
    // It may still succeed, so it must not say the money was never taken.
    await expect(page.locator('#unpaid-note')).not.toContainText('Nothing was charged');
  });

  test('keeps the confirmation for a paid checkout and for a direct visit', async ({ page }) => {
    await page.goto('/thanks?status=succeeded');
    await expect(page.locator('h1')).toContainText('Payment received');
    await expect(page.locator('#unpaid-block')).toBeHidden();

    // No parameter at all: someone who really paid must not be told otherwise.
    await page.goto('/thanks');
    await expect(page.locator('h1')).toContainText('Payment received');
    await expect(page.locator('#paid-block')).toBeVisible();
  });
});

test.describe('mobile pinboard', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'mobile', 'mobile only');
  });

  /**
   * Owner brief for the phone: the stickers must not stand in one column, and they must be movable
   * by finger. Windows stay put: a full-width card has nowhere to go.
   */
  test('stickers share rows and move by finger, windows do not', async ({ page }) => {
    await page.goto('/');
    const boxes: { id: string; x: number; y: number; width: number; height: number }[] = [];
    for (const id of ['sample', 'sticky', 'garage', 'meme', 'kao-1', 'kao-2']) {
      const b = await page.locator(`[data-pin="${id}"]`).boundingBox();
      if (!b) throw new Error(`no box for ${id}`);
      boxes.push({ id, ...b });
    }
    const sharesRow = boxes.some((a) =>
      boxes.some((b) => a.id !== b.id && Math.abs(a.y - b.y) < 40 && Math.abs(a.x - b.x) > 60),
    );
    expect(sharesRow, 'at least two stickers sit side by side').toBe(true);

    const garage = page.locator('[data-pin="garage"]');
    await garage.scrollIntoViewIfNeeded();
    const g = await garage.boundingBox();
    if (!g) throw new Error('no box for garage');
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x + g.width / 2 + 70, g.y + g.height / 2 + 30, { steps: 8 });
    await page.mouse.up();
    const after = await garage.boundingBox();
    expect(after && after.x - g.x, 'the sticker followed the finger').toBeGreaterThan(50);
    await expect(garage).toHaveAttribute('style', /translate\(/);

    const win = page.locator('[data-pin="ideas"]');
    await win.scrollIntoViewIfNeeded();
    const w = await win.boundingBox();
    if (!w) throw new Error('no box for ideas');
    await page.mouse.move(w.x + 40, w.y + 20);
    await page.mouse.down();
    await page.mouse.move(w.x + 140, w.y + 80, { steps: 6 });
    await page.mouse.up();
    const w2 = await win.boundingBox();
    expect(w2 && Math.abs(w2.x - w.x), 'windows stay where they are').toBeLessThan(2);
  });

  /**
   * Found on the live site on 2026-09-03: with real names on the board, the two-column list ran
   * out of the window's right edge on every phone. The board renders one column on the phone now.
   * Names at the 40-character limit, amounts as wide as the formatter makes them.
   */
  test('top contributors stay inside their window with long names', async ({ page }) => {
    const contributors = Array.from({ length: 8 }, (_, i) => ({
      name: `Maximiliane-Alexandra von Hohenlohe ${i + 1}`.slice(0, 40),
      amount: 1000 - i * 100,
    }));
    await page.route('**/okrich-stats*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ raised: 4400, visitors: 4711, contributors }),
      }),
    );
    await page.goto('/');
    await expect(page.locator('.board-name')).toHaveCount(8);

    const win = await page.locator('[data-pin="board"]').boundingBox();
    if (!win) throw new Error('no box for board');
    const body = await page.locator('[data-pin="board"] .body.board').boundingBox();
    if (!body) throw new Error('no box for board body');
    expect(body.x + body.width, 'the body is no wider than its window').toBeLessThanOrEqual(
      win.x + win.width + 1,
    );

    const rows = page.locator('#board-list li');
    for (let i = 0; i < 8; i++) {
      const r = await rows.nth(i).boundingBox();
      if (!r) throw new Error(`no box for row ${i + 1}`);
      expect(r.x + r.width, `row ${i + 1} ends inside the window`).toBeLessThanOrEqual(
        win.x + win.width + 1,
      );
      expect(r.x, `row ${i + 1} starts inside the window`).toBeGreaterThanOrEqual(win.x - 1);
    }
    // One column on the phone: every row starts at the same x.
    const first = await rows.nth(0).boundingBox();
    const second = await rows.nth(1).boundingBox();
    expect(first && second && Math.abs(first.x - second.x), 'rows form one column').toBeLessThan(2);
  });
});
