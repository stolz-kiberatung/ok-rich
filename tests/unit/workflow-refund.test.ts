import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The refund branch of the payment webhook.
 *
 * Refunds are automated rather than left to the manual maintenance branch, because a refund that
 * nobody remembers to mirror leaves a public number claiming money that went back. The arithmetic
 * is the whole point, and it is easy to get wrong in three specific ways:
 *
 *   1. The board merges entries by name. Someone who paid twice must keep their entry after one
 *      refund, reduced, not deleted.
 *   2. Dodo supports partial refunds, so "remove the payment" is not the same as "subtract the
 *      refunded amount".
 *   3. A redelivered refund webhook must not subtract twice.
 *
 * So these tests execute the node's real code against a stubbed n8n context and a real signature,
 * the same approach as board-maintenance.test.ts. Reading the JSON would only prove the branch
 * exists; running it proves the money adds up.
 */

const SECRET_KEY = Buffer.from('a-test-signing-key-32-bytes-long').toString('base64');
const SECRET = `whsec_${SECRET_KEY}`;

type Store = Record<string, unknown>;

function nodeCode(): string {
  const wf = JSON.parse(readFileSync('n8n/okrich-payments.json', 'utf8'));
  const node = wf.nodes.find((n: { name: string }) => n.name === 'Verify, dedupe, count');
  expect(node, 'the verification node must exist').toBeTruthy();
  return node.parameters.jsCode as string;
}

/** Feeds one signed event through the node, exactly as the webhook node would deliver it. */
function send(
  event: Record<string, unknown>,
  store: Store,
  opts: { webhookId?: string; secret?: string } = {},
): Record<string, unknown> | undefined {
  const body = JSON.stringify(event);
  const id = opts.webhookId ?? randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', Buffer.from(SECRET_KEY, 'base64'))
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');

  const item = {
    json: {
      headers: {
        'webhook-id': id,
        'webhook-timestamp': timestamp,
        'webhook-signature': `v1,${signature}`,
      },
    },
    binary: { data: { data: Buffer.from(body).toString('base64') } },
  };

  const fn = new Function(
    '$input',
    '$env',
    '$getWorkflowStaticData',
    'console',
    'require',
    nodeCode(),
  );
  const out = fn(
    { first: () => item },
    { DODO_WEBHOOK_SECRET: opts.secret ?? SECRET },
    () => store,
    { log: () => {} },
    (m: string) => {
      if (m !== 'crypto') throw new Error(`unexpected require(${m})`);
      return { createHmac, timingSafeEqual: (a: Buffer, b: Buffer) => a.equals(b) };
    },
  ) as Array<{ json: Record<string, unknown> }>;
  return out[0]?.json;
}

const payment = (paymentId: string, amount: number, displayName: string) => ({
  type: 'payment.succeeded',
  data: {
    payment_id: paymentId,
    total_amount: amount * 100,
    currency: 'EUR',
    customer: { email: 'buyer@example.com', name: 'Billing Name' },
    metadata: { display_name: displayName },
  },
});

const refund = (paymentId: string, amount: number | null, isPartial: boolean) => ({
  type: 'refund.succeeded',
  data: {
    refund_id: `ref_${paymentId}`,
    payment_id: paymentId,
    amount: amount === null ? null : amount * 100,
    currency: 'EUR',
    is_partial: isPartial,
  },
});

describe('payment webhook: refunds', () => {
  let store: Store;
  beforeEach(() => {
    store = {};
  });

  it('records a ledger entry for every payment, so a refund can find it', () => {
    send(payment('pay_1', 20, 'Ada L.'), store);

    expect(store.raised).toBe(20);
    expect(store.sales).toBe(1);
    expect(store.contributors).toEqual([{ name: 'Ada L.', amount: 20 }]);
    expect(store.payments).toEqual([
      expect.objectContaining({ paymentId: 'pay_1', boardName: 'Ada L.', amount: 20, refunded: 0 }),
    ]);
  });

  it('takes the entry off the board and the money off the total on a full refund', () => {
    send(payment('pay_1', 20, 'Ada L.'), store);
    const out = send(refund('pay_1', 20, false), store);

    expect(out?.kind).toBe('refund');
    expect(out?.matched).toBe(true);
    expect(out?.entryRemoved).toBe(true);
    expect(store.raised).toBe(0);
    expect(store.sales, 'a fully refunded payment stops being a sale').toBe(0);
    expect(store.contributors).toEqual([]);
  });

  it('reduces but keeps the entry on a partial refund', () => {
    send(payment('pay_1', 20, 'Ada L.'), store);
    const out = send(refund('pay_1', 5, true), store);

    expect(out?.amount).toBe(5);
    expect(out?.entryRemoved).toBe(false);
    expect(store.raised).toBe(15);
    expect(store.sales, 'part of it is still paid, so it is still a sale').toBe(1);
    expect(store.contributors).toEqual([{ name: 'Ada L.', amount: 15 }]);
  });

  it('keeps a twice-paying contributor on the board when only one payment is refunded', () => {
    send(payment('pay_1', 5, 'Ada L.'), store);
    send(payment('pay_2', 20, 'Ada L.'), store);
    expect(store.contributors, 'the board merges by name').toEqual([
      { name: 'Ada L.', amount: 25 },
    ]);

    const out = send(refund('pay_1', 5, false), store);

    expect(out?.entryRemoved, 'money is still standing under that name').toBe(false);
    expect(store.contributors).toEqual([{ name: 'Ada L.', amount: 20 }]);
    expect(store.raised).toBe(20);
    expect(store.sales, 'one of the two payments went back').toBe(1);
  });

  it('falls back to the outstanding amount when the event carries none', () => {
    send(payment('pay_1', 12.5, 'Ada L.'), store);
    const out = send(refund('pay_1', null, false), store);

    expect(out?.amount).toBe(12.5);
    expect(store.raised).toBe(0);
    expect(store.contributors).toEqual([]);
  });

  it('never takes back more than is outstanding, whatever the event claims', () => {
    send(payment('pay_1', 10, 'Ada L.'), store);
    const out = send(refund('pay_1', 999, false), store);

    expect(out?.amount, 'capped at what was actually paid').toBe(10);
    expect(store.raised).toBe(0);
  });

  it('ignores a second refund once nothing is outstanding', () => {
    send(payment('pay_1', 10, 'Ada L.'), store);
    send(refund('pay_1', 10, false), store);
    const again = send(refund('pay_1', 10, false), store);

    expect(again, 'a second full refund has nothing left to take').toBeUndefined();
    expect(store.raised).toBe(0);
  });

  it('ignores a redelivered refund webhook', () => {
    send(payment('pay_1', 20, 'Ada L.'), store);
    const wid = 'wh_same_id';
    send(refund('pay_1', 5, true), store, { webhookId: wid });
    const replay = send(refund('pay_1', 5, true), store, { webhookId: wid });

    expect(replay, 'the same webhook id must be processed once').toBeUndefined();
    expect(store.raised, 'and the money must move only once').toBe(15);
  });

  it('reports an unmatched refund instead of silently guessing at the board', () => {
    send(payment('pay_1', 20, 'Ada L.'), store);
    const out = send(refund('pay_unknown', 5, true), store);

    expect(out?.matched).toBe(false);
    expect(out?.name).toBe('');
    expect(store.contributors, 'no entry may be touched on a guess').toEqual([
      { name: 'Ada L.', amount: 20 },
    ]);
    expect(store.raised, 'the total still follows the money that went back').toBe(15);
  });

  it('leaves an anonymous contributor off the board arithmetic', () => {
    send(payment('pay_1', 20, 'anonymous'), store);
    expect(store.contributors ?? []).toEqual([]);

    const out = send(refund('pay_1', 20, false), store);

    expect(out?.matched).toBe(true);
    expect(store.raised).toBe(0);
    expect(store.contributors ?? []).toEqual([]);
  });

  it('writes every refund into the audit trail', () => {
    send(payment('pay_1', 20, 'Ada L.'), store);
    send(refund('pay_1', 5, true), store);

    expect(store.audit).toEqual([
      expect.objectContaining({ mode: 'refund', target: 'Ada L.', raisedDelta: -5 }),
    ]);
  });

  it('still refuses an unsigned refund', () => {
    send(payment('pay_1', 20, 'Ada L.'), store);
    const forged = send(refund('pay_1', 20, false), store, {
      secret: `whsec_${Buffer.from('a-different-key-of-32-bytes-len!').toString('base64')}`,
    });

    expect(forged, 'a wrong signing key must stop the event').toBeUndefined();
    expect(store.raised, 'and must not move the money').toBe(20);
  });
});
