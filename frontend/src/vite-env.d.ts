/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_REOWN_PROJECT_ID?: string
  readonly VITE_API_URL?: string
  readonly VITE_REGISTRY_ADDRESS?: string
  readonly VITE_MST_RPC_URL?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
