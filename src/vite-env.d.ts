/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly CLIO_API_KEY?: string
  readonly CLIO_CLIENT_ID?: string
  readonly CLIO_CLIENT_SECRET?: string
  readonly CLIO_BASE_URL?: string
  readonly CLIO_ACCESS_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
