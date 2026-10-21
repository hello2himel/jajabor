/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROXY_URL?: string;
  readonly VITE_PROXY_SAME_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
