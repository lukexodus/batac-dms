import type { FastifyInstance } from 'fastify';
import type { AssigneeSnapshot } from '../../workflow/engine/assignee-resolution.js';

// Event payloads according to EventPayloadMap
export interface WorkflowSlaWarningPayload {
  stepInstanceId: string;
  slaDeadline: string;
  percentElapsed: number;
}

export interface WorkflowSlaBreachedPayload {
  stepInstanceId: string;
  slaDeadline: string;
  breachDetectedAt: string;
  breachedAt: string;
}

export interface WorkflowSlaCriticalPayload {
  stepInstanceId: string;
  slaDeadline: string;
}

export function registerSlaEscalationConsumer(fastify: FastifyInstance) {
  // --- 1. WARNING: Sent to Assignee ---
  fastify.eventBus.on(
    'workflow.sla.warning',
    (event) => {
      const run = async () => {
        const payload = event.payload as WorkflowSlaWarningPayload;
        const stepSummary = await fastify.workflowService.getStepInstanceSummary(payload.stepInstanceId);
        if (!stepSummary || !stepSummary.assignedTo) return;

        const assignees: AssigneeSnapshot[] = Array.isArray(stepSummary.assignedTo) ? stepSummary.assignedTo : [stepSummary.assignedTo];

        const instanceSummary = await fastify.workflowService.getInstanceById(stepSummary.instanceId);
        if (!instanceSummary) return;

        const document = await fastify.documentsService.getDocumentById(instanceSummary.documentId);
        if (!document) return;

        for (const assignee of assignees) {
          if (!assignee.user_id) continue;

          await fastify.notificationsService.sendNotification({
            recipientUserId: assignee.user_id,
            templateId: 'notif.workflow.sla_warning.in_app',
            channel: 'in_app',
            templateData: {
              instanceId: stepSummary.instanceId,
              stepInstanceId: payload.stepInstanceId,
              slaDeadline: payload.slaDeadline,
              percentElapsed: payload.percentElapsed.toString(),
              documentId: instanceSummary.documentId,
              documentTitle: document.title,
              documentSeriesNumber: document.finalNumber || document.preliminaryNumber || '',
            },
          });
        }
      };

      run().catch((err) => {
        const payload = event.payload as WorkflowSlaWarningPayload;
        fastify.log.error(
          { err, eventId: event.eventId, stepInstanceId: payload.stepInstanceId },
          'notifications: sla-warning consumer failed',
        );
      });
    },
    'notifications',
  );

  // --- 2. BREACHED: Sent to Supervisor + Records Officer ---
  fastify.eventBus.on(
    'workflow.sla.breached',
    (event) => {
      const run = async () => {
        const payload = event.payload as WorkflowSlaBreachedPayload;
        const stepSummary = await fastify.workflowService.getStepInstanceSummary(payload.stepInstanceId);
        if (!stepSummary || !stepSummary.assignedTo) return;

        const instanceSummary = await fastify.workflowService.getInstanceById(stepSummary.instanceId);
        if (!instanceSummary) return;

        const document = await fastify.documentsService.getDocumentById(instanceSummary.documentId);
        if (!document) return;

        const escalationConfig = await fastify.workflowService.getEscalationConfigForInstance(stepSummary.instanceId);
        if (!escalationConfig) return;

        const assignees: AssigneeSnapshot[] = Array.isArray(stepSummary.assignedTo) ? stepSummary.assignedTo : [stepSummary.assignedTo];

        const notifiedUserIds = new Set<string>();

        for (const assignee of assignees) {
          if (!assignee.user_id) continue;

          // Find the assignee's office
          const officeData = await fastify.organizationService.getPrimaryOfficeForUser(assignee.user_id);
          if (!officeData) continue;

          // Resolve supervisors
          const supervisors = await fastify.organizationService.listEmployeesByRoleAndOffice(
            escalationConfig.supervisor_role,
            officeData.officeId
          );

          // Resolve records officers
          const recordsOfficers = await fastify.organizationService.listEmployeesByRoleAndOffice(
            escalationConfig.records_officer_role,
            officeData.officeId
          );

          const targets = [...supervisors, ...recordsOfficers];

          for (const target of targets) {
            if (!target.userId || notifiedUserIds.has(target.userId)) continue;
            notifiedUserIds.add(target.userId);

            await fastify.notificationsService.sendNotification({
              recipientUserId: target.userId,
              templateId: 'notif.workflow.sla_breach.in_app',
              channel: 'in_app',
              templateData: {
                instanceId: stepSummary.instanceId,
                stepInstanceId: payload.stepInstanceId,
                slaDeadline: payload.slaDeadline,
                breachDetectedAt: payload.breachDetectedAt,
                breachedAt: payload.breachedAt,
                documentId: instanceSummary.documentId,
                documentTitle: document.title,
                documentSeriesNumber: document.finalNumber || document.preliminaryNumber || '',
              },
            });
          }
        }
      };

      run().catch((err) => {
        const payload = event.payload as WorkflowSlaBreachedPayload;
        fastify.log.error(
          { err, eventId: event.eventId, stepInstanceId: payload.stepInstanceId },
          'notifications: sla-breached consumer failed',
        );
      });
    },
    'notifications',
  );

  // --- 3. CRITICAL: Sent to Supervisor + Records Officer + Department Head ---
  fastify.eventBus.on(
    'workflow.sla.critical',
    (event) => {
      const run = async () => {
        const payload = event.payload as WorkflowSlaCriticalPayload;
        const stepSummary = await fastify.workflowService.getStepInstanceSummary(payload.stepInstanceId);
        if (!stepSummary || !stepSummary.assignedTo) return;

        const instanceSummary = await fastify.workflowService.getInstanceById(stepSummary.instanceId);
        if (!instanceSummary) return;

        const document = await fastify.documentsService.getDocumentById(instanceSummary.documentId);
        if (!document) return;

        const escalationConfig = await fastify.workflowService.getEscalationConfigForInstance(stepSummary.instanceId);
        if (!escalationConfig) return;

        const assignees: AssigneeSnapshot[] = Array.isArray(stepSummary.assignedTo) ? stepSummary.assignedTo : [stepSummary.assignedTo];

        const notifiedUserIds = new Set<string>();

        for (const assignee of assignees) {
          if (!assignee.user_id) continue;

          // Find the assignee's office
          const officeData = await fastify.organizationService.getPrimaryOfficeForUser(assignee.user_id);
          if (!officeData) continue;

          // Resolve supervisors
          const supervisors = await fastify.organizationService.listEmployeesByRoleAndOffice(
            escalationConfig.supervisor_role,
            officeData.officeId
          );

          // Resolve records officers
          const recordsOfficers = await fastify.organizationService.listEmployeesByRoleAndOffice(
            escalationConfig.records_officer_role,
            officeData.officeId
          );

          // Department head is the office's head, resolved via the 'department_head' role code.
          // RESOLVED (see docs/development-findings-log.md LOG-0228 and its resolution entry):
          // 'department_head' is a registered role code as of TASK-IAM-054. This lookup returns
          // any employee(s) holding that role in this office; it legitimately returns an empty
          // array if no one in this office currently holds the role (not a bug — just means no
          // Department Head is assigned there yet).
          const departmentHeads = await fastify.organizationService.listEmployeesByRoleAndOffice(
            'department_head',
            officeData.officeId
          );
          if (departmentHeads.length === 0) {
            fastify.log.warn(
              {
                eventId: event.eventId,
                stepInstanceId: payload.stepInstanceId,
                officeId: officeData.officeId,
              },
              'notifications: sla-critical consumer found zero department_head recipients for this office — see LOG-0228 (department_head is not a registered role code)',
            );
          }

          const targets = [...supervisors, ...recordsOfficers, ...departmentHeads];

          for (const target of targets) {
            if (!target.userId || notifiedUserIds.has(target.userId)) continue;
            notifiedUserIds.add(target.userId);

            await fastify.notificationsService.sendNotification({
              recipientUserId: target.userId,
              templateId: 'notif.workflow.sla_critical.in_app',
              channel: 'in_app',
              templateData: {
                instanceId: stepSummary.instanceId,
                stepInstanceId: payload.stepInstanceId,
                slaDeadline: payload.slaDeadline,
                documentId: instanceSummary.documentId,
                documentTitle: document.title,
                documentSeriesNumber: document.finalNumber || document.preliminaryNumber || '',
              },
            });
          }
        }
      };

      run().catch((err) => {
        const payload = event.payload as WorkflowSlaCriticalPayload;
        fastify.log.error(
          { err, eventId: event.eventId, stepInstanceId: payload.stepInstanceId },
          'notifications: sla-critical consumer failed',
        );
      });
    },
    'notifications',
  );
}
