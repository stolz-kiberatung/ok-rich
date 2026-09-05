import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chipsHtml, resolveImage, shareUrl, validateEnv } from '../../vite.config';

const good = {
  VITE_DOMAIN: 'ok-rich.com',
  VITE_SITE_TITLE: 'OK RICH',
  VITE_PAY_URL: 'https://checkout.dodopayments.com/buy/pdt_test',
};

describe('validateEnv', () => {
  it('accepts a complete configuration', () => {
    expect(() => validateEnv(good)).not.toThrow();
  });

  it('names the missing required variable', () => {
    expect(() => validateEnv({ ...good, VITE_PAY_URL: '' })).toThrow(/VITE_PAY_URL/);
    expect(() => validateEnv({ ...good, VITE_DOMAIN: '  ' })).toThrow(/VITE_DOMAIN/);
    expect(() => validateEnv({ ...good, VITE_SITE_TITLE: undefined })).toThrow(/VITE_SITE_TITLE/);
  });

  it('rejects a non-https Stripe URL', () => {
    expect(() =>
      validateEnv({ ...good, VITE_PAY_URL: 'http://checkout.dodopayments.com/buy/pdt_test' }),
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
        env: { ...process.env, VITE_PAY_URL: 'http://insecure.example/x' },
        encoding: 'utf8',
        timeout: 60_000,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/VITE_PAY_URL must be an https/);
  }, 90_000);
});

/**
 * `add_header` inside an nginx location block discards every header inherited from the server
 * block. Repeating the set by hand is how /favicon.svg went live with no Content-Security-Policy
 * and no X-Frame-Options while / had both (found 2026-09-05 against the live site). The set now
 * lives in one snippet and every location includes it; this test is what keeps it that way, so
 * nobody has to remember the rule.
 */
describe('nginx security headers', () => {
  const SNIPPET = 'include /etc/nginx/conf.d/okrich-security-headers.inc;';
  const conf = readFileSync(resolve('nginx/default.conf.template'), 'utf8');
  const snippet = readFileSync(resolve('nginx/security-headers.conf.template'), 'utf8');

  it('has every header exactly once in the snippet', () => {
    for (const header of [
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Cross-Origin-Opener-Policy',
      'Cross-Origin-Resource-Policy',
    ]) {
      expect(snippet.match(new RegExp(`add_header ${header} `, 'g'))).toHaveLength(1);
    }
  });

  it('marks every header "always", so error responses carry them too', () => {
    for (const line of snippet.split('\n').filter((l) => l.trim().startsWith('add_header'))) {
      expect(line.trim()).toMatch(/ always;$/);
    }
  });

  /** Every `location ... { ... }` body, matched by brace depth rather than by indentation. */
  function locationBodies(text: string): string[] {
    const bodies: string[] = [];
    const opener = /location\s[^{]*\{/g;
    let match: RegExpExecArray | null;
    while ((match = opener.exec(text)) !== null) {
      let depth = 1;
      let i = match.index + match[0].length;
      const start = i;
      while (i < text.length && depth > 0) {
        if (text[i] === '{') depth += 1;
        else if (text[i] === '}') depth -= 1;
        i += 1;
      }
      bodies.push(text.slice(start, i));
    }
    return bodies;
  }

  it('includes the snippet in the server block and in every location', () => {
    const bodies = locationBodies(conf);
    // /assets/ + the image and text regex + / + = /404.html
    expect(bodies.length).toBeGreaterThanOrEqual(4);
    for (const body of bodies) {
      expect(body, `location without the header include:\n${body.slice(0, 160)}`).toContain(
        SNIPPET,
      );
    }
    // ...and the server block itself, for anything no location matches.
    expect(conf.slice(0, conf.indexOf('location /assets/'))).toContain(SNIPPET);
  });

  it('declares no add_header outside the snippet except Cache-Control', () => {
    for (const line of conf.split('\n').filter((l) => l.trim().startsWith('add_header'))) {
      expect(line, 'security headers belong in the snippet, not here').toContain('Cache-Control');
    }
  });
});
