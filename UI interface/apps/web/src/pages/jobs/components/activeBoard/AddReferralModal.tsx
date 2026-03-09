import type { Dispatch, FormEvent, SetStateAction } from "react";

type AddReferralForm = {
  name: string;
  company: string;
  role: string;
};

type Props = {
  open: boolean;
  isSaving: boolean;
  error: string;
  form: AddReferralForm;
  setForm: Dispatch<SetStateAction<AddReferralForm>>;
  onClose: () => void;
  onSubmit: (e: FormEvent) => Promise<void>;
};

export default function AddReferralModal({
  open,
  isSaving,
  error,
  form,
  setForm,
  onClose,
  onSubmit,
}: Props) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={() => !isSaving && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add Referral</h3>
        <p style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "var(--text-muted)" }}>
          Add a referral contact record to your dashboard.
        </p>
        {error ? <div className="auth-error">{error}</div> : null}
        <form className="form" onSubmit={onSubmit}>
          <label className="form-label">Name</label>
          <input
            type="text"
            placeholder="Referral name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            autoFocus
          />
          <label className="form-label">Company</label>
          <input
            type="text"
            placeholder="Company name"
            value={form.company}
            onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
            required
          />
          <label className="form-label">Role</label>
          <input
            type="text"
            placeholder="Software Engineer"
            value={form.role}
            onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
          />
          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Referral"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
