/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_OTEL_RUM_CLIENT_TOKEN: string;
  readonly VITE_OTEL_RUM_SITE: string;
  readonly VITE_OTEL_RUM_ORGANIZATION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
