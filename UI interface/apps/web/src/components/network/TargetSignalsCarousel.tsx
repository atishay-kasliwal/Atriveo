import { useMemo, useState } from "react";
import type { NetworkTodayFriend } from "../../lib/api";
import { TOP_TARGET_COMPANIES, TOP_TARGET_COMPANY_ALIASES } from "../../lib/topTargetCompanies";
import {
  formatAppliedAt,
  friendlyTimeAgo,
  logoInitials,
  normalizeCompanyName,
  normalizeDisplayValue,
  resolveCompanyLogo,
  toPrefillValue,
} from "./targetSignalsUtils";

type TargetSignalsCarouselProps = {
  todayData: NetworkTodayFriend[];
  useDemoFallback?: boolean;
  onAddApplication?: (args: {
    friendName: string;
    job: {
      company: string | null;
      role: string | null;
      date_saved: string | null;
      applied_at: string | null;
      job_link: string | null;
      job_application_id: string | null;
      oa_deadline_date: string | null;
      oa_status: string | null;
      referral_status: string | null;
      application_status: string | null;
      notes: string | null;
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
  jobApplicationId: string;
  oaStatus: string;
  oaDeadline: string;
  referralStatus: string;
  notes: string;
};

type RecentApplication = {
  role: string;
  appliedBy: string;
  link: string;
  dateIso: string;
  jobApplicationId: string;
  oaStatus: string;
  oaDeadline: string;
  referralStatus: string;
  notes: string;
};

type SignalCard = {
  company: string;
  friendsApplied: number;
  totalApplications: number;
  latestRole: string;
  latestAppliedAt: string;
  previewFriends: string[];
  recentApplications: RecentApplication[];
};

export default function TargetSignalsCarousel({
  todayData,
  useDemoFallback = false,
  onAddApplication,
}: TargetSignalsCarouselProps) {
  const [searchQuery, setSearchQuery] = useState("");

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
        if (!job.can_view_company || !job.can_view_role || !job.can_view_applied_at) return;
        const companyRaw = String(job.company ?? "").trim();
        if (!companyRaw) return;
        const canonical = canonicalByNormalized.get(normalizeCompanyName(companyRaw));
        if (!canonical) return;

        realEvents.push({
          company: canonical,
          role: normalizeDisplayValue(job.role, "Not specified"),
          friendLabel,
          friendId,
          dateIso: String(job.applied_at || job.date_saved || new Date().toISOString()),
          link: String(job.job_link || ""),
          jobApplicationId: job.can_view_job_application_id
            ? normalizeDisplayValue(job.job_application_id, "-")
            : "Not shared",
          oaStatus: job.can_view_oa_status
            ? normalizeDisplayValue(job.oa_status, "-")
            : "Not shared",
          oaDeadline: job.can_view_oa_deadline
            ? normalizeDisplayValue(job.oa_deadline_date, "-")
            : "Not shared",
          referralStatus: job.can_view_referral_used
            ? normalizeDisplayValue(job.referral_status, "-")
            : "Not shared",
          notes: job.can_view_notes
            ? normalizeDisplayValue(job.notes, "-")
            : "Not shared",
        });
      });
    });

    const friendPool = todayData
      .map((friend) => ({
        id: Number(friend.friend_id ?? 0),
        label: String(friend.friend_name || friend.friend_email || "Friend"),
      }))
      .filter((friend) => friend.label);

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
          const dayOffset = (companyIdx + i) % 7;
          const deadline = new Date(now + dayOffset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          demoEvents.push({
            company: entry.name,
            role,
            friendLabel: person.label,
            friendId: person.id || index + i + 1,
            dateIso: new Date(now - minutesAgo * 60 * 1000).toISOString(),
            link: `https://careers.example.com/${encodeURIComponent(entry.name.toLowerCase())}/${(index + i + 101).toString(36)}`,
            jobApplicationId: `DEMO-${(index + i + 1001).toString(36).toUpperCase()}`,
            oaStatus: i % 2 === 0 ? "Yes" : "No",
            oaDeadline: i % 3 === 0 ? deadline : "-",
            referralStatus: i % 2 === 0 ? "Requested" : "No",
            notes: i % 2 === 0 ? "Strong profile match." : "-",
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
        .map((event) => ({
          role: event.role,
          appliedBy: event.friendLabel,
          link: event.link,
          dateIso: event.dateIso,
          jobApplicationId: event.jobApplicationId,
          oaStatus: event.oaStatus,
          oaDeadline: event.oaDeadline,
          referralStatus: event.referralStatus,
          notes: event.notes,
        })),
    }));

    const rows = rowsBase.slice();
    rows.sort((a, b) => {
      if (b.friendsApplied !== a.friendsApplied) return b.friendsApplied - a.friendsApplied;
      if (b.totalApplications !== a.totalApplications) return b.totalApplications - a.totalApplications;
      return Date.parse(b.latestAppliedAt || "") - Date.parse(a.latestAppliedAt || "");
    });

    return { cards: rows };
  }, [todayData, useDemoFallback]);

  const filteredCards = useMemo(() => {
    const query = normalizeCompanyName(searchQuery);
    if (!query) return cards;
    return cards.filter((card) => {
      const searchableValues = [
        card.company,
        card.latestRole,
        ...card.previewFriends,
        ...card.recentApplications.flatMap((app) => [
          app.role,
          app.appliedBy,
          app.jobApplicationId,
          app.oaStatus,
          app.oaDeadline,
          app.referralStatus,
          app.notes,
          app.link,
          app.dateIso,
        ]),
      ];
      return searchableValues.some((value) => normalizeCompanyName(String(value ?? "")).includes(query));
    });
  }, [cards, searchQuery]);

  const shouldScrollCards = filteredCards.length > 1;

  return (
    <section className={`target-signals${shouldScrollCards ? " has-scrollable-list" : ""}`}>
      <div className="target-signals-head">
        <div className="target-signals-head-main">
          <h3>Target Company Signals</h3>
          <p>Search and compare big companies quickly with full field previews.</p>
        </div>

        <div className="target-signals-controls" aria-label="Target company filter">
          <input
            type="search"
            className="target-signals-search"
            placeholder="Search anything"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Search target signals by any field"
          />
          <span className="target-signals-count">
            {filteredCards.length} compan{filteredCards.length === 1 ? "y" : "ies"}
            {shouldScrollCards ? " (scroll)" : ""}
          </span>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="target-signals-empty network-empty-state" role="status" aria-live="polite">
          <div className="network-empty-state-icon" aria-hidden="true">
            ◎
          </div>
          <p className="network-empty-state-title">No target company signals yet</p>
          <p className="network-empty-state-copy">No friend applications in your top target companies today.</p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="target-signals-empty network-empty-state" role="status" aria-live="polite">
          <div className="network-empty-state-icon" aria-hidden="true">
            ⌕
          </div>
          <p className="network-empty-state-title">No matching companies</p>
          <p className="network-empty-state-copy">Try a different search term.</p>
        </div>
      ) : (
        <div className={`target-signals-grid${shouldScrollCards ? " is-scrollable" : ""}`}>
          {filteredCards.map((card) => (
            <article key={card.company} className="target-signal-card">
              <div className="target-signal-title">
                <span className="target-signal-logo-wrap" aria-hidden="true">
                  {resolveCompanyLogo(card.company) ? (
                    <img
                      src={resolveCompanyLogo(card.company)}
                      alt=""
                      className="target-signal-logo"
                      loading="lazy"
                      onError={(event) => {
                        const img = event.currentTarget;
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

              <div className="target-signal-summary">
                <span className="target-signal-stat-chip">
                  <strong>{card.friendsApplied}</strong> friend{card.friendsApplied === 1 ? "" : "s"} applied
                </span>
                <span className="target-signal-stat-chip">
                  <strong>{card.totalApplications}</strong> total application{card.totalApplications === 1 ? "" : "s"}
                </span>
              </div>
              <div className="target-signal-meta-row">
                <span className="target-signal-meta-role">Last role: {card.latestRole}</span>
                <span className="target-signal-meta-context">
                  {card.latestAppliedAt ? friendlyTimeAgo(card.latestAppliedAt) : "recently"}
                  {card.previewFriends.length ? ` · ${card.previewFriends.join(" · ")}` : ""}
                </span>
              </div>

              <div className="target-signal-app-list">
                {card.recentApplications.map((app, index) => (
                  <div key={`${card.company}-${index}`} className="target-signal-app">
                    <div className="target-signal-app-head">
                      <span className="target-signal-app-index">#{index + 1}</span>
                      <strong className="target-signal-app-role" title={app.role}>{app.role}</strong>
                      <span className="target-signal-app-time">{formatAppliedAt(app.dateIso)}</span>
                    </div>

                    <div className="target-signal-app-kv-grid">
                      <span className="target-signal-app-kv-item" title={app.appliedBy}>
                        <strong>Applied by:</strong> {app.appliedBy}
                      </span>
                      <span className="target-signal-app-kv-item" title={app.jobApplicationId}>
                        <strong>Job/App ID:</strong> {app.jobApplicationId}
                      </span>
                      <span className="target-signal-app-kv-item" title={app.oaStatus}>
                        <strong>OA:</strong> {app.oaStatus}
                      </span>
                      <span className="target-signal-app-kv-item" title={app.oaDeadline}>
                        <strong>Deadline:</strong> {app.oaDeadline}
                      </span>
                      <span className="target-signal-app-kv-item" title={app.referralStatus}>
                        <strong>Referral:</strong> {app.referralStatus}
                      </span>
                      <span className="target-signal-app-kv-item target-signal-app-kv-item--full" title={app.notes}>
                        <strong>Notes:</strong> {app.notes}
                      </span>
                    </div>

                    <div className="target-signal-app-actions">
                      {app.link ? (
                        <a
                          href={app.link}
                          target="_blank"
                          rel="noreferrer"
                          className="target-signal-link-chip"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="target-signal-muted">No link</span>
                      )}

                      {onAddApplication ? (
                        <button
                          type="button"
                          className="action-btn target-signal-add-btn"
                          onClick={() =>
                            onAddApplication({
                              friendName: app.appliedBy,
                              job: {
                                company: card.company,
                                role: app.role,
                                date_saved: app.dateIso,
                                applied_at: app.dateIso,
                                job_link: app.link || null,
                                job_application_id: toPrefillValue(app.jobApplicationId),
                                oa_deadline_date: toPrefillValue(app.oaDeadline),
                                oa_status: toPrefillValue(app.oaStatus),
                                referral_status: toPrefillValue(app.referralStatus),
                                application_status: null,
                                notes: toPrefillValue(app.notes),
                              },
                            })
                          }
                        >
                          Add Application
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
