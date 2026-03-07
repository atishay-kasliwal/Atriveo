import { useEffect, useMemo } from "react";
import type { NetworkFieldVisibility } from "../../lib/api";

const FIELD_META: Record<
  keyof NetworkFieldVisibility,
  { label: string; description: string }
> = {
  share_company: {
    label: "Company",
    description: "Company names are always shown for context",
  },
  share_role: {
    label: "Role",
    description: "Role titles are always shown for context",
  },
  share_applied_at: {
    label: "Applied Date",
    description: "Application date is always shown for trend consistency",
  },
  share_oa_status: {
    label: "OA Status",
    description: "See if friends passed the online assessment",
  },
  share_oa_deadline: {
    label: "OA Deadline",
    description: "Know upcoming deadlines friends are preparing for",
  },
  share_referral_used: {
    label: "Referral Used",
    description: "Understand where referrals are helping",
  },
  share_notes: {
    label: "Notes",
    description: "Share personal notes about the application",
  },
  share_job_application_id: {
    label: "Job/Application ID",
    description: "Let friends see your job or application IDs for reference",
  },
};

const ALWAYS_SHARED_ORDER: Array<keyof NetworkFieldVisibility> = [
  "share_company",
  "share_role",
  "share_applied_at",
  "share_job_application_id",
];

const OPTIONAL_ORDER: Array<keyof NetworkFieldVisibility> = [
  "share_oa_status",
  "share_oa_deadline",
  "share_referral_used",
  "share_notes",
];

type ManageSharedFieldsModalProps = {
  open: boolean;
  saving: boolean;
  error: string;
  visibility: NetworkFieldVisibility;
  requiredFields: Array<keyof NetworkFieldVisibility>;
  onClose: () => void;
  onSave: () => void;
  onToggle: (key: keyof NetworkFieldVisibility, value: boolean) => void;
};

function LockGlyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M6.75 8V6.875a3.25 3.25 0 1 1 6.5 0V8h.75A1.75 1.75 0 0 1 15.75 9.75v5.5A1.75 1.75 0 0 1 14 17H6A1.75 1.75 0 0 1 4.25 15.25v-5.5A1.75 1.75 0 0 1 6 8h.75Zm1.5 0h3.5V6.875a1.75 1.75 0 1 0-3.5 0V8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function InfoGlyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M10 1.5A8.5 8.5 0 1 0 10 18.5A8.5 8.5 0 1 0 10 1.5Zm0 3.75a1.1 1.1 0 1 1 0 2.2a1.1 1.1 0 1 1 0-2.2Zm-1.2 4.2h2.4v5.3H8.8v-5.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M5.47 4.41a.75.75 0 0 0-1.06 1.06L8.94 10l-4.53 4.53a.75.75 0 1 0 1.06 1.06L10 11.06l4.53 4.53a.75.75 0 0 0 1.06-1.06L11.06 10l4.53-4.53a.75.75 0 0 0-1.06-1.06L10 8.94L5.47 4.41Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function ManageSharedFieldsModal({
  open,
  saving,
  error,
  visibility,
  requiredFields,
  onClose,
  onSave,
  onToggle,
}: ManageSharedFieldsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, saving]);

  const requiredSet = useMemo(() => new Set(requiredFields), [requiredFields]);
  const alwaysShared = ALWAYS_SHARED_ORDER.filter((key) => requiredSet.has(key));
  const optional = OPTIONAL_ORDER.filter((key) => !requiredSet.has(key));

  if (!open) return null;

  return (
    <div
      className="modal-overlay network-shared-fields-overlay"
      onClick={() => !saving && onClose()}
    >
      <section
        className="modal network-shared-fields-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-shared-fields-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close-x network-shared-fields-close"
          onClick={onClose}
          disabled={saving}
          aria-label="Close shared fields modal"
        >
          <CloseGlyph />
        </button>

        <header className="network-shared-fields-header">
          <h3 id="manage-shared-fields-title">Manage Shared Fields</h3>
          <p>
            Fields are visible only when both you and your friend choose to share
            them.
          </p>
        </header>

        <div className="network-shared-fields-grid">
          <div className="network-shared-fields-left">
            <section className="network-shared-fields-block">
              <p className="network-shared-fields-kicker">Always Shared</p>
              <div className="network-shared-fields-stack">
                {alwaysShared.map((key) => (
                  <div
                    key={key}
                    className="network-shared-fields-row network-shared-fields-row--required"
                  >
                    <div className="network-shared-fields-row-left">
                      <span className="network-shared-fields-lock" aria-hidden="true">
                        <LockGlyph />
                      </span>
                      <span>{FIELD_META[key].label}</span>
                    </div>
                    <span className="network-shared-fields-required">Required</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="network-shared-fields-block">
              <p className="network-shared-fields-kicker">Optional</p>
              <div className="network-shared-fields-stack">
                {optional.map((key) => {
                  const enabled = Boolean(visibility[key]);
                  return (
                    <label
                      key={key}
                      className={`network-shared-fields-option${enabled ? " is-enabled" : ""}`}
                    >
                      <div className="network-shared-fields-option-top">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(event) => onToggle(key, event.target.checked)}
                          disabled={saving}
                        />
                        <span className="network-shared-fields-option-title">
                          {FIELD_META[key].label}
                        </span>
                      </div>
                      <p className="network-shared-fields-option-desc">
                        {FIELD_META[key].description}
                      </p>
                    </label>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="network-shared-fields-right">
            <div className="network-shared-fields-right-head">
              <span className="network-shared-fields-info-icon" aria-hidden="true">
                <InfoGlyph />
              </span>
              <h4>How Mutual Sharing Works</h4>
            </div>

            <div className="network-shared-fields-compare">
              <section
                className="network-shared-fields-user-card"
                aria-label="You shared fields"
              >
                <p className="network-shared-fields-card-title">You</p>
                <ul>
                  {ALWAYS_SHARED_ORDER.map((key) => (
                    <li key={`you-${key}`} className="is-locked">
                      <LockGlyph />
                      <span>{FIELD_META[key].label}</span>
                    </li>
                  ))}
                  {OPTIONAL_ORDER.map((key) => (
                    <li key={`you-${key}`} className={visibility[key] ? "is-enabled" : ""}>
                      <span>{FIELD_META[key].label}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section
                className="network-shared-fields-user-card"
                aria-label="Friend shared fields"
              >
                <p className="network-shared-fields-card-title">Friend</p>
                <ul>
                  {ALWAYS_SHARED_ORDER.map((key) => (
                    <li key={`friend-${key}`} className="is-locked">
                      <LockGlyph />
                      <span>{FIELD_META[key].label}</span>
                    </li>
                  ))}
                  {OPTIONAL_ORDER.map((key) => (
                    <li key={`friend-${key}`}>
                      <span>{FIELD_META[key].label}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <p className="network-shared-fields-explainer">
              Locked fields are always shared. Optional fields become visible only
              when both you and your friend enable them. Each friend controls
              their own optional fields independently.
            </p>
          </aside>
        </div>

        {error ? <div className="auth-error">{error}</div> : null}

        <footer className="network-shared-fields-footer">
          <p>You can change these settings anytime.</p>
          <div className="network-shared-fields-footer-actions">
            <button
              type="button"
              className="action-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="network-shared-fields-save-btn"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
