/**
 * Client-side mirror of the server's isRichTextEmpty check (see
 * apps/server/src/modules/workflow/rich-text.util.ts for the
 * server-side counterpart — kept as a small intentional duplicate
 * rather than a shared package import, since this is a 3-line pure
 * function and does not warrant a new cross-boundary shared-package
 * dependency for client-side UX-only validation; the server-side
 * check remains the actual security/correctness boundary).
 */
export function isRichTextEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  const textOnly = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return textOnly.length === 0;
}
