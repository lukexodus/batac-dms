import { eq, and, isNull, or, gte, lte, sql } from 'drizzle-orm';
import type { AppDb, TxOrDb } from '../../db.js';
import type {
  WorkflowPublicAPI,
  WorkflowInstanceSummary,
  WorkflowSLAFilter,
  WorkflowSLAData,
  WorkflowStepType,
} from './index.js';
import { WorkflowRepository } from './workflow.repository.js';
import { SlaService } from './services/sla.service.js';
import { instances, steps, definitionVersions } from '@batac/database/schema/workflow.schema.js';
import { documents, documentTypes } from '@batac/database/schema/documents.schema.js';
import { autoCompleteActionStep } from './engine/step-handlers/action.handler.js';
import type { DocumentsPublicAPI } from '../documents/documents.types.js';
import type { OrgService, DelegationService } from '../organization/organization.types.js';
import type { IamPublicAPI } from '../iam/iam.types.js';
import type { EventBus } from '@batac/shared';

export interface WorkflowPublicAPIDeps {
  db: AppDb;
  documentsService: DocumentsPublicAPI;
  eventBus: EventBus;
  orgService: OrgService;
  delegationService: DelegationService;
  iamService: IamPublicAPI;
}

export function createWorkflowPublicAPI(deps: WorkflowPublicAPIDeps): WorkflowPublicAPI {
  const { db } = deps;
  const repository = new WorkflowRepository(db);
  const slaService = new SlaService();

  function mapStatus(
    status: 'active' | 'completed' | 'cancelled' | 'stuck' | 'suspended',
  ): 'Active' | 'Completed' | 'Cancelled' {
    switch (status) {
      case 'active':
      case 'stuck':
      case 'suspended':
        return 'Active';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
    }
  }

  return {
    async getInstanceById(instanceId: string): Promise<WorkflowInstanceSummary | null> {
      const instance = await repository.getInstanceById(instanceId);
      if (!instance) return null;

      const activeSteps = await repository.getActiveStepInstancesForInstance(instanceId);
      const versionData = await repository.getDefinitionVersionWithSteps(
        instance.definitionVersionId,
      );
      if (!versionData) return null;

      let currentStepType: WorkflowStepType = 'action';
      if (activeSteps.length > 0) {
        const stepDef = versionData.steps.find((s) => s.id === activeSteps[0]?.stepId);
        if (stepDef) currentStepType = stepDef.stepType as WorkflowStepType;
      }

      const context = (instance.context as Record<string, any>) || {};
      let lapseStatus: 'mayor_10_day_lapsed' | 'panlalawigan_30_day_deemed' | null = null;
      if (context['mayor_action'] === 'lapsed') lapseStatus = 'mayor_10_day_lapsed';
      if (context['panlalawigan_outcome'] === 'deemed_approved')
        lapseStatus = 'panlalawigan_30_day_deemed';

      return {
        instanceId: instance.id,
        documentId: instance.documentId,
        definitionId: versionData.version.definitionId,
        definitionVersionId: instance.definitionVersionId,
        currentStepType,
        currentStepInstanceId: activeSteps.length > 0 ? activeSteps[0]!.id : '',
        currentAssigneeUserId:
          activeSteps.length > 0
            ? (activeSteps[0]!.assignedTo as any[])?.[0]?.type === 'user'
              ? (activeSteps[0]!.assignedTo as any[])?.[0]?.id
              : null
            : null,
        status: mapStatus(instance.status),
        slaDeadline: instance.slaDeadline,
        lapseStatus,
        createdAt: instance.createdAt,
      };
    },

    async getActiveInstanceForDocument(
      documentId: string,
    ): Promise<WorkflowInstanceSummary | null> {
      const instance = await repository.getActiveInstanceForDocument(documentId);
      if (!instance) return null;
      return this.getInstanceById(instance.id);
    },

    async getWorkflowSLAData(filter: WorkflowSLAFilter): Promise<WorkflowSLAData[]> {
      const conditions = [isNull(instances.deletedAt)];

      if (filter.documentTypeId) {
        conditions.push(eq(documents.documentTypeId, filter.documentTypeId));
      }

      if (filter.officeId) {
        conditions.push(
          or(
            eq(documents.ownedByOfficeId, filter.officeId)!,
            eq(documents.originatingOfficeId, filter.officeId)!,
          )!,
        );
      }

      if (filter.from) {
        conditions.push(gte(instances.startedAt, filter.from));
      }

      if (filter.to) {
        conditions.push(lte(instances.startedAt, filter.to));
      }

      const rows = await db
        .select({
          instanceId: instances.id,
          documentId: instances.documentId,
          documentTypeId: documents.documentTypeId,
          status: instances.status,
          context: instances.context,
          slaDeadline: instances.slaDeadline,
          slaBreachedAt: instances.slaBreachedAt,
          startedAt: instances.startedAt,
          completedAt: instances.completedAt,
          documentTypeCode: documentTypes.code,
          currentAssigneeOfficeId: documents.ownedByOfficeId, // Approximate based on document's current office
        })
        .from(instances)
        .innerJoin(documents, eq(instances.documentId, documents.id))
        .innerJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
        .where(and(...conditions));

      const result: WorkflowSLAData[] = [];

      for (const row of rows) {
        const context = (row.context as Record<string, any>) || {};
        let slaClassification: 'simple' | 'complex' | 'highly_technical' = 'simple';
        let slaThresholdDays = 3;

        if (context['sla_classification']) {
          slaClassification = context['sla_classification'];
        } else if (
          row.documentTypeCode === 'SP_RESOLUTION' ||
          row.documentTypeCode === 'SP_ORDINANCE' ||
          row.documentTypeCode === 'SP_APPROPRIATION_ORDINANCE'
        ) {
          slaClassification = 'complex';
        }

        if (context['sla_threshold_days']) {
          slaThresholdDays = context['sla_threshold_days'];
        } else {
          if (slaClassification === 'simple') slaThresholdDays = 3;
          else if (slaClassification === 'complex') slaThresholdDays = 7;
          else if (slaClassification === 'highly_technical') slaThresholdDays = 20;
        }

        const endDate = row.completedAt || new Date();
        const elapsedWorkingDays = await slaService.elapsedWorkingDays(
          row.startedAt || new Date(),
          endDate,
        );

        const isBreached =
          !!row.slaBreachedAt ||
          (row.status === 'active' && !!row.slaDeadline && new Date() > row.slaDeadline);
        const breachedAt = row.slaBreachedAt || (isBreached ? row.slaDeadline : null);

        if (filter.breachedOnly && !isBreached) {
          continue;
        }

        result.push({
          instanceId: row.instanceId,
          documentId: row.documentId,
          documentTypeId: row.documentTypeId,
          slaClassification,
          slaThresholdDays,
          elapsedWorkingDays,
          isBreached,
          breachedAt,
          currentAssigneeOfficeId: row.currentAssigneeOfficeId,
        });
      }

      return result;
    },

    async getStepKeyById(stepId: string, tx?: TxOrDb): Promise<string | null> {
      const scopedRepository = tx ? new WorkflowRepository(tx) : repository;
      const step = await scopedRepository.getStepById(stepId, tx);
      return step?.stepKey ?? null;
    },

    async archiveStepForDocument(
      documentId: string,
      stepKey: string,
      tx?: TxOrDb,
    ): Promise<{ resolved: boolean }> {
      const scopedDb: AppDb | TxOrDb = tx ?? db;
      const scopedRepository = tx ? new WorkflowRepository(tx) : repository;

      const instance = await scopedRepository.getActiveInstanceForDocument(documentId, tx);
      if (!instance) return { resolved: false };

      const stepInstance = await scopedRepository.getActiveStepInstanceByStepKey(
        instance.id,
        stepKey,
        tx,
      );
      if (!stepInstance) return { resolved: false };

      await autoCompleteActionStep(
        instance,
        stepInstance,
        {
          db: scopedDb,
          workflowRepository: scopedRepository,
          documentsService: deps.documentsService,
          eventBus: deps.eventBus,
          orgService: deps.orgService,
          delegationService: deps.delegationService,
          iamService: deps.iamService,
        },
        tx,
      );

      return { resolved: true };
    },
  };
}
