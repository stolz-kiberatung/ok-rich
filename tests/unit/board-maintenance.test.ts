import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The board maintenance branch: the owner's way to take an entry down.
 *
 * It lives in the payment workflow rather than an admin workflow of its own, because the board
 * state is in `$getWorkflowStaticData('global')`, which is per-workflow. It hangs off a manual
 * trigger, so the n8n login is the authentication and no new public endpoint exists.
 *
 * These tests execute the node's actual code against a stubbed n8n context. Reading the JSON
 * would only prove the code is present; running it proves the arithmetic is right — and the
 * arithmetic is the part that decides whether the number on the page stays honest after a refund.
 */

type Contributor = { name: string; amount: number };
type Store = { raised: number; contributors: Contributor[]; audit?: unknown[] };

function runFix(input: { name: string; mode?: string }, store: Store) {
  const wf = JSON.parse(readFileSync('n8n/okrich-payments.json', 'utf8'));
  const node = wf.nodes.find((n: { name: string }) => n.name === 'Fix the board');
  expect(node, 'the maintenance node must exist').toBeTruthy();

  const fn = new Function(
    '$input',
    '$getWorkflowStaticData',
    'console',
    `${node.parameters.jsCode}`,
  );
  const result = fn({ first: () => ({ json: input }) }, () => store, { log: () => {} }) as Array<{
    json: Record<string, unknown>;
  }>;
  const first = result[0];
  expect(first, 'the node must return a result').toBeTruthy();
  return first!.json;
}

const freshStore = (): Store => ({
  raised: 60,
  contributors: [
    { name: 'Ada L.', amount: 40 },
    { name: 'Rude Name', amount: 15 },
    { name: 'Bob', amount: 5 },
  ],
});

describe('board maintenance', () => {
  it('anonymises an entry and keeps the money counted', () => {
    const store = freshStore();
    const out = runFix({ name: 'Rude Name', mode: 'anonymise' }, store);

    expect(out.ok).toBe(true);
    expect(store.contributors.map((c) => c.name)).toEqual(['Ada L.', 'anonymous', 'Bob']);
    expect(store.raised, 'the payment stands, so the total must not move').toBe(60);
    expect(out.raisedDelta).toBe(0);
  });

  it('removes an entry and reduces the total, for a refund', () => {
    const store = freshStore();
    const out = runFix({ name: 'Rude Name', mode: 'remove' }, store);

    expect(out.ok).toBe(true);
    expect(store.contributors.map((c) => c.name)).toEqual(['Ada L.', 'Bob']);
    expect(store.raised, 'a refunded amount must leave the total').toBe(45);
    expect(out.raisedDelta).toBe(15);
  });

  it('matches the name case-insensitively', () => {
    const store = freshStore();
    const out = runFix({ name: 'rude NAME', mode: 'anonymise' }, store);
    expect(out.ok).toBe(true);
    expect(out.entriesAffected).toBe(1);
  });

  it('refuses an unknown name and shows what is actually on the board', () => {
    const store = freshStore();
    const out = runFix({ name: 'Nobody', mode: 'remove' }, store);
    expect(out.ok).toBe(false);
    expect(out.currentNames).toEqual(['Ada L.', 'Rude Name', 'Bob']);
    expect(store.raised, 'a failed lookup must change nothing').toBe(60);
    expect(store.contributors).toHaveLength(3);
  });

  it('refuses an empty name and an unknown mode', () => {
    const store = freshStore();
    expect(runFix({ name: '   ' }, store).ok).toBe(false);
    expect(runFix({ name: 'Bob', mode: 'delete-everything' }, store).ok).toBe(false);
    expect(store.contributors, 'nothing may change on a rejected call').toHaveLength(3);
  });

  it('never lets the total go negative', () => {
    const store: Store = { raised: 5, contributors: [{ name: 'Bob', amount: 500 }] };
    runFix({ name: 'Bob', mode: 'remove' }, store);
    expect(store.raised).toBe(0);
  });

  it('writes an audit entry', () => {
    const store = freshStore();
    runFix({ name: 'Bob', mode: 'remove' }, store);
    expect(store.audit).toHaveLength(1);
    expect((store.audit as Array<Record<string, unknown>>)[0]).toMatchObject({
      mode: 'remove',
      target: 'Bob',
      entries: 1,
    });
  });
});
