import { useState, useEffect, useRef } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import {
  acceptFriendRequest,
  getActiveOa,
  blockFriendship,
  createJob,
  createReferral,
  createPending,
  createNote,
  exportJobsCsv,
  getFriendRequests,
  getFriends,
  getNetworkDeadlines,
  getPending,
  importJobsCsv,
  rejectFriendRequest,
  sendFriendRequest,
  type ActiveOaRecord,
  type FriendRecord,
  type IncomingFriendRequest,
  type NetworkDeadlineRecord,
  type JobsCsvExportRange,
  type OutgoingFriendRequest,
} from "../lib/api";
import { getLocalISODate } from "../lib/formatDate";

type LayoutProps = {
  userEmail: string;
  onLogout: () => void;
};

type PendingDeadlineAlert = {
  id: number | string;
  company: string;
  position: string;
  end_date: string;
  days_to_deadline: number;
  deadline_state: "overdue" | "today" | "upcoming";
};

const emptyJobForm = {
  role: "Software Engineer",
  company: "",
  location_raw: "United States of America",
  job_link: "",
  job_application_id: "",
  oa_deadline_date: "",
  keyword_matching: "Medium",
  oa_status: "No",
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
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [latestNotificationSignature, setLatestNotificationSignature] = useState("");
  const [incomingAlerts, setIncomingAlerts] = useState<IncomingFriendRequest[]>([]);
  const [oaAlerts, setOaAlerts] = useState<ActiveOaRecord[]>([]);
  const [pendingDeadlineAlerts, setPendingDeadlineAlerts] = useState<PendingDeadlineAlert[]>([]);
  const [friendDeadlineAlerts, setFriendDeadlineAlerts] = useState<NetworkDeadlineRecord[]>([]);
  const csvToolsRef = useRef<HTMLDivElement | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);

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
    if (!showNotifications) return;
    function onDocumentClick(e: MouseEvent) {
      const target = e.target as Node | null;
      if (notificationRef.current && target && !notificationRef.current.contains(target)) {
        setShowNotifications(false);
      }
    }
    function onEscapeKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowNotifications(false);
    }
    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscapeKey);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscapeKey);
    };
  }, [showNotifications]);

  useEffect(() => {
    function onOpenFriendManager() {
      openFriendModal();
    }
    window.addEventListener("open-friend-manager", onOpenFriendManager);
    return () => window.removeEventListener("open-friend-manager", onOpenFriendManager);
  }, []);

  useEffect(() => {
    void loadNotificationFeed();
    function onRefresh() {
      void loadNotificationFeed();
    }
    window.addEventListener("dashboard-refresh", onRefresh);
    return () => window.removeEventListener("dashboard-refresh", onRefresh);
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

  function getSeenNotificationKey() {
    return `noobly_notify_seen_signature_${String(userEmail || "").toLowerCase()}`;
  }

  function buildNotificationSignature(
    incomingRows: IncomingFriendRequest[],
    oaRows: ActiveOaRecord[],
    pendingRows: PendingDeadlineAlert[],
    friendDeadlineRows: NetworkDeadlineRecord[],
  ) {
    const payload = {
      incoming: incomingRows.map((r) => String(r.friendship_id)).sort(),
      ownDeadlines: oaRows
        .map((r) => `${r.id}:${r.oa_urgency}:${r.oa_deadline_date ?? ""}`)
        .sort(),
      taskDeadlines: pendingRows
        .map((r) => `${String(r.id)}:${r.deadline_state}:${r.end_date}`)
        .sort(),
      friendDeadlines: friendDeadlineRows
        .map((r) => `${r.friend_id}:${r.job_id}:${r.deadline_state}:${r.oa_deadline_date ?? ""}`)
        .sort(),
    };
    return JSON.stringify(payload);
  }

  function markNotificationsAsSeen(signature?: string) {
    const toStore = signature ?? latestNotificationSignature;
    try {
      window.localStorage.setItem(getSeenNotificationKey(), toStore);
    } catch {
      // Ignore localStorage failures and continue with in-memory behavior.
    }
    setHasUnreadNotifications(false);
  }

  async function loadNotificationFeed(options?: { markAsSeen?: boolean }) {
    try {
      setNotificationLoading(true);
      setNotificationError("");
      const [requestsRes, activeOaRes, pendingRes, friendDeadlinesRes] = await Promise.all([
        getFriendRequests(),
        getActiveOa(),
        getPending(false),
        getNetworkDeadlines(),
      ]);
      const today = new Date(`${getLocalISODate()}T00:00:00`);
      const pendingAlerts: PendingDeadlineAlert[] = (pendingRes.data ?? [])
        .map((row) => {
          const endDateRaw = String(row.end_date ?? "").trim();
          if (!endDateRaw) return null;
          const target = new Date(`${endDateRaw}T00:00:00`);
          if (Number.isNaN(target.getTime())) return null;
          const daysToDeadline = Math.floor((target.getTime() - today.getTime()) / 86400000);
          const deadlineState: PendingDeadlineAlert["deadline_state"] =
            daysToDeadline < 0 ? "overdue" : daysToDeadline === 0 ? "today" : "upcoming";
          return {
            id: String(row.id ?? `${endDateRaw}-${String(row.company ?? "")}-${String(row.position_name ?? "")}`),
            company: String(row.company ?? "Task").trim() || "Task",
            position: String(row.position_name ?? "").trim(),
            end_date: endDateRaw,
            days_to_deadline: daysToDeadline,
            deadline_state: deadlineState,
          };
        })
        .filter((item): item is PendingDeadlineAlert => item !== null)
        .filter((item) => item.days_to_deadline <= 7)
        .sort((a, b) => a.days_to_deadline - b.days_to_deadline);
      const incomingRows = requestsRes.incoming ?? [];
      const ownOaRows = (activeOaRes.data ?? []).filter((row) => row.oa_urgency !== "no_deadline");
      const friendDeadlineRows = friendDeadlinesRes.data ?? [];
      const signature = buildNotificationSignature(incomingRows, ownOaRows, pendingAlerts, friendDeadlineRows);
      setLatestNotificationSignature(signature);
      setIncomingAlerts(incomingRows);
      setOaAlerts(ownOaRows);
      setPendingDeadlineAlerts(pendingAlerts);
      setFriendDeadlineAlerts(friendDeadlineRows);

      if (options?.markAsSeen) {
        markNotificationsAsSeen(signature);
      } else {
        const hasAnyAlerts =
          incomingRows.length > 0 || ownOaRows.length > 0 || pendingAlerts.length > 0 || friendDeadlineRows.length > 0;
        let seenSignature = "";
        try {
          seenSignature = window.localStorage.getItem(getSeenNotificationKey()) ?? "";
        } catch {
          seenSignature = "";
        }
        setHasUnreadNotifications(hasAnyAlerts && signature !== seenSignature);
      }
    } catch (err) {
      setNotificationError((err as Error).message);
    } finally {
      setNotificationLoading(false);
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

  function formatDateShort(value: string | null | undefined) {
    if (!value) return "No date";
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  function getPersonLabel(name: string | null | undefined, email: string | null | undefined) {
    const rawName = String(name ?? "").trim();
    if (rawName) return rawName;
    const rawEmail = String(email ?? "").trim();
    if (!rawEmail) return "Friend";
    return rawEmail.includes("@") ? rawEmail.split("@")[0] : rawEmail;
  }

  function getOwnDeadlineLabel(item: ActiveOaRecord) {
    if (item.oa_urgency === "today") return "Due today";
    if (item.oa_urgency === "overdue") {
      const days = Math.abs(Number(item.days_to_deadline ?? 0));
      return days === 1 ? "Overdue by 1 day" : `Overdue by ${days} days`;
    }
    const days = Number(item.days_to_deadline ?? 0);
    return days <= 1 ? "Due tomorrow" : `Due in ${days} days`;
  }

  function getPendingDeadlineLabel(item: PendingDeadlineAlert) {
    if (item.deadline_state === "today") return "Due today";
    if (item.deadline_state === "overdue") {
      const days = Math.abs(item.days_to_deadline);
      return days === 1 ? "Overdue by 1 day" : `Overdue by ${days} days`;
    }
    return item.days_to_deadline === 1 ? "Due tomorrow" : `Due in ${item.days_to_deadline} days`;
  }

  function openCsvModal(mode: "import" | "export") {
    setCsvMode(mode);
    setCsvError("");
    setCsvSuccess("");
    setShowCsvTools(false);
    setShowNotifications(false);
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
    setShowNotifications(false);
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
        job_application_id: form.job_application_id.trim() || undefined,
        oa_deadline_date: form.oa_deadline_date || undefined,
        oa_status: form.oa_status || "No",
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

  const urgentOwnDeadlines = oaAlerts.filter((row) => row.oa_urgency === "overdue" || row.oa_urgency === "today");
  const urgentPendingDeadlines = pendingDeadlineAlerts.filter((row) => row.deadline_state === "overdue" || row.deadline_state === "today");
  const notificationCount = incomingAlerts.length + urgentOwnDeadlines.length + urgentPendingDeadlines.length + friendDeadlineAlerts.length;
  const hasNotificationItems =
    incomingAlerts.length > 0 || oaAlerts.length > 0 || pendingDeadlineAlerts.length > 0 || friendDeadlineAlerts.length > 0;

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
          <div className="nav-notify" ref={notificationRef}>
            <button
              type="button"
              className={`quick-add-btn notify-btn${showNotifications ? " active" : ""}${hasUnreadNotifications ? " unread" : ""}`}
              onClick={() => {
                setShowCsvTools(false);
                const opening = !showNotifications;
                setShowNotifications(opening);
                if (opening) {
                  void loadNotificationFeed({ markAsSeen: true });
                }
              }}
              aria-label="Open notifications"
              title="Notifications"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 3a5 5 0 0 0-5 5v2.3c0 .8-.3 1.6-.9 2.2l-1.1 1.1a1 1 0 0 0 .7 1.7h12.6a1 1 0 0 0 .7-1.7l-1.1-1.1a3.1 3.1 0 0 1-.9-2.2V8a5 5 0 0 0-5-5Zm0 18a3 3 0 0 0 2.8-2h-5.6A3 3 0 0 0 12 21Z"
                />
              </svg>
            </button>
            {showNotifications ? (
              <div className="notify-menu" role="dialog" aria-label="Notifications">
                <div className="notify-head">
                  <strong>Notifications</strong>
                  <span>{notificationLoading ? "Updating..." : `${notificationCount} urgent`}</span>
                </div>
                {notificationError ? <div className="notify-error">{notificationError}</div> : null}
                <div className="notify-list">
                  {incomingAlerts.length > 0 ? (
                    <button type="button" className="notify-item notify-item--action" onClick={openFriendModal}>
                      <span className="notify-pill">Friend Requests</span>
                      <span className="notify-title">
                        {incomingAlerts.length} new friend request{incomingAlerts.length > 1 ? "s" : ""}
                      </span>
                      <span className="notify-meta">Open Add Friend to accept or reject.</span>
                    </button>
                  ) : null}

                  {oaAlerts.slice(0, 4).map((item) => (
                    <div key={item.id} className={`notify-item notify-item--deadline ${item.oa_urgency === "overdue" ? "is-overdue" : ""}`}>
                      <span className="notify-pill">Your Deadline</span>
                      <span className="notify-title">{(item.company ?? "Company").trim() || "Company"} · {(item.role ?? "Role").trim() || "Role"}</span>
                      <span className="notify-meta">
                        {getOwnDeadlineLabel(item)} · {formatDateShort(item.oa_deadline_date)}
                      </span>
                    </div>
                  ))}

                  {pendingDeadlineAlerts.slice(0, 3).map((item) => (
                    <div key={String(item.id)} className={`notify-item notify-item--task ${item.deadline_state === "overdue" ? "is-overdue" : ""}`}>
                      <span className="notify-pill">Task Deadline</span>
                      <span className="notify-title">{item.company} · {item.position || "Pending Task"}</span>
                      <span className="notify-meta">
                        {getPendingDeadlineLabel(item)} · {formatDateShort(item.end_date)}
                      </span>
                    </div>
                  ))}

                  {friendDeadlineAlerts.slice(0, 4).map((item) => (
                    <div key={`${item.friend_id}-${item.job_id}`} className={`notify-item notify-item--friend ${item.deadline_state === "overdue" ? "is-overdue" : ""}`}>
                      <span className="notify-pill">Friend Deadline</span>
                      <span className="notify-title">
                        {getPersonLabel(item.friend_name, item.friend_email)} · {(item.company ?? "Company").trim() || "Company"}
                      </span>
                      <span className="notify-meta">
                        {item.deadline_state === "today"
                          ? `Reached deadline today · ${formatDateShort(item.oa_deadline_date)}`
                          : `Overdue by ${Math.abs(Number(item.days_to_deadline ?? 0))} day${Math.abs(Number(item.days_to_deadline ?? 0)) === 1 ? "" : "s"} · ${formatDateShort(item.oa_deadline_date)}`}
                      </span>
                    </div>
                  ))}

                  {!notificationLoading && !notificationError && !hasNotificationItems ? (
                    <div className="notify-empty">No alerts right now.</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
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
      <footer className="app-footer" aria-label="Application version">
        <span className="app-footer-version">version 1.18.06.1999</span>
      </footer>

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
                  <code>oa_status</code> = Yes/No,
                  <code>oa_deadline_date</code> = YYYY-MM-DD (optional),
                  <code>job_application_id</code> = optional text (defaults to -),
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
                <input
                  placeholder="Job/Application ID (optional)"
                  value={form.job_application_id}
                  onChange={(e) => setForm((p) => ({ ...p, job_application_id: e.target.value }))}
                />
                <div className="form-row">
                  <label className="form-label">OA Deadline (optional)</label>
                  <input
                    type="date"
                    value={form.oa_deadline_date}
                    onChange={(e) => setForm((p) => ({ ...p, oa_deadline_date: e.target.value }))}
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">Online Assessment (OA)</label>
                  <select
                    value={form.oa_status}
                    onChange={(e) => setForm((p) => ({ ...p, oa_status: e.target.value }))}
                    className="form-select"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
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
