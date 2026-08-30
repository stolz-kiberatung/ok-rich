import { expect, test, type Page } from '@playwright/test';
import { loadEnv } from 'vite';
import { STAGE } from '../../site.config';

const env = loadEnv('production', process.cwd(), 'VITE_');
const STRIPE_URL = env.VITE_STRIPE_PAYMENT_LINK_URL ?? '';
const DESIGN_WIDTH = STAGE.width;

type Errors = string[];

function collectErrors(page: Page): Errors {
  const errors: Errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
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
    const cta = page.locator('a.btn');
    await expect(cta).toHaveAttribute('href', STRIPE_URL);
    await expect(cta).toHaveAttribute('rel', /noopener/);
    expect(STRIPE_URL.startsWith('https://')).toBe(true);
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
    await dragByBar(page, 'wall', 40, 40);
    const zWall = await page
      .locator('[data-pin="wall"]')
      .evaluate((el) => Number((el as HTMLElement).style.zIndex));
    const zKid = await page
      .locator('[data-pin="kid"]')
      .evaluate((el) => Number((el as HTMLElement).style.zIndex));
    expect(zWall).toBeGreaterThan(zKid);
    // Fling the window far outside: at least 24 design px must remain visible.
    await dragByBar(page, 'wall', -3000, -3000);
    const pos = await position(page, 'wall');
    const size = await page.locator('[data-pin="wall"]').evaluate((el) => ({
      w: (el as HTMLElement).offsetWidth,
      h: (el as HTMLElement).offsetHeight,
    }));
    expect(pos.left).toBeCloseTo(STAGE.clampMargin - size.w, 0);
    expect(pos.top).toBeCloseTo(STAGE.clampMargin - size.h, 0);
  });

  test('a drag that ends over a link does not navigate; a plain click does', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('[data-pin="footer"] a', { hasText: 'Impressum' });
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

  test('the CTA is clickable without starting a drag', async ({ page }) => {
    await page.route('https://buy.stripe.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>stripe</title>' }),
    );
    await page.goto('/');
    await page.locator('a.btn').click();
    await expect(page).toHaveURL(STRIPE_URL);
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

  test('windows stack in DOM order, stickers are hidden, drag does nothing', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#stage')).not.toHaveClass(/is-board/);
    const order = [
      'headline',
      'cta',
      'trade-offer',
      'kid',
      'faq',
      'testimonials',
      'goal',
      'wall',
      'footer',
    ];
    let lastBottom = -1;
    for (const id of order) {
      const box = await page.locator(`[data-pin="${id}"]`).boundingBox();
      if (!box) throw new Error(`no box for ${id}`);
      expect(box.y, id).toBeGreaterThan(lastBottom);
      lastBottom = box.y + box.height;
    }
    await expect(page.locator('[data-pin="kao-1"]')).toBeHidden();
    await expect(page.locator('[data-pin="nametag"]')).toBeHidden();
    await expect(page.locator('[data-pin="sticky"]')).toBeVisible();
    await expect(page.locator('[data-pin="dad"]')).toBeVisible();
    await expect(page.locator('[data-pin="counter"]')).toBeVisible();

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
});
