/**
 * apps/portal/src/lib/format.ts
 *
 * Asia/Manila date formatting for the public portal. All API timestamps are
 * ISO-8601 (UTC or +08:00); the Philippines has no DST, so rendering in
 * Asia/Manila is stable year-round.
 */

const PH_TIMEZONE = 'Asia/Manila';

function toDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** e.g. "March 5, 2026" */
export function formatPhDate(value: string): string {
  const d = toDate(value);
  if (!d) return value;
  return d.toLocaleDateString('en-PH', {
    timeZone: PH_TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** e.g. "Mar 5, 2026, 9:00 AM" */
export function formatPhDateTime(value: string): string {
  const d = toDate(value);
  if (!d) return value;
  return d.toLocaleString('en-PH', {
    timeZone: PH_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
