/// <reference types="vite/client" />

// Optional: strictly type the env vars you actually use
interface ImportMetaEnv {
  readonly VITE_REOWN_PROJECT_ID: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_BSC_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

