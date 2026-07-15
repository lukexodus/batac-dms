import jsonLogic from 'json-logic-js';
import type { TransitionRuleRow } from './types.js';

/**
 * Evaluates transition rules to determine the next step in the workflow (B4 §3.4).
 *
 * @param rules Array of TransitionRuleRow matching the current step and definition version.
 * @param outcome The outcome string from the current step's execution.
 * @param context The current workflow instance context.
 * @returns The `to_step_id` of the winning rule, or `null` if no rule matches.
 */
export function evaluateTransitionRules(
  rules: TransitionRuleRow[],
  outcome: string | null,
  context: Record<string, any>,
): string | null {
  // 1. Filter: remove rules where outcome_filter is set but doesn't match
  const candidateRules = rules.filter((rule) => {
    if (rule.outcomeFilter !== null && rule.outcomeFilter !== outcome) {
      return false;
    }
    return true;
  });

  // 2. Sort remaining by priority ASC (lower value = higher priority)
  candidateRules.sort((a, b) => a.priority - b.priority);

  // 3. Evaluate condition expressions
  for (const rule of candidateRules) {
    if (rule.conditionExpression === null) {
      return rule.toStepId; // unconditional rule
    }

    try {
      // jsonLogic evaluates pure read-only against context
      const isMatch = jsonLogic.apply(rule.conditionExpression, context);
      if (isMatch) {
        return rule.toStepId;
      }
    } catch (err) {
      // A failed evaluation evaluates as false
      console.warn(`JSONLogic evaluation failed for rule ${rule.id}:`, err);
    }
  }

  // 4. No match found
  return null;
}
