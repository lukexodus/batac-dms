/**
 * Parses the OTEL_EXPORTER_OTLP_HEADERS env var into a headers object
 * for the OTLP exporters. Follows the standard OTel spec format:
 * comma-separated `key=value` pairs (e.g.
 * "Authorization=Basic xyz,X-Custom=abc").
 *
 * Deliberately isolated in its own dependency-free file: both
 * app.ts (for the Pino log-shipping transport) and instrumentation.ts
 * (for the trace exporter) need this function, and instrumentation.ts
 * must be importable without pulling in app.ts's own dependency tree
 * (fastify, pino, etc.) — see instrumentation.ts's own top-of-file
 * comment for why that ordering matters.
 */
export function parseOtlpHeaders(raw: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!raw) return headers;
  for (const pair of raw.split(',')) {
    const [key, ...rest] = pair.split('=');
    const value = rest.join('=');
    if (key && value) {
      headers[key.trim()] = value.trim();
    }
  }
  return headers;
}
