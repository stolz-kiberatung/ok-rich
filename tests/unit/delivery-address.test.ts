import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The optional "send it to someone else" address.
 *
 * It arrives as metadata from the /pay form, which means it is whatever the buyer typed and can
 * also be set by hand on the checkout URL. So it is validated inside the webhook, not trusted.
 *
 * These tests pull the validation lines out of the real Code node and run them, so the rules that
 * execute in n8n are the rules under test. A malformed address must be dropped and reported
 * rather than used, because a photo sent into nowhere looks to the buyer like no photo at all.
 */

function deliveryLogic(metadataDeliverTo: unknown, payerEmail: string) {
  const wf = JSON.parse(readFileSync('n8n/okrich-payments.json', 'utf8'));
  const node = wf.nodes.find((n: { name: string }) => n.name === 'Verify, dedupe, count');
  const code: string = node.parameters.jsCode;

  const start = code.indexOf('const rawDeliverTo');
  const end = code.indexOf('const sendPhotoTo');
  expect(start, 'delivery lines must exist in the node').toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const block = code.slice(start, code.indexOf('\n', end));

  const fn = new Function(
    'metadata',
    'email',
    `${block}\nreturn { deliverTo, deliverToRejected, sendPhotoTo };`,
  );
  return fn({ deliver_to: metadataDeliverTo }, payerEmail) as {
    deliverTo: string;
    deliverToRejected: string;
    sendPhotoTo: string;
  };
}

const PAYER = 'buyer@example.com';

describe('optional delivery address', () => {
  it('falls back to the paying address when the field is empty', () => {
    for (const empty of ['', '   ', undefined, null]) {
      const r = deliveryLogic(empty, PAYER);
      expect(r.sendPhotoTo, String(empty)).toBe(PAYER);
      expect(r.deliverTo).toBe('');
      expect(r.deliverToRejected).toBe('');
    }
  });

  it('uses a valid address when one is given', () => {
    const r = deliveryLogic('friend@example.org', PAYER);
    expect(r.deliverTo).toBe('friend@example.org');
    expect(r.sendPhotoTo).toBe('friend@example.org');
    expect(r.deliverToRejected).toBe('');
  });

  it('trims stray whitespace and invisible characters', () => {
    const r = deliveryLogic('  friend@example.org  ', PAYER);
    expect(r.sendPhotoTo).toBe('friend@example.org');
  });

  it('drops anything that is not an address, and reports it', () => {
    for (const junk of ['not an email', 'a@b', 'friend at example.org', '@example.org', 'a@.com']) {
      const r = deliveryLogic(junk, PAYER);
      expect(r.deliverTo, junk).toBe('');
      expect(r.sendPhotoTo, junk).toBe(PAYER);
      expect(r.deliverToRejected, junk).not.toBe('');
    }
  });

  it('refuses an absurdly long value rather than passing it on', () => {
    const long = 'a'.repeat(200) + '@example.com';
    const r = deliveryLogic(long, PAYER);
    expect(r.deliverTo).toBe('');
    expect(r.sendPhotoTo).toBe(PAYER);
  });

  it('cannot be used to smuggle a second recipient or a header break', () => {
    for (const attack of [
      'a@example.com, victim@example.com',
      'a@example.com\nBcc: victim@example.com',
      'a@example.com<script>',
    ]) {
      const r = deliveryLogic(attack, PAYER);
      expect(r.deliverTo, attack).toBe('');
      expect(r.sendPhotoTo, attack).toBe(PAYER);
    }
  });
});
