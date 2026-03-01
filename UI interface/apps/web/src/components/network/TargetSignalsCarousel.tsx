import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { NetworkTodayFriend } from "../../lib/api";
import { TOP_TARGET_COMPANIES, TOP_TARGET_COMPANY_ALIASES, TOP_TARGET_COMPANY_LOGOS } from "../../lib/topTargetCompanies";

type TargetSignalsCarouselProps = {
  todayData: NetworkTodayFriend[];
  useDemoFallback?: boolean;
  onAddApplication?: (args: {
    friendName: string;
    job: {
      company: string | null;
      role: string | null;
      date_saved: string | null;
      job_link: string | null;
      job_application_id: string | null;
      oa_deadline_date: string | null;
      oa_status: string | null;
      referral_status: string | null;
      application_status: string | null;
    };
  }) => void;
};

type SignalEvent = {
  company: string;
  role: string;
  friendLabel: string;
  friendId: number;
  dateIso: string;
  link: string;
};

type SignalCard = {
  company: string;
  friendsApplied: number;
  totalApplications: number;
  latestRole: string;
  latestAppliedAt: string;
  previewFriends: string[];
  recentApplications: Array<{
    role: string;
    appliedBy: string;
    link: string;
    dateIso: string;
  }>;
};

function normalizeCompanyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function friendlyTimeAgo(isoLike: string): string {
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

function formatAppliedAt(isoLike: string): string {
  const ts = Date.parse(isoLike);
  if (Number.isNaN(ts)) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSlidesPerPage(width: number): number {
  if (width >= 1280) return 5;
  if (width >= 1080) return 4;
  if (width >= 900) return 3;
  if (width >= 640) return 2;
  return 1;
}

function logoInitials(company: string): string {
  const parts = String(company || "")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function resolveCompanyLogo(company: string): string {
  const raw = String(TOP_TARGET_COMPANY_LOGOS[company] || "").trim();
  if (!raw) return "";
  const clearbit = /^https:\/\/logo\.clearbit\.com\/(.+)$/i.exec(raw);
  if (clearbit?.[1]) {
    const domain = clearbit[1].replace(/\/+$/, "");
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  }
  return raw;
}

export default function TargetSignalsCarousel({ todayData, useDemoFallback = false, onAddApplication }: TargetSignalsCarouselProps) {
  const [viewportWidth, setViewportWidth] = useState<number>(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  const [page, setPage] = useState(0);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  useEffect(() => {
    function onResize() {
      setViewportWidth(window.innerWidth);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { cards } = useMemo(() => {
    const canonicalByNormalized = new Map<string, string>();
    TOP_TARGET_COMPANIES.forEach((name) => {
      canonicalByNormalized.set(normalizeCompanyName(name), name);
    });
    Object.entries(TOP_TARGET_COMPANY_ALIASES).forEach(([alias, canonical]) => {
      canonicalByNormalized.set(normalizeCompanyName(alias), canonical);
    });

    const realEvents: SignalEvent[] = [];
    todayData.forEach((friend) => {
      const friendId = Number(friend.friend_id ?? 0);
      const friendLabel = String(friend.friend_name || friend.friend_email || "Friend");
      friend.jobs.forEach((job) => {
        const companyRaw = String(job.company ?? "").trim();
        if (!companyRaw) return;
        const canonical = canonicalByNormalized.get(normalizeCompanyName(companyRaw));
        if (!canonical) return;
        realEvents.push({
          company: canonical,
          role: String(job.role || "Not specified"),
          friendLabel,
          friendId,
          dateIso: String(job.date_saved || new Date().toISOString()),
          link: String(job.job_link || ""),
        });
      });
    });

    const friendPool = todayData
      .map((f) => ({
        id: Number(f.friend_id ?? 0),
        label: String(f.friend_name || f.friend_email || "Friend"),
      }))
      .filter((f) => f.label);

    const demoEvents: SignalEvent[] = [];
    if (useDemoFallback && realEvents.length === 0 && friendPool.length > 0) {
      const demoCompanies = [
        { name: "Google", count: 6 },
        { name: "Amazon", count: 5 },
        { name: "Meta", count: 5 },
        { name: "Microsoft", count: 4 },
        { name: "Apple", count: 4 },
        { name: "Netflix", count: 3 },
        { name: "NVIDIA", count: 3 },
        { name: "Databricks", count: 3 },
        { name: "Stripe", count: 3 },
        { name: "Uber", count: 2 },
      ];
      const demoRoles = [
        "Software Engineer",
        "Frontend Engineer",
        "Backend Engineer",
        "Machine Learning Engineer",
        "Data Scientist",
        "Product Manager",
        "Platform Engineer",
      ];
      const now = Date.now();
      let index = 0;
      demoCompanies.forEach((entry, companyIdx) => {
        for (let i = 0; i < entry.count; i += 1) {
          const person = friendPool[(index + i + companyIdx) % friendPool.length];
          const role = demoRoles[(index + i * 2) % demoRoles.length];
          const minutesAgo = companyIdx * 34 + i * 19 + 6;
          demoEvents.push({
            company: entry.name,
            role,
            friendLabel: person.label,
            friendId: person.id || index + i + 1,
            dateIso: new Date(now - minutesAgo * 60 * 1000).toISOString(),
            link: `https://careers.example.com/${encodeURIComponent(entry.name.toLowerCase())}/${(index + i + 101).toString(36)}`,
          });
        }
        index += entry.count;
      });
    }

    const events = realEvents.length ? realEvents : demoEvents;

    const grouped = new Map<
      string,
      {
        company: string;
        friendIds: Set<number>;
        total: number;
        latestTs: number;
        latestRole: string;
        previewFriends: string[];
        events: SignalEvent[];
      }
    >();

    events.forEach((event) => {
      const canonical = canonicalByNormalized.get(normalizeCompanyName(event.company));
      if (!canonical) return;

      const current = grouped.get(canonical) ?? {
        company: canonical,
        friendIds: new Set<number>(),
        total: 0,
        latestTs: 0,
        latestRole: "Not specified",
        previewFriends: [],
        events: [],
      };

      current.total += 1;
      if (event.friendId > 0) current.friendIds.add(event.friendId);
      if (!current.previewFriends.includes(event.friendLabel) && current.previewFriends.length < 3) {
        current.previewFriends.push(event.friendLabel);
      }

      const ts = Date.parse(String(event.dateIso || ""));
      if (!Number.isNaN(ts) && ts >= current.latestTs) {
        current.latestTs = ts;
        current.latestRole = String(event.role || "Not specified");
      }

      current.events.push(event);
      grouped.set(canonical, current);
    });

    const rowsBase: SignalCard[] = Array.from(grouped.values()).map((row) => ({
        company: row.company,
        friendsApplied: row.friendIds.size,
        totalApplications: row.total,
        latestRole: row.latestRole,
        latestAppliedAt: row.latestTs > 0 ? new Date(row.latestTs).toISOString() : "",
        previewFriends: row.previewFriends,
        recentApplications: row.events
          .slice()
          .sort((a, b) => Date.parse(b.dateIso || "") - Date.parse(a.dateIso || ""))
          .slice(0, 2)
          .map((e) => ({
            role: e.role,
            appliedBy: e.friendLabel,
            link: e.link,
            dateIso: e.dateIso,
          })),
      }));

    const rows = rowsBase.slice();
    rows.sort((a, b) => {
      if (b.friendsApplied !== a.friendsApplied) return b.friendsApplied - a.friendsApplied;
      if (b.totalApplications !== a.totalApplications) return b.totalApplications - a.totalApplications;
      return Date.parse(b.latestAppliedAt || "") - Date.parse(a.latestAppliedAt || "");
    });

    return {
      cards: rows,
    };
  }, [todayData, useDemoFallback]);

  const perPage = getSlidesPerPage(viewportWidth);
  const totalPages = Math.max(1, Math.ceil(cards.length / perPage));

  useEffect(() => {
    setPage((prev) => Math.max(0, Math.min(prev, totalPages - 1)));
  }, [totalPages]);

  useEffect(() => {
    if (!cards.length) {
      setSelectedCompany(null);
      return;
    }
    if (!selectedCompany || !cards.some((c) => c.company === selectedCompany)) {
      setSelectedCompany(cards[0].company);
    }
  }, [cards, selectedCompany]);

  const pageCards = useMemo(() => {
    const start = page * perPage;
    return cards.slice(start, start + perPage);
  }, [cards, page, perPage]);

  const selectedCard = useMemo(() => cards.find((c) => c.company === selectedCompany) ?? null, [cards, selectedCompany]);

  return (
    <section className="target-signals">
      <div className="target-signals-head">
        <div>
          <h3>Target Company Signals</h3>
        </div>
        <div className="target-signals-controls">
          <span className="target-signals-page">{cards.length === 0 ? "0 / 0" : `${page + 1} / ${totalPages}`}</span>
          <button
            type="button"
            className="target-signals-arrow"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous companies"
          >
            ‹
          </button>
          <button
            type="button"
            className="target-signals-arrow"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            aria-label="Next companies"
          >
            ›
          </button>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="target-signals-empty">No friend applications in your top target companies today.</div>
      ) : (
        <div className="target-signals-grid" style={{ "--target-cols": perPage } as CSSProperties}>
          {pageCards.map((card) => (
            <article
              key={card.company}
              className={`target-signal-card${selectedCompany === card.company ? " is-selected" : ""}`}
              onClick={() => setSelectedCompany((prev) => (prev === card.company ? null : card.company))}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedCompany((prev) => (prev === card.company ? null : card.company));
                }
              }}
            >
              <div className="target-signal-title">
                <span className="target-signal-logo-wrap" aria-hidden="true">
                  {resolveCompanyLogo(card.company) ? (
                    <img
                      src={resolveCompanyLogo(card.company)}
                      alt=""
                      className="target-signal-logo"
                      loading="lazy"
                      onError={(e) => {
                        const img = e.currentTarget;
                        img.style.display = "none";
                        const fallback = img.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = "grid";
                      }}
                    />
                  ) : null}
                  <span
                    className="target-signal-logo-fallback"
                    style={{ display: resolveCompanyLogo(card.company) ? "none" : "grid" }}
                  >
                    {logoInitials(card.company)}
                  </span>
                </span>
                <span>{card.company}</span>
              </div>
              <div className="target-signal-stats">
                <strong>{card.friendsApplied}</strong> friend{card.friendsApplied === 1 ? "" : "s"} applied
              </div>
              <div className="target-signal-stats">
                <strong>{card.totalApplications}</strong> total application{card.totalApplications === 1 ? "" : "s"}
              </div>
              <div className="target-signal-meta">Last role: {card.latestRole}</div>
              <div className="target-signal-foot">
                <span>{card.latestAppliedAt ? friendlyTimeAgo(card.latestAppliedAt) : "recently"}</span>
                <span className="target-signal-friends">{card.previewFriends.join(" · ")}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedCard ? (
        <div className="target-signals-detail">
          <div className="target-signals-detail-head">
            <strong>{selectedCard.company}</strong>
            <span>Latest 2 applications</span>
          </div>
          <div className="table-wrap">
            <table className="target-signals-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Applied By</th>
                  <th>Applied Time</th>
                  <th>Link</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {selectedCard.recentApplications.map((app, idx) => (
                  <tr key={`${selectedCard.company}-app-${idx}`}>
                    <td>{app.role}</td>
                    <td>{app.appliedBy}</td>
                    <td>{formatAppliedAt(app.dateIso)}</td>
                    <td>
                      {app.link ? (
                        <a href={app.link} target="_blank" rel="noreferrer" className="table-link" onClick={(e) => e.stopPropagation()}>
                          Open
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddApplication?.({
                            friendName: app.appliedBy,
                            job: {
                              company: selectedCard.company,
                              role: app.role,
                              date_saved: app.dateIso,
                              job_link: app.link || null,
                              job_application_id: null,
                              oa_deadline_date: null,
                              oa_status: null,
                              referral_status: null,
                              application_status: null,
                            },
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
      ) : null}
    </section>
  );
}
