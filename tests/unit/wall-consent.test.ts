import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Consent for the Wall of Thumbs.
 *
 * The only way to agree is the unticked-by-default checkbox on /pay, which travels to Dodo as
 * `metadata_wall=yes` and reaches the webhook as `metadata.wall`. An earlier version read "wall me"
 * out of a checkout message field that never existed, so nobody could actually consent.
 *
 * The test runs the real line from the Code node. Consent must be explicit: anything other than
 * the exact value the checkbox sends is a no, and free text can never switch it on.
 */

function wallLogic(metadata: Record<string, unknown>) {
  const wf = JSON.parse(readFileSync('n8n/okrich-payments.json', 'utf8'));
  const node = wf.nodes.find((n: { name: string }) => n.name === 'Verify, dedupe, count');
  const code: string = node.parameters.jsCode;

  const start = code.indexOf('const wallMe');
  expect(start, 'the consent line must exist in the node').toBeGreaterThan(-1);
  const line = code.slice(start, code.indexOf('\n', start));

  return new Function('metadata', `${line}\nreturn wallMe;`)(metadata) as boolean;
}

describe('Wall of Thumbs consent', () => {
  it('is given only by the ticked checkbox', () => {
    expect(wallLogic({ wall: 'yes' })).toBe(true);
    expect(wallLogic({ wall: ' YES ' })).toBe(true);
  });

  it('is not given when the box stays empty', () => {
    expect(wallLogic({})).toBe(false);
    expect(wallLogic({ wall: '' })).toBe(false);
  });

  it('is not given by anything else a URL could carry', () => {
    for (const value of ['no', 'on', 'true', '1', 'yes please', 'yess', ['yes'], { yes: 1 }]) {
      expect(wallLogic({ wall: value }), JSON.stringify(value)).toBe(false);
    }
  });

  it('can no longer be switched on by free text', () => {
    expect(wallLogic({ message: 'wall me' })).toBe(false);
    expect(wallLogic({ message: 'please WALL ME', wall: '' })).toBe(false);
  });
});
