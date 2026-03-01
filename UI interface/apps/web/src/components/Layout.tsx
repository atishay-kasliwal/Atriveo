import { useState, useEffect, useRef } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import {
  acceptFriendRequest,
  blockFriendship,
  createJob,
  createReferral,
  createPending,
  createNote,
  exportJobsCsv,
  getFriendRequests,
  getFriends,
  importJobsCsv,
  rejectFriendRequest,
  sendFriendRequest,
  type FriendRecord,
  type IncomingFriendRequest,
  type JobsCsvExportRange,
  type OutgoingFriendRequest,
} from "../lib/api";
import { getLocalISODate } from "../lib/formatDate";

type LayoutProps = {
  userEmail: string;
  onLogout: () => void;
};

const emptyJobForm = {
  role: "Software Engineer",
  company: "",
  location_raw: "United States of America",
  job_link: "",
  keyword_matching: "Medium",
  referral_status: "No",
  notes: "",
  date_saved: getLocalISODate(),
};

const emptyPendingForm = {
  company: "",
  position_name: "",
  pending_date: getLocalISODate(),
  end_date: "",
  comment: "",
  link: "",
};

function getLocalISODatePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return getLocalISODate(d);
}

const emptyNoteForm = {
  title: "",
  currentDate: getLocalISODate(),
  lastDate: getLocalISODatePlusDays(7),
  priority: "High",
  show_on_dashboard: "Yes",
  note: "",
};

export default function Layout({ userEmail, onLogout }: LayoutProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showPendingTask, setShowPendingTask] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showCsvTools, setShowCsvTools] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [csvMode, setCsvMode] = useState<"import" | "export">("import");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRange, setCsvRange] = useState<JobsCsvExportRange>("30");
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState("");
  const [csvSuccess, setCsvSuccess] = useState("");
  const [friendEmail, setFriendEmail] = useState("");
  const [friendBusy, setFriendBusy] = useState(false);
  const [friendBusyId, setFriendBusyId] = useState<number | string | null>(null);
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendError, setFriendError] = useState("");
  const [friendSuccess, setFriendSuccess] = useState("");
  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [incoming, setIncoming] = useState<IncomingFriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingFriendRequest[]>([]);
  const [maxFriends, setMaxFriends] = useState(10);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [form, setForm] = useState(emptyJobForm);
  const [pendingForm, setPendingForm] = useState(emptyPendingForm);
  const [noteForm, setNoteForm] = useState(emptyNoteForm);
  const csvToolsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showQuickAdd && !showPendingTask && !showNoteModal) setModalError("");
  }, [showQuickAdd, showPendingTask, showNoteModal]);

  useEffect(() => {
    if (!showCsvTools) return;
    function onDocumentClick(e: MouseEvent) {
      const target = e.target as Node | null;
      if (csvToolsRef.current && target && !csvToolsRef.current.contains(target)) {
        setShowCsvTools(false);
      }
    }
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, [showCsvTools]);

  useEffect(() => {
    function onOpenFriendManager() {
      openFriendModal();
    }
    window.addEventListener("open-friend-manager", onOpenFriendManager);
    return () => window.removeEventListener("open-friend-manager", onOpenFriendManager);
  }, []);

  useEffect(() => {
    if (!showFriendModal) return;
    void loadFriendManager();
  }, [showFriendModal]);

  async function loadFriendManager() {
    try {
      setFriendLoading(true);
      setFriendError("");
      const [friendsRes, reqRes] = await Promise.all([getFriends(), getFriendRequests()]);
      setFriends(friendsRes.data ?? []);
      setMaxFriends(Number(friendsRes.maxFriends ?? 10));
      setIncoming(reqRes.incoming ?? []);
      setOutgoing(reqRes.outgoing ?? []);
    } catch (err) {
      setFriendError((err as Error).message);
    } finally {
      setFriendLoading(false);
    }
  }

  function formatDateTimeCell(value: unknown) {
    if (value == null || value === "") return "—";
    const raw = String(value);
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    return parsed.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function openCsvModal(mode: "import" | "export") {
    setCsvMode(mode);
    setCsvError("");
    setCsvSuccess("");
    setShowCsvTools(false);
    setShowCsvModal(true);
  }

  function closeCsvModal() {
    if (csvBusy) return;
    setShowCsvModal(false);
    setCsvError("");
    setCsvSuccess("");
    setCsvFile(null);
  }

  function openFriendModal() {
    setShowCsvTools(false);
    setFriendError("");
    setFriendSuccess("");
    setShowFriendModal(true);
  }

  function closeFriendModal() {
    if (friendBusy || friendBusyId != null) return;
    setShowFriendModal(false);
    setFriendError("");
    setFriendSuccess("");
    setFriendEmail("");
  }

  async function onSendFriendRequest(e: React.FormEvent) {
    e.preventDefault();
    const email = friendEmail.trim().toLowerCase();
    if (!email) {
      setFriendError("Please enter an email.");
      return;
    }
    try {
      setFriendBusy(true);
      setFriendError("");
      setFriendSuccess("");
      await sendFriendRequest({ email });
      setFriendSuccess(`Friend request sent to ${email}.`);
      setFriendEmail("");
      await loadFriendManager();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (err) {
      setFriendError((err as Error).message);
    } finally {
      setFriendBusy(false);
    }
  }

  async function onAcceptFriend(id: number | string) {
    try {
      setFriendBusyId(id);
      setFriendError("");
      setFriendSuccess("");
      await acceptFriendRequest(id);
      setFriendSuccess("Friend request accepted.");
      await loadFriendManager();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (err) {
      setFriendError((err as Error).message);
    } finally {
      setFriendBusyId(null);
    }
  }

  async function onRejectFriend(id: number | string) {
    try {
      setFriendBusyId(id);
      setFriendError("");
      setFriendSuccess("");
      await rejectFriendRequest(id);
      setFriendSuccess("Friend request rejected.");
      await loadFriendManager();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (err) {
      setFriendError((err as Error).message);
    } finally {
      setFriendBusyId(null);
    }
  }

  async function onRemoveFriend(id: number | string) {
    const confirmed = window.confirm("Remove this friend? You can send a new friend request later.");
    if (!confirmed) return;
    try {
      setFriendBusyId(id);
      setFriendError("");
      setFriendSuccess("");
      await blockFriendship(id);
      setFriendSuccess("Friend removed.");
      await loadFriendManager();
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (err) {
      setFriendError((err as Error).message);
    } finally {
      setFriendBusyId(null);
    }
  }

  async function onImportCsv(e: React.FormEvent) {
    e.preventDefault();
    setCsvError("");
    setCsvSuccess("");
    if (!csvFile) {
      setCsvError("Please choose a CSV file.");
      return;
    }
    if (csvFile.size > 1024 * 1024) {
      setCsvError("CSV file is too large. Maximum allowed size is 1 MB.");
      return;
    }
    try {
      setCsvBusy(true);
      const csvText = await csvFile.text();
      const result = await importJobsCsv(csvText);
      const summary = [
        `Imported ${result.imported} row(s).`,
        `Skipped (missing mandatory): ${result.skippedMissingRequired}.`,
        `Skipped (invalid date): ${result.skippedInvalidDate}.`,
        `Defaults applied: ${result.defaultsApplied}.`,
      ].join(" ");
      const warningPreview = result.warnings?.length ? ` ${result.warnings.slice(0, 3).join(" ")}` : "";
      setCsvSuccess(`${summary}${warningPreview}`);
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (err) {
      setCsvError((err as Error).message || "Failed to import CSV.");
    } finally {
      setCsvBusy(false);
    }
  }

  async function onExportCsv(e: React.FormEvent) {
    e.preventDefault();
    setCsvError("");
    setCsvSuccess("");
    try {
      setCsvBusy(true);
      const blob = await exportJobsCsv(csvRange);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `jobs_${csvRange}_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setCsvSuccess("CSV export downloaded.");
    } catch (err) {
      setCsvError((err as Error).message || "Failed to export CSV.");
    } finally {
      setCsvBusy(false);
    }
  }

  async function onCreateJob(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim()) return;
    if (form.referral_status === "Requested") {
      if (!form.role.trim()) return;
      try {
        setIsSaving(true);
        setModalError("");
        await createReferral({
          company: form.company.trim(),
          request_log: form.role.trim(),
          request_date: form.date_saved || getLocalISODate(),
          request_link: form.job_link.trim() || undefined,
          referral_received: form.referral_status,
          keyword_matching: form.keyword_matching,
          comment: form.notes.trim() || undefined,
        });
        setForm({ ...emptyJobForm, date_saved: getLocalISODate() });
        setShowQuickAdd(false);
        window.dispatchEvent(new CustomEvent("dashboard-refresh"));
      } catch (err) {
        setModalError((err as Error).message);
      } finally {
        setIsSaving(false);
      }
      return;
    }
    if (!form.role.trim()) return;
    try {
      setIsSaving(true);
      setModalError("");
      await createJob({
        ...form,
        date_saved: form.date_saved || getLocalISODate(),
        job_link: form.job_link.trim() || undefined,
        referral_status: form.referral_status.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setForm({ ...emptyJobForm, date_saved: getLocalISODate() });
      setShowQuickAdd(false);
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (err) {
      setModalError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function onCreatePending(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingForm.company.trim()) return;
    try {
      setIsSaving(true);
      setModalError("");
      await createPending({
        company: pendingForm.company.trim(),
        position_name: pendingForm.position_name.trim() || undefined,
        pending_date: pendingForm.pending_date || undefined,
        end_date: pendingForm.end_date || undefined,
        comment: pendingForm.comment.trim() || undefined,
        link: pendingForm.link.trim() || undefined,
      });
      setPendingForm({
        ...emptyPendingForm,
        pending_date: getLocalISODate(),
      });
      setShowPendingTask(false);
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
      window.dispatchEvent(new CustomEvent("pending-refresh"));
    } catch (err) {
      setModalError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function onCreateNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteForm.title.trim() && !noteForm.note.trim()) return;
    try {
      setIsSaving(true);
      setModalError("");
      const lines: string[] = [];
      if (noteForm.title.trim()) {
        lines.push(noteForm.title.trim());
      }
      if (noteForm.note.trim()) {
        lines.push("");
        lines.push(noteForm.note.trim());
      }
      await createNote({
        note_date: noteForm.currentDate || getLocalISODate(),
        comments: lines.join("\n"),
        priority: noteForm.priority,
        show_on_dashboard: noteForm.show_on_dashboard === "Yes",
      });
      setNoteForm({
        ...emptyNoteForm,
        currentDate: getLocalISODate(),
        lastDate: getLocalISODatePlusDays(7),
      });
      setShowNoteModal(false);
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
    } catch (err) {
      setModalError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page">
      <nav className="app-nav">
        <div className="app-nav-links">
          <NavLink to="/network" className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}>
            Network
          </NavLink>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}>
            Dashboard
          </NavLink>
          <NavLink to="/jobs" className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}>
            Active Jobs
          </NavLink>
          <NavLink to="/referrals" className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}>
            Referrals
          </NavLink>
          <NavLink to="/archive" className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}>
            Archive
          </NavLink>
          <NavLink to="/pending" className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}>
            Pending Tasks
          </NavLink>
          <NavLink to="/notes" className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}>
            Notes
          </NavLink>
        </div>
        <div className="app-nav-actions app-nav-actions--segmented">
          <button type="button" className="quick-add-btn app-btn" onClick={() => setShowQuickAdd(true)}>
            New Application
          </button>
          <button type="button" className="quick-add-btn pending-task-btn mid-btn" onClick={() => setShowPendingTask(true)}>
            Create Task
          </button>
          <button type="button" className="quick-add-btn pending-task-btn note-btn mid-btn" onClick={() => setShowNoteModal(true)}>
            Log Note
          </button>
          <div className="csv-tools" ref={csvToolsRef}>
            <button
              type="button"
              className="quick-add-btn settings-btn"
              onClick={() => setShowCsvTools((prev) => !prev)}
              aria-label="Open settings tools"
              title="Settings"
            >
              Settings
            </button>
            {showCsvTools ? (
              <div className="csv-tools-menu">
                <button type="button" className="csv-tools-item" onClick={() => openCsvModal("import")}>
                  Import CSV
                </button>
                <button type="button" className="csv-tools-item" onClick={() => openCsvModal("export")}>
                  Export CSV
                </button>
                <button type="button" className="csv-tools-item" onClick={openFriendModal}>
                  Add Friend
                </button>
                <a className="csv-tools-item" href="/jobs_import_sample.csv" download onClick={() => setShowCsvTools(false)}>
                  Download Sample CSV
                </a>
              </div>
            ) : null}
          </div>
          <button type="button" className="quick-add-btn logout-btn" onClick={onLogout} title="Logout" aria-label="Logout">
            <span className="logout-emoji">⏻</span>
          </button>
        </div>
      </nav>
      <main className="page-main">
        <Outlet />
      </main>

      {showCsvModal ? (
        <div className="modal-overlay" onClick={closeCsvModal}>
          <div className="modal modal--csv" onClick={(e) => e.stopPropagation()}>
            <h3>{csvMode === "import" ? "Import Jobs CSV" : "Export Jobs CSV"}</h3>
            {csvMode === "import" ? (
              <form className="form" onSubmit={onImportCsv}>
                <p className="csv-helper">
                  Upload must be CSV, up to 1 MB.
                  Mandatory per row: <code>role</code>, <code>company</code>, <code>date_saved</code> (YYYY-MM-DD). Rows missing these are skipped.
                  Optional fields auto-default when blank or invalid.
                  Allowed values:
                  <code>keyword_matching</code> = Strong/Medium/Weak,
                  <code>oa_status</code> = Yes/No/Pending/Done,
                  <code>referral_status</code> = Requested/Yes/No,
                  <code>response_status</code> = Review/Screening/Interview/Rejected/Offer/No Response,
                  <code>application_status</code> = Applied/Review/Interview/Rejected/Offer.
                </p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                />
                <a className="table-link" href="/jobs_import_sample.csv" download>
                  Download sample format
                </a>
                {csvError ? <div className="auth-error">{csvError}</div> : null}
                {csvSuccess ? <div className="csv-success">{csvSuccess}</div> : null}
                <div className="modal-actions">
                  <button type="button" className="action-btn" onClick={closeCsvModal} disabled={csvBusy}>
                    Close
                  </button>
                  <button type="submit" disabled={csvBusy || !csvFile}>
                    {csvBusy ? "Importing..." : "Import CSV"}
                  </button>
                </div>
              </form>
            ) : (
              <form className="form" onSubmit={onExportCsv}>
                <p className="csv-helper">Choose how much data to export from your jobs table.</p>
                <div className="form-row">
                  <label className="form-label">Range</label>
                  <select
                    className="form-select"
                    value={csvRange}
                    onChange={(e) => setCsvRange(e.target.value as JobsCsvExportRange)}
                  >
                    <option value="30">Last 30 days</option>
                    <option value="60">Last 60 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="all">All data</option>
                  </select>
                </div>
                {csvError ? <div className="auth-error">{csvError}</div> : null}
                {csvSuccess ? <div className="csv-success">{csvSuccess}</div> : null}
                <div className="modal-actions">
                  <button type="button" className="action-btn" onClick={closeCsvModal} disabled={csvBusy}>
                    Close
                  </button>
                  <button type="submit" disabled={csvBusy}>
                    {csvBusy ? "Exporting..." : "Export CSV"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {showFriendModal ? (
        <div className="modal-overlay" onClick={closeFriendModal}>
          <div className="modal modal--friends" onClick={(e) => e.stopPropagation()}>
            <div className="friends-modal-head">
              <h3>Add Friend</h3>
              <div className="friends-head-right">
                <span className="friends-slot-pill">Friend slots: {friends.length}/{maxFriends}</span>
                <button type="button" className="friends-modal-close-x" onClick={closeFriendModal} aria-label="Close Add Friend">
                  ×
                </button>
              </div>
            </div>
            <form className="form friends-form" onSubmit={onSendFriendRequest}>
              <p className="friends-form-subtitle">Send a friend request by email.</p>
              <div className="friends-form-row">
                <div className="form-row">
                  <label className="form-label">Friend email</label>
                  <input
                    type="email"
                    placeholder="friend@example.com"
                    value={friendEmail}
                    onChange={(e) => setFriendEmail(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="friends-form-actions">
                  <button type="button" className="action-btn friends-close-btn" onClick={closeFriendModal} disabled={friendBusy}>
                    Close
                  </button>
                  <button type="submit" disabled={friendBusy || !friendEmail.trim()}>
                    {friendBusy ? "Sending..." : "Send Request"}
                  </button>
                </div>
              </div>
              {friendError ? <div className="auth-error">{friendError}</div> : null}
              {friendSuccess ? <div className="csv-success">{friendSuccess}</div> : null}
            </form>
            <div className="friends-manager-grid">
              <div className="friends-panel">
                <h3>Friends ({friends.length})</h3>
                {friendLoading ? (
                  <div className="empty-state">Loading...</div>
                ) : friends.length === 0 ? (
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
                                className="action-btn friend-row-btn"
                                onClick={() => onRemoveFriend(f.friendship_id)}
                                disabled={friendBusyId === f.friendship_id}
                              >
                                {friendBusyId === f.friendship_id ? "Please wait..." : "Remove"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="friends-side-stack">
                <div className="friends-panel">
                  <h3>Incoming Requests ({incoming.length})</h3>
                  {friendLoading ? (
                    <div className="empty-state">Loading...</div>
                  ) : incoming.length === 0 ? (
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
                                  className="action-btn friend-row-btn"
                                  onClick={() => onAcceptFriend(r.friendship_id)}
                                  disabled={friendBusyId === r.friendship_id}
                                >
                                  {friendBusyId === r.friendship_id ? "Please wait..." : "Accept"}
                                </button>
                                <button
                                  type="button"
                                  className="action-btn friend-row-btn"
                                  onClick={() => onRejectFriend(r.friendship_id)}
                                  disabled={friendBusyId === r.friendship_id}
                                >
                                  Reject
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="friends-panel">
                  <h3>Sent Requests ({outgoing.length})</h3>
                  {friendLoading ? (
                    <div className="empty-state">Loading...</div>
                  ) : outgoing.length === 0 ? (
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
                              <td className="network-email-cell" title={String(r.receiver_name || r.receiver_email)}>
                                {String(r.receiver_name || r.receiver_email)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showQuickAdd && (
        <div className="modal-overlay" onClick={() => !isSaving && setShowQuickAdd(false)}>
          <div className="modal modal--quickadd" onClick={(e) => e.stopPropagation()}>
            <h3>New Application</h3>
            {modalError ? <div className="auth-error">{modalError}</div> : null}
            <form className="form form--quickadd" onSubmit={onCreateJob}>
              <div className="qa-left">
                <input
                  placeholder="Position *"
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  autoFocus
                />
                <div className="form-row">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    value={form.date_saved}
                    onChange={(e) => setForm((p) => ({ ...p, date_saved: e.target.value }))}
                  />
                </div>
                <input
                  placeholder="Location"
                  value={form.location_raw}
                  onChange={(e) => setForm((p) => ({ ...p, location_raw: e.target.value }))}
                />
                <div className="form-row">
                  <label className="form-label">Referral</label>
                  <select
                    value={form.referral_status}
                    onChange={(e) => setForm((p) => ({ ...p, referral_status: e.target.value }))}
                    className="form-select"
                  >
                    <option value="">—</option>
                    <option value="Requested">Requested</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                {form.referral_status === "Requested" && (
                  <p className="referral-hint">
                    This will add an entry on the <Link to="/referrals" className="table-link">Referrals</Link> page. Change its status there to create a job.
                  </p>
                )}
                {form.referral_status === "Yes" && (
                  <p className="referral-hint">
                    Add a referral for this company on the <Link to="/referrals" className="table-link">Referrals</Link> page to keep track.
                  </p>
                )}
                <textarea
                  placeholder="Notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <div className="qa-right">
                <input
                  placeholder="Company *"
                  value={form.company}
                  onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                />
                <input
                  placeholder="Job link (URL)"
                  type="url"
                  value={form.job_link}
                  onChange={(e) => setForm((p) => ({ ...p, job_link: e.target.value }))}
                />
                <div className="form-row">
                  <label className="form-label">Keyword Matching</label>
                  <select
                    value={form.keyword_matching}
                    onChange={(e) => setForm((p) => ({ ...p, keyword_matching: e.target.value }))}
                    className="form-select"
                  >
                    <option value="Strong">Strong</option>
                    <option value="Medium">Medium</option>
                    <option value="Weak">Weak</option>
                  </select>
                  <p className="form-helper">
                    {form.keyword_matching === "Strong"
                      ? "Almost every technical keyword matched"
                      : form.keyword_matching === "Medium"
                        ? "Few Keywords are not Present"
                        : "Few Keywords Matched"}
                  </p>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="action-btn" onClick={() => !isSaving && setShowQuickAdd(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" disabled={isSaving || !form.company.trim() || !form.role.trim()}>
                  {isSaving ? "Saving..." : "Create Application"}
                </button>
              </div>
            </form>
            <p className="modal-footnote">
              View and search all jobs on the <Link to="/jobs" className="table-link">Jobs</Link> page.
            </p>
          </div>
        </div>
      )}

      {showPendingTask && (
        <div className="modal-overlay" onClick={() => !isSaving && setShowPendingTask(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Task</h3>
            {modalError ? <div className="auth-error">{modalError}</div> : null}
            <form className="form" onSubmit={onCreatePending}>
              <input
                placeholder="Company *"
                value={pendingForm.company}
                onChange={(e) => setPendingForm((p) => ({ ...p, company: e.target.value }))}
              />
              <input
                placeholder="Position"
                value={pendingForm.position_name}
                onChange={(e) => setPendingForm((p) => ({ ...p, position_name: e.target.value }))}
              />
              <input
                type="date"
                placeholder="Date"
                value={pendingForm.pending_date}
                onChange={(e) => setPendingForm((p) => ({ ...p, pending_date: e.target.value }))}
              />
              <input
                type="date"
                placeholder="End date"
                value={pendingForm.end_date}
                onChange={(e) => setPendingForm((p) => ({ ...p, end_date: e.target.value }))}
              />
              <input
                placeholder="Comment"
                value={pendingForm.comment}
                onChange={(e) => setPendingForm((p) => ({ ...p, comment: e.target.value }))}
              />
              <input
                placeholder="Link (URL)"
                type="url"
                value={pendingForm.link}
                onChange={(e) => setPendingForm((p) => ({ ...p, link: e.target.value }))}
              />
              <div className="modal-actions">
                <button type="button" className="action-btn" onClick={() => !isSaving && setShowPendingTask(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" disabled={isSaving || !pendingForm.company.trim()}>
                  {isSaving ? "Saving..." : "Add Pending"}
                </button>
              </div>
            </form>
            <p style={{ marginTop: 12, fontSize: "0.85rem", color: "var(--text-muted)" }}>
              View all on the <Link to="/pending" className="table-link">Pending</Link> tab.
            </p>
          </div>
        </div>
      )}

      {showNoteModal && (
        <div className="modal-overlay" onClick={() => !isSaving && setShowNoteModal(false)}>
          <div className="modal modal--note" onClick={(e) => e.stopPropagation()}>
            <h3>Add Note</h3>
            {modalError ? <div className="auth-error">{modalError}</div> : null}
            <form className="form form--note-split" onSubmit={onCreateNote}>
              <div className="note-split-left">
                <input
                  placeholder="Title *"
                  value={noteForm.title}
                  onChange={(e) => setNoteForm((p) => ({ ...p, title: e.target.value }))}
                />
                <div className="form-row">
                  <label className="form-label">Current date</label>
                  <input
                    type="date"
                    value={noteForm.currentDate}
                    onChange={(e) => setNoteForm((p) => ({ ...p, currentDate: e.target.value }))}
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">Last date</label>
                  <input
                    type="date"
                    value={noteForm.lastDate}
                    onChange={(e) => setNoteForm((p) => ({ ...p, lastDate: e.target.value }))}
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-select"
                    value={noteForm.priority}
                    onChange={(e) => setNoteForm((p) => ({ ...p, priority: e.target.value }))}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">Show on Dashboard</label>
                  <select
                    className="form-select"
                    value={noteForm.show_on_dashboard}
                    onChange={(e) => setNoteForm((p) => ({ ...p, show_on_dashboard: e.target.value }))}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>
              <div className="note-split-right">
                <textarea
                  placeholder="Note"
                  rows={10}
                  value={noteForm.note}
                  onChange={(e) => setNoteForm((p) => ({ ...p, note: e.target.value }))}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="action-btn" onClick={() => !isSaving && setShowNoteModal(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" disabled={isSaving || !noteForm.title.trim()}>
                  {isSaving ? "Saving..." : "Add Note"}
                </button>
              </div>
            </form>
            <p style={{ marginTop: 12, fontSize: "0.85rem", color: "var(--text-muted)" }}>
              View and manage all notes on the{" "}
              <Link to="/notes" className="table-link">
                Notes
              </Link>{" "}
              tab.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
