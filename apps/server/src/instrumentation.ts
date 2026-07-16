// NOTE: This file's imports are deliberately minimal. Anything
// imported here that transitively pulls in this project's own
// application code (app.ts, fastify, pino, etc.) risks forcing
// that code to load and evaluate before sdk.start() below runs —
// which silently defeats FastifyInstrumentation/PinoInstrumentation,
// since by the time sdk.start() executes, the target modules are
// already cached and unpatched. This file should only ever import
// from @opentelemetry/* packages, Node built-ins, and genuinely
// leaf, dependency-free local files (like ./config/otlp-headers.js
// and ./config/env.js).
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { env } from './config/env.js';
import { parseOtlpHeaders } from './config/otlp-headers.js';

const headers = parseOtlpHeaders(env.OTEL_EXPORTER_OTLP_HEADERS);

// OTLPTraceExporter expects the full endpoint for traces.
// We append /v1/traces to the base endpoint as required by OpenObserve.
const traceExporter = new OTLPTraceExporter({
  url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
  headers,
});

const sdk = new NodeSDK({
  traceExporter,
  instrumentations: [
    new FastifyInstrumentation(),
    new PinoInstrumentation({
      // The instrumentation automatically injects trace_id and span_id into log records.
    }),
  ],
});

try {
  sdk.start();
  console.log('OpenTelemetry initialized.');
} catch (error) {
  console.error('Error initializing OpenTelemetry', error);
}
