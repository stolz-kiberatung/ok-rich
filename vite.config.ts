import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv, type Connect, type HtmlTagDescriptor, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

type Env = Record<string, string | undefined>;

/** Extension-less routes that resolve to <name>/index.html (see cleanUrls and nginx.conf). */
const PAGES = ['pay', 'thanks', 'impressum', 'privacy', 'terms'];

/** Bump when a file in public/img is replaced in place, so browser caches refetch it. */
const IMG_V = '?v=2';

const REQUIRED = ['VITE_DOMAIN', 'VITE_SITE_TITLE', 'VITE_PAY_URL'] as const;

/**
 * .env silently losing a key that .env.example documents costs an afternoon to notice, because
 * everything still builds and only a feature quietly disappears. Say it out loud at build time.
 */
export function missingEnvKeys(envFile: string, exampleFile: string): string[] {
  const keys = (s: string) => [...s.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1] as string);
  const have = new Set(keys(envFile));
  return keys(exampleFile).filter((k) => !have.has(k));
}

function warnMissingEnvKeys(root: string): void {
  try {
    const missing = missingEnvKeys(
      readFileSync(resolve(root, '.env'), 'utf8'),
      readFileSync(resolve(root, '.env.example'), 'utf8'),
    );
    if (missing.length) {
      console.warn(
        `[okrich] .env is missing keys that .env.example documents: ${missing.join(', ')}`,
      );
    }
  } catch {
    // no .env (CI passes values as env vars) — nothing to compare
  }
}

/** Fails the build loudly when a required variable is missing (constitution §8, §10). */
export function validateEnv(env: Env): void {
  for (const key of REQUIRED) {
    if (!env[key]?.trim()) {
      throw new Error(`[okrich] ${key} is empty. Copy .env.example to .env and fill it in.`);
    }
  }
  if (!env.VITE_PAY_URL?.startsWith('https://')) {
    throw new Error('[okrich] VITE_PAY_URL must be an https:// URL.');
  }
  if (env.VITE_STATS_URL?.trim() && !env.VITE_STATS_URL.startsWith('https://')) {
    throw new Error('[okrich] VITE_STATS_URL must be an https:// URL (or empty).');
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

export function currencySymbol(currency: string): string {
  return currency === 'EUR' ? '€' : currency;
}

/** "5, 10, 50" + "EUR" → "5 €, 10 € or 50 €" as plain text (nothing here is clickable). */
export function chipsHtml(list: string, currency: string): string {
  const symbol = currencySymbol(currency);
  const amounts = list
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((amount) => `${amount} ${symbol}`);
  if (amounts.length === 0) return '';
  if (amounts.length === 1) return amounts[0] as string;
  return `${amounts.slice(0, -1).join(', ')} or ${amounts[amounts.length - 1]}`;
}

const MILLION_GOAL_EUR = 1_000_000;

/** Millionaire fund: raised amount as a share of one million euros, 4 decimals. */
export function millionPercent(env: Env): string {
  const raised = Number(env.VITE_RAISED_EUR ?? '0') || 0;
  return ((raised / MILLION_GOAL_EUR) * 100).toFixed(4);
}

/** "12345" → "12,345 €" for the millionaire meter. */
export function formatEur(env: Env): string {
  const raised = Number(env.VITE_RAISED_EUR ?? '0') || 0;
  return raised.toLocaleString('en-US') + ' €';
}

/** Sports car fund: real percentage from the raised amount, shown with 4 decimals for comedy. */
export function goalPercent(env: Env): string {
  const raised = Number(env.VITE_RAISED_EUR ?? '0') || 0;
  const goal = Number(env.VITE_CAR_GOAL_EUR ?? '200000') || 200000;
  return ((raised / goal) * 100).toFixed(4);
}

/** Prepared text for the "Share on X" link on /thanks. Change the wording here. */
export const SHARE_TEXT = 'I paid a stranger for a thumbs-up. Best money I ever spent.';

export function shareUrl(siteUrl: string): string {
  const params = new URLSearchParams({ text: SHARE_TEXT, url: siteUrl });
  return `https://x.com/intent/post?${params.toString()}`;
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
      handler(html, ctx) {
        const replaced = html.replace(/%%(\w+)%%/g, (_match, key: string) => {
          const value = values[key];
          if (value === undefined) throw new Error(`[okrich] Unknown HTML placeholder %%${key}%%`);
          return value;
        });
        // ICON_VERSION: bump it whenever favicon.svg changes. nginx sends the icons with a 24 h
        // cache and browsers keep favicons far longer than that; without a new URL the owner kept
        // seeing the old tab icon a day after the logo mark went live (2026-09-03).
        const ICON_VERSION = 2;
        const head: HtmlTagDescriptor[] = [
          {
            tag: 'link',
            attrs: { rel: 'icon', href: `/favicon.svg?v=${ICON_VERSION}`, type: 'image/svg+xml' },
          },
          {
            tag: 'link',
            attrs: { rel: 'icon', href: `/favicon.png?v=${ICON_VERSION}`, sizes: '96x96' },
          },
          {
            tag: 'link',
            attrs: { rel: 'apple-touch-icon', href: `/apple-touch-icon.png?v=${ICON_VERSION}` },
          },
          { tag: 'meta', attrs: { name: 'theme-color', content: '#f6f6f2' } },
          { tag: 'meta', attrs: { property: 'og:image', content: `https://${domain}/og.png` } },
          { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
          { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
          { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
          // --- SEO / GEO, invisible on the page (2026-09-03) ---
          { tag: 'meta', attrs: { property: 'og:site_name', content: env.VITE_SITE_TITLE ?? '' } },
          { tag: 'meta', attrs: { property: 'og:locale', content: 'en_US' } },
          {
            tag: 'meta',
            attrs: {
              property: 'og:image:alt',
              content: 'OK RICH: a thumbs-up in front of a fan of banknotes',
            },
          },
          { tag: 'meta', attrs: { name: 'twitter:image', content: `https://${domain}/og.png` } },
        ];
        if (env.VITE_STATS_URL?.startsWith('https://')) {
          // The live counters fetch from the stats host on every visit; warming the connection
          // shaves the handshake off the first paint of real numbers.
          head.push({
            tag: 'link',
            attrs: {
              rel: 'preconnect',
              href: new URL(env.VITE_STATS_URL).origin,
              crossorigin: true,
            },
          });
        }
        // Structured data for the front page only: what the site is, who runs it, and the one
        // product with its pay-what-you-want floor. JSON-LD is a data block, not a script the
        // browser executes, so CSP's script-src does not apply to it.
        if (
          /(^|[\\/])index\.html$/.test(ctx.filename) &&
          !/[\\/](pay|thanks|terms|privacy|impressum)[\\/]/.test(ctx.filename)
        ) {
          const site = `https://${domain}`;
          const ld = {
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebSite',
                '@id': `${site}/#website`,
                url: `${site}/`,
                name: env.VITE_SITE_TITLE ?? 'OK RICH',
                inLanguage: 'en',
                publisher: { '@id': `${site}/#owner` },
              },
              {
                '@type': 'Person',
                '@id': `${site}/#owner`,
                name: 'Tobias Stolz',
                url: `${site}/impressum`,
              },
              {
                '@type': 'Product',
                '@id': `${site}/#thumb`,
                name: 'One personal thumbs-up photo',
                description:
                  "Exactly one photograph of the owner's thumb pointing up, taken for you and emailed within 7 days. Pay what you want, minimum 5 EUR.",
                image: `${site}/og.png`,
                brand: { '@id': `${site}/#owner` },
                offers: {
                  '@type': 'Offer',
                  url: `${site}/pay`,
                  priceCurrency: env.VITE_CURRENCY ?? 'EUR',
                  price: env.VITE_MIN_AMOUNT ?? '5',
                  priceSpecification: {
                    '@type': 'PriceSpecification',
                    minPrice: Number(env.VITE_MIN_AMOUNT ?? '5'),
                    priceCurrency: env.VITE_CURRENCY ?? 'EUR',
                  },
                  availability: 'https://schema.org/InStock',
                  itemCondition: 'https://schema.org/NewCondition',
                  deliveryLeadTime: { '@type': 'QuantitativeValue', maxValue: 7, unitCode: 'DAY' },
                },
              },
            ],
          };
          head.push({
            tag: 'script',
            attrs: { type: 'application/ld+json' },
            children: JSON.stringify(ld),
          });
        }
        if (env.VITE_UMAMI_SCRIPT_URL && env.VITE_UMAMI_WEBSITE_ID) {
          head.push({
            tag: 'script',
            attrs: {
              defer: true,
              src: env.VITE_UMAMI_SCRIPT_URL,
              'data-website-id': env.VITE_UMAMI_WEBSITE_ID,
              // The tracker posts to <host-url>/api/send. The existing instance is published
              // under a /s prefix, so the host URL is the script URL minus its file name.
              'data-host-url': env.VITE_UMAMI_SCRIPT_URL.replace(/\/script\.js$/, ''),
              // The site does not track its own pinboard testing: honour the browser's DNT.
              'data-do-not-track': 'true',
            },
          });
        }
        return { html: replaced, tags: head.map((t) => ({ ...t, injectTo: 'head' as const })) };
      },
    },
  };
}

/**
 * Clean URLs in dev and preview, mirroring the nginx config: /thanks → thanks/index.html,
 * unknown extension-less paths → 404.html with a real 404 status (preview only).
 */
function cleanUrls(pages: string[], outDir: string): Plugin {
  const isAsset = (path: string) =>
    path === '/' || /\.[a-z0-9]+$/i.test(path) || path.startsWith('/@') || path.startsWith('/src/');
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    if (isAsset(path)) return next();
    const name = path.replace(/^\/|\/$/g, '');
    if (pages.includes(name)) req.url = `/${name}/index.html`;
    next();
  };
  const notFound: Connect.NextHandleFunction = (req, res, next) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    if (isAsset(path) || pages.includes(path.replace(/^\/|\/$/g, ''))) return next();
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(readFileSync(resolve(outDir, '404.html')));
  };
  return {
    name: 'okrich-clean-urls',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
      server.middlewares.use(notFound);
    },
  };
}

export default defineConfig(({ mode }) => {
  const root = process.cwd();
  const env: Env = loadEnv(mode, root, 'VITE_');
  warnMissingEnvKeys(root);
  validateEnv(env);
  const publicDir = resolve(root, 'public');
  const values: Record<string, string> = {
    THUMB_SRC: resolveImage(publicDir, 'thumb.webp', 'thumb-placeholder.svg') + IMG_V,
    KID_SRC: resolveImage(publicDir, 'kid.webp', 'kid-placeholder.svg') + IMG_V,
    CHIPS: chipsHtml(env.VITE_SUGGESTED_AMOUNTS ?? '5, 10, 50', env.VITE_CURRENCY ?? 'EUR'),
    SITE_URL: `https://${env.VITE_DOMAIN}`,
    MIN: `${env.VITE_MIN_AMOUNT ?? '5'} ${currencySymbol(env.VITE_CURRENCY ?? 'EUR')}`,
    MIN_SHORT: `${currencySymbol(env.VITE_CURRENCY ?? 'EUR')}${env.VITE_MIN_AMOUNT ?? '5'}`,
    PAY_URL: escapeAttr(env.VITE_PAY_URL ?? ''),
    ONE: `1 ${currencySymbol(env.VITE_CURRENCY ?? 'EUR')}`,
    SHARE_URL: shareUrl(`https://${env.VITE_DOMAIN}/`),
    GOAL_PERCENT: goalPercent(env),
    MILLION_PERCENT: millionPercent(env),
    RAISED: formatEur(env),
  };

  return {
    // Multi-page site: no SPA fallback, unknown routes are real 404s in dev and preview.
    appType: 'mpa',
    plugins: [headPlugin(env, values), cleanUrls(PAGES, resolve(root, 'dist'))],
    build: {
      target: 'es2022',
      rollupOptions: {
        input: {
          index: resolve(root, 'index.html'),
          pay: resolve(root, 'pay/index.html'),
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
