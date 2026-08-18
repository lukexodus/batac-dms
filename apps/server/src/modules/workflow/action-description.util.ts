/**
 * action-description.util.ts
 *
 * Builds a user-friendly action description for routing history entries.
 * Uses the step's human-readable label and a meaningful outcome verb
 * instead of raw technical strings like "action DONE".
 *
 * Extracted from workflow.router.ts for TASK-WF-025 so that the workflow
 * public API (workflow.public-api.ts) and the tRPC router share one
 * implementation of the same description string.
 */
export function buildActionDescription(
  stepLabel: string | null,
  stepKey: string,
  outcome: string,
): string {
  const name =
    stepLabel ||
    stepKey
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  const OUTCOME_VERBS: Record<string, string> = {
    DONE: 'completed',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    RETURNED_FOR_REVISION: 'returned for revision',
    SIGNED: 'signed',
    VETOED: 'vetoed',
    REPORT_ACCEPTED: 'committee report accepted',
    SECRETARY_ADVANCED: 'manually advanced by SP Secretary',
    LAPSED_CONFIRMED: 'mayor lapse confirmed — document deemed approved (RA 7160 §47)',
    DEEMED_APPROVED_CONFIRMED:
      'Panlalawigan deemed approval confirmed — 30-day window lapsed (RA 7160 §56-d)',
    VALID: 'affirmed in entirety by Panlalawigan',
    VALID_IN_PART: 'approved with partial invalidity by Panlalawigan',
    RETURNED: 'returned with objections by Panlalawigan',
    OPERATIVE_IN_ITS_ENTIRETY: 'affirmed in entirety by Panlalawigan',
  };

  const verb = OUTCOME_VERBS[outcome] ?? outcome.toLowerCase().replace(/_/g, ' ');
  return `${name} — ${verb}`;
}
