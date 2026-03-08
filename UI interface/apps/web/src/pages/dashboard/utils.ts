export function percentChange(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous === 0) return current === 0 ? 0 : 100;
  const raw = Math.round(((current - previous) / Math.abs(previous)) * 100);
  return Math.max(-100, Math.min(100, raw));
}

function parseIsoDay(day: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const d = Number(m[3]);
  if (!y || month < 1 || month > 12 || d < 1 || d > 31) return null;
  return { y, m: month, d };
}

function utcDateFromIsoDay(day: string): Date | null {
  const p = parseIsoDay(day);
  if (!p) return null;
  return new Date(Date.UTC(p.y, p.m - 1, p.d));
}

export function isoDayAddDays(day: string, deltaDays: number): string {
  const d = utcDateFromIsoDay(day);
  if (!d) return day;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function weekStartIsoUtc(day: string): string {
  const d = utcDateFromIsoDay(day);
  if (!d) return day;
  const dayOfWeek = d.getUTCDay(); // 0..6, Sun..Sat
  const daysFromMonday = (dayOfWeek + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysFromMonday);
  return d.toISOString().slice(0, 10);
}

export function formatDay(day: string) {
  try {
    const d = utcDateFromIsoDay(day);
    if (!d || Number.isNaN(d.getTime())) return day;
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "2-digit",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return day;
  }
}

export function formatDayShort(day: string) {
  try {
    const p = parseIsoDay(day);
    if (!p) return day;
    return `${String(p.m).padStart(2, "0")}/${String(p.d).padStart(2, "0")}`;
  } catch {
    return day;
  }
}

export function formatWeek(week: string) {
  try {
    const d = utcDateFromIsoDay(week);
    if (!d || Number.isNaN(d.getTime())) return week;
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
  } catch {
    return week;
  }
}

export function formatMonth(month: string) {
  try {
    const [y, m] = month.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return Number.isNaN(d.getTime()) ? month : d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  } catch {
    return month;
  }
}

export function dayWithSuffix(day: number): string {
  const mod10 = day % 10;
  const mod100 = day % 100;
  if (mod10 === 1 && mod100 !== 11) return `${day}st`;
  if (mod10 === 2 && mod100 !== 12) return `${day}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${day}rd`;
  return `${day}th`;
}
