/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLIO_API_KEY: string
  readonly VITE_CLIO_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
