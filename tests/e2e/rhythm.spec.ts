import { expect, test } from '@playwright/test';

/**
 * Vertical rhythm guard.
 *
 * Why this test exists: three separate times a blanket margin reset with high specificity beat a
 * more meaningful rule and glued two elements together. The last one was
 * `.page .win .body p { margin: 0 0 12px }` (specificity 0,3,1) silently overriding
 * `.payment-note { margin-top: 12px }` (0,1,0), so the note stuck to the button with a 0 px gap.
 *
 * A prose rule in HANDOFF.md did not prevent it, because the rule named a *spelling* of the
 * selector and a slightly different spelling walked straight past it. This test checks the
 * *effect* instead: inside any window body, two consecutive flow elements must not touch.
 *
 * It applies to new sections and new features automatically — anything added to a window body
 * is measured without anyone having to remember this file exists.
 */

const MIN_GAP = 8;

/** Elements that carry the flow. Inner parts of a field (label, input, hint) are deliberately tight. */
const FLOW = ['P', 'H1', 'H2', 'H3', 'UL', 'OL', 'BUTTON', 'FORM', 'BLOCKQUOTE'];

const PAGES = ['/', '/pay', '/thanks', '/impressum', '/privacy', '/terms', '/404.html'];

for (const path of PAGES) {
  test(`vertical rhythm holds on ${path}`, async ({ page }) => {
    await page.goto(path);
    const offenders = await page.evaluate(
      ({ minGap, flow }) => {
        const bad: string[] = [];
        const containers = [...document.querySelectorAll('.win .body, .payform')];
        for (const box of containers) {
          const kids = [...box.children].filter((el) => {
            const r = el.getBoundingClientRect();
            return r.height > 0 && r.width > 0;
          });
          for (let i = 1; i < kids.length; i++) {
            const prev = kids[i - 1];
            const cur = kids[i];
            if (!prev || !cur) continue;
            // Only judge pairs where both sides take part in the text flow.
            const isFlow = (el: Element) =>
              flow.includes(el.tagName) || el.classList.contains('field');
            if (!isFlow(prev) || !isFlow(cur)) continue;
            const gap = cur.getBoundingClientRect().top - prev.getBoundingClientRect().bottom;
            if (gap < minGap) {
              const label = (t: Element) =>
                `${t.tagName}${t.className ? '.' + String(t.className).split(' ')[0] : ''}`;
              bad.push(
                `${label(prev)} -> ${label(cur)}: ${Math.round(gap)}px (min ${minGap}px) — "${(
                  cur.textContent || ''
                )
                  .trim()
                  .slice(0, 40)}"`,
              );
            }
          }
        }
        return bad;
      },
      { minGap: MIN_GAP, flow: FLOW },
    );

    expect(offenders, `elements touching on ${path}`).toEqual([]);
  });
}
