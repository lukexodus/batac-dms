import type { DomainErrorCode } from '@batac/shared';

// We define TRPC_ERROR_CODE_KEY inline to avoid external dependency issues before tRPC is fully set up in the server.
export type TRPC_ERROR_CODE_KEY =
  | 'PARSE_ERROR'
  | 'BAD_REQUEST'
  | 'INTERNAL_SERVER_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_SUPPORTED'
  | 'TIMEOUT'
  | 'CONFLICT'
  | 'PRECONDITION_FAILED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNPROCESSABLE_CONTENT'
  | 'TOO_MANY_REQUESTS'
  | 'CLIENT_CLOSED_REQUEST';

export abstract class AppError extends Error {
  abstract readonly code: DomainErrorCode;
  abstract readonly httpStatus: number;
  abstract readonly trpcCode: TRPC_ERROR_CODE_KEY;
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    // Maintain correct prototype chain after TypeScript transpilation
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
