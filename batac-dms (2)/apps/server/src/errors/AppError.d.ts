import type { DomainErrorCode } from '@batac/shared';
export type TRPC_ERROR_CODE_KEY = 'PARSE_ERROR' | 'BAD_REQUEST' | 'INTERNAL_SERVER_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'METHOD_NOT_SUPPORTED' | 'TIMEOUT' | 'CONFLICT' | 'PRECONDITION_FAILED' | 'PAYLOAD_TOO_LARGE' | 'UNPROCESSABLE_CONTENT' | 'TOO_MANY_REQUESTS' | 'CLIENT_CLOSED_REQUEST';
export declare abstract class AppError extends Error {
    abstract readonly code: DomainErrorCode;
    abstract readonly httpStatus: number;
    abstract readonly trpcCode: TRPC_ERROR_CODE_KEY;
    readonly details?: Record<string, unknown>;
    constructor(message: string, details?: Record<string, unknown>);
}
//# sourceMappingURL=AppError.d.ts.map