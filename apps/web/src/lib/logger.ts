import { openobserveLogs as logs } from '@openobserve/browser-logs';

// Simple heuristic based redaction matching the intent of backend LOG_REDACT_PATHS
const REDACT_KEYWORDS = ['authorization', 'cookie', 'password', 'secret', 'token'];

function redactContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;

  const redacted = { ...context };
  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();
    if (REDACT_KEYWORDS.some((k) => lowerKey.includes(k))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactContext(redacted[key] as Record<string, unknown>);
    }
  }
  return redacted;
}

export const logger = {
  info: (event: string, context?: Record<string, unknown>) => {
    logs.logger.info(event, redactContext(context));
  },
  warn: (event: string, context?: Record<string, unknown>) => {
    logs.logger.warn(event, redactContext(context));
  },
  error: (event: string, context?: Record<string, unknown>) => {
    logs.logger.error(event, redactContext(context));
  },
};
