import { z } from 'zod';
import { router, publicProcedure } from '../../trpc/trpc.js';

export const trackingRouter = router({
  getTrackingRecord: publicProcedure
    .input(z.unknown())
    .query(async () => {
      throw new Error('not implemented');
    }),
  printQrCoverSheet: publicProcedure
    .input(z.unknown())
    .query(async () => {
      throw new Error('not implemented');
    }),
  getRoutingHistory: publicProcedure
    .input(z.unknown())
    .query(async () => {
      throw new Error('not implemented');
    }),
  logRoutingEntry: publicProcedure
    .input(z.unknown())
    .mutation(async () => {
      throw new Error('not implemented');
    }),
  scanQrCodeAuthenticated: publicProcedure
    .input(z.unknown())
    .query(async () => {
      throw new Error('not implemented');
    }),
});
