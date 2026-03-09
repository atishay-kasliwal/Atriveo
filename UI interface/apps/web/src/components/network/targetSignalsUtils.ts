import { TOP_TARGET_COMPANY_LOGOS } from "../../lib/topTargetCompanies";

export function normalizeCompanyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDisplayValue(value: unknown, fallback = "-"): string {
  const raw = String(value ?? "").trim();
  return raw.length ? raw : fallback;
}

export function friendlyTimeAgo(isoLike: string): string {
  const ts = Date.parse(isoLike);
  if (Number.isNaN(ts)) return "recently";
  const diffMs = Date.now() - ts;
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatAppliedAt(isoLike: string): string {
  const ts = Date.parse(isoLike);
  if (Number.isNaN(ts)) return "-";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function logoInitials(company: string): string {
  const parts = String(company || "")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function resolveCompanyLogo(company: string): string {
  const raw = String(TOP_TARGET_COMPANY_LOGOS[company] || "").trim();
  if (!raw) return "";
  const clearbit = /^https:\/\/logo\.clearbit\.com\/(.+)$/i.exec(raw);
  if (clearbit?.[1]) {
    const domain = clearbit[1].replace(/\/+$/, "");
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  }
  return raw;
}

export function toPrefillValue(value: string): string | null {
  const normalized = normalizeDisplayValue(value);
  if (!normalized || normalized === "-" || normalized === "Not shared") return null;
  return normalized;
}
