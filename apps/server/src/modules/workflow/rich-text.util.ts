import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// DOMPurify requires a DOM implementation in a Node.js (non-browser) context.
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

/**
 * Sanitizes an HTML string produced by the RichTextEditor (TipTap) component
 * before it is persisted. MUST be called on every rich-text field's value
 * before it reaches any `createWorkflowEvent` payload or any other storage
 * write. Never trust client-supplied HTML as pre-sanitized — an API client
 * that bypasses the React frontend entirely could submit crafted HTML
 * directly to these tRPC procedures.
 */
export function sanitizeRichText(html: string): string {
  return purify.sanitize(html);
}

/**
 * Determines whether a rich-text HTML string should be treated as "empty"
 * for required-field validation purposes. A naive `!value` or `value.trim()
 * === ''` check is insufficient because an empty TipTap editor serializes
 * to non-empty markup like `<p></p>` — this string is truthy and has
 * non-zero trimmed length, but represents no user-entered content.
 *
 * Strips all HTML tags and collapses whitespace before checking length.
 */
export function isRichTextEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  const textOnly = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return textOnly.length === 0;
}
