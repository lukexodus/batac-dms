import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc/trpc.js';

const dateRangeInput = z.object({
  from: z.coerce.date().nullish(),
  to: z.coerce.date().nullish(),
});

export function createSessionRouter() {
  return router({
    // Queries
    getAttendanceRecord: protectedProcedure
      .input(z.object({ sessionDate: z.coerce.date() }))
      .query(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'getAttendanceRecord is not implemented.',
        });
      }),

    getAttendanceStatistics: protectedProcedure
      .input(dateRangeInput)
      .query(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'getAttendanceStatistics is not implemented.',
        });
      }),

    getOrderOfBusiness: protectedProcedure
      .input(z.object({ sessionDate: z.coerce.date().optional() }))
      .query(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'getOrderOfBusiness is not implemented.',
        });
      }),

    // Mutations
    recordAttendance: protectedProcedure
      .input(
        z.object({
          sessionDate: z.coerce.date(),
          absences: z.array(
            z.object({
              councilorEmployeeId: z.string().uuid(),
              reason: z.enum([
                'official_business',
                'sick_leave',
                'vacation_leave',
                'absent_unqualified',
              ]),
            })
          ),
        })
      )
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'recordAttendance is not implemented.',
        });
      }),

    scheduleDocumentForFirstReading: protectedProcedure
      .input(
        z.object({
          documentId: z.string().uuid(),
          sessionDate: z.coerce.date(),
        })
      )
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'scheduleDocumentForFirstReading is not implemented.',
        });
      }),

    enterCommitteeHearingDate: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          hearingDate: z.coerce.date().nullish(),
        })
      )
      .mutation(async () => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'enterCommitteeHearingDate is not implemented.',
        });
      }),
  });
}

export const sessionRouter = createSessionRouter();
