import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { env } from './config/env.js';

const headers: Record<string, string> = {};
if (env.OTEL_EXPORTER_OTLP_HEADERS) {
  const [key, value] = env.OTEL_EXPORTER_OTLP_HEADERS.split('=', 2);
  if (key && value) {
    headers[key.trim()] = value.trim();
  }
}

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
