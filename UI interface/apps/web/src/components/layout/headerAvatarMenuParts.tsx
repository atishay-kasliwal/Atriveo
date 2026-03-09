import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

export type HeaderMenuSection = "workspace" | "account";

export type HeaderMenuAction = {
  id: string;
  label: string;
  section: HeaderMenuSection;
  tone?: "default" | "danger";
  icon: ReactNode;
  onSelect?: () => void;
  href?: string;
  download?: boolean;
};

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <li role="presentation" className="avatar-menu-section-label">
      {children}
    </li>
  );
}

export function Divider() {
  return <li className="avatar-menu-divider" role="separator" />;
}

type MenuItemProps = {
  action: HeaderMenuAction;
  itemRef: (element: HTMLButtonElement | HTMLAnchorElement | null) => void;
  onSelect: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
};

export function MenuItem({ action, itemRef, onSelect, onKeyDown }: MenuItemProps) {
  const className = `avatar-menu-item${action.tone === "danger" ? " avatar-menu-item--danger" : ""}`;
  if (action.href) {
    return (
      <li role="none">
        <a
          ref={itemRef}
          role="menuitem"
          className={className}
          href={action.href}
          download={action.download}
          onKeyDown={onKeyDown}
          onClick={onSelect}
        >
          <span className="avatar-menu-item-icon" aria-hidden>
            {action.icon}
          </span>
          <span>{action.label}</span>
        </a>
      </li>
    );
  }
  return (
    <li role="none">
      <button
        ref={itemRef}
        type="button"
        role="menuitem"
        className={className}
        onKeyDown={onKeyDown}
        onClick={() => {
          onSelect();
          action.onSelect?.();
        }}
      >
        <span className="avatar-menu-item-icon" aria-hidden>
          {action.icon}
        </span>
        <span>{action.label}</span>
      </button>
    </li>
  );
}

export function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 4h9l5 5v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4Zm9 1.5V10h4.5L14 5.5Zm-2 3.7-3 3h2v3h2v-3h2l-3-3Z"
      />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 4h9l5 5v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4Zm9 1.5V10h4.5L14 5.5Zm-2 5.8v-3h-2v3H8l3 3 3-3h-2Z"
      />
    </svg>
  );
}

export function TemplateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 4h10l4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4Zm10 1.5V9h3.5L15 5.5ZM11 10v2H9v2h2v2h2v-2h2v-2h-2v-2h-2Z"
      />
    </svg>
  );
}

export function AddFriendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.3 0-6 1.7-6 4v2h10v-2c0-2.3-2.7-4-6-4Zm9-5V6h-2V4h-2v2h-2v2h2v2h2V8h2Z"
      />
    </svg>
  );
}

export function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10 4H6a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h4v-2H6V6h4V4Zm4.3 3.3-1.4 1.4L15.2 11H9v2h6.2l-2.3 2.3 1.4 1.4L19 12l-4.7-4.7Z"
      />
    </svg>
  );
}
