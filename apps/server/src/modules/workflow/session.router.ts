import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc/trpc.js';
import {
  spSessions,
  sessionAttendances,
  orderOfBusiness,
  orderOfBusinessItems,
  stepInstances,
  steps,
  instances,
} from '@batac/database/schema/workflow.schema.js';
import {
  employees,
  assignments,
  offices,
  positions,
  committees,
  delegationGrants,
} from '@batac/database/schema/organization.schema.js';
import { documents } from '@batac/database/schema/documents.schema.js';
import { eq, and, or, ilike, inArray, isNull, sql, lte, gte, asc, ne } from 'drizzle-orm';
import type { Context } from '../iam/iam.types.js';
import { submitStepAction } from './engine/step-handlers/action.handler.js';
import { sanitizeRichText } from './rich-text.util.js';
import { workflowPolicy, type StepInstanceAttrs } from './workflow.policy.js';
import { WorkflowRepository } from './workflow.repository.js';

const dateRangeInput = z.object({
  from: z.coerce.date().nullish(),
  to: z.coerce.date().nullish(),
});

const RecordAttendanceOutputSchema = z.object({
  success: z.literal(true),
  presentCount: z.number().int().nonnegative(),
  absentCount: z.number().int().nonnegative(),
  quorumMet: z.boolean(),
});

function formatDate(date: Date): string {
  // Manila is UTC+8
  const offset = 8 * 60;
  const localTime = new Date(date.getTime() + offset * 60 * 1000);
  const y = localTime.getUTCFullYear();
  const m = String(localTime.getUTCMonth() + 1).padStart(2, '0');
  const d = String(localTime.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getNextTuesday(now: Date = new Date()): Date {
  const phtTime = new Date(now.getTime() + 8 * 3600 * 1000);
  let daysToTuesday = 2 - phtTime.getUTCDay();
  if (daysToTuesday < 0) daysToTuesday += 7;
  phtTime.setUTCDate(phtTime.getUTCDate() + daysToTuesday);
  phtTime.setUTCHours(0, 0, 0, 0);
  return new Date(phtTime.getTime() - 8 * 3600 * 1000);
}

function hasAnyRole(ctx: Context, allowedRoles: string[]): boolean {
  const roles = ctx.auth?.roles || [];
  const effRoles = ctx.auth?.effectiveRoles || [];
  return allowedRoles.some((r) => roles.includes(r) || effRoles.includes(r));
}

function enforceRoles(ctx: Context, allowedRoles: string[]) {
  if (!hasAnyRole(ctx, allowedRoles)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action.',
    });
  }
}

export function createSessionRouter() {
  return router({
    // Queries
    getAttendanceRecord: protectedProcedure
      .input(z.object({ sessionDate: z.coerce.date() }))
      .query(async ({ input, ctx }) => {
        enforceRoles(ctx, [
          'sp_secretary',
          'sp_member',
          'sp_presiding_officer',
          'mayor',
          'auditor',
        ]);

        const dateStr = formatDate(input.sessionDate);

        const vmPos = await ctx.db
          .select({ employeeId: assignments.employeeId })
          .from(positions)
          .innerJoin(assignments, eq(assignments.positionId, positions.id))
          .where(
            and(
              or(
                ilike(positions.title, '%Vice Mayor%'),
                ilike(positions.code, '%VM%'),
                ilike(positions.title, '%Presiding%'),
              ),
              isNull(positions.deletedAt),
              isNull(assignments.deletedAt),
              eq(assignments.isPrimary, true),
            ),
          )
          .limit(1);
        const vmEmployeeId = vmPos[0]?.employeeId || null;

        const [session] = await ctx.db
          .select()
          .from(spSessions)
          .where(
            and(
              eq(spSessions.sessionDate, dateStr),
              eq(spSessions.cityId, ctx.auth.cityId),
              isNull(spSessions.deletedAt),
            ),
          )
          .limit(1);

        if (!session) {
          return {
            sessionDate: input.sessionDate,
            presentCouncilors: [],
            absences: [],
            quorumMet: false,
            presidedByEmployeeId: null,
            presidedByDisplayName: null,
            vmEmployeeId,
          };
        }

        const attendances = await ctx.db
          .select({
            employeeId: sessionAttendances.employeeId,
            isPresent: sessionAttendances.isPresent,
            absenceReason: sessionAttendances.absenceReason,
            firstName: employees.firstName,
            lastName: employees.lastName,
          })
          .from(sessionAttendances)
          .innerJoin(employees, eq(sessionAttendances.employeeId, employees.id))
          .where(
            and(
              eq(sessionAttendances.spSessionId, session.id),
              isNull(sessionAttendances.deletedAt),
            ),
          );

        const presentCouncilors: Array<{ id: string; displayName: string }> = [];
        const absences: Array<{
          councilorEmployeeId: string;
          councilorDisplayName: string;
          reason: string;
        }> = [];

        const friendlyReason = (r: string | null) => {
          if (!r) return 'Absent';
          if (r === 'ob') return 'Official Business';
          if (r === 'sick_leave') return 'Sick Leave';
          if (r === 'vacation_leave') return 'Vacation Leave';
          if (r === 'absent') return 'Absent (Unqualified)';
          return r;
        };

        for (const att of attendances) {
          if (att.isPresent) {
            presentCouncilors.push({
              id: att.employeeId,
              displayName: `${att.firstName} ${att.lastName}`.trim(),
            });
          } else {
            absences.push({
              councilorEmployeeId: att.employeeId,
              councilorDisplayName: `${att.firstName} ${att.lastName}`.trim(),
              reason: friendlyReason(att.absenceReason),
            });
          }
        }

        let presidedByDisplayName: string | null = null;
        if (session.presidedByEmployeeId) {
          const [presidingEmp] = await ctx.db
            .select({
              firstName: employees.firstName,
              lastName: employees.lastName,
            })
            .from(employees)
            .where(eq(employees.id, session.presidedByEmployeeId))
            .limit(1);

          if (presidingEmp) {
            presidedByDisplayName = `${presidingEmp.firstName} ${presidingEmp.lastName}`.trim();
          }
        }

        return {
          sessionDate: input.sessionDate,
          presentCouncilors,
          absences,
          quorumMet: session.quorumAchieved ?? false,
          presidedByEmployeeId: session.presidedByEmployeeId,
          presidedByDisplayName,
          vmEmployeeId,
        };
      }),

    getAttendanceStatistics: protectedProcedure
      .input(dateRangeInput)
      .query(async ({ input, ctx }) => {
        enforceRoles(ctx, [
          'sp_secretary',
          'sp_member',
          'sp_presiding_officer',
          'mayor',
          'auditor',
        ]);

        const conditions = [eq(spSessions.cityId, ctx.auth.cityId), isNull(spSessions.deletedAt)];
        if (input.from) {
          conditions.push(gte(spSessions.sessionDate, formatDate(input.from)));
        }
        if (input.to) {
          conditions.push(lte(spSessions.sessionDate, formatDate(input.to)));
        }

        const rows = await ctx.db
          .select({
            sessionDate: spSessions.sessionDate,
            presentCount: spSessions.presentCount,
          })
          .from(spSessions)
          .where(and(...conditions))
          .orderBy(asc(spSessions.sessionDate));

        const series = await Promise.all(
          rows.map(async (r) => {
            const [year, month, day] = r.sessionDate.split('-').map(Number);
            const sessionDate = new Date(Date.UTC(year!, month! - 1, day!, 0, 0, 0));

            let presentCount: number | null = null;
            let absentCount: number | null = null;

            if (r.presentCount !== null) {
              presentCount = r.presentCount;

              const rosterAsOfDate = await ctx.db
                .select({ id: employees.id })
                .from(employees)
                .innerJoin(assignments, eq(assignments.employeeId, employees.id))
                .innerJoin(offices, eq(assignments.officeId, offices.id))
                .where(
                  and(
                    eq(offices.code, 'SP'),
                    eq(offices.cityId, ctx.auth.cityId),
                    eq(assignments.isActive, true),
                    isNull(employees.deletedAt),
                    isNull(assignments.deletedAt),
                    lte(assignments.startDate, r.sessionDate),
                    or(isNull(assignments.endDate), gte(assignments.endDate, r.sessionDate)),
                  ),
                );

              let rosterSize = rosterAsOfDate.length;
              if (rosterSize === 0) {
                const fallbackRoster = await ctx.db
                  .select({ id: employees.id })
                  .from(employees)
                  .where(
                    and(
                      ilike(employees.employeeNumber, 'SP-%'),
                      eq(employees.cityId, ctx.auth.cityId),
                      isNull(employees.deletedAt),
                    ),
                  );
                rosterSize = fallbackRoster.length;
              }

              absentCount = Math.max(0, rosterSize - presentCount);
            }

            return {
              sessionDate,
              presentCount,
              absentCount,
            };
          }),
        );

        return {
          series,
          printableSummaryUrl: null,
        };
      }),

    getEligibleSubstituteOfficers: protectedProcedure
      .input(z.object({ sessionDate: z.coerce.date() }))
      .query(async ({ input, ctx }) => {
        enforceRoles(ctx, ['sp_secretary']);

        const dateStr = formatDate(input.sessionDate);

        const vmPos = await ctx.db
          .select({ positionId: positions.id })
          .from(positions)
          .innerJoin(assignments, eq(assignments.positionId, positions.id))
          .where(
            and(
              or(
                ilike(positions.title, '%Vice Mayor%'),
                ilike(positions.code, '%VM%'),
                ilike(positions.title, '%Presiding%'),
              ),
              isNull(positions.deletedAt),
              isNull(assignments.deletedAt),
              eq(assignments.isPrimary, true),
            ),
          )
          .limit(1);

        const vmPositionId = vmPos[0]?.positionId;

        if (!vmPositionId) {
          return [];
        }

        const candidateMap = new Map<string, { id: string; displayName: string }>();

        const activeGrants = await ctx.db
          .select({
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
          })
          .from(delegationGrants)
          .innerJoin(employees, eq(delegationGrants.delegatedToEmployeeId, employees.id))
          .where(
            and(
              eq(delegationGrants.positionId, vmPositionId),
              eq(delegationGrants.isActive, true),
              lte(delegationGrants.startDate, dateStr),
              gte(delegationGrants.endDate, dateStr),
              isNull(delegationGrants.revokedAt),
              isNull(employees.deletedAt),
            ),
          );

        for (const emp of activeGrants) {
          if (!candidateMap.has(emp.id)) {
            candidateMap.set(emp.id, {
              id: emp.id,
              displayName: `${emp.firstName} ${emp.lastName}`.trim(),
            });
          }
        }

        const candidates = Array.from(candidateMap.values()).sort((a, b) =>
          a.displayName.localeCompare(b.displayName),
        );

        return candidates;
      }),

    getOrderOfBusiness: protectedProcedure
      .input(z.object({ sessionDate: z.coerce.date().optional() }))
      .query(async ({ input, ctx }) => {
        enforceRoles(ctx, [
          'sp_secretary',
          'sp_member',
          'sp_presiding_officer',
          'mayor',
          'auditor',
        ]);

        const targetDate = input.sessionDate ?? getNextTuesday();
        const dateStr = formatDate(targetDate);

        const [session] = await ctx.db
          .select({ id: spSessions.id })
          .from(spSessions)
          .where(
            and(
              eq(spSessions.sessionDate, dateStr),
              eq(spSessions.cityId, ctx.auth.cityId),
              isNull(spSessions.deletedAt),
            ),
          )
          .limit(1);

        if (!session) {
          return {
            sessionDate: targetDate,
            items: [],
          };
        }

        const [oob] = await ctx.db
          .select()
          .from(orderOfBusiness)
          .where(
            and(eq(orderOfBusiness.spSessionId, session.id), isNull(orderOfBusiness.deletedAt)),
          )
          .limit(1);

        if (!oob) {
          return {
            sessionDate: targetDate,
            items: [],
          };
        }

        const items = await ctx.db
          .select({
            documentId: orderOfBusinessItems.documentId,
            title: documents.title,
            preliminaryNumber: documents.preliminaryNumber,
            isRedFlagged: orderOfBusinessItems.isRedFlagged,
            stepType: steps.stepType,
            stepInstanceId: stepInstances.id,
            stepMetadata: stepInstances.metadata,
            workflowInstanceId: instances.id,
          })
          .from(orderOfBusinessItems)
          .innerJoin(documents, eq(orderOfBusinessItems.documentId, documents.id))
          .leftJoin(instances, eq(documents.workflowInstanceId, instances.id))
          .leftJoin(
            stepInstances,
            and(eq(instances.id, stepInstances.instanceId), eq(stepInstances.status, 'active')),
          )
          .leftJoin(steps, eq(stepInstances.stepId, steps.id))
          .where(
            and(
              eq(orderOfBusinessItems.orderOfBusinessId, oob.id),
              isNull(orderOfBusinessItems.deletedAt),
              isNull(documents.deletedAt),
              ne(documents.lifecycleState, 'cancelled'),
            ),
          )
          .orderBy(asc(orderOfBusinessItems.itemOrder));

        const allCommittees = await ctx.db
          .select({ id: committees.id, name: committees.name, code: committees.code })
          .from(committees)
          .where(and(eq(committees.cityId, ctx.auth.cityId), isNull(committees.deletedAt)));
        const committeeNameMap = new Map(allCommittees.map((c) => [c.id, c.name]));

        const resultItems = items.map((item) => {
          const isMultiReferral = item.stepType === 'multi_referral';
          const meta = (item.stepMetadata as Record<string, any>) || {};
          const assignedList =
            (meta['assigned_committees'] as Array<{ committee_id: string }>) || [];
          const submissions = (meta['submissions'] as Array<any>) || [];

          const assignedCommittees = assignedList
            .map((ac) => committeeNameMap.get(ac.committee_id))
            .filter((name): name is string => typeof name === 'string');

          let committeeReportStatus: 'not_applicable' | 'all_submitted' | 'red_flagged' =
            'not_applicable';
          if (isMultiReferral) {
            const allSubmitted =
              meta['all_submitted_at'] ||
              (submissions.length >= assignedList.length && assignedList.length > 0);
            if (allSubmitted) {
              committeeReportStatus = 'all_submitted';
            } else {
              const now = new Date();
              const cutoffDateTime = new Date(`${oob.cutoffDate}T23:59:59+08:00`);
              if (now > cutoffDateTime || item.isRedFlagged) {
                committeeReportStatus = 'red_flagged';
              } else {
                committeeReportStatus = 'not_applicable';
              }
            }
          }

          return {
            documentId: item.documentId,
            title: item.title,
            preliminaryNumber: item.preliminaryNumber,
            committeeReportStatus,
            assignedCommittees,
            stepInstanceId: item.stepInstanceId,
            workflowInstanceId: item.workflowInstanceId,
          };
        });

        return {
          sessionDate: targetDate,
          items: resultItems,
        };
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
            }),
          ),
          presidedByEmployeeIdOverride: z.string().uuid().nullish(),
        }),
      )
      .output(RecordAttendanceOutputSchema)
      .mutation(async ({ input, ctx }) => {
        enforceRoles(ctx, ['sp_secretary']);

        const { sessionDate, absences, presidedByEmployeeIdOverride } = input;
        const dateStr = formatDate(sessionDate);

        const absentCount = absences.length;

        return await ctx.db.transaction(async (tx) => {
          const spMembers = await tx
            .select({ id: employees.id })
            .from(employees)
            .innerJoin(assignments, eq(assignments.employeeId, employees.id))
            .innerJoin(offices, eq(assignments.officeId, offices.id))
            .where(
              and(
                eq(offices.code, 'SP'),
                eq(offices.cityId, ctx.auth.cityId),
                isNull(employees.deletedAt),
                isNull(assignments.deletedAt),
              ),
            );

          let councilorIds = spMembers.map((m) => m.id);
          if (councilorIds.length === 0) {
            const fallbackMembers = await tx
              .select({ id: employees.id })
              .from(employees)
              .where(
                and(
                  ilike(employees.employeeNumber, 'SP-%'),
                  eq(employees.cityId, ctx.auth.cityId),
                  isNull(employees.deletedAt),
                ),
              );
            councilorIds = fallbackMembers.map((m) => m.id);
          }

          const totalActiveSpMembers = councilorIds.length;

          // Defensive check for data-integrity edge case, not spec-mandated
          if (totalActiveSpMembers === 0) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'No active SP membership roster could be resolved; cannot compute quorum.',
            });
          }

          const presentCount = Math.max(0, totalActiveSpMembers - absentCount);
          const quorumMet = presentCount >= Math.ceil(totalActiveSpMembers / 2) + 1;

          let presidedByEmployeeId: string | null = null;

          const vmPos = await tx
            .select({ employeeId: assignments.employeeId, positionId: positions.id })
            .from(positions)
            .innerJoin(assignments, eq(assignments.positionId, positions.id))
            .where(
              and(
                or(
                  ilike(positions.title, '%Vice Mayor%'),
                  ilike(positions.code, '%VM%'),
                  ilike(positions.title, '%Presiding%'),
                ),
                isNull(positions.deletedAt),
                isNull(assignments.deletedAt),
                eq(assignments.isPrimary, true),
              ),
            )
            .limit(1);

          if (vmPos[0]) {
            const { employeeId: vmEmployeeId, positionId: vmPositionId } = vmPos[0];
            const isVmAbsent = absences.some((a) => a.councilorEmployeeId === vmEmployeeId);

            if (isVmAbsent) {
              if (presidedByEmployeeIdOverride) {
                const [overrideEmp] = await tx
                  .select({ id: employees.id })
                  .from(employees)
                  .where(
                    and(
                      eq(employees.id, presidedByEmployeeIdOverride),
                      eq(employees.cityId, ctx.auth.cityId),
                      isNull(employees.deletedAt),
                    ),
                  )
                  .limit(1);

                if (!overrideEmp) {
                  throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'The selected substitute presiding officer could not be found.',
                  });
                }

                const [activeGrant] = await tx
                  .select({ id: delegationGrants.id })
                  .from(delegationGrants)
                  .where(
                    and(
                      eq(delegationGrants.delegatedToEmployeeId, presidedByEmployeeIdOverride),
                      eq(delegationGrants.positionId, vmPositionId),
                      eq(delegationGrants.isActive, true),
                      lte(delegationGrants.startDate, dateStr),
                      gte(delegationGrants.endDate, dateStr),
                      isNull(delegationGrants.revokedAt),
                    ),
                  )
                  .limit(1);

                const isEligible = !!activeGrant;

                if (!isEligible) {
                  throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message:
                      'The selected substitute presiding officer is not eligible to preside.',
                  });
                }

                presidedByEmployeeId = presidedByEmployeeIdOverride;
              } else {
                const activeDesignation = await tx
                  .select({ delegatedToEmployeeId: delegationGrants.delegatedToEmployeeId })
                  .from(delegationGrants)
                  .where(
                    and(
                      eq(delegationGrants.positionId, vmPositionId),
                      eq(delegationGrants.isActive, true),
                      lte(delegationGrants.startDate, dateStr),
                      gte(delegationGrants.endDate, dateStr),
                      isNull(delegationGrants.revokedAt),
                    ),
                  )
                  .limit(1);

                if (activeDesignation[0]) {
                  presidedByEmployeeId = activeDesignation[0].delegatedToEmployeeId;
                } else {
                  presidedByEmployeeId = vmEmployeeId;
                }
              }
            } else {
              // The override is intentionally ignored in this branch.
              // It only applies when the regular presiding officer is absent.
              presidedByEmployeeId = vmEmployeeId;
            }
          }

          if (!presidedByEmployeeId) {
            const loggedInEmployee = await tx
              .select({ id: employees.id })
              .from(employees)
              .where(and(eq(employees.userId, ctx.auth.userId), isNull(employees.deletedAt)))
              .limit(1);

            if (loggedInEmployee[0]) {
              presidedByEmployeeId = loggedInEmployee[0].id;
            } else {
              const firstEmp = await tx.select({ id: employees.id }).from(employees).limit(1);
              if (firstEmp[0]) {
                presidedByEmployeeId = firstEmp[0].id;
              } else {
                presidedByEmployeeId = ctx.auth.userId;
              }
            }
          }

          const [existingSession] = await tx
            .select()
            .from(spSessions)
            .where(
              and(
                eq(spSessions.sessionDate, dateStr),
                eq(spSessions.cityId, ctx.auth.cityId),
                isNull(spSessions.deletedAt),
              ),
            )
            .limit(1);

          let sessionId: string;
          if (existingSession) {
            sessionId = existingSession.id;
            await tx
              .update(spSessions)
              .set({
                presentCount,
                quorumAchieved: quorumMet,
                presidedByEmployeeId,
                updatedAt: new Date(),
              })
              .where(eq(spSessions.id, sessionId));
          } else {
            const [numRow] = await tx
              .select({ maxNum: sql<number>`max(${spSessions.sessionNumber})` })
              .from(spSessions)
              .where(eq(spSessions.cityId, ctx.auth.cityId));
            const nextSessionNumber = (numRow?.maxNum || 0) + 1;

            const [newSession] = await tx
              .insert(spSessions)
              .values({
                cityId: ctx.auth.cityId,
                sessionNumber: nextSessionNumber,
                sessionDate: dateStr,
                sessionType: 'regular',
                presidedByEmployeeId,
                presentCount,
                quorumAchieved: quorumMet,
              })
              .returning();
            if (!newSession) throw new Error('Failed to create session');
            sessionId = newSession.id;
          }

          const absenceIds = absences.map((a) => a.councilorEmployeeId);
          const allTargetIds = Array.from(new Set([...councilorIds, ...absenceIds]));

          const reasonMap = {
            official_business: 'ob' as const,
            sick_leave: 'sick_leave' as const,
            vacation_leave: 'vacation_leave' as const,
            absent_unqualified: 'absent' as const,
          };

          for (const empId of allTargetIds) {
            const absence = absences.find((a) => a.councilorEmployeeId === empId);
            const isPresent = !absence;
            const absenceReason = absence ? reasonMap[absence.reason] : null;

            await tx
              .insert(sessionAttendances)
              .values({
                cityId: ctx.auth.cityId,
                spSessionId: sessionId,
                employeeId: empId,
                isPresent,
                absenceReason,
                recordedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [sessionAttendances.spSessionId, sessionAttendances.employeeId],
                set: {
                  isPresent,
                  absenceReason,
                  recordedAt: new Date(),
                },
              });
          }

          return { success: true as const, presentCount, absentCount, quorumMet };
        });
      }),

    scheduleDocumentForFirstReading: protectedProcedure
      .input(
        z.object({
          documentId: z.string().uuid(),
          sessionDate: z.coerce.date(),
          comment: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        enforceRoles(ctx, ['sp_secretary']);

        const { documentId, sessionDate } = input;

        const getPhtDayOfWeek = (d: Date) => {
          const pht = new Date(d.getTime() + 8 * 3600 * 1000);
          return pht.getUTCDay();
        };

        let targetTuesday = new Date(sessionDate);
        let dayOfWeek = getPhtDayOfWeek(targetTuesday);
        if (dayOfWeek !== 2) {
          let diff = 2 - dayOfWeek;
          if (diff < 0) diff += 7;
          const pht = new Date(targetTuesday.getTime() + 8 * 3600 * 1000);
          pht.setUTCDate(pht.getUTCDate() + diff);
          pht.setUTCHours(0, 0, 0, 0);
          targetTuesday = new Date(pht.getTime() - 8 * 3600 * 1000);
        }

        const getThursdayCutoff = (tues: Date) => {
          const pht = new Date(tues.getTime() + 8 * 3600 * 1000);
          pht.setUTCDate(pht.getUTCDate() - 5);
          pht.setUTCHours(23, 59, 59, 0);
          return new Date(pht.getTime() - 8 * 3600 * 1000);
        };

        const now = new Date();
        let cutoff = getThursdayCutoff(targetTuesday);
        if (now > cutoff) {
          const pht = new Date(targetTuesday.getTime() + 8 * 3600 * 1000);
          pht.setUTCDate(pht.getUTCDate() + 7);
          pht.setUTCHours(0, 0, 0, 0);
          targetTuesday = new Date(pht.getTime() - 8 * 3600 * 1000);
          cutoff = getThursdayCutoff(targetTuesday);
        }

        const dateStr = formatDate(targetTuesday);
        const cutoffStr = formatDate(cutoff);

        await ctx.db.transaction(async (tx) => {
          let presidedByEmployeeId: string | null = null;
          const vmPos = await tx
            .select({ employeeId: assignments.employeeId })
            .from(positions)
            .innerJoin(assignments, eq(assignments.positionId, positions.id))
            .where(
              and(
                or(
                  ilike(positions.title, '%Vice Mayor%'),
                  ilike(positions.code, '%VM%'),
                  ilike(positions.title, '%Presiding%'),
                ),
                isNull(positions.deletedAt),
                isNull(assignments.deletedAt),
                eq(assignments.isPrimary, true),
              ),
            )
            .limit(1);

          if (vmPos[0]) {
            presidedByEmployeeId = vmPos[0].employeeId;
          } else {
            const loggedInEmployee = await tx
              .select({ id: employees.id })
              .from(employees)
              .where(and(eq(employees.userId, ctx.auth.userId), isNull(employees.deletedAt)))
              .limit(1);
            if (loggedInEmployee[0]) {
              presidedByEmployeeId = loggedInEmployee[0].id;
            } else {
              const firstEmp = await tx.select({ id: employees.id }).from(employees).limit(1);
              if (firstEmp[0]) {
                presidedByEmployeeId = firstEmp[0].id;
              } else {
                presidedByEmployeeId = ctx.auth.userId;
              }
            }
          }

          let [session] = await tx
            .select()
            .from(spSessions)
            .where(
              and(
                eq(spSessions.sessionDate, dateStr),
                eq(spSessions.cityId, ctx.auth.cityId),
                isNull(spSessions.deletedAt),
              ),
            )
            .limit(1);

          let sessionId: string;
          if (session) {
            sessionId = session.id;
          } else {
            const [numRow] = await tx
              .select({ maxNum: sql<number>`max(${spSessions.sessionNumber})` })
              .from(spSessions)
              .where(eq(spSessions.cityId, ctx.auth.cityId));
            const nextSessionNumber = (numRow?.maxNum || 0) + 1;

            const [newSession] = await tx
              .insert(spSessions)
              .values({
                cityId: ctx.auth.cityId,
                sessionNumber: nextSessionNumber,
                sessionDate: dateStr,
                sessionType: 'regular',
                presidedByEmployeeId,
                presentCount: null,
                quorumAchieved: null,
              })
              .returning();
            if (!newSession) throw new Error('Failed to create session');
            sessionId = newSession.id;
          }

          let [oob] = await tx
            .select()
            .from(orderOfBusiness)
            .where(
              and(eq(orderOfBusiness.spSessionId, sessionId), isNull(orderOfBusiness.deletedAt)),
            )
            .limit(1);

          let oobId: string;
          if (oob) {
            oobId = oob.id;
          } else {
            const [newOob] = await tx
              .insert(orderOfBusiness)
              .values({
                cityId: ctx.auth.cityId,
                spSessionId: sessionId,
                cutoffDate: cutoffStr,
              })
              .returning();
            if (!newOob) throw new Error('Failed to create Order of Business');
            oobId = newOob.id;
          }

          const [existingItem] = await tx
            .select()
            .from(orderOfBusinessItems)
            .where(
              and(
                eq(orderOfBusinessItems.orderOfBusinessId, oobId),
                eq(orderOfBusinessItems.documentId, documentId),
                isNull(orderOfBusinessItems.deletedAt),
              ),
            )
            .limit(1);

          if (!existingItem) {
            const [orderRow] = await tx
              .select({ maxOrder: sql<number>`max(${orderOfBusinessItems.itemOrder})` })
              .from(orderOfBusinessItems)
              .where(eq(orderOfBusinessItems.orderOfBusinessId, oobId));
            const nextOrder = (orderRow?.maxOrder || 0) + 1;

            await tx.insert(orderOfBusinessItems).values({
              cityId: ctx.auth.cityId,
              orderOfBusinessId: oobId,
              documentId,
              itemOrder: nextOrder,
              itemType: 'first_reading',
              isRedFlagged: false,
            });
          }

          const [docRow] = await tx
            .select({ workflowInstanceId: documents.workflowInstanceId, createdBy: documents.createdBy })
            .from(documents)
            .where(eq(documents.id, documentId))
            .limit(1);

          if (docRow && docRow.workflowInstanceId) {
            const workflowInstanceId = docRow.workflowInstanceId;

            const [activeStepData] = await tx
              .select({
                stepInstance: stepInstances,
                step: steps,
                instance: instances
              })
              .from(stepInstances)
              .innerJoin(steps, eq(stepInstances.stepId, steps.id))
              .innerJoin(instances, eq(stepInstances.instanceId, instances.id))
              .where(
                and(
                  eq(instances.id, workflowInstanceId),
                  eq(steps.stepKey, 'order_of_business_scheduling'),
                  eq(stepInstances.status, 'active'),
                  isNull(stepInstances.deletedAt)
                )
              )
              .limit(1);

            if (!activeStepData) {
              console.warn(`[OoB Scheduling] Document ${documentId} with workflow instance ${workflowInstanceId} has no active 'order_of_business_scheduling' step instance to complete.`);
            } else {
              const { stepInstance, step, instance } = activeStepData;
              
              const assignedTo = (stepInstance.assignedTo || []) as Array<{ user_id?: string; office_id?: string }>;
              const metadata = (stepInstance.metadata || {}) as Record<string, any>;
              const assignedCommitteeIds = ((metadata['assigned_committees'] || []) as Array<{ committee_id: string }>).map((c) => c.committee_id);

              const stepAttrs: StepInstanceAttrs = {
                stepStatus: stepInstance.status as any,
                stepType: step.stepType as any,
                stepKey: step.stepKey,
                isFinalApprovalStep: (step.config as Record<string, any>)?.['is_final_approval'] === true,
                assigneeUserId: assignedTo[0]?.user_id || null,
                assigneeOfficeId: assignedTo[0]?.office_id || null,
                assignedCommitteeIds,
                instanceCreatedBy: instance.createdBy,
                documentCreatedBy: docRow.createdBy,
              };

              workflowPolicy.canCompleteActionStep(ctx.auth, stepAttrs);

              const server = (ctx.req as any).server;
              const deps = {
                db: tx,
                workflowRepository: new WorkflowRepository(tx),
                documentsService: server.documentsService,
                eventBus: server.eventBus,
                orgService: server.organizationService,
                delegationService: server.delegationService,
                iamService: server.iamService,
              };

              const sanitizedComment = input.comment ? sanitizeRichText(input.comment) : null;
              await submitStepAction(
                instance,
                stepInstance,
                ctx.auth.userId,
                sanitizedComment,
                deps as any,
                tx
              );
            }
          }
        });

        return { success: true as const };
      }),

    removeFromOrderOfBusiness: protectedProcedure
      .input(
        z.object({
          documentId: z.string().uuid(),
          sessionDate: z.coerce.date(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        enforceRoles(ctx, ['sp_secretary']);
        
        const { documentId, sessionDate } = input;
        const dateStr = formatDate(sessionDate);

        return await ctx.db.transaction(async (tx) => {
          const [session] = await tx
            .select({ id: spSessions.id })
            .from(spSessions)
            .where(
              and(
                eq(spSessions.sessionDate, dateStr),
                eq(spSessions.cityId, ctx.auth.cityId),
                isNull(spSessions.deletedAt)
              )
            )
            .limit(1);

          if (!session) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'No session found for the given date.',
            });
          }

          const [oob] = await tx
            .select({ id: orderOfBusiness.id })
            .from(orderOfBusiness)
            .where(
              and(
                eq(orderOfBusiness.spSessionId, session.id),
                isNull(orderOfBusiness.deletedAt)
              )
            )
            .limit(1);

          if (!oob) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'No Order of Business found for the given date.',
            });
          }

          const [oobItem] = await tx
            .select({ id: orderOfBusinessItems.id })
            .from(orderOfBusinessItems)
            .where(
              and(
                eq(orderOfBusinessItems.orderOfBusinessId, oob.id),
                eq(orderOfBusinessItems.documentId, documentId),
                isNull(orderOfBusinessItems.deletedAt)
              )
            )
            .limit(1);

          if (!oobItem) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'This document is not currently on the agenda for the given date.',
            });
          }

          await tx
            .update(orderOfBusinessItems)
            .set({ deletedAt: new Date(), deletedBy: ctx.auth.userId })
            .where(eq(orderOfBusinessItems.id, oobItem.id));
            
          return { success: true as const };
        });
      }),

    getScheduledReadingForDocument: protectedProcedure
      .input(z.object({ documentId: z.string().uuid() }))
      .output(
        z.object({
          documentId: z.string().uuid(),
          readingType: z
            .enum(['first_reading', 'second_reading', 'third_reading'])
            .nullable(),
          sessionDate: z.coerce.date().nullable(),
        }),
      )
      .query(async ({ input, ctx }) => {
        enforceRoles(ctx, [
          'sp_secretary',
          'sp_member',
          'sp_presiding_officer',
          'mayor',
          'auditor',
        ]);

        // session_date is stored as a text DATE (YYYY-MM-DD). Zero-padded ISO
        // dates sort lexicographically the same as chronologically, so gte/asc
        // on the text column are correct here.
        const todayStr = formatDate(new Date());

        const [row] = await ctx.db
          .select({
            itemType: orderOfBusinessItems.itemType,
            sessionDate: spSessions.sessionDate,
          })
          .from(orderOfBusinessItems)
          .innerJoin(
            orderOfBusiness,
            eq(orderOfBusinessItems.orderOfBusinessId, orderOfBusiness.id),
          )
          .innerJoin(spSessions, eq(orderOfBusiness.spSessionId, spSessions.id))
          .where(
            and(
              eq(orderOfBusinessItems.documentId, input.documentId),
              eq(orderOfBusinessItems.cityId, ctx.auth.cityId),
              inArray(orderOfBusinessItems.itemType, [
                'first_reading',
                'second_reading',
                'third_reading',
              ]),
              gte(spSessions.sessionDate, todayStr),
              isNull(orderOfBusinessItems.deletedAt),
              isNull(orderOfBusiness.deletedAt),
              isNull(spSessions.deletedAt),
            ),
          )
          .orderBy(asc(spSessions.sessionDate))
          .limit(1);

        if (!row) {
          return { documentId: input.documentId, readingType: null, sessionDate: null };
        }

        const [year, month, day] = row.sessionDate.split('-').map(Number);
        const sessionDate = new Date(Date.UTC(year!, month! - 1, day!, 0, 0, 0));

        return {
          documentId: input.documentId,
          readingType: row.itemType as 'first_reading' | 'second_reading' | 'third_reading',
          sessionDate,
        };
      }),

    enterCommitteeHearingDate: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          hearingDate: z.coerce.date().nullish(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        enforceRoles(ctx, ['sp_secretary']);

        const { stepInstanceId, hearingDate } = input;

        await ctx.db.transaction(async (tx) => {
          const [stepInstance] = await tx
            .select()
            .from(stepInstances)
            .where(and(eq(stepInstances.id, stepInstanceId), isNull(stepInstances.deletedAt)))
            .limit(1);

          if (!stepInstance) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Step instance not found.',
            });
          }

          const metadata = (stepInstance.metadata as Record<string, any>) || {};
          const isoDate = hearingDate ? hearingDate.toISOString() : null;
          metadata['hearing_date'] = isoDate;
          metadata['hearingDate'] = isoDate;

          await tx
            .update(stepInstances)
            .set({ metadata })
            .where(eq(stepInstances.id, stepInstanceId));
        });

        return { success: true as const };
      }),
  });
}

export const sessionRouter = createSessionRouter();
