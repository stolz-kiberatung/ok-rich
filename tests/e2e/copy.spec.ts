import { expect, test } from '@playwright/test';

/**
 * House style guard for user-facing copy.
 *
 * No em dashes in body text. They read as an AI tic and the owner asked for them to be gone.
 * Page titles are exempt: there the dash separates page name from site name, it is not punctuation
 * inside a sentence.
 *
 * Like the rhythm guard, this checks the rendered result rather than a rule in a document, so new
 * sections and new copy are covered without anyone remembering this file exists.
 */

const PAGES = ['/', '/pay', '/thanks', '/impressum', '/privacy', '/terms', '/404.html'];

for (const path of PAGES) {
  test(`no em dashes in the copy on ${path}`, async ({ page }) => {
    await page.goto(path);
    const hits = await page.evaluate(() => {
      const found: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node.textContent ?? '';
        if (!text.includes('—')) continue;
        const i = text.indexOf('—');
        found.push(text.slice(Math.max(0, i - 30), i + 30).trim());
      }
      return found;
    });
    expect(hits, `em dashes found on ${path}`).toEqual([]);
  });
}
