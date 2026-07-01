import { router } from '../../trpc/trpc.js';

/**
 * Factory to create the Documents tRPC router.
 * Returns an empty tRPC router object in the stub.
 */
export function createDocumentsRouter() {
  return router({});
}
