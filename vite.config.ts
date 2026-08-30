import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

type Env = Record<string, string | undefined>;

const REQUIRED = ['VITE_DOMAIN', 'VITE_SITE_TITLE', 'VITE_STRIPE_PAYMENT_LINK_URL'] as const;

/** Fails the build loudly when a required variable is missing (constitution §8, §10). */
export function validateEnv(env: Env): void {
  for (const key of REQUIRED) {
    if (!env[key]?.trim()) {
      throw new Error(`[okrich] ${key} is empty. Copy .env.example to .env and fill it in.`);
    }
  }
  if (!env.VITE_STRIPE_PAYMENT_LINK_URL?.startsWith('https://')) {
    throw new Error('[okrich] VITE_STRIPE_PAYMENT_LINK_URL must be an https:// URL.');
  }
  const hasScript = Boolean(env.VITE_UMAMI_SCRIPT_URL?.trim());
  const hasId = Boolean(env.VITE_UMAMI_WEBSITE_ID?.trim());
  if (hasScript !== hasId) {
    throw new Error(
      '[okrich] VITE_UMAMI_SCRIPT_URL and VITE_UMAMI_WEBSITE_ID must be set together or both left empty.',
    );
  }
}

/** Real photo when the owner has dropped it into public/img, placeholder SVG otherwise. */
export function resolveImage(publicDir: string, file: string, placeholder: string): string {
  return existsSync(resolve(publicDir, 'img', file)) ? `/img/${file}` : `/img/${placeholder}`;
}

/** "5, 10, 50" + "EUR" → three text chips. */
export function chipsHtml(list: string, currency: string): string {
  const symbol = currency === 'EUR' ? '€' : currency;
  return list
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((amount) => `<span class="chip">${amount} ${symbol}</span>`)
    .join('');
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Replaces %%KEY%% placeholders and injects the shared head tags into every page. */
function headPlugin(env: Env, values: Record<string, string>): Plugin {
  const domain = env.VITE_DOMAIN ?? '';
  return {
    name: 'okrich-head',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const replaced = html.replace(/%%(\w+)%%/g, (_match, key: string) => {
          const value = values[key];
          if (value === undefined) throw new Error(`[okrich] Unknown HTML placeholder %%${key}%%`);
          return value;
        });
        const head: HtmlTagDescriptor[] = [
          { tag: 'link', attrs: { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' } },
          { tag: 'meta', attrs: { name: 'theme-color', content: '#f6f6f2' } },
          { tag: 'meta', attrs: { property: 'og:image', content: `https://${domain}/og.png` } },
          { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
          { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
          { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
        ];
        if (env.VITE_UMAMI_SCRIPT_URL && env.VITE_UMAMI_WEBSITE_ID) {
          head.push({
            tag: 'script',
            attrs: {
              defer: true,
              src: env.VITE_UMAMI_SCRIPT_URL,
              'data-website-id': env.VITE_UMAMI_WEBSITE_ID,
            },
          });
        }
        return { html: replaced, tags: head.map((t) => ({ ...t, injectTo: 'head' as const })) };
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const root = process.cwd();
  const env: Env = loadEnv(mode, root, 'VITE_');
  validateEnv(env);
  const publicDir = resolve(root, 'public');
  const values: Record<string, string> = {
    THUMB_SRC: resolveImage(publicDir, 'thumb.webp', 'thumb-placeholder.svg'),
    KID_SRC: resolveImage(publicDir, 'kid.webp', 'kid-placeholder.svg'),
    CHIPS: chipsHtml(env.VITE_SUGGESTED_AMOUNTS ?? '5, 10, 50', env.VITE_CURRENCY ?? 'EUR'),
    SITE_URL: `https://${env.VITE_DOMAIN}`,
    STRIPE_URL: escapeAttr(env.VITE_STRIPE_PAYMENT_LINK_URL ?? ''),
    WHY: env.VITE_WHY_PARAGRAPH ?? '',
  };

  return {
    plugins: [headPlugin(env, values)],
    build: {
      target: 'es2022',
      rollupOptions: {
        input: {
          index: resolve(root, 'index.html'),
          thanks: resolve(root, 'thanks/index.html'),
          impressum: resolve(root, 'impressum/index.html'),
          privacy: resolve(root, 'privacy/index.html'),
          terms: resolve(root, 'terms/index.html'),
          notFound: resolve(root, '404.html'),
        },
      },
    },
    test: {
      include: ['tests/unit/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/drag.ts', 'src/stage.ts'],
        thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  };
});
