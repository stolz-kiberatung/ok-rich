/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DOMAIN: string;
  readonly VITE_SITE_TITLE: string;
  readonly VITE_OWNER_NAME?: string;
  readonly VITE_CURRENCY?: string;
  readonly VITE_MIN_AMOUNT?: string;
  readonly VITE_SUGGESTED_AMOUNTS?: string;
  readonly VITE_STRIPE_PAYMENT_LINK_URL: string;
  readonly VITE_UMAMI_SCRIPT_URL?: string;
  readonly VITE_UMAMI_WEBSITE_ID?: string;
  readonly VITE_WHY_PARAGRAPH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
