/**
 * Shared date/time utilities for the ClickProject platform.
 *
 * All functions use LOCAL timezone — never toISOString() for date-only
 * comparisons, because that converts to UTC and shifts dates in UTC+ timezones.
 */

// ─── Local date key ──────────────────────────────────────────────────
/** Returns `YYYY-MM-DD` in the browser's local timezone. */
export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ─── Comparison helpers ──────────────────────────────────────────────
/** True when both Date objects fall on the same calendar day (local tz). */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * True when a YYYY-MM-DD string matches the local calendar day of `date`.
 * Useful for comparing DB date strings against JS Date objects.
 */
export function isDateStringOnDay(dateStr: string, date: Date): boolean {
  return dateStr === toLocalDateKey(date);
}

// ─── Hebrew locale formatters ────────────────────────────────────────
/** Full date: "יום ראשון, 11 בפברואר 2026" */
export function formatDateHebrew(date: Date): string {
  return date.toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Short date from string: "11 בפבר׳" */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
  });
}

/** Full date from string (nullable): "11 בפברואר 2026" or fallback */
export function formatDate(dateStr: string | null, fallback = '—'): string {
  if (!dateStr) return fallback;
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Week helpers ────────────────────────────────────────────────────
/** Hebrew weekday names, indexed by `Date.getDay()` (0 = Sunday). */
export const HEBREW_WEEKDAYS = [
  'ראשון',
  'שני',
  'שלישי',
  'רביעי',
  'חמישי',
  'שישי',
  'שבת',
] as const;

/** Single-letter Hebrew weekday initials, indexed by `Date.getDay()` (0 = Sunday). */
export const HEBREW_WEEKDAY_INITIALS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] as const;

/**
 * Day of week (0 = Sunday … 6 = Saturday) for a `YYYY-MM-DD` key.
 * Parsed as UTC midnight so the result never shifts with the server timezone —
 * pair it with a date key already resolved in the timezone you care about
 * (e.g. `getIsraelNow().date`).
 */
export function getWeekdayFromDateKey(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

/** Returns an array of 7 Date objects for the week containing `date` (Sun–Sat). */
export function getWeekDays(date: Date): Date[] {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    days.push(day);
  }
  return days;
}

// ─── Time helpers ────────────────────────────────────────────────────
/** Strips "HH:MM:SS" → "HH:MM". Passes through if already short. */
export function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

/** Returns current date (YYYY-MM-DD) and time (HH:MM) in Israel timezone. */
export function getIsraelNow(): { date: string; time: string } {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const time = new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  return { date, time };
}
