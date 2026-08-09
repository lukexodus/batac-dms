/// <reference types="vite/client" />

// Ambient stub for scribe.js-ocr — the full declaration lives in
// apps/server/src/modules/documents/scribe-ocr.types.d.ts.
// This stub is needed here because apps/web/src/lib/query-client.ts imports
// a type from the server (AppRouter), which causes tsc -b to traverse the
// server's source tree. Without this stub the web build fails with TS7016.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare module 'scribe.js-ocr';

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_OTEL_RUM_CLIENT_TOKEN: string;
  readonly VITE_OTEL_RUM_SITE: string;
  readonly VITE_OTEL_RUM_ORGANIZATION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
