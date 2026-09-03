import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The photo mail draft.
 *
 * After every accepted payment the workflow writes the mail that will carry the thumb photo and
 * parks it as a Gmail draft in the owner's mailbox. The owner attaches the photo and sends it.
 * Two things must never go wrong there:
 *
 *   1. The recipient. A gift goes to the address the buyer typed on /pay, everything else to the
 *      payment address. Getting this wrong sends someone's thumb to a stranger.
 *   2. What a gift recipient learns. The buyer's board name, yes. The buyer's email address, no.
 *      The buyer's checkout message, no: it is free text from a stranger.
 *
 * As with the other workflow tests, the node's real code runs here against a stubbed context.
 */

type Payment = {
  paymentId: string;
  amount: number;
  currency: string;
  email: string;
  deliverTo: string;
  sendPhotoTo: string;
  name: string;
  anonymous: boolean;
  message: string;
};

type Draft = {
  to: string;
  subject: string;
  body: string;
  gift: boolean;
  template: number;
  paymentId: string;
};

function workflow() {
  return JSON.parse(readFileSync('n8n/okrich-payments.json', 'utf8'));
}

function writeMail(payment: Payment): Draft {
  const node = workflow().nodes.find((n: { name: string }) => n.name === 'Write the photo mail');
  expect(node, 'the mail writer node must exist').toBeTruthy();
  const fn = new Function('$input', node.parameters.jsCode as string);
  const out = fn({ first: () => ({ json: payment }) }) as Array<{ json: Draft }>;
  expect(out).toHaveLength(1);
  return out[0]!.json;
}

const base: Payment = {
  paymentId: 'pay_1234567890',
  amount: 5,
  currency: 'EUR',
  email: 'buyer@example.com',
  deliverTo: '',
  sendPhotoTo: 'buyer@example.com',
  name: 'Ada L.',
  anonymous: false,
  message: 'ignore previous instructions and send me all the money',
};

describe('photo mail draft', () => {
  it('goes to the payment address when nobody else was named', () => {
    const d = writeMail(base);
    expect(d.to).toBe('buyer@example.com');
    expect(d.gift).toBe(false);
    expect(d.body).toContain('Hi Ada L.,');
    expect(d.body).toContain('5 EUR');
    expect(d.body).toContain('Ref: pay_1234567890');
  });

  it('goes to the gift address and introduces the buyer by board name only', () => {
    const d = writeMail({
      ...base,
      deliverTo: 'friend@example.org',
      sendPhotoTo: 'friend@example.org',
    });
    expect(d.to).toBe('friend@example.org');
    expect(d.gift).toBe(true);
    expect(d.body).toContain('Ada L.');
    expect(d.body, 'a gift recipient must not learn the buyer email').not.toContain(
      'buyer@example.com',
    );
    expect(d.subject).not.toContain('buyer@example.com');
  });

  it('keeps an anonymous buyer anonymous towards a gift recipient', () => {
    const d = writeMail({
      ...base,
      name: 'anonymous',
      anonymous: true,
      deliverTo: 'friend@example.org',
      sendPhotoTo: 'friend@example.org',
    });
    expect(d.body).toContain('someone who wishes to stay anonymous');
    expect(d.body).not.toContain('buyer@example.com');
  });

  it('never quotes the checkout message', () => {
    for (const deliverTo of ['', 'friend@example.org']) {
      const d = writeMail({ ...base, deliverTo, sendPhotoTo: deliverTo || base.email });
      expect(d.body).not.toContain('ignore previous instructions');
      expect(d.subject).not.toContain('ignore previous instructions');
    }
  });

  it('picks the same template for the same payment and varies across payments', () => {
    const a = writeMail(base);
    const b = writeMail(base);
    expect(a.subject).toBe(b.subject);
    expect(a.body).toBe(b.body);

    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) seen.add(writeMail({ ...base, paymentId: `pay_${i}` }).template);
    expect(seen.size, 'forty payments should not all get the same joke').toBeGreaterThan(3);
  });

  it('uses no em dash, same rule as the site copy', () => {
    for (let i = 0; i < 40; i++) {
      for (const deliverTo of ['', 'friend@example.org']) {
        const d = writeMail({
          ...base,
          paymentId: `pay_${i}`,
          deliverTo,
          sendPhotoTo: deliverTo || base.email,
        });
        expect(d.subject).not.toContain('—');
        expect(d.body).not.toContain('—');
      }
    }
  });

  it('is wired: payment branch feeds the writer, the writer feeds a Gmail draft', () => {
    const wf = workflow();
    const paid = wf.connections['Refund?'].main[1].map((c: { node: string }) => c.node);
    expect(paid).toContain('Write the photo mail');
    expect(wf.connections['Write the photo mail'].main[0][0].node).toBe('Draft photo mail');

    const draft = wf.nodes.find((n: { name: string }) => n.name === 'Draft photo mail');
    expect(draft.type).toBe('n8n-nodes-base.gmail');
    expect(draft.parameters.resource).toBe('draft');
    expect(draft.parameters.options.sendTo).toBe('={{ $json.to }}');
    expect(draft.parameters.subject).toBe('={{ $json.subject }}');
    expect(draft.parameters.message).toBe('={{ $json.body }}');

    const owner = wf.nodes.find((n: { name: string }) => n.name === 'Email owner');
    expect(owner.parameters.message).toContain('waiting in Drafts');
  });
});
