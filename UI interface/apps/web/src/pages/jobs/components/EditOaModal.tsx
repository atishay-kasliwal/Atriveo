import { Link } from "react-router-dom";
import { REFERRAL_OPTIONS } from "../constants";

type OaEditForm = {
  role: string;
  company: string;
  location_raw: string;
  job_link: string;
  job_application_id: string;
  oa_deadline_date: string;
  keyword_matching: string;
  oa_status: string;
  referral_status: string;
  response_status: string;
  application_status: string;
  notes: string;
  date_saved: string;
  oa_result: string;
  oa_result_date: string;
  oa_completed_date: string;
};

type Props = {
  oaEditing: Record<string, unknown> | null;
  isOaSaving: boolean;
  oaEditForm: OaEditForm;
  setOaEditing: (value: Record<string, unknown> | null) => void;
  setOaEditForm: (updater: (prev: OaEditForm) => OaEditForm) => void;
  onSaveOaEdit: (e: React.FormEvent) => Promise<void>;
};

export default function EditOaModal({
  oaEditing,
  isOaSaving,
  oaEditForm,
  setOaEditing,
  setOaEditForm,
  onSaveOaEdit,
}: Props) {
  if (!oaEditing) return null;

  return (
    <div className="modal-overlay" onClick={() => !isOaSaving && setOaEditing(null)}>
      <div className="modal modal--quickadd" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="modal-close-x"
          aria-label="Close"
          onClick={() => !isOaSaving && setOaEditing(null)}
          disabled={isOaSaving}
        >
          ×
        </button>
        <h3>Edit OA Record</h3>
        <form className="form form--quickadd" onSubmit={onSaveOaEdit}>
          <div className="qa-left">
            <input
              placeholder="Position"
              value={oaEditForm.role}
              onChange={(e) => setOaEditForm((p) => ({ ...p, role: e.target.value }))}
              autoFocus
            />
            <div className="form-row">
              <label className="form-label">Date Saved</label>
              <input
                type="date"
                value={oaEditForm.date_saved}
                onChange={(e) => setOaEditForm((p) => ({ ...p, date_saved: e.target.value }))}
              />
            </div>
            <input
              placeholder="Location"
              value={oaEditForm.location_raw}
              onChange={(e) => setOaEditForm((p) => ({ ...p, location_raw: e.target.value }))}
            />
            <div className="form-row">
              <label className="form-label">Referral</label>
              <select
                value={oaEditForm.referral_status}
                onChange={(e) => setOaEditForm((p) => ({ ...p, referral_status: e.target.value }))}
                className="form-select"
              >
                {REFERRAL_OPTIONS.map((opt) => (
                  <option key={`oa-ref-${opt || "empty"}`} value={opt}>{opt || "—"}</option>
                ))}
              </select>
            </div>
            {oaEditForm.referral_status === "Yes" && (
              <p className="referral-hint">
                Ensure this company has an entry on the <Link to="/referrals" className="table-link">Referrals</Link> page.
              </p>
            )}
            <div className="form-row">
              <label className="form-label">Application Status</label>
              <select
                value={oaEditForm.application_status}
                onChange={(e) => setOaEditForm((p) => ({ ...p, application_status: e.target.value }))}
                className="form-select"
              >
                <option value="Applied">Applied</option>
                <option value="OA">OA</option>
                <option value="Interview">Interview</option>
                <option value="Offer">Offer</option>
                <option value="Archive">Archive</option>
              </select>
            </div>
            <input
              placeholder="Response status"
              value={oaEditForm.response_status}
              onChange={(e) => setOaEditForm((p) => ({ ...p, response_status: e.target.value }))}
            />
            <textarea
              placeholder="Notes"
              rows={3}
              value={oaEditForm.notes}
              onChange={(e) => setOaEditForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="qa-right">
            <input
              placeholder="Company"
              value={oaEditForm.company}
              onChange={(e) => setOaEditForm((p) => ({ ...p, company: e.target.value }))}
            />
            <input
              placeholder="Job link (URL)"
              type="url"
              value={oaEditForm.job_link}
              onChange={(e) => setOaEditForm((p) => ({ ...p, job_link: e.target.value }))}
            />
            <input
              placeholder="Job/Application ID"
              value={oaEditForm.job_application_id}
              onChange={(e) => setOaEditForm((p) => ({ ...p, job_application_id: e.target.value }))}
            />
            <div className="form-row">
              <label className="form-label">OA Deadline</label>
              <input
                type="date"
                value={oaEditForm.oa_deadline_date}
                onChange={(e) => setOaEditForm((p) => ({ ...p, oa_deadline_date: e.target.value }))}
              />
            </div>
            <div className="form-row">
              <label className="form-label">Online Assessment (OA)</label>
              <select
                value={oaEditForm.oa_status}
                onChange={(e) => setOaEditForm((p) => ({ ...p, oa_status: e.target.value }))}
                className="form-select"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Keyword Matching</label>
              <select
                value={oaEditForm.keyword_matching}
                onChange={(e) => setOaEditForm((p) => ({ ...p, keyword_matching: e.target.value }))}
                className="form-select"
              >
                <option value="Strong">Strong</option>
                <option value="Medium">Medium</option>
                <option value="Weak">Weak</option>
              </select>
            </div>
            <details className="form-accordion">
              <summary>
                <span>OA Result Details</span>
                <span className="form-accordion-summary-meta">Status: {oaEditForm.oa_result || "—"}</span>
              </summary>
              <div className="form-accordion-grid">
                <div className="form-row">
                  <label className="form-label">Record Date</label>
                  <input
                    type="date"
                    value={oaEditForm.oa_result_date}
                    onChange={(e) => setOaEditForm((p) => ({ ...p, oa_result_date: e.target.value }))}
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">Result Status</label>
                  <select
                    value={oaEditForm.oa_result}
                    onChange={(e) => setOaEditForm((p) => ({ ...p, oa_result: e.target.value }))}
                    className="form-select"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                    <option value="Missed">Missed</option>
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">OA Completed Date (legacy)</label>
                  <input
                    type="date"
                    value={oaEditForm.oa_completed_date}
                    onChange={(e) => setOaEditForm((p) => ({ ...p, oa_completed_date: e.target.value }))}
                  />
                </div>
              </div>
            </details>
          </div>
          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={() => setOaEditing(null)} disabled={isOaSaving}>
              Cancel
            </button>
            <button type="submit" disabled={isOaSaving}>
              {isOaSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
