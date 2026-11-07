/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_API?: string;
  readonly VITE_ENABLE_QA_FIXTURES?: string;
  readonly VITE_CANONICAL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
