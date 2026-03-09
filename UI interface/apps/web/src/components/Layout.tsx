import { useState, useEffect, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
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
import {
  ANALYTICS_EVENTS,
  trackErrorEvent,
  trackFeatureEvent,
  trackFunnelStep,
  trackLifecycleMilestone,
  trackPerformanceEvent,
  trackProductEvent,
} from "../analytics/events";
import NotificationBell from "./layout/NotificationBell";
import QuickCreateSplitButton from "./layout/QuickCreateSplitButton";
import HeaderAvatarMenu from "./layout/HeaderAvatarMenu";
import {
  COUNTRY_OPTIONS,
  SLOW_APPLICATION_CREATE_THRESHOLD_MS,
  emptyJobForm,
  emptyNoteForm,
  emptyPendingForm,
} from "./layout/quickCreateConfig";
import { computeUserInitials } from "./layout/utils";
import { ThemeToggle } from "./ThemeToggle";
import useConfirmDialog from "./ui/useConfirmDialog";

type LayoutProps = {
  userEmail: string;
  userFirstName?: string | null;
  userLastName?: string | null;
  onLogout: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

type SectionHeaderProps = {
  icon: ReactNode;
  title: string;
};

function SectionHeader({ icon, title }: SectionHeaderProps) {
  return (
    <div className="new-app-section-header">
      <span className="new-app-section-icon" aria-hidden="true">
        {icon}
      </span>
      <h4>{title}</h4>
    </div>
  );
}

type InputProps = {
  label: string;
  required?: boolean;
  icon?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "required">;

function Input({ label, required, icon, id, className, ...props }: InputProps) {
  return (
    <label className="new-app-field" htmlFor={id}>
      <span className="new-app-label">
        {icon ? <span className="new-app-label-icon">{icon}</span> : null}
        {label}
        {required ? " *" : ""}
      </span>
      <input id={id} className={["new-app-input", className].filter(Boolean).join(" ")} {...props} />
    </label>
  );
}

type SelectProps = {
  label: string;
  required?: boolean;
  icon?: ReactNode;
  options: Array<{ label: string; value: string }>;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "required">;

function Select({ label, required, icon, id, className, options, ...props }: SelectProps) {
  return (
    <label className="new-app-field" htmlFor={id}>
      <span className="new-app-label">
        {icon ? <span className="new-app-label-icon">{icon}</span> : null}
        {label}
        {required ? " *" : ""}
      </span>
      <select id={id} className={["new-app-input", "new-app-select", className].filter(Boolean).join(" ")} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type DatePickerProps = {
  label: string;
  required?: boolean;
  showIcon?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "required" | "type">;

function DatePicker({ label, required, showIcon = true, id, className, ...props }: DatePickerProps) {
  return (
    <label className="new-app-field" htmlFor={id}>
      <span className="new-app-label">
        {showIcon ? (
          <span className="new-app-label-icon" aria-hidden="true">
            📅
          </span>
        ) : null}
        {label}
        {required ? " *" : ""}
      </span>
      <input id={id} type="date" className={["new-app-input", className].filter(Boolean).join(" ")} {...props} />
    </label>
  );
}

type YesNoToggleProps = {
  id: string;
  label: string;
  value: "Yes" | "No";
  onChange: (value: "Yes" | "No") => void;
};

function YesNoToggle({ id, label, value, onChange }: YesNoToggleProps) {
  return (
    <div className="new-app-field new-app-toggle-field">
      <span className="new-app-label" id={`${id}-label`}>
        {label}
      </span>
      <div className="new-app-toggle" role="radiogroup" aria-labelledby={`${id}-label`}>
        <button
          type="button"
          id={`${id}-yes`}
          role="radio"
          aria-checked={value === "Yes"}
          className={value === "Yes" ? "is-active" : ""}
          onClick={() => onChange("Yes")}
        >
          Yes
        </button>
        <button
          type="button"
          id={`${id}-no`}
          role="radio"
          aria-checked={value === "No"}
          className={value === "No" ? "is-active" : ""}
          onClick={() => onChange("No")}
        >
          No
        </button>
      </div>
    </div>
  );
}

type KeywordMatchRadioProps = {
  id: string;
  label: string;
  value: "Strong" | "Medium" | "Weak";
  onChange: (value: "Strong" | "Medium" | "Weak") => void;
};

function KeywordMatchRadio({ id, label, value, onChange }: KeywordMatchRadioProps) {
  return (
    <div className="new-app-field new-app-keyword-field">
      <span className="new-app-label" id={`${id}-label`}>
        {label}
      </span>
      <div className="new-app-keyword-toggle" role="radiogroup" aria-labelledby={`${id}-label`}>
        <button
          type="button"
          id={`${id}-strong`}
          role="radio"
          aria-checked={value === "Strong"}
          className={value === "Strong" ? "is-active" : ""}
          onClick={() => onChange("Strong")}
        >
          High
        </button>
        <button
          type="button"
          id={`${id}-medium`}
          role="radio"
          aria-checked={value === "Medium"}
          className={value === "Medium" ? "is-active" : ""}
          onClick={() => onChange("Medium")}
        >
          Medium
        </button>
        <button
          type="button"
          id={`${id}-weak`}
          role="radio"
          aria-checked={value === "Weak"}
          className={value === "Weak" ? "is-active" : ""}
          onClick={() => onChange("Weak")}
        >
          Low
        </button>
      </div>
    </div>
  );
}

export default function Layout({
  userEmail,
  userFirstName,
  userLastName,
  onLogout,
  theme,
  onToggleTheme,
}: LayoutProps) {
  const location = useLocation();
  const isNetworkView = location.pathname.includes("/network");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showPendingTask, setShowPendingTask] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
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
  const { confirm, confirmDialog } = useConfirmDialog();
  const avatarInitials = computeUserInitials(userFirstName, userLastName, userEmail);

  useEffect(() => {
    if (!showQuickAdd && !showPendingTask && !showNoteModal) setModalError("");
  }, [showQuickAdd, showPendingTask, showNoteModal]);

  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("atriveo-sync");
      bc.onmessage = (event) => {
        if (event.data?.type === "job-added") {
          window.dispatchEvent(new CustomEvent("dashboard-refresh"));
        }
      };
    } catch (_) { /* BroadcastChannel not supported */ }
    return () => { bc?.close(); };
  }, []);

  useEffect(() => {
    function onOpenFriendManager() {
      openFriendModal();
    }
    window.addEventListener("open-friend-manager", onOpenFriendManager);
    return () => window.removeEventListener("open-friend-manager", onOpenFriendManager);
  }, []);

  useEffect(() => {
    function onOpenCreateTaskModal() {
      openCreateTaskModal();
    }
    function onOpenLogNoteModal() {
      openLogNoteModal();
    }
    function onOpenImportCsvModal() {
      openCsvModal("import");
    }
    window.addEventListener("open-create-task-modal", onOpenCreateTaskModal);
    window.addEventListener("open-log-note-modal", onOpenLogNoteModal);
    window.addEventListener("open-import-csv", onOpenImportCsvModal);
    return () => {
      window.removeEventListener("open-create-task-modal", onOpenCreateTaskModal);
      window.removeEventListener("open-log-note-modal", onOpenLogNoteModal);
      window.removeEventListener("open-import-csv", onOpenImportCsvModal);
    };
  }, []);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

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
    const confirmed = await confirm({
      title: "Remove Friend",
      message: "You're going to remove this friend. You can send a new friend request later.",
      confirmText: "Confirm Remove",
      cancelText: "No, Keep it",
    });
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
    if (csvFile.size > 10 * 1024 * 1024) {
      setCsvError("CSV file is too large. Maximum allowed size is 10 MB.");
      return;
    }
    try {
      setCsvBusy(true);
      const csvText = await csvFile.text();
      const result = await importJobsCsv(csvText);
      const summary = [
        `Imported ${result.imported} of ${result.rowsReceived} row(s).`,
        `Skipped (missing mandatory): ${result.skippedMissingRequired}.`,
        `Skipped (invalid date): ${result.skippedInvalidDate}.`,
        `Defaults applied: ${result.defaultsApplied}.`,
      ].join(" ");
      const warningPreview = result.warnings?.length ? ` ${result.warnings.slice(0, 3).join(" ")}` : "";
      setCsvSuccess(`${summary}${warningPreview} Jobs table is paginated (25 per page).`);
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
      trackFeatureEvent(ANALYTICS_EVENTS.export_data_clicked, {
        source: "header_menu",
        export_format: "csv",
        export_range: csvRange,
      });
    } catch (err) {
      setCsvError((err as Error).message || "Failed to export CSV.");
    } finally {
      setCsvBusy(false);
    }
  }

  async function onCreateJob(e: React.FormEvent) {
    e.preventDefault();
    const company = form.company.trim();
    const role = form.role.trim();

    if (!company) {
      trackErrorEvent(ANALYTICS_EVENTS.validation_error, {
        component_name: "new_application_form",
        error_type: "missing_company",
      });
      return;
    }

    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

    if (form.referral_status === "Requested") {
      if (!role) {
        trackErrorEvent(ANALYTICS_EVENTS.validation_error, {
          component_name: "new_application_form",
          error_type: "missing_role",
        });
        return;
      }
      try {
        setIsSaving(true);
        setModalError("");
        await createReferral({
          company,
          request_log: role,
          request_date: form.date_saved || getLocalISODate(),
          request_link: form.job_link.trim() || undefined,
          referral_received: form.referral_status,
          keyword_matching: form.keyword_matching,
          referred_by_name: form.referred_by_name.trim() || undefined,
          comment: form.notes.trim() || undefined,
        });
        setForm({ ...emptyJobForm, date_saved: getLocalISODate() });
        setShowQuickAdd(false);
        window.dispatchEvent(new CustomEvent("dashboard-refresh"));
      } catch (err) {
        trackErrorEvent(ANALYTICS_EVENTS.form_submission_error, {
          component_name: "new_application_form",
          error_type: "referral_submit_failed",
        });
        setModalError((err as Error).message);
      } finally {
        const durationMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt;
        if (durationMs >= SLOW_APPLICATION_CREATE_THRESHOLD_MS) {
          trackPerformanceEvent(ANALYTICS_EVENTS.slow_application_create, durationMs, {
            source: "new_application_modal",
            flow: "referral",
          });
        }
        setIsSaving(false);
      }
      return;
    }

    if (!role) {
      trackErrorEvent(ANALYTICS_EVENTS.validation_error, {
        component_name: "new_application_form",
        error_type: "missing_role",
      });
      return;
    }

    try {
      setIsSaving(true);
      setModalError("");
      await createJob({
        ...form,
        company,
        role,
        date_saved: form.date_saved || getLocalISODate(),
        job_link: form.job_link.trim() || undefined,
        job_application_id: form.job_application_id.trim() || undefined,
        oa_deadline_date: form.oa_deadline_date || undefined,
        oa_status: form.oa_status || "No",
        referral_status: form.referral_status.trim() || undefined,
        referred_by_name: form.referred_by_name.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setForm({ ...emptyJobForm, date_saved: getLocalISODate() });
      setShowQuickAdd(false);
      window.dispatchEvent(new CustomEvent("dashboard-refresh"));
      trackProductEvent(ANALYTICS_EVENTS.application_created, {
        source: "new_application_modal",
        method: "manual",
        has_referral: form.referral_status === "Yes",
        has_online_assessment: form.oa_status === "Yes",
      });
      trackFunnelStep(ANALYTICS_EVENTS.application_created, {
        source: "new_application_modal",
      });
      trackLifecycleMilestone(ANALYTICS_EVENTS.first_application_created, {
        source: "new_application_modal",
      });
    } catch (err) {
      trackErrorEvent(ANALYTICS_EVENTS.form_submission_error, {
        component_name: "new_application_form",
        error_type: "application_create_failed",
      });
      setModalError((err as Error).message);
    } finally {
      const durationMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt;
      if (durationMs >= SLOW_APPLICATION_CREATE_THRESHOLD_MS) {
        trackPerformanceEvent(ANALYTICS_EVENTS.slow_application_create, durationMs, {
          source: "new_application_modal",
          flow: "job",
        });
      }
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

  function openNewApplicationModal() {
    trackProductEvent(ANALYTICS_EVENTS.add_application_clicked, {
      source: "dashboard_header",
    });
    trackFunnelStep(ANALYTICS_EVENTS.add_application_clicked, {
      source: "dashboard_header",
    });
    setModalError("");
    setForm({ ...emptyJobForm, date_saved: getLocalISODate() });
    setShowPendingTask(false);
    setShowNoteModal(false);
    setShowQuickAdd(true);
  }

  function openCreateTaskModal() {
    setModalError("");
    setShowQuickAdd(false);
    setShowNoteModal(false);
    setShowPendingTask(true);
  }

  function openLogNoteModal() {
    setModalError("");
    setShowQuickAdd(false);
    setShowPendingTask(false);
    setShowNoteModal(true);
  }

  return (
    <div className={`page${isNetworkView ? " page--network" : ""}`}>
      <nav className={`app-nav${isNetworkView ? " app-nav--network" : ""}`}>
        <div className="app-nav-top">
          <div className="app-nav-left">
            <Link to="/" className="app-nav-brand" aria-label="Atriveo home">
              Atriveo<span>.</span>
            </Link>
          </div>
          <button
            type="button"
            className={`app-nav-menu-toggle${isMobileNavOpen ? " is-open" : ""}`}
            aria-label="Toggle navigation menu"
            aria-controls="app-top-navigation"
            aria-expanded={isMobileNavOpen}
            onClick={() => setIsMobileNavOpen((prev) => !prev)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div id="app-top-navigation" className={`app-nav-center${isMobileNavOpen ? " is-mobile-open" : ""}`}>
            <div className="app-nav-links">
              <NavLink
                to="network"
                className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}
                onClick={() => setIsMobileNavOpen(false)}
              >
                Network
              </NavLink>
              <NavLink
                to="."
                end
                className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}
                onClick={() => setIsMobileNavOpen(false)}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="jobs"
                className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}
                onClick={() => setIsMobileNavOpen(false)}
              >
                Active Jobs
              </NavLink>
              <NavLink
                to="pending"
                className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}
                onClick={() => setIsMobileNavOpen(false)}
              >
                Follow Up
              </NavLink>
            </div>
          </div>
          <div className="app-nav-actions">
            <div className="app-nav-actions-main">
              <QuickCreateSplitButton
                className="app-split-create--nav-primary"
                onNewApplication={openNewApplicationModal}
                onCreateTask={openCreateTaskModal}
                onLogNote={openLogNoteModal}
              />
            </div>
            <div className="app-nav-actions-utility">
              <ThemeToggle theme={theme} onToggle={onToggleTheme} className="app-nav-theme-toggle app-nav-theme-toggle--top" />
              <NotificationBell
                userEmail={userEmail}
                onOpenFriendModal={openFriendModal}
              />
              <HeaderAvatarMenu
                onImportCsv={() => openCsvModal("import")}
                onExportCsv={() => openCsvModal("export")}
                onAddFriend={openFriendModal}
                onLogout={onLogout}
                templateHref="/jobs_import_sample.csv"
                initials={avatarInitials}
              />
            </div>
          </div>
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
            <div className="csv-modal-head">
              <h3>{csvMode === "import" ? "Import Jobs CSV" : "Export Jobs CSV"}</h3>
              {csvMode === "import" ? (
                <details className="csv-rules">
                  <summary className="csv-info-btn" aria-label="View CSV import rules">i</summary>
                  <div className="csv-rules-panel">
                    <div className="csv-rules-copy">
                      <p className="csv-helper">Quick rules</p>
                      <ul>
                        <li>Use CSV only (max 10 MB).</li>
                        <li>Required per row: <code>role</code>, <code>company</code>, and one date field.</li>
                        <li>Date field: <code>date_saved</code> (YYYY-MM-DD) or <code>applied_at</code> (ISO timestamp).</li>
                        <li>If only <code>date_saved</code> is sent, time defaults to 12:07 AM.</li>
                        <li>Optional fields auto-default when blank/invalid.</li>
                      </ul>
                    </div>
                  </div>
                </details>
              ) : null}
            </div>
            {csvMode === "import" ? (
              <form className="form" onSubmit={onImportCsv}>
                <div className="csv-import-headline">
                  <div className="csv-required-pill">
                    <p className="csv-required-label">Required headers</p>
                    <p className="csv-required-item">
                      Company Name: <code>company</code>
                    </p>
                    <p className="csv-required-item">
                      Application Title: <code>role</code>
                    </p>
                    <p className="csv-required-item">
                      Applied Date: <code>date_saved</code>
                    </p>
                  </div>
                </div>
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
                  <button type="button" className="jobs-search-btn csv-action-btn" onClick={closeCsvModal} disabled={csvBusy}>
                    Close
                  </button>
                  <button type="submit" className="jobs-search-btn csv-action-btn" disabled={csvBusy || !csvFile}>
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
                  <button type="button" className="jobs-search-btn csv-action-btn" onClick={closeCsvModal} disabled={csvBusy}>
                    Close
                  </button>
                  <button type="submit" className="jobs-search-btn csv-action-btn" disabled={csvBusy}>
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
                          <th>No.</th>
                          <th>Email</th>
                          <th>Connected At</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {friends.map((f, idx) => (
                          <tr key={String(f.friendship_id)}>
                            <td className="table-col-no">{idx + 1}</td>
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
                            <th>No.</th>
                            <th>From</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {incoming.map((r, idx) => (
                            <tr key={String(r.friendship_id)}>
                              <td className="table-col-no">{idx + 1}</td>
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
                            <th>No.</th>
                            <th>To</th>
                          </tr>
                        </thead>
                        <tbody>
                          {outgoing.map((r, idx) => (
                            <tr key={String(r.friendship_id)}>
                              <td className="table-col-no">{idx + 1}</td>
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
        <div className="modal-overlay modal-overlay--quickadd" onClick={() => !isSaving && setShowQuickAdd(false)}>
          <div className="modal modal--quickadd" onClick={(e) => e.stopPropagation()}>
            {modalError ? <div className="auth-error">{modalError}</div> : null}
            <form className="new-app-form" onSubmit={onCreateJob}>
              <header className="new-app-header">
                <h3>New Application</h3>
                <p>Track a new job application</p>
              </header>

              <section className="new-app-section">
                <SectionHeader icon="▦" title="JOB INFORMATION" />
                <div className="new-app-grid-3">
                  <Input
                    id="new-app-role"
                    label="Job Title"
                    required
                    placeholder="e.g. Software Engineer"
                    value={form.role}
                    onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                    autoFocus
                  />
                  <Input
                    id="new-app-company"
                    label="Company"
                    required
                    icon="🏢"
                    placeholder="e.g. Google"
                    value={form.company}
                    onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                  />
                  <Input
                    id="new-app-id"
                    label="Job / Application ID"
                    icon="#"
                    placeholder="Optional"
                    value={form.job_application_id}
                    onChange={(e) => setForm((p) => ({ ...p, job_application_id: e.target.value }))}
                  />
                </div>
                <div className="new-app-grid-2">
                  <Input
                    id="new-app-link"
                    label="Job Link"
                    icon="↗"
                    type="url"
                    placeholder="https://..."
                    value={form.job_link}
                    onChange={(e) => setForm((p) => ({ ...p, job_link: e.target.value }))}
                  />
                  <KeywordMatchRadio
                    id="new-app-keyword"
                    label="Keyword Match"
                    value={form.keyword_matching as "Strong" | "Medium" | "Weak"}
                    onChange={(next) => setForm((p) => ({ ...p, keyword_matching: next }))}
                  />
                </div>
              </section>

              <section className="new-app-section">
                <SectionHeader icon="⌁" title="REFERRAL & OA" />
                <div className="new-app-grid-2 new-app-grid-referral">
                  <YesNoToggle
                    id="new-app-referral"
                    label="Referral"
                    value={form.referral_status === "Yes" ? "Yes" : "No"}
                    onChange={(next) => setForm((p) => ({ ...p, referral_status: next }))}
                  />
                  <Input
                    id="new-app-referral-name"
                    label="Referral Name"
                    placeholder="Optional"
                    value={form.referred_by_name}
                    onChange={(e) => setForm((p) => ({ ...p, referred_by_name: e.target.value }))}
                  />
                  <YesNoToggle
                    id="new-app-oa"
                    label="Online Assessment"
                    value={form.oa_status === "Yes" ? "Yes" : "No"}
                    onChange={(next) => setForm((p) => ({ ...p, oa_status: next }))}
                  />
                  <DatePicker
                    id="new-app-oa-deadline"
                    label="OA Deadline"
                    showIcon={false}
                    value={form.oa_deadline_date}
                    onChange={(e) => setForm((p) => ({ ...p, oa_deadline_date: e.target.value }))}
                  />
                </div>
              </section>

              <section className="new-app-section">
                <details className="new-app-details">
                  <summary className="new-app-details-summary">
                    <span className="new-app-details-title">Additional Information</span>
                    <span className="new-app-details-toggle" aria-hidden="true">
                      <span className="new-app-details-icon">▾</span>
                    </span>
                  </summary>
                  <div className="new-app-details-body">
                    <div className="new-app-grid-2">
                      <DatePicker
                        id="new-app-date"
                        label="Date Applied"
                        required
                        value={form.date_saved}
                        onChange={(e) => setForm((p) => ({ ...p, date_saved: e.target.value }))}
                      />
                      <Select
                        id="new-app-country"
                        label="Country"
                        required
                        icon="◎"
                        options={COUNTRY_OPTIONS.map((country) => ({ label: country, value: country }))}
                        value={form.location_raw}
                        onChange={(e) => setForm((p) => ({ ...p, location_raw: e.target.value }))}
                      />
                    </div>
                    <label className="new-app-field" htmlFor="new-app-notes">
                      <span className="new-app-label">
                        <span className="new-app-label-icon" aria-hidden="true">
                          ☰
                        </span>
                        Notes
                      </span>
                      <textarea
                        id="new-app-notes"
                        className="new-app-input new-app-textarea"
                        placeholder="Any additional notes about this application..."
                        rows={3}
                        value={form.notes}
                        onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                      />
                    </label>
                  </div>
                </details>
              </section>

              <div className="new-app-actions">
                <button type="button" className="new-app-btn new-app-btn--secondary" onClick={() => !isSaving && setShowQuickAdd(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="new-app-btn new-app-btn--primary" disabled={isSaving || !form.company.trim() || !form.role.trim()}>
                  {isSaving ? "Saving..." : "Create Application"}
                </button>
              </div>
            </form>
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
      {confirmDialog}
    </div>
  );
}
