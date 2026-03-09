import type { CreateRecordForm } from "../types";

type Props = {
  showCreateRecordModal: boolean;
  isCreatingRecord: boolean;
  createRecordError: string;
  createRecordForm: CreateRecordForm;
  setCreateRecordForm: React.Dispatch<React.SetStateAction<CreateRecordForm>>;
  setShowCreateRecordModal: React.Dispatch<React.SetStateAction<boolean>>;
  onCreateRecord: (e: React.FormEvent) => Promise<void>;
};

export default function CreateRecordModal({
  showCreateRecordModal,
  isCreatingRecord,
  createRecordError,
  createRecordForm,
  setCreateRecordForm,
  setShowCreateRecordModal,
  onCreateRecord,
}: Props) {
  if (!showCreateRecordModal) return null;

  return (
    <div className="modal-overlay" onClick={() => !isCreatingRecord && setShowCreateRecordModal(false)}>
      <div className="modal modal--form-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Add Referral Record</h3>
        <p style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "var(--text-muted)" }}>
          This creates a referral record directly with status &quot;Yes&quot;.
        </p>
        {createRecordError ? <div className="auth-error">{createRecordError}</div> : null}
        <form className="form form--two-col" onSubmit={onCreateRecord}>
          <div className="form-row">
            <label className="form-label">Company</label>
            <input
              type="text"
              placeholder="Company name"
              value={createRecordForm.company}
              onChange={(e) => setCreateRecordForm((p) => ({ ...p, company: e.target.value }))}
              autoFocus
              required
            />
          </div>
          <div className="form-row">
            <label className="form-label">Position / Request log</label>
            <input
              type="text"
              placeholder="Software Engineer"
              value={createRecordForm.request_log}
              onChange={(e) => setCreateRecordForm((p) => ({ ...p, request_log: e.target.value }))}
            />
          </div>
          <div className="form-row">
            <label className="form-label">Date</label>
            <input
              type="date"
              value={createRecordForm.request_date}
              onChange={(e) => setCreateRecordForm((p) => ({ ...p, request_date: e.target.value }))}
            />
          </div>
          <div className="form-row">
            <label className="form-label">Request link</label>
            <input
              type="url"
              placeholder="https://..."
              value={createRecordForm.request_link}
              onChange={(e) => setCreateRecordForm((p) => ({ ...p, request_link: e.target.value }))}
            />
          </div>
          <div className="form-row">
            <label className="form-label">Referred by</label>
            <input
              type="text"
              placeholder="Name"
              value={createRecordForm.referred_by_name}
              onChange={(e) => setCreateRecordForm((p) => ({ ...p, referred_by_name: e.target.value }))}
            />
          </div>
          <div className="form-row">
            <label className="form-label">Notes</label>
            <textarea
              placeholder="Optional notes"
              value={createRecordForm.comment}
              onChange={(e) => setCreateRecordForm((p) => ({ ...p, comment: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="action-btn"
              onClick={() => !isCreatingRecord && setShowCreateRecordModal(false)}
              disabled={isCreatingRecord}
            >
              Cancel
            </button>
            <button type="submit" disabled={isCreatingRecord}>
              {isCreatingRecord ? "Saving..." : "Add Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
