import { useEffect, useMemo } from "react";
import type { NetworkFieldVisibility } from "../../lib/api";
import { CloseGlyph, InfoGlyph, LockGlyph } from "./SharedFieldIcons";
import { ALWAYS_SHARED_ORDER, FIELD_META, OPTIONAL_ORDER } from "./sharedFieldsConfig";

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
