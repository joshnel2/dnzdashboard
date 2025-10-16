/// <reference types="vite/client" />

interface ImportMetaEnv {
  // No Clio env vars needed in frontend
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
