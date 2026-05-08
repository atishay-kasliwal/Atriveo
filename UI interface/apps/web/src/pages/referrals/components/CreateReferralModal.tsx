import type { CreateReferralForm } from "../types";
import { REFERRAL_SOURCE_OPTIONS } from "../constants";

type Props = {
  showCreateModal: boolean;
  isCreating: boolean;
  createForm: CreateReferralForm;
  setCreateForm: React.Dispatch<React.SetStateAction<CreateReferralForm>>;
  closeCreateReferral: () => void;
  onCreateReferralRequest: (e: React.FormEvent) => Promise<void>;
};

export default function CreateReferralModal({
  showCreateModal,
  isCreating,
  createForm,
  setCreateForm,
  closeCreateReferral,
  onCreateReferralRequest,
}: Props) {
  if (!showCreateModal) return null;

  return (
    <div className="modal-overlay" onClick={closeCreateReferral}>
      <div className="modal modal--quickadd" onClick={(e) => e.stopPropagation()}>
        <h3>New Referral Request</h3>
        <form className="form form--quickadd" onSubmit={onCreateReferralRequest}>
          <div className="qa-left">
            <input
              placeholder="Company *"
              value={createForm.company}
              onChange={(e) => setCreateForm((p) => ({ ...p, company: e.target.value }))}
              autoFocus
            />
            <input
              placeholder="Position / Request log *"
              value={createForm.request_log}
              onChange={(e) => setCreateForm((p) => ({ ...p, request_log: e.target.value }))}
            />
            <div className="form-row">
              <label className="form-label">Referral Date</label>
              <input
                type="date"
                value={createForm.request_date}
                onChange={(e) => setCreateForm((p) => ({ ...p, request_date: e.target.value }))}
              />
            </div>
            <input
              placeholder="Referred by name (optional)"
              value={createForm.referred_by_name}
              onChange={(e) => setCreateForm((p) => ({ ...p, referred_by_name: e.target.value }))}
            />
            <div className="form-row">
              <label className="form-label">Source</label>
              <select
                className="form-select"
                value={createForm.source}
                onChange={(e) => setCreateForm((p) => ({ ...p, source: e.target.value }))}
              >
                <option value="">Default (Manual)</option>
                {REFERRAL_SOURCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="qa-right">
            <input
              type="url"
              placeholder="Referral link (optional)"
              value={createForm.request_link}
              onChange={(e) => setCreateForm((p) => ({ ...p, request_link: e.target.value }))}
            />
            <div className="form-row">
              <label className="form-label">Keyword Matching</label>
              <select
                className="form-select"
                value={createForm.keyword_matching}
                onChange={(e) => setCreateForm((p) => ({ ...p, keyword_matching: e.target.value }))}
              >
                <option value="Strong">Strong</option>
                <option value="Medium">Medium</option>
                <option value="Weak">Weak</option>
              </select>
            </div>
            <textarea
              placeholder="Notes (optional)"
              rows={5}
              value={createForm.comment}
              onChange={(e) => setCreateForm((p) => ({ ...p, comment: e.target.value }))}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="action-btn" onClick={closeCreateReferral} disabled={isCreating}>
              Cancel
            </button>
            <button type="submit" disabled={isCreating || !createForm.company.trim() || !createForm.request_log.trim()}>
              {isCreating ? "Saving..." : "Create Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
