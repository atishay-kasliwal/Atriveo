import { getLocalISODate } from "../../lib/formatDate";
import type { NetworkTodayFriend, NetworkTrendFriend } from "../../lib/api";

export function rgbaFromHex(hex: string, alpha: number): string {
  const normalized = String(hex || "").trim();
  const short = /^#([0-9a-f]{3})$/i.exec(normalized);
  const full = /^#([0-9a-f]{6})$/i.exec(normalized);
  if (!short && !full) return normalized || `rgba(37, 99, 235, ${alpha})`;
  const raw = short ? short[1].split("").map((c) => `${c}${c}`).join("") : full?.[1] ?? "3385ff";
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function todayBarGradientId(key: string): string {
  return `todayBarGrad-${String(key || "unknown").replace(/[^a-z0-9_-]/gi, "-")}`;
}

export function weeklyShadeGradientId(key: string): string {
  return `weeklyShadeGrad-${String(key || "unknown").replace(/[^a-z0-9_-]/gi, "-")}`;
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

export function utcDateFromIsoDay(day: string): Date | null {
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
  const dayOfWeek = d.getUTCDay(); // Sun=0..Sat=6
  const daysFromMonday = (dayOfWeek + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysFromMonday);
  return d.toISOString().slice(0, 10);
}

export function formatDayShort(day: string) {
  const parts = String(day).split("-");
  if (parts.length !== 3) return day;
  return `${parts[1]}/${parts[2]}`;
}

export function formatWeekdayShort(day: string): string {
  const d = utcDateFromIsoDay(day);
  if (!d || Number.isNaN(d.getTime())) return formatDayShort(day);
  return new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(d);
}

export function formatFirstNameLastInitial(name: string): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return String(name || "");
  if (parts.length === 1) return parts[0];
  const lastInitial = parts[parts.length - 1]?.[0] ?? "";
  return `${parts[0]} ${lastInitial}`;
}

export function toDateInput(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return getLocalISODate();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return getLocalISODate();
  return d.toISOString().slice(0, 10);
}

export function normalizeOaStatus(value: unknown): "Yes" | "No" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "yes" || raw === "pending" || raw === "completed" || raw === "complete" || raw === "done" || raw === "missed" || raw === "missing" || raw === "overdue") return "Yes";
  return "No";
}

export function emojiForTickerFact(text: string): string {
  if (text.startsWith("Weekly Leader:")) return "★";
  if (text.startsWith("Runner-Up:")) return "◆";
  if (text.startsWith("Lead:")) return "▲";
  if (text.startsWith("Leading Today:")) return "●";
  if (text.startsWith("Close Race:")) return "◈";
  if (text.startsWith("Most Daily Wins:")) return "♛";
  if (text.startsWith("Team Total:")) return "▦";
  if (text.startsWith("Most Consistent:")) return "◎";
  if (text.startsWith("Top Single Day:")) return "✦";
  return "•";
}

export function augmentDemoNetworkData(
  trendRows: NetworkTrendFriend[],
  todayRows: NetworkTodayFriend[],
): { trend: NetworkTrendFriend[]; today: NetworkTodayFriend[] } {
  const companies = ["Google", "Amazon", "Meta", "Microsoft", "Apple", "Netflix", "NVIDIA", "Databricks", "Stripe", "Uber"];
  const roles = ["Software Engineer", "Frontend Engineer", "Backend Engineer", "Data Scientist", "ML Engineer", "Product Engineer"];
  const now = Date.now();
  const todayIso = getLocalISODate();

  const trend = trendRows.map((friend, idx) => {
    const bumpBase = 1 + (idx % 3);
    const boostedTrend = (friend.trend ?? []).map((point, pointIdx) => {
      const isRecent = point.day >= isoDayAddDays(todayIso, -6);
      const boost = isRecent ? ((pointIdx + idx) % 3 === 0 ? bumpBase + 1 : bumpBase) : 0;
      return {
        ...point,
        total: Number(point.total ?? 0) + boost,
      };
    });
    return {
      ...friend,
      trend: boostedTrend,
    };
  });

  const today = todayRows.map((friend, idx) => {
    const existing = Array.isArray(friend.jobs) ? friend.jobs : [];
    const extraCount = existing.length >= 2 ? 1 : 2;
    const extraJobs = Array.from({ length: extraCount }, (_, j) => {
      const company = companies[(idx * 2 + j) % companies.length];
      const role = roles[(idx + j) % roles.length];
      const ts = new Date(now - (idx * 31 + j * 13) * 60000).toISOString();
      return {
        id: 900000 + idx * 10 + j,
        company,
        role,
        date_saved: ts,
        applied_at: ts,
        application_status: "Applied",
        referral_status: j % 2 === 0 ? "Requested" : "No",
        oa_status: "No",
        oa_deadline_date: null,
        job_application_id: "-",
        job_link: `https://careers.example.com/${encodeURIComponent(company.toLowerCase())}/${(idx + j + 100).toString(36)}`,
        notes: null,
        can_view_company: true,
        can_view_role: true,
        can_view_applied_at: true,
        can_view_oa_status: true,
        can_view_oa_deadline: true,
        can_view_referral_used: true,
        can_view_notes: false,
      };
    });
    return {
      ...friend,
      jobs: [...existing, ...extraJobs],
    };
  });

  return { trend, today };
}
