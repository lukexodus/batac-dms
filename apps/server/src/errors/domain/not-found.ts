import { AppError } from '../AppError.js';

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND' as const;
  readonly httpStatus = 404;
  readonly trpcCode = 'NOT_FOUND' as const;

  constructor(resource: string, id?: string) {
    super(
      id
        ? `${resource} with id '${id}' was not found.`
        : `${resource} was not found.`,
      id ? { resource, id } : { resource },
    );
  }
}
