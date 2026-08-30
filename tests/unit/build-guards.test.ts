import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chipsHtml, resolveImage, shareUrl, validateEnv } from '../../vite.config';

const good = {
  VITE_DOMAIN: 'ok-rich.com',
  VITE_SITE_TITLE: 'OK RICH',
  VITE_STRIPE_PAYMENT_LINK_URL: 'https://buy.stripe.com/test_x',
};

describe('validateEnv', () => {
  it('accepts a complete configuration', () => {
    expect(() => validateEnv(good)).not.toThrow();
  });

  it('names the missing required variable', () => {
    expect(() => validateEnv({ ...good, VITE_STRIPE_PAYMENT_LINK_URL: '' })).toThrow(
      /VITE_STRIPE_PAYMENT_LINK_URL/,
    );
    expect(() => validateEnv({ ...good, VITE_DOMAIN: '  ' })).toThrow(/VITE_DOMAIN/);
    expect(() => validateEnv({ ...good, VITE_SITE_TITLE: undefined })).toThrow(/VITE_SITE_TITLE/);
  });

  it('rejects a non-https Stripe URL', () => {
    expect(() =>
      validateEnv({ ...good, VITE_STRIPE_PAYMENT_LINK_URL: 'http://buy.stripe.com/x' }),
    ).toThrow(/https/);
  });

  it('requires the Umami pair to be set together', () => {
    expect(() => validateEnv({ ...good, VITE_UMAMI_SCRIPT_URL: 'https://u.example/s.js' })).toThrow(
      /together/,
    );
    expect(() => validateEnv({ ...good, VITE_UMAMI_WEBSITE_ID: 'abc' })).toThrow(/together/);
    expect(() =>
      validateEnv({
        ...good,
        VITE_UMAMI_SCRIPT_URL: 'https://u.example/s.js',
        VITE_UMAMI_WEBSITE_ID: 'abc',
      }),
    ).not.toThrow();
  });
});

describe('helpers', () => {
  it('falls back to the placeholder only when the photo is missing', () => {
    expect(
      resolveImage(process.cwd() + '/public', 'does-not-exist.webp', 'thumb-placeholder.svg'),
    ).toBe('/img/thumb-placeholder.svg');
    expect(resolveImage(process.cwd() + '/public', 'thumb-placeholder.svg', 'never.svg')).toBe(
      '/img/thumb-placeholder.svg',
    );
  });

  it('renders the amount line as plain text with the currency symbol', () => {
    expect(chipsHtml('5, 10, 50', 'EUR')).toBe('5 €, 10 € or 50 €');
    expect(chipsHtml('5', 'EUR')).toBe('5 €');
    expect(chipsHtml('', 'EUR')).toBe('');
  });

  it('builds an X intent URL with the site URL', () => {
    const url = new URL(shareUrl('https://ok-rich.com/'));
    expect(url.origin + url.pathname).toBe('https://x.com/intent/post');
    expect(url.searchParams.get('url')).toBe('https://ok-rich.com/');
    expect(url.searchParams.get('text')).toContain('thumbs-up');
  });
});

describe('vite build', () => {
  it('exits non-zero when the Stripe URL is invalid', () => {
    const result = spawnSync(
      process.execPath,
      [resolve('node_modules/vite/bin/vite.js'), 'build', '--outDir', 'test-results/guard-build'],
      {
        cwd: process.cwd(),
        env: { ...process.env, VITE_STRIPE_PAYMENT_LINK_URL: 'http://insecure.example/x' },
        encoding: 'utf8',
        timeout: 60_000,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/VITE_STRIPE_PAYMENT_LINK_URL must be an https/);
  }, 90_000);
});
