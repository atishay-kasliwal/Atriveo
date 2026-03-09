import { Link } from "react-router-dom";
import { REFERRAL_OPTIONS } from "../constants";
import EditJobAdditionalSection from "./modal/EditJobAdditionalSection";

type EditForm = {
  date_saved: string;
  role: string;
  company: string;
  location_raw: string;
  job_link: string;
  job_application_id: string;
  oa_deadline_date: string;
  keyword_matching: string;
  oa_status: string;
  referral_status: string;
  referred_by_name: string;
  response_status: string;
  application_status: string;
  notes: string;
};

type Props = {
  editing: Record<string, unknown> | null;
  isSaving: boolean;
  isDeleting: boolean;
  editForm: EditForm;
  setEditing: (value: Record<string, unknown> | null) => void;
  setEditForm: (updater: (prev: EditForm) => EditForm) => void;
  onSaveEdit: (e: React.FormEvent) => Promise<void>;
  onDeleteEdit: () => Promise<void>;
};

export default function EditJobModal({
  editing,
  isSaving,
  isDeleting,
  editForm,
  setEditing,
  setEditForm,
  onSaveEdit,
  onDeleteEdit,
}: Props) {
  if (!editing) return null;

  return (
    <div className="modal-overlay modal-overlay--quickadd" onClick={() => !isSaving && !isDeleting && setEditing(null)}>
      <div className="modal modal--quickadd" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="modal-close-x"
          aria-label="Close"
          onClick={() => !isSaving && !isDeleting && setEditing(null)}
          disabled={isSaving || isDeleting}
        >
          ×
        </button>
        <form className="new-app-form" onSubmit={onSaveEdit}>
          <header className="new-app-header">
            <h3>Edit Application</h3>
            <p>Update this application using the same structure as Add Application.</p>
          </header>

          <section className="new-app-section">
            <div className="new-app-section-header">
              <span className="new-app-section-icon">⌁</span>
              <h4>CORE DETAILS</h4>
            </div>
            <div className="new-app-grid-2">
              <label className="new-app-field">
                <span className="new-app-label">Company</span>
                <input
                  className="new-app-input"
                  placeholder="e.g. Stripe"
                  value={editForm.company}
                  onChange={(e) => setEditForm((p) => ({ ...p, company: e.target.value }))}
                  autoFocus
                />
              </label>
              <label className="new-app-field">
                <span className="new-app-label">Position</span>
                <input
                  className="new-app-input"
                  placeholder="e.g. Software Engineer"
                  value={editForm.role}
                  onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                />
              </label>
              <label className="new-app-field">
                <span className="new-app-label">Application Link</span>
                <input
                  className="new-app-input"
                  type="url"
                  placeholder="https://..."
                  value={editForm.job_link}
                  onChange={(e) => setEditForm((p) => ({ ...p, job_link: e.target.value }))}
                />
              </label>
              <label className="new-app-field">
                <span className="new-app-label">Application ID</span>
                <input
                  className="new-app-input"
                  placeholder="Optional"
                  value={editForm.job_application_id}
                  onChange={(e) => setEditForm((p) => ({ ...p, job_application_id: e.target.value }))}
                />
              </label>
            </div>
          </section>

          <section className="new-app-section">
            <div className="new-app-section-header">
              <span className="new-app-section-icon">⌁</span>
              <h4>REFERRAL & OA</h4>
            </div>
            <div className="new-app-grid-2 new-app-grid-referral">
              <label className="new-app-field">
                <span className="new-app-label">Referral</span>
                <select
                  className="new-app-input new-app-select"
                  value={editForm.referral_status}
                  onChange={(e) => setEditForm((p) => ({ ...p, referral_status: e.target.value }))}
                >
                  {REFERRAL_OPTIONS.map((opt) => (
                    <option key={opt || "empty"} value={opt}>
                      {opt || "—"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="new-app-field">
                <span className="new-app-label">Referral Name</span>
                <input
                  className="new-app-input"
                  placeholder="Optional"
                  value={editForm.referred_by_name}
                  onChange={(e) => setEditForm((p) => ({ ...p, referred_by_name: e.target.value }))}
                />
              </label>
              <label className="new-app-field">
                <span className="new-app-label">Online Assessment</span>
                <select
                  className="new-app-input new-app-select"
                  value={editForm.oa_status}
                  onChange={(e) => setEditForm((p) => ({ ...p, oa_status: e.target.value }))}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </label>
              <label className="new-app-field">
                <span className="new-app-label">OA Deadline</span>
                <input
                  className="new-app-input"
                  type="date"
                  value={editForm.oa_deadline_date}
                  onChange={(e) => setEditForm((p) => ({ ...p, oa_deadline_date: e.target.value }))}
                />
              </label>
            </div>
            <label className="new-app-field new-app-keyword-field">
              <span className="new-app-label">Keyword Matching</span>
              <div className="new-app-keyword-toggle">
                {(["Strong", "Medium", "Weak"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={editForm.keyword_matching === level ? "is-active" : ""}
                    onClick={() => setEditForm((p) => ({ ...p, keyword_matching: level }))}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </label>
            {editForm.referral_status === "Requested" && (
              <p className="new-app-alert">
                Track requested referrals on the <Link to="/referrals" className="table-link">Referrals</Link> page.
              </p>
            )}
            {editForm.referral_status === "Yes" && (
              <p className="new-app-alert">
                Ensure this company has an entry on the <Link to="/referrals" className="table-link">Referrals</Link> page.
              </p>
            )}
          </section>

          <EditJobAdditionalSection editForm={editForm} setEditForm={setEditForm} />

          <div className="new-app-actions new-app-actions--with-delete">
            <button
              type="button"
              className="new-app-btn new-app-btn--danger"
              onClick={() => void onDeleteEdit()}
              disabled={isSaving || isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
            <div className="new-app-actions-right">
              <button
                type="button"
                className="new-app-btn new-app-btn--secondary"
                onClick={() => setEditing(null)}
                disabled={isSaving || isDeleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="new-app-btn new-app-btn--primary"
                disabled={isSaving || isDeleting || !editForm.role.trim() || !editForm.company.trim()}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
