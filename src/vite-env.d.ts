/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the deployed sync Worker, e.g. https://baby-log-sync.you.workers.dev */
  readonly VITE_SYNC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
