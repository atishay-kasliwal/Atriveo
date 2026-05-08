import { ALL_STATUS_OPTIONS, JOB_STATUSES } from "../constants";

type Props = {
  editing: Record<string, unknown> | null;
  isSaving: boolean;
  editStatus: string;
  setEditStatus: React.Dispatch<React.SetStateAction<string>>;
  editReferredByName: string;
  setEditReferredByName: React.Dispatch<React.SetStateAction<string>>;
  editCompany: string;
  setEditCompany: React.Dispatch<React.SetStateAction<string>>;
  editRole: string;
  setEditRole: React.Dispatch<React.SetStateAction<string>>;
  editDate: string;
  setEditDate: React.Dispatch<React.SetStateAction<string>>;
  setEditing: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>;
  onSaveEdit: (e: React.FormEvent) => Promise<void>;
};

export default function EditReferralModal({
  editing,
  isSaving,
  editStatus,
  setEditStatus,
  editReferredByName,
  setEditReferredByName,
  editCompany,
  setEditCompany,
  editRole,
  setEditRole,
  editDate,
  setEditDate,
  setEditing,
  onSaveEdit,
}: Props) {
  if (!editing) return null;
  const movesToJobs = JOB_STATUSES.includes(editStatus as (typeof JOB_STATUSES)[number]);

  return (
    <div className="modal-overlay" onClick={() => !isSaving && setEditing(null)}>
      <div className="modal modal--form-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Edit Referral</h3>
        <p style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "var(--text-muted)" }}>
          {editCompany || String(editing.company || "—")} — {editRole || String(editing.request_log || "—")}
        </p>
        <form className="form form--two-col" onSubmit={onSaveEdit}>
          <div className="form-row">
            <label className="form-label">Person (referred by)</label>
            <input
              type="text"
              placeholder="Name of person who referred you"
              value={editReferredByName}
              onChange={(e) => setEditReferredByName(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-label">Status</label>
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="form-select">
              {ALL_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Role</label>
            <input
              type="text"
              placeholder="Position / role"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-label">Company</label>
            <input
              type="text"
              placeholder="Company"
              value={editCompany}
              onChange={(e) => setEditCompany(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-label">Date</label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
            />
          </div>
          {movesToJobs && (
            <p className="referral-hint form-span-2">
              Saving as &quot;{editStatus}&quot; will create a job and move this row to Referral Records.
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={() => !isSaving && setEditing(null)} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
