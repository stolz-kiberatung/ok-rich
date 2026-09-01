import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isBlockedName } from '../../src/moderation';

/**
 * The board-name check only matters server-side: the name arrives as a query parameter on a
 * static payment link, so anything running in the buyer's browser can be skipped. The effective
 * copy lives inside the n8n Code node, generated from `src/moderation` by
 * `scripts/sync-blocklist.mjs`.
 *
 * These tests guard the two ways that arrangement can rot:
 *   1. the workflow copy drifts from the source (someone edits one and forgets the other)
 *   2. the generated bundle is present but does not actually work
 *
 * The second is checked by executing the generated block, not by reading it.
 */

const BEGIN = '// ===== BEGIN GENERATED MODERATION (scripts/sync-blocklist.mjs) =====';
const END = '// ===== END GENERATED MODERATION =====';

function codeNode(): string {
  const wf = JSON.parse(readFileSync('n8n/okrich-payments.json', 'utf8'));
  const node = wf.nodes.find((n: { name: string }) => n.name === 'Verify, dedupe, count');
  expect(node, 'the payment code node must exist').toBeTruthy();
  return node.parameters.jsCode as string;
}

function generatedChecker(): (name: string) => boolean {
  const code = codeNode();
  const block = code.slice(code.indexOf(BEGIN) + BEGIN.length, code.indexOf(END));
  return new Function(`${block}\nreturn isBlockedName;`)() as (name: string) => boolean;
}

describe('the moderation that actually runs in n8n', () => {
  it('is present in the workflow', () => {
    const code = codeNode();
    expect(code).toContain(BEGIN);
    expect(code).toContain(END);
  });

  it('is applied, not merely bundled', () => {
    const code = codeNode();
    expect(code, 'the workflow must call the checker').toContain('isBlockedName(name)');
    expect(code, 'a blocked name must be filed as anonymous').toContain("? 'anonymous' : name");
    expect(code, 'the board must store the checked name').toContain('name: boardName');
  });

  it('behaves identically to the source module', () => {
    const generated = generatedChecker();
    const cases = [
      'Ada L.',
      'Tobias',
      'Scunthorpe',
      'Klaus Assmann',
      'anonymous',
      'hitler',
      'H1TL3R',
      'h i t l e r',
      '1488',
      'arschloch',
      '',
    ];
    for (const name of cases) {
      expect(generated(name), name).toBe(isBlockedName(name));
    }
  });

  it('blocks what it must and passes what it must', () => {
    const generated = generatedChecker();
    for (const ok of ['Ada L.', 'Tobias', 'Scunthorpe', 'Klaus Assmann']) {
      expect(generated(ok), ok).toBe(false);
    }
    for (const bad of ['hitler', 'H1TL3R', 'h i t l e r', '1488', 'arschloch']) {
      expect(generated(bad), bad).toBe(true);
    }
  });
});
