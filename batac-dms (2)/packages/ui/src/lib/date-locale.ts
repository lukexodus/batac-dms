import { enUS } from "date-fns/locale";
import type { Locale } from "date-fns";

/**
 * batac-dms custom date-fns locale.
 *
 * Base: en-US (DESIGN.md §6.4: labels in English)
 * Overrides:
 *   - weekStartsOn: 1 (Monday) — Philippine calendar convention
 *
 * Timezone: date-fns operates in local time. All display formatting
 * should be done in Asia/Manila (UTC+8). The server stores UTC;
 * format() calls in the browser will use the system timezone.
 * For server-side formatting, pass { timeZone: 'Asia/Manila' } to
 * Intl.DateTimeFormat or use date-fns-tz's formatInTimeZone().
 *
 * Philippine holidays: deferred to Phase 2 per DESIGN.md §6.4.
 *
 * [Decision confirmed 2026-06-19: custom locale, not date-fns/locale/fil]
 */
export const phLocale: Locale = {
  ...enUS,
  options: {
    ...enUS.options,
    weekStartsOn: 1, // Monday
    firstWeekContainsDate: 1,
  },
};

/**
 * Asia/Manila timezone string — use with date-fns-tz's formatInTimeZone()
 * on the server, or for Intl.DateTimeFormat calls.
 */
export const PH_TIMEZONE = "Asia/Manila" as const;

/**
 * Standard display formats used throughout the app.
 * Pass phLocale to all date-fns format() calls.
 *
 * Usage:
 *   import { format } from "date-fns";
 *   import { phLocale, DATE_FORMATS } from "@batac/ui/lib/date-locale";
 *   format(date, DATE_FORMATS.display, { locale: phLocale })
 */
export const DATE_FORMATS = {
  /** "18 Jun 2026" — document timestamps, routing history */
  display: "d MMM yyyy",

  /** "18 Jun 2026 · 09:15 AM" — full audit log entries */
  displayWithTime: "d MMM yyyy · hh:mm a",

  /** "2026-06-18" — ISO date, DB storage, URL params */
  iso: "yyyy-MM-dd",

  /** "2026-06-18 09:15:32" — monospace timestamp per DESIGN.md §9 */
  isoWithTime: "yyyy-MM-dd HH:mm:ss",

  /** "Monday, 23 June 2026" — session headers */
  sessionHeading: "EEEE, d MMMM yyyy",

  /** "Jun 2026" — month navigation in Calendar */
  monthYear: "MMM yyyy",
} as const;
