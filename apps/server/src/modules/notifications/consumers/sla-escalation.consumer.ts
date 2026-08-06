import type { FastifyInstance } from 'fastify';

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

        const assignees = Array.isArray(stepSummary.assignedTo) ? stepSummary.assignedTo : [stepSummary.assignedTo];
        
        const instanceSummary = await fastify.workflowService.getInstanceById(stepSummary.instanceId);
        if (!instanceSummary) return;

        const document = await fastify.documentsService.getDocumentById(instanceSummary.documentId);
        if (!document) return;

        for (const assignee of assignees) {
          if (assignee.type !== 'user' || !assignee.id) continue;

          await fastify.notificationsService.sendNotification({
            recipientUserId: assignee.id,
            templateId: 'notif.workflow.sla_warning.in_app',
            channel: 'in_app',
            templateData: {
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

        const assignees = Array.isArray(stepSummary.assignedTo) ? stepSummary.assignedTo : [stepSummary.assignedTo];

        const notifiedUserIds = new Set<string>();

        for (const assignee of assignees) {
          if (assignee.type !== 'user' || !assignee.id) continue;

          // Find the assignee's office
          const officeData = await fastify.organizationService.getPrimaryOfficeForUser(assignee.id);
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

        const assignees = Array.isArray(stepSummary.assignedTo) ? stepSummary.assignedTo : [stepSummary.assignedTo];

        const notifiedUserIds = new Set<string>();

        for (const assignee of assignees) {
          if (assignee.type !== 'user' || !assignee.id) continue;

          // Find the assignee's office
          const officeData = await fastify.organizationService.getPrimaryOfficeForUser(assignee.id);
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

          // Department head is typically the office's head. We could find the person with role 'department_head'
          // However, for safety if 'department_head' is not defined, we could fallback, but we'll assume it exists or returns empty array.
          const departmentHeads = await fastify.organizationService.listEmployeesByRoleAndOffice(
            'department_head',
            officeData.officeId
          );

          const targets = [...supervisors, ...recordsOfficers, ...departmentHeads];

          for (const target of targets) {
            if (!target.userId || notifiedUserIds.has(target.userId)) continue;
            notifiedUserIds.add(target.userId);

            await fastify.notificationsService.sendNotification({
              recipientUserId: target.userId,
              templateId: 'notif.workflow.sla_critical.in_app',
              channel: 'in_app',
              templateData: {
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
