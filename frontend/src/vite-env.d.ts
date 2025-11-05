/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TEE_SERVER_URL: string
  readonly VITE_PRIVY_APP_ID: string
  readonly VITE_RPC_URL: string
  readonly VITE_CHAIN_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

