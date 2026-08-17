/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETS_BASE_URL: string;
  readonly VITE_NETS_API_KEY: string;
  readonly VITE_NETS_PROJECT_ID: string;
  readonly VITE_NETS_TXN_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Build id injected by Vite, used to version the service worker's cache. */
declare const __BUILD_ID__: string;
