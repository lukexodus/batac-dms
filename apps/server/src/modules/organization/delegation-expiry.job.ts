import type PgBoss from 'pg-boss';
import type { DbClient } from './organization.types.js';
import type { EventBus } from '@batac/shared';
import type { AuditPublicAPI } from '../audit/index.js';
import { eq, and, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { delegationGrants, employees } from '@batac/database/schema/organization.schema.js';
import { randomUUID } from 'node:crypto';

export async function registerDelegationExpiryJob(deps: {
  boss: PgBoss;
  db: DbClient;
  eventBus: EventBus;
  auditService: AuditPublicAPI;
}): Promise<void> {
  const { boss, db, eventBus, auditService } = deps;

  await boss.work('delegation.expire', async ([job]) => {
    if (!job) return;
    const { delegationGrantId } = job.data as { delegationGrantId: string };

    await db.transaction(async (trx) => {
      // 1. Deactivate the row
      const result = await trx
        .update(delegationGrants)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(delegationGrants.id, delegationGrantId),
            eq(delegationGrants.isActive, true),
            isNull(delegationGrants.deletedAt),
          ),
        )
        .returning();

      if (result.length === 0) {
        // Already revoked or deleted — no-op; do not throw (idempotent)
        return;
      }

      const grant = result[0]!;
      const now = new Date();

      // 2. Resolve delegatingUserId and delegatedToUserId
      const delegatorEmp = alias(employees, 'delegator_emp');
      const delegateeEmp = alias(employees, 'delegatee_emp');

      const [empRow] = await trx
        .select({
          delegatingUserId: delegatorEmp.userId,
          delegatedToUserId: delegateeEmp.userId,
        })
        .from(delegatorEmp)
        .innerJoin(delegateeEmp, eq(delegateeEmp.id, grant.delegatedToEmployeeId))
        .where(eq(delegatorEmp.id, grant.delegatingEmployeeId))
        .limit(1);

      const delegatingUserId = empRow?.delegatingUserId ?? '';
      const delegatedToUserId = empRow?.delegatedToUserId ?? '';

      // 3. Emit delegation.expired domain event
      eventBus.emit('delegation.expired', {
        eventId: randomUUID(),
        eventType: 'delegation.expired',
        occurredAt: now.toISOString(),
        cityId: grant.cityId,
        schemaVersion: 1,
        payload: {
          delegationId: grant.id,
          delegatingUserId,
          delegatedToUserId,
          expiredAt: now.toISOString(),
        },
      });

    });
  });
}
