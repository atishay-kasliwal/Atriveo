type EditForm = {
  date_saved: string;
  role: string;
  company: string;
  job_link: string;
  job_application_id: string;
  oa_deadline_date: string;
  keyword_matching: string;
  oa_status: string;
  referral_status: string;
  referred_by_name: string;
  location_raw: string;
  response_status: string;
  application_status: string;
  notes: string;
};

type Props = {
  editForm: EditForm;
  setEditForm: (updater: (prev: EditForm) => EditForm) => void;
};

export default function EditJobAdditionalSection({ editForm, setEditForm }: Props) {
  return (
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
            <label className="new-app-field">
              <span className="new-app-label">Date Applied</span>
              <input className="new-app-input" type="date" value={editForm.date_saved} onChange={(e) => setEditForm((p) => ({ ...p, date_saved: e.target.value }))} />
            </label>
            <label className="new-app-field">
              <span className="new-app-label">Country / Location</span>
              <input className="new-app-input" placeholder="e.g. United States" value={editForm.location_raw} onChange={(e) => setEditForm((p) => ({ ...p, location_raw: e.target.value }))} />
            </label>
            <label className="new-app-field">
              <span className="new-app-label">Application Status</span>
              <select
                className="new-app-input new-app-select"
                value={editForm.application_status}
                onChange={(e) => setEditForm((p) => ({ ...p, application_status: e.target.value }))}
              >
                <option value="Applied">Applied</option>
                <option value="OA">OA</option>
                <option value="Interview">Interview</option>
                <option value="Offer">Offer</option>
                <option value="Archive">Archive</option>
              </select>
            </label>
            <label className="new-app-field">
              <span className="new-app-label">Response Status</span>
              <input className="new-app-input" placeholder="e.g. Interview" value={editForm.response_status} onChange={(e) => setEditForm((p) => ({ ...p, response_status: e.target.value }))} />
            </label>
          </div>
          <label className="new-app-field">
            <span className="new-app-label">Notes</span>
            <textarea className="new-app-input new-app-textarea" rows={3} placeholder="Any additional notes..." value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} />
          </label>
        </div>
      </details>
    </section>
  );
}
