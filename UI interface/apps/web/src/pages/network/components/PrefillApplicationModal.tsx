import type { FormEvent } from "react";
import type { PrefillForm, SetPrefillForm } from "../types";

type Props = {
  show: boolean;
  isSaving: boolean;
  prefillFromName: string;
  prefillError: string;
  prefillForm: PrefillForm;
  setPrefillForm: SetPrefillForm;
  onClose: () => void;
  onSubmit: (e: FormEvent) => Promise<void>;
};

export default function PrefillApplicationModal({
  show,
  isSaving,
  prefillFromName,
  prefillError,
  prefillForm,
  setPrefillForm,
  onClose,
  onSubmit,
}: Props) {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--quickadd" onClick={(e) => e.stopPropagation()}>
        <h3>Add Application</h3>
        <p className="modal-subtitle">Prefilled from {prefillFromName}. Edit anything before saving.</p>
        {prefillError ? <div className="auth-error">{prefillError}</div> : null}
        <form className="form form--quickadd" onSubmit={onSubmit}>
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
            <input
              placeholder="Job/Application ID (optional)"
              value={prefillForm.job_application_id}
              onChange={(e) => setPrefillForm((p) => ({ ...p, job_application_id: e.target.value }))}
            />
            <div className="form-row">
              <label className="form-label">OA Deadline (optional)</label>
              <input
                type="date"
                value={prefillForm.oa_deadline_date}
                onChange={(e) => setPrefillForm((p) => ({ ...p, oa_deadline_date: e.target.value }))}
              />
            </div>
            <div className="form-row">
              <label className="form-label">Online Assessment (OA)</label>
              <select
                value={prefillForm.oa_status}
                onChange={(e) => setPrefillForm((p) => ({ ...p, oa_status: e.target.value }))}
                className="form-select"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
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
            <button type="button" className="action-btn" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving || !prefillForm.company.trim() || !prefillForm.role.trim()}>
              {isSaving ? "Saving..." : "Add Application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
