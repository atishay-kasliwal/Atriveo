import { useEffect, useRef, useState } from "react";
import {
  getProfile,
  updateProfile,
  exportJobsCsv,
  type UpdateProfileInput,
  type UserProfile,
} from "../lib/api";

const EXPERIENCE_LEVELS = ["Intern", "New Grad", "1–3 yrs", "3–6 yrs", "6+ yrs"];
const LOCATION_OPTIONS = ["Remote", "Hybrid", "On-site", "Open to relocation"];

const ROLE_OPTIONS: { group: string; roles: string[] }[] = [
  { group: "Engineering", roles: ["Software Engineer", "Backend Engineer", "Frontend Engineer", "Full Stack Engineer", "Mobile Engineer", "DevOps / Platform", "Site Reliability Engineer", "Embedded Engineer"] },
  { group: "AI / Data", roles: ["ML Engineer", "AI Research Scientist", "Data Scientist", "Data Analyst", "Data Engineer", "MLOps Engineer", "Computer Vision Engineer", "NLP Engineer"] },
  { group: "Product & Design", roles: ["Product Manager", "Technical Program Manager", "UX Designer", "Product Designer", "UX Researcher"] },
  { group: "Business & Finance", roles: ["Business Analyst", "Strategy & Operations", "Investment Banking Analyst", "Quant Analyst", "Consulting Analyst", "Financial Analyst"] },
  { group: "Other", roles: ["Sales Engineer", "Solutions Engineer", "Developer Relations", "Security Engineer", "QA / Test Engineer"] },
];

const NAV_GROUPS = [
  { label: "Account", items: [{ key: "profile", label: "My Profile" }] },
  { label: "Preferences", items: [
    { key: "preferences", label: "Job Preferences" },
    { key: "notifications", label: "Notifications" },
  ]},
  { label: "Security & Privacy", items: [
    { key: "privacy", label: "Privacy" },
    { key: "integrations", label: "Integrations" },
  ]},
  { label: "Data", items: [
    { key: "data", label: "Data & Export" },
    { key: "danger", label: "Danger Zone", danger: true },
  ]},
];

function calcStrength(f: {
  firstName: string; lastName: string; bio: string; university: string;
  gradYear: string; targetRoles: string[];
  experienceLevel: string; locationPref: string;
}): { pct: number; missing: { label: string; key: string }[] } {
  const checks = [
    { label: "Add your first & last name", filled: !!(f.firstName && f.lastName), key: "profile", w: 20 },
    { label: "Write a bio", filled: !!f.bio, key: "profile", w: 20 },
    { label: "Add your university", filled: !!f.university, key: "profile", w: 15 },
    { label: "Set experience level", filled: !!f.experienceLevel, key: "preferences", w: 20 },
    { label: "Set location preference", filled: !!f.locationPref, key: "preferences", w: 10 },
    { label: "Choose target roles", filled: f.targetRoles.length > 0, key: "preferences", w: 15 },
  ];
  const total = checks.reduce((s, c) => s + c.w, 0);
  const earned = checks.filter((c) => c.filled).reduce((s, c) => s + c.w, 0);
  return {
    pct: Math.round((earned / total) * 100),
    missing: checks.filter((c) => !c.filled).map((c) => ({ label: c.label, key: c.key })),
  };
}

function getInitials(first: string, last: string, email: string): string {
  if (first && last) return (first[0] + last[0]).toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);
  function add(v: string) { const t = v.trim(); if (!t || tags.includes(t)) return; onChange([...tags, t]); setInput(""); }
  function remove(t: string) { onChange(tags.filter((x) => x !== t)); }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input); }
    else if (e.key === "Backspace" && input === "" && tags.length > 0) onChange(tags.slice(0, -1));
  }
  return (
    <div>
      <div className="as-tag-input-wrap" onClick={() => ref.current?.focus()}>
        {tags.map((tag) => (
          <span key={tag} className="as-tag-chip">
            {tag}
            <button type="button" className="as-tag-chip-remove" onClick={(e) => { e.stopPropagation(); remove(tag); }}>×</button>
          </span>
        ))}
        <input ref={ref} className="as-tag-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} onBlur={() => { if (input.trim()) add(input); }} placeholder={tags.length === 0 ? placeholder : ""} />
      </div>
      <p className="as-field-hint">Press Enter or comma to add</p>
    </div>
  );
}

function PillGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="as-pill-group">
      {options.map((opt) => (
        <button key={opt} type="button" className={`as-pill-btn${value === opt ? " is-active" : ""}`} onClick={() => onChange(value === opt ? "" : opt)}>{opt}</button>
      ))}
    </div>
  );
}

function RoleSelect({ selected, onChange }: { selected: string[]; onChange: (r: string[]) => void }) {
  function toggle(role: string) { onChange(selected.includes(role) ? selected.filter((r) => r !== role) : [...selected, role]); }
  return (
    <div className="as-role-select">
      {ROLE_OPTIONS.map((g) => (
        <div key={g.group} className="as-role-group">
          <p className="as-role-group-label">{g.group}</p>
          <div className="as-role-chips">
            {g.roles.map((role) => {
              const active = selected.includes(role);
              return (
                <button key={role} type="button" className={`as-role-chip${active ? " is-selected" : ""}`} onClick={() => toggle(role)}>
                  {active && <span className="as-role-chip-check">✓</span>}{role}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="as-info-row">
      <p className="as-info-label">{label}</p>
      <p className="as-info-value">{value || <span className="as-info-empty">Not set</span>}</p>
    </div>
  );
}

function SuggestionBox({ icon, text, action, onAction }: { icon: string; text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="as-suggestion">
      <span className="as-suggestion-icon">{icon}</span>
      <p className="as-suggestion-text">{text}</p>
      {action && <button type="button" className="as-suggestion-action" onClick={onAction}>{action}</button>}
    </div>
  );
}

function InsightBox({ text }: { text: string }) {
  return (
    <div className="as-insight">
      <span className="as-insight-icon">💡</span>
      <p className="as-insight-text">{text}</p>
    </div>
  );
}

function ComingSoonBadge() {
  return <span className="as-coming-soon">Coming soon</span>;
}

function CardActions({ saving, saveState, onCancel, onSave }: { saving: boolean; saveState: "idle" | "success" | "error"; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="as-card-actions">
      {saveState === "success" && <span className="as-save-status is-success">✓ Saved</span>}
      {saveState === "error" && <span className="as-save-status is-error">Failed — try again</span>}
      <button type="button" className="as-btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
      <button type="button" className="as-btn-primary" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
    </div>
  );
}

export default function ProfilePage() {
  const [_profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [university, setUniversity] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [targetCompanies, setTargetCompanies] = useState<string[]>([]);
  const [locationPref, setLocationPref] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [shareApplications, setShareApplications] = useState(true);

  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editUniversity, setEditUniversity] = useState("");
  const [editGradYear, setEditGradYear] = useState("");
  const [editExpLevel, setEditExpLevel] = useState("");
  const [editLocationPref, setEditLocationPref] = useState("");
  const [editTargetRoles, setEditTargetRoles] = useState<string[]>([]);
  const [editTargetCompanies, setEditTargetCompanies] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [cardSaving, setCardSaving] = useState(false);
  const [cardSaveState, setCardSaveState] = useState<"idle" | "success" | "error">("idle");
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [activeNav, setActiveNav] = useState("profile");

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("dashboard_auth_session");
      if (raw) {
        const parsed = JSON.parse(raw) as { user?: { email?: string; first_name?: string; last_name?: string } };
        setEmail(parsed.user?.email ?? "");
        setFirstName(parsed.user?.first_name ?? "");
        setLastName(parsed.user?.last_name ?? "");
      }
    } catch { /* ignore */ }
    getProfile()
      .then(({ profile: p }) => {
        setProfile(p);
        setBio(p.bio ?? "");
        setUniversity(p.university ?? "");
        setGradYear(p.grad_year ? String(p.grad_year) : "");
        setTargetRoles(p.target_roles);
        setTargetCompanies(p.target_companies);
        setLocationPref(p.location_pref ?? "");
        setExperienceLevel(p.experience_level ?? "");
        setShareApplications(p.share_applications);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveNav(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [loading]);

  function scrollTo(key: string) {
    sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startEdit(card: string) {
    setEditFirst(firstName); setEditLast(lastName); setEditBio(bio);
    setEditUniversity(university); setEditGradYear(gradYear);
    setEditExpLevel(experienceLevel); setEditLocationPref(locationPref);
    setEditTargetRoles([...targetRoles]); setEditTargetCompanies([...targetCompanies]);
    setEditingCard(card); setCardSaveState("idle");
  }

  function cancelEdit() { setEditingCard(null); setCardSaveState("idle"); }

  async function saveCard(card: string) {
    setCardSaving(true); setCardSaveState("idle");
    let data: UpdateProfileInput = {};
    if (card === "identity") data = { first_name: editFirst || undefined, last_name: editLast || undefined, bio: editBio || undefined };
    else if (card === "personal") data = { university: editUniversity || undefined, grad_year: editGradYear ? Number(editGradYear) : null };
    else if (card === "career") data = { experience_level: editExpLevel || undefined, location_pref: editLocationPref || undefined };
    else if (card === "roles") data = { target_roles: editTargetRoles };
    else if (card === "companies") data = { target_companies: editTargetCompanies };
    try {
      await updateProfile(data);
      if (card === "identity") { setFirstName(editFirst); setLastName(editLast); setBio(editBio); }
      if (card === "personal") { setUniversity(editUniversity); setGradYear(editGradYear); }
      if (card === "career") { setExperienceLevel(editExpLevel); setLocationPref(editLocationPref); }
      if (card === "roles") setTargetRoles(editTargetRoles);
      if (card === "companies") setTargetCompanies(editTargetCompanies);
      setCardSaveState("success");
      setTimeout(() => { setCardSaveState("idle"); setEditingCard(null); }, 1200);
    } catch { setCardSaveState("error"); }
    finally { setCardSaving(false); }
  }

  async function savePrivacyToggle(val: boolean) {
    setShareApplications(val);
    try { await updateProfile({ share_applications: val }); }
    catch { setShareApplications(!val); }
  }

  async function handleExport() {
    setExportLoading(true);
    try {
      const blob = await exportJobsCsv("all");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "atriveo-applications.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ } finally { setExportLoading(false); }
  }

  const initials = getInitials(firstName, lastName, email);
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || email || "Your Profile";
  const subtitle = bio || (university ? `${university}${gradYear ? ` · ${gradYear}` : ""}` : "");
  const { pct: strengthPct, missing: strengthMissing } = calcStrength({
    firstName, lastName, bio, university, gradYear, targetRoles, targetCompanies, experienceLevel, locationPref,
  });

  if (loading) {
    return <div className="as-page"><div className="spinner-wrap"><div className="spinner" /></div></div>;
  }

  return (
    <div className="as-page">
      <div className="as-layout">

        {/* ── Sidebar ── */}
        <nav className="as-sidebar">
          <div className="as-sidebar-head">
            <div className="as-sidebar-avatar">{initials}</div>
            <div className="as-sidebar-user">
              <p className="as-sidebar-name">{displayName}</p>
              <p className="as-sidebar-email">{email}</p>
            </div>
          </div>
          <div className="as-sidebar-strength">
            <div className="as-sidebar-strength-row">
              <span className="as-sidebar-strength-label">Profile strength</span>
              <span className="as-sidebar-strength-pct">{strengthPct}%</span>
            </div>
            <div className="as-strength-track">
              <div className="as-strength-fill" style={{ width: `${strengthPct}%` }} />
            </div>
          </div>
          <div className="as-nav-body">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="as-nav-group">
                <p className="as-nav-group-label">{group.label}</p>
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`as-nav-item${activeNav === item.key ? " is-active" : ""}${item.danger ? " as-nav-item--danger" : ""}`}
                    onClick={() => scrollTo(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </nav>

        {/* ── Single scrollable content ── */}
        <div className="as-content">

          {/* MY PROFILE */}
          <section id="profile" ref={(el) => { sectionRefs.current.profile = el; }} className="as-section">
            <div className="as-section-header">
              <h2 className="as-content-heading">My Profile</h2>
              <p className="as-content-sub">Your identity on the Atriveo network</p>
            </div>

            {strengthPct < 100 && (
              <div className="as-strength-card">
                <div className="as-strength-card-top">
                  <div>
                    <p className="as-strength-card-title">Complete your profile</p>
                    <p className="as-strength-card-sub">A complete profile gets better job recommendations and appears higher in the network feed.</p>
                  </div>
                  <div className="as-strength-badge" style={{ "--pct": `${strengthPct}%` } as React.CSSProperties}>
                    <span>{strengthPct}%</span>
                  </div>
                </div>
                <div className="as-strength-track as-strength-track--wide">
                  <div className="as-strength-fill" style={{ width: `${strengthPct}%` }} />
                </div>
                {strengthMissing.length > 0 && (
                  <div className="as-strength-missing">
                    {strengthMissing.slice(0, 4).map((m) => (
                      <button key={m.label} type="button" className="as-strength-item" onClick={() => scrollTo(m.key)}>
                        <span className="as-strength-item-dot" />{m.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="as-card">
              <div className="as-card-header">
                <div className="as-profile-identity">
                  <div className="as-avatar">{initials}</div>
                  <div>
                    <p className="as-identity-name">{displayName}</p>
                    {subtitle && <p className="as-identity-sub">{subtitle}</p>}
                    {(locationPref || experienceLevel) && (
                      <p className="as-identity-meta">{[experienceLevel, locationPref].filter(Boolean).join(" · ")}</p>
                    )}
                  </div>
                </div>
                {editingCard !== "identity" && <button type="button" className="as-edit-btn" onClick={() => startEdit("identity")}>Edit</button>}
              </div>
              {editingCard === "identity" && (
                <div className="as-card-edit-body">
                  <div className="as-field-grid">
                    <label className="as-field">
                      <span className="as-field-label">First name</span>
                      <input className="as-input" type="text" value={editFirst} onChange={(e) => setEditFirst(e.target.value)} placeholder="First name" maxLength={80} />
                    </label>
                    <label className="as-field">
                      <span className="as-field-label">Last name</span>
                      <input className="as-input" type="text" value={editLast} onChange={(e) => setEditLast(e.target.value)} placeholder="Last name" maxLength={80} />
                    </label>
                  </div>
                  <label className="as-field">
                    <span className="as-field-label">Bio</span>
                    <textarea className="as-input as-textarea" value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="e.g. CS grad looking for ML roles in NYC" maxLength={300} />
                  </label>
                  <CardActions saving={cardSaving} saveState={cardSaveState} onCancel={cancelEdit} onSave={() => saveCard("identity")} />
                </div>
              )}
            </div>

            <div className="as-card">
              <div className="as-card-header">
                <div>
                  <p className="as-card-title">Personal Information</p>
                  <p className="as-card-desc">Used to personalize your Atriveo experience</p>
                </div>
                {editingCard !== "personal" && <button type="button" className="as-edit-btn" onClick={() => startEdit("personal")}>Edit</button>}
              </div>
              {editingCard !== "personal" ? (
                <div className="as-info-grid">
                  <InfoRow label="First Name" value={firstName} />
                  <InfoRow label="Last Name" value={lastName} />
                  <InfoRow label="Email address" value={email} />
                  <InfoRow label="Bio" value={bio} />
                  <InfoRow label="University" value={university} />
                  <InfoRow label="Graduation Year" value={gradYear} />
                </div>
              ) : (
                <div className="as-card-edit-body">
                  <div className="as-field-grid">
                    <label className="as-field">
                      <span className="as-field-label">University</span>
                      <input className="as-input" type="text" value={editUniversity} onChange={(e) => setEditUniversity(e.target.value)} placeholder="e.g. University of Michigan" maxLength={120} />
                    </label>
                    <label className="as-field">
                      <span className="as-field-label">Graduation year</span>
                      <input className="as-input" type="number" value={editGradYear} onChange={(e) => setEditGradYear(e.target.value)} placeholder="2025" min={1990} max={2040} />
                    </label>
                  </div>
                  <label className="as-field">
                    <span className="as-field-label">Email address</span>
                    <input className="as-input" type="email" value={email} disabled />
                    <span className="as-field-hint">Email cannot be changed here</span>
                  </label>
                  <CardActions saving={cardSaving} saveState={cardSaveState} onCancel={cancelEdit} onSave={() => saveCard("personal")} />
                </div>
              )}
            </div>
          </section>

          {/* JOB PREFERENCES */}
          <section id="preferences" ref={(el) => { sectionRefs.current.preferences = el; }} className="as-section">
            <div className="as-section-header">
              <h2 className="as-content-heading">Job Preferences</h2>
              <p className="as-content-sub">Help Atriveo surface the right opportunities for you</p>
            </div>
            <InsightBox text="Users who complete their job preferences are 2.3× more likely to land interviews within 60 days." />
            <div className="as-card">
              <div className="as-card-header">
                <div>
                  <p className="as-card-title">Experience & Location</p>
                  <p className="as-card-desc">Used to rank and filter job opportunities in your feed</p>
                </div>
                {editingCard !== "career" && <button type="button" className="as-edit-btn" onClick={() => startEdit("career")}>Edit</button>}
              </div>
              {editingCard !== "career" ? (
                <div className="as-info-grid">
                  <InfoRow label="Experience level" value={experienceLevel} />
                  <InfoRow label="Location preference" value={locationPref} />
                </div>
              ) : (
                <div className="as-card-edit-body">
                  <div className="as-field">
                    <span className="as-field-label">Experience level</span>
                    <PillGroup options={EXPERIENCE_LEVELS} value={editExpLevel} onChange={setEditExpLevel} />
                  </div>
                  <div className="as-field">
                    <span className="as-field-label">Location preference</span>
                    <PillGroup options={LOCATION_OPTIONS} value={editLocationPref} onChange={setEditLocationPref} />
                  </div>
                  <CardActions saving={cardSaving} saveState={cardSaveState} onCancel={cancelEdit} onSave={() => saveCard("career")} />
                </div>
              )}
            </div>
            <div className="as-card">
              <div className="as-card-header">
                <div>
                  <p className="as-card-title">Target Roles</p>
                  <p className="as-card-desc">Select the roles you're actively pursuing</p>
                </div>
                {editingCard !== "roles" && <button type="button" className="as-edit-btn" onClick={() => startEdit("roles")}>Edit</button>}
              </div>
              {editingCard !== "roles" ? (
                <div className="as-chip-display">
                  {targetRoles.length > 0
                    ? <div className="as-chip-display-inner">{targetRoles.map((r) => <span key={r} className="as-display-chip">{r}</span>)}</div>
                    : <SuggestionBox icon="🎯" text="Select your target roles to improve job recommendations and track your focus areas." action="Add target roles" onAction={() => startEdit("roles")} />}
                </div>
              ) : (
                <div className="as-card-edit-body">
                  <RoleSelect selected={editTargetRoles} onChange={setEditTargetRoles} />
                  <CardActions saving={cardSaving} saveState={cardSaveState} onCancel={cancelEdit} onSave={() => saveCard("roles")} />
                </div>
              )}
            </div>
          </section>

          {/* NOTIFICATIONS */}
          <section id="notifications" ref={(el) => { sectionRefs.current.notifications = el; }} className="as-section">
            <div className="as-section-header">
              <h2 className="as-content-heading">Notifications</h2>
              <p className="as-content-sub">Control how and when Atriveo reaches you</p>
            </div>
            <div className="as-card">
              <div className="as-card-header">
                <div>
                  <p className="as-card-title">Activity & Reminders</p>
                  <p className="as-card-desc">Stay on track with your application goals</p>
                </div>
                <ComingSoonBadge />
              </div>
              <div className="as-toggle-list">
                {[
                  { label: "Daily application reminder", desc: "Get nudged if you haven't logged any applications by 6pm." },
                  { label: "Weekly progress summary", desc: "A digest of your week — apps sent, interviews booked, trends." },
                  { label: "Follow-up reminders", desc: "Remind you to follow up on applications after 7 days of silence." },
                  { label: "Friend activity notifications", desc: "See when friends hit milestones or break application streaks." },
                ].map((n) => (
                  <div key={n.label} className="as-toggle-row as-toggle-row--disabled">
                    <div>
                      <p className="as-toggle-label">{n.label}</p>
                      <p className="as-toggle-desc">{n.desc}</p>
                    </div>
                    <div className="as-toggle as-toggle--disabled"><input type="checkbox" disabled /><span className="as-toggle-track" /></div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* PRIVACY */}
          <section id="privacy" ref={(el) => { sectionRefs.current.privacy = el; }} className="as-section">
            <div className="as-section-header">
              <h2 className="as-content-heading">Privacy</h2>
              <p className="as-content-sub">Control what your network can see</p>
            </div>
            <div className="as-card">
              <div className="as-card-header">
                <p className="as-card-title">Sharing & Visibility</p>
              </div>
              <div className="as-toggle-list">
                <div className="as-toggle-row">
                  <div>
                    <p className="as-toggle-label">Share my applications with friends</p>
                    <p className="as-toggle-desc">Friends can see your daily application count and company names in the network feed.</p>
                  </div>
                  <label className="as-toggle">
                    <input type="checkbox" checked={shareApplications} onChange={(e) => savePrivacyToggle(e.target.checked)} />
                    <span className="as-toggle-track" />
                  </label>
                </div>
                <div className="as-toggle-row as-toggle-row--disabled">
                  <div>
                    <p className="as-toggle-label">Show on network leaderboard <ComingSoonBadge /></p>
                    <p className="as-toggle-desc">Appear in the weekly application leaderboard visible to your friend group.</p>
                  </div>
                  <div className="as-toggle as-toggle--disabled"><input type="checkbox" disabled /><span className="as-toggle-track" /></div>
                </div>
                <div className="as-toggle-row as-toggle-row--disabled">
                  <div>
                    <p className="as-toggle-label">Anonymous mode <ComingSoonBadge /></p>
                    <p className="as-toggle-desc">Hide your name and show only a username in all network views.</p>
                  </div>
                  <div className="as-toggle as-toggle--disabled"><input type="checkbox" disabled /><span className="as-toggle-track" /></div>
                </div>
              </div>
            </div>
          </section>

          {/* INTEGRATIONS */}
          <section id="integrations" ref={(el) => { sectionRefs.current.integrations = el; }} className="as-section">
            <div className="as-section-header">
              <h2 className="as-content-heading">Integrations</h2>
              <p className="as-content-sub">Connect your tools and supercharge your job search workflow</p>
            </div>
            <div className="as-integration-grid">
              {[
                { icon: "📅", name: "Google Calendar", desc: "Sync interview deadlines and follow-up reminders to your calendar." },
                { icon: "📧", name: "Gmail", desc: "Auto-import job applications from your inbox. Never manually log again." },
                { icon: "💼", name: "LinkedIn", desc: "Track jobs you save on LinkedIn directly in your Atriveo dashboard." },
                { icon: "📄", name: "Notion", desc: "Export your job tracker data to a Notion database in one click." },
                { icon: "📊", name: "Google Sheets", desc: "Live-sync your applications to a Google Sheet for custom analysis." },
                { icon: "🔔", name: "Slack", desc: "Get daily Atriveo digests and alerts delivered to a Slack channel." },
              ].map((intg) => (
                <div key={intg.name} className="as-integration-card">
                  <div className="as-integration-icon">{intg.icon}</div>
                  <div className="as-integration-body">
                    <p className="as-integration-name">{intg.name}</p>
                    <p className="as-integration-desc">{intg.desc}</p>
                  </div>
                  <div className="as-integration-right">
                    <ComingSoonBadge />
                    <button type="button" className="as-integration-btn" disabled>Connect</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* DATA & EXPORT */}
          <section id="data" ref={(el) => { sectionRefs.current.data = el; }} className="as-section">
            <div className="as-section-header">
              <h2 className="as-content-heading">Data & Export</h2>
              <p className="as-content-sub">Your data belongs to you — always portable, always transparent</p>
            </div>
            <div className="as-card">
              <div className="as-card-header">
                <div>
                  <p className="as-card-title">Export Applications</p>
                  <p className="as-card-desc">Download all your job applications as a CSV file</p>
                </div>
              </div>
              <div className="as-data-row">
                <div className="as-data-row-info">
                  <p className="as-data-label">All applications (CSV)</p>
                  <p className="as-data-desc">Company, role, status, dates, notes — everything you've tracked.</p>
                </div>
                <button type="button" className="as-btn-secondary" onClick={handleExport} disabled={exportLoading}>
                  {exportLoading ? "Exporting…" : "Download CSV"}
                </button>
              </div>
              <div className="as-data-row as-data-row--disabled">
                <div className="as-data-row-info">
                  <p className="as-data-label">Analytics report (PDF) <ComingSoonBadge /></p>
                  <p className="as-data-desc">Application trends, response rates, company analysis, interview funnel.</p>
                </div>
                <button type="button" className="as-btn-secondary" disabled>Download PDF</button>
              </div>
            </div>
          </section>

          {/* DANGER ZONE */}
          <section id="danger" ref={(el) => { sectionRefs.current.danger = el; }} className="as-section">
            <div className="as-section-header">
              <h2 className="as-content-heading as-content-heading--danger">Danger Zone</h2>
              <p className="as-content-sub">Irreversible actions — proceed with caution</p>
            </div>
            <div className="as-card as-card--danger">
              <div className="as-card-header">
                <div>
                  <p className="as-card-title as-card-title--danger">Delete Account</p>
                  <p className="as-card-desc">Permanently delete your account and all associated data. This cannot be undone.</p>
                </div>
              </div>
              <div className="as-danger-body">
                <div className="as-danger-warning">
                  <span className="as-danger-warning-icon">⚠️</span>
                  <div>
                    <p className="as-danger-warning-title">This will permanently delete:</p>
                    <ul className="as-danger-list">
                      <li>All job applications and tracking history</li>
                      <li>Your profile and preferences</li>
                      <li>All network connections and friend data</li>
                      <li>Analytics, streaks, and all activity</li>
                    </ul>
                  </div>
                </div>
                {!deleteConfirm ? (
                  <button type="button" className="as-btn-danger" onClick={() => setDeleteConfirm(true)}>Delete my account</button>
                ) : (
                  <div className="as-delete-confirm">
                    <p className="as-delete-confirm-text">Are you absolutely sure? This action cannot be reversed.</p>
                    <div className="as-delete-confirm-actions">
                      <button type="button" className="as-btn-ghost" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                      <button type="button" className="as-btn-danger">Yes, delete everything</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
