import { useCallback, useEffect, useRef, useState } from "react";

type ConfirmDialogOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

type NormalizedConfirmDialogOptions = {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
};

const DEFAULT_OPTIONS: Omit<NormalizedConfirmDialogOptions, "message"> = {
  title: "Confirm Action",
  confirmText: "Confirm",
  cancelText: "No, Keep it",
};

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M9.5 3.75h5a1 1 0 0 1 1 1v1h3a.75.75 0 0 1 0 1.5h-13a.75.75 0 0 1 0-1.5h3v-1a1 1 0 0 1 1-1z" />
      <path d="M7.75 8.5h8.5l-.55 9.07a2 2 0 0 1-2 1.88h-3.4a2 2 0 0 1-2-1.88L7.75 8.5z" />
      <path d="M10.15 10.35a.75.75 0 0 1 .75.75v5.7a.75.75 0 0 1-1.5 0v-5.7a.75.75 0 0 1 .75-.75zm3.7 0a.75.75 0 0 1 .75.75v5.7a.75.75 0 0 1-1.5 0v-5.7a.75.75 0 0 1 .75-.75z" />
    </svg>
  );
}

export default function useConfirmDialog() {
  const [options, setOptions] = useState<NormalizedConfirmDialogOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback((value: boolean) => {
    setOptions(null);
    if (resolverRef.current) {
      resolverRef.current(value);
      resolverRef.current = null;
    }
  }, []);

  const confirm = useCallback((next: ConfirmDialogOptions) => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions({
        title: next.title || DEFAULT_OPTIONS.title,
        message: next.message,
        confirmText: next.confirmText || DEFAULT_OPTIONS.confirmText,
        cancelText: next.cancelText || DEFAULT_OPTIONS.cancelText,
      });
    });
  }, []);

  useEffect(() => {
    if (!options) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close(false);
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [options, close]);

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(false);
      }
    };
  }, []);

  const confirmDialog = options ? (
    <div className="modal-overlay confirm-overlay" onClick={() => close(false)}>
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-dialog-icon" aria-hidden="true">
          <TrashIcon />
        </div>
        <h3 id="confirm-dialog-title" className="confirm-dialog-title">
          {options.title}
        </h3>
        <p id="confirm-dialog-message" className="confirm-dialog-message">
          {options.message}
        </p>
        <div className="confirm-dialog-actions">
          <button type="button" className="confirm-dialog-btn confirm-dialog-btn--cancel" onClick={() => close(false)}>
            {options.cancelText}
          </button>
          <button type="button" className="confirm-dialog-btn confirm-dialog-btn--confirm" onClick={() => close(true)} autoFocus>
            {options.confirmText}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, confirmDialog };
}
