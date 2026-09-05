import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

/**
 * The public stats endpoint, executed as the node really runs it.
 *
 * The behaviour under test is not the counting, it is the WRITING. n8n loads workflow static data
 * at the start of an execution and writes the whole object back at the end, so two overlapping
 * executions lose one of the two results. This branch answers every page view and shares its
 * static data with the payment branch, which holds the money. Before 2026-09-05 it reassigned
 * `store.seenIps` on every single request, so any visit that overlapped a payment could write the
 * pre-payment snapshot back over it.
 *
 * n8n notices a change by intercepting assignment on the static data object, so "did this request
 * write" is exactly "did it assign a top-level key". The proxy below records that, the same way
 * n8n's own `__dataChanged` flag does.
 */

type Store = Record<string, unknown>;

function runStats(store: Store, headers: Record<string, string>, env: Record<string, string>) {
  const wf = JSON.parse(readFileSync('n8n/okrich-payments.json', 'utf8'));
  const node = wf.nodes.find((n: { name: string }) => n.name === 'Count visit, read totals');
  expect(node, 'the stats node must exist').toBeTruthy();

  const assignments: string[] = [];
  const tracked = new Proxy(store, {
    set(target, key, value) {
      assignments.push(String(key));
      return Reflect.set(target, key, value);
    },
  });

  const fn = new Function(
    '$input',
    '$getWorkflowStaticData',
    '$env',
    'require',
    'console',
    node.parameters.jsCode,
  );
  const result = fn(
    { first: () => ({ json: { headers } }) },
    () => tracked,
    env,
    (m: string) => {
      if (m !== 'crypto') throw new Error(`unexpected require(${m})`);
      return { createHash };
    },
    { log: () => {} },
  ) as Array<{ json: Record<string, unknown> }>;

  return { json: result[0]!.json, assignments };
}

const SALT = { OKRICH_IP_SALT: 'a-salt-that-is-only-used-in-this-test' };
const from = (ip: string) => ({ 'x-forwarded-for': `203.0.113.9, ${ip}` });

/** The money half of the store, exactly as the payment branch leaves it. */
const money = () => ({
  raised: 50,
  sales: 5,
  contributors: [
    { name: 'Ada L.', amount: 30 },
    { name: 'Bob', amount: 20 },
  ],
});

describe('stats endpoint', () => {
  it('reports the totals the payment branch wrote', () => {
    const { json } = runStats({ ...money() }, from('198.51.100.4'), SALT);
    expect(json.raised).toBe(50);
    expect(json.sales).toBe(5);
    expect(json.visitors).toBe(1);
    expect(json.contributors).toHaveLength(2);
  });

  it('counts a new visitor once and a repeat visit not at all', () => {
    const store: Store = { ...money() };
    runStats(store, from('198.51.100.4'), SALT);
    runStats(store, from('198.51.100.4'), SALT);
    const { json } = runStats(store, from('198.51.100.7'), SALT);
    expect(json.visitors).toBe(2);
  });

  it('writes nothing at all for a repeat visitor, so it cannot overwrite a payment', () => {
    // This is the whole point of the test file. A pure read cannot lose a concurrent payment.
    const store: Store = { ...money() };
    runStats(store, from('198.51.100.4'), SALT); // first visit: allowed to write
    const second = runStats(store, from('198.51.100.4'), SALT);
    expect(second.assignments, 'a repeat visit must not touch static data').toEqual([]);
  });

  it('still prunes an expired hash, because /privacy promises twelve hours', () => {
    const thirteenHoursAgo = Date.now() - 13 * 60 * 60 * 1000;
    const store: Store = { ...money(), seenIps: [{ h: 'stale', t: thirteenHoursAgo }] };
    const { assignments } = runStats(store, from('198.51.100.4'), SALT);
    expect(assignments).toContain('seenIps');
    expect((store.seenIps as Array<{ h: string }>).some((e) => e.h === 'stale')).toBe(false);
  });

  it('never returns the address, only a salted hash, and never leaks the hash', () => {
    const store: Store = { ...money() };
    const { json } = runStats(store, from('198.51.100.4'), SALT);
    expect(JSON.stringify(json)).not.toContain('198.51.100.4');
    expect(Object.keys(json).sort()).toEqual(['contributors', 'raised', 'sales', 'visitors']);
  });

  it('takes the client address from the last X-Forwarded-For entry, the one Caddy appended', () => {
    const store: Store = { ...money() };
    // A visitor who sends their own X-Forwarded-For must not be able to look like someone else,
    // nor inflate the counter by forging the first entry.
    runStats(store, { 'x-forwarded-for': 'spoofed-a, 198.51.100.4' }, SALT);
    const { json } = runStats(store, { 'x-forwarded-for': 'spoofed-b, 198.51.100.4' }, SALT);
    expect(json.visitors, 'same real client, one visitor').toBe(1);
  });

  it('refuses to run without the salt rather than hashing with a known one', () => {
    expect(() => runStats({ ...money() }, from('198.51.100.4'), {})).toThrow(/OKRICH_IP_SALT/);
  });
});
