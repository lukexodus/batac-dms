/**
 * apps/portal/src/lib/document-request.ts
 *
 * Builds the "Request a copy" link that every public document page links to.
 *
 * [Inference — TASK-PORTAL-009, logged]: E2 constructs `documentRequestUrl`
 * as `/document-requests?ref=<finalNumber>` (see the public-read service),
 * but F1 §14.2 and the portal task list place the citizen request form at
 * `/requests/new` (TASK-PORTAL-011, matching the existing `/complaints/new`
 * precedent). Linking to the API-provided `documentRequestUrl` would point
 * citizens at a route that does not exist in this app, so the frontend links
 * to the form route directly and carries the final number through as `ref`.
 */
export function documentRequestHref(finalNumber: string | null, documentId?: string): string {
  const ref = finalNumber ?? documentId;
  return ref ? `/requests/new?ref=${encodeURIComponent(ref)}` : '/requests/new';
}
