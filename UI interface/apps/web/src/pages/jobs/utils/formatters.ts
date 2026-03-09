export function normalizeReferralStatus(value: unknown): "Requested" | "Yes" | "No" | "" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "requested") return "Requested";
  if (raw === "yes") return "Yes";
  return "No";
}

export function normalizeOaStatus(value: unknown): "Yes" | "No" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (
    raw === "yes" ||
    raw === "pending" ||
    raw === "completed" ||
    raw === "complete" ||
    raw === "done" ||
    raw === "missed" ||
    raw === "missing" ||
    raw === "overdue"
  ) {
    return "Yes";
  }
  return "No";
}

export function getOaResultLabel(row: Record<string, unknown>): "Pending" | "Completed" | "Missed" {
  const explicit = String((row as any).oa_result ?? "").trim();
  if (explicit === "Pending") return "Pending";
  if (explicit === "Missed") return "Missed";
  if (explicit === "Completed") return "Completed";
  const source = String(row.source ?? "").toLowerCase();
  if (source.includes("missed")) return "Missed";
  const deadline = String(row.oa_deadline_date ?? "").trim();
  if (deadline) {
    const d = new Date(`${deadline}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d < today) return "Missed";
    }
  }
  return "Completed";
}

export function getReferralInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function parseIsoDay(day: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const y = Number(match[1]);
  const month = Number(match[2]);
  const d = Number(match[3]);
  if (!y || month < 1 || month > 12 || d < 1 || d > 31) return null;
  return { y, m: month, d };
}

export function formatDayShort(day: string) {
  try {
    const parts = parseIsoDay(day);
    if (!parts) return day;
    return `${String(parts.m).padStart(2, "0")}/${String(parts.d).padStart(2, "0")}`;
  } catch {
    return day;
  }
}

export function getKeywordMatchTier(value: number): "Weak" | "Medium" | "Strong" {
  if (value >= 80) return "Strong";
  if (value >= 65) return "Medium";
  return "Weak";
}

export function capitalizeFirst(value: string) {
  if (!value) return value;
  const normalized = value.toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
