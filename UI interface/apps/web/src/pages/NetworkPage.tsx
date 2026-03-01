import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Spinner from "../components/Spinner";
import {
  acceptFriendRequest,
  blockFriendship,
  createJob,
  getFriendRequests,
  getFriends,
  getNetworkToday,
  getNetworkTrend,
  rejectFriendRequest,
  sendFriendRequest,
  type FriendRecord,
  type IncomingFriendRequest,
  type NetworkTodayFriend,
  type NetworkTrendFriend,
  type OutgoingFriendRequest,
} from "../lib/api";
import { formatTableDateTime, getLocalISODate } from "../lib/formatDate";

function parseIsoDay(day: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const d = Number(m[3]);
  if (!y || month < 1 || month > 12 || d < 1 || d > 31) return null;
  return { y, m: month, d };
}

function formatDayShort(day: string) {
  try {
    const p = parseIsoDay(day);
    if (!p) return day;
    return `${String(p.m).padStart(2, "0")}/${String(p.d).padStart(2, "0")}`;
  } catch {
    return day;
  }
}

const NETWORK_TREND_COLORS = ["#4f8cff", "#22d3ee", "#60a5fa", "#a78bfa", "#38bdf8"];
const NETWORK_TREND_LINE_COLOR = "#6ee7b7";
const MAX_NETWORK_TREND_FRIENDS = 5;
const NETWORK_TREND_COLOR_STORAGE_KEY = "network_trend_colors_v1";

function formatDateTimeCell(value: unknown, withTime = true) {
  if (value == null || value === "") return "—";
  const raw = String(value);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  if (!withTime) {
    return parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NetworkTrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const dedup = new Map<string, { name: string; value: number; color: string }>();
  payload.forEach((item) => {
    const name = String(item.name ?? "");
    if (!name) return;
    const next = {
      name,
      value: Number(item.value ?? 0),
      color: item.color ?? "#a1a1aa",
    };
    const prev = dedup.get(name);
    if (!prev || next.value > prev.value) dedup.set(name, next);
  });
  const rows = Array.from(dedup.values()).sort((a, b) => b.value - a.value);

  return (
    <div
      style={{
        background: "#18181b",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 8,
        padding: "10px 12px",
        minWidth: 180,
      }}
    >
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "#d4d4d8", fontWeight: 600 }}>{String(label ?? "")}</p>
      {rows.map((row) => (
        <p key={row.name} style={{ margin: "0 0 6px", fontSize: 12, color: row.color }}>
          {row.name}: <strong>{row.value}</strong>
        </p>
      ))}
    </div>
  );
}

function toDateInput(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return getLocalISODate();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return getLocalISODate();
  return d.toISOString().slice(0, 10);
}

export default function NetworkPage() {
  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [incoming, setIncoming] = useState<IncomingFriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingFriendRequest[]>([]);
  const [trendData, setTrendData] = useState<NetworkTrendFriend[]>([]);
  const [todayData, setTodayData] = useState<NetworkTodayFriend[]>([]);
  const [maxFriends, setMaxFriends] = useState(10);
  const [emailInput, setEmailInput] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [busyId, setBusyId] = useState<number | string | null>(null);
  const [sectionOpen, setSectionOpen] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [todayOpen, setTodayOpen] = useState(false);
  const [showPrefillModal, setShowPrefillModal] = useState(false);
  const [isPrefillSaving, setIsPrefillSaving] = useState(false);
  const [prefillError, setPrefillError] = useState("");
  const [prefillFromName, setPrefillFromName] = useState("");
  const [prefillForm, setPrefillForm] = useState({
    company: "",
    role: "",
    date_saved: getLocalISODate(),
    job_link: "",
    location_raw: "",
    referral_status: "",
    keyword_matching: "Medium",
    notes: "",
  });
  const [seriesColors, setSeriesColors] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(NETWORK_TREND_COLOR_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, string>;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  const [expanded, setExpanded] = useState({
    add: true,
    friends: true,
    incoming: true,
    outgoing: true,
  });

  const friendSlots = useMemo(() => `${friends.length}/${maxFriends}`, [friends.length, maxFriends]);

  const load = useCallback(async () => {
    try {
      setError("");
      setIsLoading(true);
      const [friendsRes, requestsRes, trendRes, todayRes] = await Promise.all([
        getFriends(),
        getFriendRequests(),
        getNetworkTrend(10),
        getNetworkToday(),
      ]);
      setFriends(friendsRes.data ?? []);
      setMaxFriends(Number(friendsRes.maxFriends ?? 10));
      setIncoming(requestsRes.incoming ?? []);
      setOutgoing(requestsRes.outgoing ?? []);
      setTrendData(trendRes.data ?? []);
      setTodayData(todayRes.data ?? []);
    } catch (e) {
      setError((e as Error).message);
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
      setTrendData([]);
      setTodayData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSendRequest(e: React.FormEvent) {
    e.preventDefault();
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    try {
      setIsSending(true);
      setError("");
      setSuccess("");
      await sendFriendRequest({ email });
      setEmailInput("");
      setSuccess(`Friend request sent to ${email}.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSending(false);
    }
  }

  async function onAccept(id: number | string) {
    try {
      setBusyId(id);
      setError("");
      setSuccess("");
      await acceptFriendRequest(id);
      setSuccess("Friend request accepted.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(id: number | string) {
    try {
      setBusyId(id);
      setError("");
      setSuccess("");
      await rejectFriendRequest(id);
      setSuccess("Friend request rejected.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function onRemove(id: number | string) {
    const confirmed = window.confirm("Remove this friend? You can send a new friend request later.");
    if (!confirmed) return;
    try {
      setBusyId(id);
      setError("");
      setSuccess("");
      await blockFriendship(id);
      setSuccess("Friend removed.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  function toggleSection(key: "add" | "friends" | "incoming" | "outgoing") {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openPrefillFromFriend(
    friendName: string,
    job: {
      company: string | null;
      role: string | null;
      date_saved: string | null;
      job_link: string | null;
      referral_status: string | null;
      application_status: string | null;
    },
  ) {
    setPrefillFromName(friendName);
    setPrefillError("");
    setPrefillForm({
      company: String(job.company ?? ""),
      role: String(job.role ?? ""),
      date_saved: toDateInput(job.date_saved),
      job_link: String(job.job_link ?? ""),
      location_raw: "",
      referral_status: String(job.referral_status ?? ""),
      keyword_matching: "Medium",
      notes: `Copied from ${friendName}${job.application_status ? ` (${job.application_status})` : ""}`.trim(),
    });
    setShowPrefillModal(true);
  }

  function onSelectFriendJob(
    friendDisplayName: string,
    job: {
      company: string | null;
      role: string | null;
      date_saved: string | null;
      job_link: string | null;
      referral_status: string | null;
      application_status: string | null;
    },
  ) {
    openPrefillFromFriend(friendDisplayName, job);
  }

  async function onCreateFromPrefill(e: React.FormEvent) {
    e.preventDefault();
    if (!prefillForm.company.trim() || !prefillForm.role.trim()) return;
    try {
      setIsPrefillSaving(true);
      setPrefillError("");
      await createJob({
        company: prefillForm.company.trim(),
        role: prefillForm.role.trim(),
        date_saved: prefillForm.date_saved || getLocalISODate(),
        job_link: prefillForm.job_link.trim() || undefined,
        location_raw: prefillForm.location_raw.trim() || undefined,
        referral_status: prefillForm.referral_status.trim() || undefined,
        keyword_matching: prefillForm.keyword_matching || "Medium",
        notes: prefillForm.notes.trim() || undefined,
        application_status: "Applied",
      });
      setShowPrefillModal(false);
      setSuccess("Application added from friend suggestion.");
    } catch (err) {
      setPrefillError((err as Error).message);
    } finally {
      setIsPrefillSaving(false);
    }
  }

  function initialsFromEmail(email: string): string {
    const local = (email.split("@")[0] ?? "").replace(/[^a-zA-Z0-9]+/g, " ").trim();
    if (!local) return "U";
    const parts = local.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    return (parts[0].slice(0, 2) || "U").toUpperCase();
  }

  function initialsFromNameOrEmail(name: string | undefined, email: string): string {
    const raw = String(name || "").trim();
    if (raw) {
      const parts = raw.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
      return (parts[0].slice(0, 2) || "U").toUpperCase();
    }
    return initialsFromEmail(email);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(NETWORK_TREND_COLOR_STORAGE_KEY, JSON.stringify(seriesColors));
  }, [seriesColors]);

  const combinedTrend = useMemo(() => {
    const ranked = trendData
      .map((friend) => ({
        ...friend,
        total: friend.trend.reduce((sum, point) => sum + Number(point.total ?? 0), 0),
        avgPerDay: friend.trend.length ? friend.trend.reduce((sum, point) => sum + Number(point.total ?? 0), 0) / friend.trend.length : 0,
        maxDaily: friend.trend.reduce((m, point) => Math.max(m, Number(point.total ?? 0)), 0),
      }))
      .sort((a, b) => b.avgPerDay - a.avgPerDay);
    const selfEntry = ranked.find((entry) => entry.is_self);
    const others = ranked.filter((entry) => !entry.is_self);
    const selectedBase = selfEntry
      ? [selfEntry, ...others.slice(0, Math.max(0, MAX_NETWORK_TREND_FRIENDS - 1))]
      : others.slice(0, MAX_NETWORK_TREND_FRIENDS);
    const selected = selectedBase.map((friend, idx) => ({
      ...friend,
      key: `friend_${friend.friend_id}`,
      label: friend.is_self ? "You" : String(friend.friend_name || friend.friend_email),
      color: seriesColors[`friend_${friend.friend_id}`] || NETWORK_TREND_COLORS[idx % NETWORK_TREND_COLORS.length],
      initials: initialsFromNameOrEmail(friend.friend_name, friend.friend_email),
    }));
    const bestByAvg =
      selected.length === 0
        ? null
        : selected.reduce((best, item) => (item.avgPerDay > best.avgPerDay ? item : best), selected[0]);
    const allDays = new Set<string>();
    selected.forEach((friend) => {
      friend.trend.forEach((point) => allDays.add(point.day));
    });
    const rows: Array<Record<string, number | string>> = Array.from(allDays)
      .sort()
      .map((day) => {
        const row: Record<string, number | string> = {
          day,
          dayLabel: formatDayShort(day),
        };
        let dayMax = -1;
        let dayWinnerLabel = "";
        let dayWinnerInitials = "";
        selected.forEach((friend) => {
          const point = friend.trend.find((p) => p.day === day);
          const total = Number(point?.total ?? 0);
          row[friend.key] = total;
          if (total > dayMax) {
            dayMax = total;
            dayWinnerLabel = friend.label;
            dayWinnerInitials = friend.initials;
          }
        });
        row.dayMax = Math.max(dayMax, 0);
        row.dayWinnerLabel = dayWinnerLabel;
        row.dayWinnerInitials = dayWinnerInitials;
        row.dayWinnerBadge = dayMax > 0 ? `${dayWinnerInitials} ${dayMax}` : "";
        return row;
      });
    return {
      selected,
      bestByAvg,
      rows,
      totalFriends: ranked.length,
      hiddenCount: Math.max(0, ranked.length - selected.length),
    };
  }, [seriesColors, trendData]);

  const todayWithJobs = useMemo(() => {
    const rows = todayData.filter((f) => (f.jobs?.length ?? 0) > 0);
    const latestTs = (friend: {
      jobs: Array<{ date_saved: string | null; id: number }>;
    }) => {
      return friend.jobs.reduce((max, job) => {
        const ts = Date.parse(String(job.date_saved ?? ""));
        if (Number.isNaN(ts)) return max;
        return Math.max(max, ts);
      }, 0);
    };
    rows.sort((a, b) => {
      const lastDiff = latestTs(b) - latestTs(a);
      if (lastDiff !== 0) return lastDiff;
      const diff = (b.jobs?.length ?? 0) - (a.jobs?.length ?? 0);
      if (diff !== 0) return diff;
      const an = String(a.friend_name || a.friend_email || "").toLowerCase();
      const bn = String(b.friend_name || b.friend_email || "").toLowerCase();
      return an.localeCompare(bn);
    });
    return rows;
  }, [todayData]);
  return (
    <>
      {error ? <div className="error">{error}</div> : null}
      {success ? (
        <div className="network-success-banner" role="status" aria-live="polite">
          <span>{success}</span>
          <button type="button" className="network-success-close" aria-label="Dismiss message" onClick={() => setSuccess("")}>
            ×
          </button>
        </div>
      ) : null}

      <section>
        <div className="card">
          <button type="button" className="network-main-head" onClick={() => setInsightsOpen((p) => !p)}>
            <h2>Network Insights</h2>
            <div className="network-main-right">
              <span className="pending-meta">Last 10 days and today</span>
              <span className={`network-section-arrow ${insightsOpen ? "open" : ""}`}>▴</span>
            </div>
          </button>

          {!insightsOpen ? null : isLoading ? (
            <Spinner />
          ) : (
            <>
              <div className="network-insight-head">
                <h3>Application Trend (Last 10 Days)</h3>
              </div>
              {combinedTrend.selected.length === 0 ? (
                <div className="empty-state">No accepted friends yet. Add friends to see trend insights.</div>
              ) : (
                <div className="network-combined-card">
                  <div className="chart-header network-chart-header">
                    <div className="chart-title-group">
                      <h2>Network Comparison (Top {combinedTrend.selected.length})</h2>
                      <p className="chart-subtitle">Daily applications</p>
                    </div>
                    <div className="chart-filter">
                      <span className="delta-pill">Sorted by avg/day (sum ÷ days)</span>
                      {combinedTrend.bestByAvg ? (
                        <span className="delta-pill">Trend line: {combinedTrend.bestByAvg.label}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="network-avatar-row">
                    {combinedTrend.selected.map((friend) => (
                      <div key={`avatar-${friend.key}`} className="network-avatar-chip" title={friend.label}>
                        <span className="network-avatar-circle" style={{ borderColor: friend.color }}>
                          {friend.initials}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="network-mini-chart network-combined-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={combinedTrend.rows} margin={{ top: 20, right: 22, left: 6, bottom: 4 }} barGap={2} barCategoryGap="8%">
                        <defs>
                          <filter id="networkTrendGlow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="3.5" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="dayLabel" tick={{ fill: "#a1a1aa", fontSize: 10, fontWeight: 400 }} tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} tick={{ fill: "#a1a1aa", fontSize: 10, fontWeight: 400 }} tickLine={false} axisLine={false} width={36} />
                        <Tooltip content={<NetworkTrendTooltip />} cursor={{ fill: "rgba(96, 165, 250, 0.08)" }} />
                        {combinedTrend.selected.map((friend) => (
                          <Bar
                            key={friend.key}
                            dataKey={friend.key}
                            name={friend.label}
                            fill={friend.color}
                            radius={[0, 0, 0, 0]}
                            maxBarSize={30}
                            stroke="rgba(255,255,255,0.14)"
                            strokeWidth={1}
                            fillOpacity={combinedTrend.bestByAvg?.key === friend.key ? 1 : 0.82}
                            animationDuration={650}
                          />
                        ))}
                        {combinedTrend.bestByAvg ? (
                          <>
                            <Line
                              type="monotone"
                              dataKey={combinedTrend.bestByAvg.key}
                              name={`${combinedTrend.bestByAvg.label} trend glow`}
                              stroke={NETWORK_TREND_LINE_COLOR}
                              strokeWidth={7}
                              strokeOpacity={0.2}
                              dot={false}
                              isAnimationActive={false}
                              filter="url(#networkTrendGlow)"
                            />
                            <Line
                              type="monotone"
                              dataKey={combinedTrend.bestByAvg.key}
                              name={`${combinedTrend.bestByAvg.label} trend`}
                              stroke={NETWORK_TREND_LINE_COLOR}
                              strokeWidth={3.2}
                              strokeOpacity={0.98}
                              strokeDasharray="7 6"
                              dot={false}
                              activeDot={{ r: 5, strokeWidth: 2, stroke: "#18181b" }}
                              animationDuration={700}
                            />
                          </>
                        ) : null}
                        {combinedTrend.rows.map((row) => {
                          const y = Number(row.dayMax ?? 0);
                          if (y <= 0) return null;
                          const x = String(row.dayLabel ?? "");
                          const badge = String(row.dayWinnerBadge ?? "");
                          return (
                            <ReferenceDot
                              key={`max-${String(row.day ?? x)}`}
                              x={x}
                              y={y}
                              r={0}
                              ifOverflow="extendDomain"
                              label={{
                                value: badge,
                                position: "top",
                                fill: "#d4d4d8",
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            />
                          );
                        })}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="network-trend-legend">
                    {combinedTrend.selected.map((friend) => (
                      <div key={friend.key} className="network-legend-chip" title={friend.friend_email}>
                        <span className="network-legend-dot" style={{ background: friend.color }} />
                        <span className="network-legend-email">{friend.label}</span>
                        <span className="network-legend-total">avg {friend.avgPerDay.toFixed(1)} | max {friend.maxDaily}</span>
                        <input
                          type="color"
                          className="network-color-picker"
                          aria-label={`Pick line color for ${friend.label}`}
                          value={friend.color}
                          onChange={(e) => {
                            const val = e.currentTarget.value;
                            setSeriesColors((prev) => ({ ...prev, [friend.key]: val }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button type="button" className="network-section-head network-insight-toggle" onClick={() => setTodayOpen((p) => !p)}>
                <h3>Today&apos;s Applications</h3>
                <span className={`network-section-arrow ${todayOpen ? "open" : ""}`}>▴</span>
              </button>
              {!todayOpen ? null : todayWithJobs.length === 0 ? (
                <div className="empty-state">No friend applications recorded today.</div>
              ) : (
                <div className="network-today-grid">
                  {todayWithJobs.map((friend) => (
                    <div key={String(friend.friend_id)} className="network-today-card network-today-item">
                      <div className="network-today-summary">
                        <strong>{String(friend.friend_name || friend.friend_email)}</strong>
                        <span className="network-today-summary-right">
                          <span className="pending-meta">{friend.jobs.length} today</span>
                        </span>
                      </div>
                      <div className="table-wrap">
                        <table className="network-today-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Company</th>
                              <th>Role</th>
                              <th>Date</th>
                              <th>Link</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {friend.jobs.map((job, idx) => (
                              <tr
                                key={String(job.id)}
                                className="network-job-row"
                                onClick={() =>
                                  onSelectFriendJob(String(friend.friend_name || friend.friend_email), {
                                    company: job.company ?? null,
                                    role: job.role ?? null,
                                    date_saved: job.date_saved ?? null,
                                    job_link: job.job_link ?? null,
                                    referral_status: job.referral_status ?? null,
                                    application_status: job.application_status ?? null,
                                  })
                                }
                              >
                                <td className="network-cell-index">{idx + 1}</td>
                                <td className="network-cell-primary" title={String(job.company ?? "—")}>
                                  {String(job.company ?? "—")}
                                </td>
                                <td className="network-cell-secondary" title={String(job.role ?? "—")}>
                                  {String(job.role ?? "—")}
                                </td>
                                <td className="network-cell-date">{formatTableDateTime(job.date_saved)}</td>
                                <td>
                                  {job.job_link ? (
                                    <a
                                      href={String(job.job_link)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="network-link-chip"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Open
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="action-btn network-add-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSelectFriendJob(String(friend.friend_name || friend.friend_email), {
                                        company: job.company ?? null,
                                        role: job.role ?? null,
                                        date_saved: job.date_saved ?? null,
                                        job_link: job.job_link ?? null,
                                        referral_status: job.referral_status ?? null,
                                        application_status: job.application_status ?? null,
                                      });
                                    }}
                                  >
                                    Add Application
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section>
        <div className="card">
          <button type="button" className="network-main-head" onClick={() => setSectionOpen((p) => !p)}>
            <h2>Add Friend</h2>
            <div className="network-main-right">
              <span className="pending-meta">Friend slots: {friendSlots}</span>
              <span className={`network-section-arrow ${sectionOpen ? "open" : ""}`}>▴</span>
            </div>
          </button>

          {!sectionOpen ? null : isLoading ? (
            <Spinner />
          ) : (
            <div className="friends-layout-grid">
              <div className="friends-panel">
                <button type="button" className="network-section-head" onClick={() => toggleSection("add")}>
                  <h3>Add Friend</h3>
                  <span className={`network-section-arrow ${expanded.add ? "open" : ""}`}>▴</span>
                </button>
                {expanded.add ? (
                  <form className="form friends-send-form" onSubmit={onSendRequest}>
                    <div className="form-row">
                      <label className="form-label">Add friend by email</label>
                      <input
                        type="email"
                        placeholder="friend@example.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                      />
                    </div>
                    <button type="submit" disabled={isSending || !emailInput.trim()}>
                      {isSending ? "Sending..." : "Send Request"}
                    </button>
                  </form>
                ) : null}
              </div>

              <div className="friends-panel">
                <button type="button" className="network-section-head" onClick={() => toggleSection("friends")}>
                  <h3>Friends ({friends.length})</h3>
                  <span className={`network-section-arrow ${expanded.friends ? "open" : ""}`}>▴</span>
                </button>
                {expanded.friends ? (
                  friends.length === 0 ? (
                    <div className="empty-state">No accepted friends yet.</div>
                  ) : (
                    <div className="table-wrap">
                      <table className="network-friends-table">
                        <thead>
                          <tr>
                            <th>Email</th>
                            <th>Connected At</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {friends.map((f) => (
                            <tr key={String(f.friendship_id)}>
                              <td>{String(f.friend_name || f.friend_email)}</td>
                              <td>{formatDateTimeCell(f.accepted_at ?? f.created_at ?? "-")}</td>
                              <td>
                                <button
                                  type="button"
                                  className="action-btn"
                                  onClick={() => onRemove(f.friendship_id)}
                                  disabled={busyId === f.friendship_id}
                                >
                                  {busyId === f.friendship_id ? "Please wait..." : "Remove"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : null}
              </div>

              <div className="friends-panel">
                <button type="button" className="network-section-head" onClick={() => toggleSection("incoming")}>
                  <h3>Incoming Requests ({incoming.length})</h3>
                  <span className={`network-section-arrow ${expanded.incoming ? "open" : ""}`}>▴</span>
                </button>
                {expanded.incoming ? (
                  incoming.length === 0 ? (
                    <div className="empty-state">No incoming requests.</div>
                  ) : (
                    <div className="table-wrap">
                      <table className="network-incoming-table">
                        <thead>
                          <tr>
                            <th>From</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {incoming.map((r) => (
                            <tr key={String(r.friendship_id)}>
                              <td className="network-email-cell" title={String(r.requester_name || r.requester_email)}>
                                {String(r.requester_name || r.requester_email)}
                              </td>
                              <td className="friends-actions-cell">
                                <button
                                  type="button"
                                  className="action-btn"
                                  onClick={() => onAccept(r.friendship_id)}
                                  disabled={busyId === r.friendship_id}
                                >
                                  {busyId === r.friendship_id ? "Please wait..." : "Accept"}
                                </button>
                                <button
                                  type="button"
                                  className="action-btn"
                                  onClick={() => onReject(r.friendship_id)}
                                  disabled={busyId === r.friendship_id}
                                >
                                  Reject
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : null}
              </div>

              <div className="friends-panel">
                <button type="button" className="network-section-head" onClick={() => toggleSection("outgoing")}>
                  <h3>Sent Requests ({outgoing.length})</h3>
                  <span className={`network-section-arrow ${expanded.outgoing ? "open" : ""}`}>▴</span>
                </button>
                {expanded.outgoing ? (
                  outgoing.length === 0 ? (
                    <div className="empty-state">No outgoing requests.</div>
                  ) : (
                    <div className="table-wrap">
                      <table className="network-outgoing-table">
                        <thead>
                          <tr>
                            <th>To</th>
                          </tr>
                        </thead>
                        <tbody>
                          {outgoing.map((r) => (
                            <tr key={String(r.friendship_id)}>
                              <td>{String(r.receiver_name || r.receiver_email)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>

      {showPrefillModal ? (
        <div className="modal-overlay" onClick={() => !isPrefillSaving && setShowPrefillModal(false)}>
          <div className="modal modal--quickadd" onClick={(e) => e.stopPropagation()}>
            <h3>Add Application</h3>
            <p className="modal-subtitle">Prefilled from {prefillFromName}. Edit anything before saving.</p>
            {prefillError ? <div className="auth-error">{prefillError}</div> : null}
            <form className="form form--quickadd" onSubmit={onCreateFromPrefill}>
              <div className="qa-left">
                <input
                  placeholder="Position *"
                  value={prefillForm.role}
                  onChange={(e) => setPrefillForm((p) => ({ ...p, role: e.target.value }))}
                  autoFocus
                />
                <div className="form-row">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    value={prefillForm.date_saved}
                    onChange={(e) => setPrefillForm((p) => ({ ...p, date_saved: e.target.value }))}
                  />
                </div>
                <input
                  placeholder="Location"
                  value={prefillForm.location_raw}
                  onChange={(e) => setPrefillForm((p) => ({ ...p, location_raw: e.target.value }))}
                />
                <div className="form-row">
                  <label className="form-label">Referral</label>
                  <select
                    value={prefillForm.referral_status}
                    onChange={(e) => setPrefillForm((p) => ({ ...p, referral_status: e.target.value }))}
                    className="form-select"
                  >
                    <option value="">—</option>
                    <option value="Requested">Requested</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <textarea
                  placeholder="Notes"
                  rows={2}
                  value={prefillForm.notes}
                  onChange={(e) => setPrefillForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <div className="qa-right">
                <input
                  placeholder="Company *"
                  value={prefillForm.company}
                  onChange={(e) => setPrefillForm((p) => ({ ...p, company: e.target.value }))}
                />
                <input
                  placeholder="Job link (URL)"
                  type="url"
                  value={prefillForm.job_link}
                  onChange={(e) => setPrefillForm((p) => ({ ...p, job_link: e.target.value }))}
                />
                <div className="form-row">
                  <label className="form-label">Keyword Matching</label>
                  <select
                    value={prefillForm.keyword_matching}
                    onChange={(e) => setPrefillForm((p) => ({ ...p, keyword_matching: e.target.value }))}
                    className="form-select"
                  >
                    <option value="Strong">Strong</option>
                    <option value="Medium">Medium</option>
                    <option value="Weak">Weak</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="action-btn" onClick={() => !isPrefillSaving && setShowPrefillModal(false)} disabled={isPrefillSaving}>
                  Cancel
                </button>
                <button type="submit" disabled={isPrefillSaving || !prefillForm.company.trim() || !prefillForm.role.trim()}>
                  {isPrefillSaving ? "Saving..." : "Add Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
