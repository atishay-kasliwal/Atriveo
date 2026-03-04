/**
 * Format a date for display in tables (Jobs, Referrals, Pending).
 * Uses a consistent format: "Feb 22, 2025"
 */
export function formatTableDate(value: unknown): string {
  if (value == null || value === "") return "—";
  try {
    const raw = String(value);
    // YYYY-MM-DD from inputs/DB: format in UTC to avoid timezone day-shift
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
    const d = isDateOnly ? new Date(`${raw}T00:00:00Z`) : new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return String(value);
  }
}

/**
 * Format a timestamp for display in tables with date + time.
 * Date-only inputs remain date-only to avoid fake midnight times.
 */
function extractMidnightUtcDate(raw: string): string | null {
  const normalized = raw.trim().replace(" ", "T");
  const m = normalized.match(
    /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0+)?(?:Z|[+-]00(?::?00)?)?$/,
  );
  return m ? m[1] : null;
}

export function formatTableDateTime(value: unknown): string {
  if (value == null || value === "") return "—";
  try {
    const raw = String(value);
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
    if (isDateOnly) return formatTableDate(raw);

    // Many rows are saved with date-only intent at midnight UTC.
    // Rendering those in local time can show the previous day (e.g. Mar 1 -> Feb 28, 07:00 PM EST).
    // For those cases, keep date-only rendering.
    const midnightUtcDate = extractMidnightUtcDate(raw);
    if (midnightUtcDate) return formatTableDate(midnightUtcDate);

    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;

    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return String(value);
  }
}

/** Format only time (for columns where date is already shown separately). */
export function formatTableTime(value: unknown): string {
  if (value == null || value === "") return "—";
  try {
    const raw = String(value);
    if (extractMidnightUtcDate(raw)) return "12:00 AM";

    const d = new Date(raw);
    if (isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "—";
  }
}

/** Local YYYY-MM-DD for <input type="date"> defaults (avoids UTC shifts). */
export function getLocalISODate(d = new Date()): string {
  const local = new Date(d);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
}
