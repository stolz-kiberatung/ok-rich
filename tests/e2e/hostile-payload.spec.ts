import { expect, test } from '@playwright/test';

/**
 * What happens if the stats endpoint lies.
 *
 * The board is filled from a public JSON document served by the owner's n8n. That endpoint is
 * outside this repository, so the page must stay intact even if it is spoofed, compromised, or
 * simply wrong. This test serves a deliberately hostile payload and asserts that nothing of it
 * becomes code, markup, or a crash.
 *
 * It is a regression guard for a specific decision: names go into the DOM through `textContent`
 * and are cleaned by `cleanName` at render time. If someone ever "improves" that into
 * `innerHTML`, this test is what catches it.
 */
test('a hostile stats payload cannot execute, inject or crash', async ({ page }) => {
  await page.route('**/okrich-stats*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        raised: 1,
        visitors: 1,
        contributors: [
          { name: '<img src=x onerror="window.__pwned=1">', amount: 99 },
          { name: '<script>window.__pwned=1</script>', amount: 98 },
          { name: 'javascript:alert(1)', amount: 97 },
          { name: 'A'.repeat(5000), amount: 96 },
          // Wrong types must be dropped, not coerced into something renderable.
          { name: { toString: () => 'object' }, amount: 95 },
          { name: 'ok', amount: 'not-a-number' },
        ],
      }),
    }),
  );

  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('/');
  await page.waitForTimeout(1200);

  const result = await page.evaluate(() => {
    const board = document.querySelector('[data-pin="board"]');
    return {
      pwned: Boolean((window as unknown as Record<string, unknown>).__pwned),
      injected: board ? board.querySelectorAll('script, img, iframe, object').length : -1,
      entries: board ? board.querySelectorAll('li').length : -1,
      longest: Math.max(
        0,
        ...[...(board?.querySelectorAll('.board-name') ?? [])].map(
          (el) => (el.textContent ?? '').length,
        ),
      ),
    };
  });

  expect(result.pwned, 'script from the payload must not run').toBe(false);
  expect(result.injected, 'no element from the payload may enter the DOM').toBe(0);
  expect(pageErrors, 'a bad payload must not throw').toEqual([]);
  // Two of the six entries are malformed and must be rejected rather than rendered.
  expect(result.entries).toBeLessThanOrEqual(4);
  expect(result.longest, 'names must stay within the designed length').toBeLessThanOrEqual(40);
});
