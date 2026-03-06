import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";

type HeaderAvatarMenuProps = {
  onImportCsv: () => void;
  onExportCsv: () => void;
  onAddFriend: () => void;
  onLogout: () => void;
  templateHref: string;
  initials?: string;
};

function normalizeAvatarInitials(raw: string | undefined): string {
  const cleaned = String(raw ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  if (!cleaned) return "U";
  return cleaned.slice(0, 2);
}

type HeaderMenuSection = "workspace" | "account";

type HeaderMenuAction = {
  id: string;
  label: string;
  section: HeaderMenuSection;
  tone?: "default" | "danger";
  icon: ReactNode;
  onSelect?: () => void;
  href?: string;
  download?: boolean;
};

export default function HeaderAvatarMenu({
  onImportCsv,
  onExportCsv,
  onAddFriend,
  onLogout,
  templateHref,
  initials = "U",
}: HeaderAvatarMenuProps) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | HTMLAnchorElement | null>>([]);
  const menuId = useId();

  const actions = useMemo<HeaderMenuAction[]>(
    () => [
      { id: "import", label: "Import CSV", section: "workspace", icon: <UploadIcon />, onSelect: onImportCsv },
      { id: "export", label: "Export CSV", section: "workspace", icon: <DownloadIcon />, onSelect: onExportCsv },
      {
        id: "template",
        label: "Download Template",
        section: "workspace",
        icon: <TemplateIcon />,
        href: templateHref,
        download: true,
      },
      { id: "friend", label: "Add Friend", section: "workspace", icon: <AddFriendIcon />, onSelect: onAddFriend },
      {
        id: "logout",
        label: "Logout",
        section: "account",
        tone: "danger",
        icon: <LogoutIcon />,
        onSelect: onLogout,
      },
    ],
    [onAddFriend, onExportCsv, onImportCsv, onLogout, templateHref],
  );

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) return;
    function onDocumentMouseDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!rootRef.current || !target) return;
      if (!rootRef.current.contains(target)) setIsOpen(false);
    }
    function onDocumentEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onDocumentEscape);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onDocumentEscape);
    };
  }, [isOpen]);

  function openMenu(focusTarget: "first" | "last" | "none" = "none") {
    setIsOpen(true);
    if (focusTarget === "none") return;
    requestAnimationFrame(() => {
      if (focusTarget === "first") itemRefs.current[0]?.focus();
      if (focusTarget === "last") itemRefs.current[actions.length - 1]?.focus();
    });
  }

  function closeMenu() {
    setIsOpen(false);
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu("first");
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu("last");
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen((prev) => !prev);
    }
  }

  function onMenuItemKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement | HTMLAnchorElement>,
    index: number,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = (index + 1) % actions.length;
      itemRefs.current[nextIndex]?.focus();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const prevIndex = (index - 1 + actions.length) % actions.length;
      itemRefs.current[prevIndex]?.focus();
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      itemRefs.current[0]?.focus();
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      itemRefs.current[actions.length - 1]?.focus();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      triggerRef.current?.focus();
    }
  }

  const workspaceActions = actions.filter((action) => action.section === "workspace");
  const accountActions = actions.filter((action) => action.section === "account");
  const avatarInitials = normalizeAvatarInitials(initials);

  return (
    <div className="avatar-menu" ref={rootRef}>
      <AvatarTriggerButton
        ref={triggerRef}
        initials={avatarInitials}
        isOpen={isOpen}
        menuId={menuId}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={onTriggerKeyDown}
      />
      {isOpen ? (
        <DropdownContainer id={menuId}>
          <SectionLabel>Workspace</SectionLabel>
          {workspaceActions.map((action, index) => (
            <MenuItem
              key={action.id}
              action={action}
              itemRef={(element) => {
                itemRefs.current[index] = element;
              }}
              onKeyDown={(event) => onMenuItemKeyDown(event, index)}
              onSelect={closeMenu}
            />
          ))}
          <Divider />
          <SectionLabel>Account</SectionLabel>
          {accountActions.map((action) => {
            const index = actions.findIndex((candidate) => candidate.id === action.id);
            return (
              <MenuItem
                key={action.id}
                action={action}
                itemRef={(element) => {
                  itemRefs.current[index] = element;
                }}
                onKeyDown={(event) => onMenuItemKeyDown(event, index)}
                onSelect={closeMenu}
              />
            );
          })}
        </DropdownContainer>
      ) : null}
    </div>
  );
}

type AvatarTriggerButtonProps = {
  initials: string;
  isOpen: boolean;
  menuId: string;
  onClick: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
};

const AvatarTriggerButton = forwardRef<HTMLButtonElement, AvatarTriggerButtonProps>(
  ({ initials, isOpen, menuId, onClick, onKeyDown }, ref) => (
    <button
      ref={ref}
      type="button"
      className="avatar-menu-trigger"
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-controls={isOpen ? menuId : undefined}
      aria-label="Open settings menu"
    >
      {initials}
    </button>
  ),
);

AvatarTriggerButton.displayName = "AvatarTriggerButton";

type DropdownContainerProps = {
  id: string;
  children: ReactNode;
};

function DropdownContainer({ id, children }: DropdownContainerProps) {
  return (
    <ul id={id} role="menu" aria-label="Settings menu" className="avatar-menu-dropdown">
      {children}
    </ul>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <li role="presentation" className="avatar-menu-section-label">
      {children}
    </li>
  );
}

function Divider() {
  return <li className="avatar-menu-divider" role="separator" />;
}

type MenuItemProps = {
  action: HeaderMenuAction;
  itemRef: (element: HTMLButtonElement | HTMLAnchorElement | null) => void;
  onSelect: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
};

function MenuItem({ action, itemRef, onSelect, onKeyDown }: MenuItemProps) {
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

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 4h9l5 5v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4Zm9 1.5V10h4.5L14 5.5Zm-2 3.7-3 3h2v3h2v-3h2l-3-3Z"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 4h9l5 5v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4Zm9 1.5V10h4.5L14 5.5Zm-2 5.8v-3h-2v3H8l3 3 3-3h-2Z"
      />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 4h10l4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4Zm10 1.5V9h3.5L15 5.5ZM11 10v2H9v2h2v2h2v-2h2v-2h-2v-2h-2Z"
      />
    </svg>
  );
}

function AddFriendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.3 0-6 1.7-6 4v2h10v-2c0-2.3-2.7-4-6-4Zm9-5V6h-2V4h-2v2h-2v2h2v2h2V8h2Z"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10 4H6a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h4v-2H6V6h4V4Zm4.3 3.3-1.4 1.4L15.2 11H9v2h6.2l-2.3 2.3 1.4 1.4L19 12l-4.7-4.7Z"
      />
    </svg>
  );
}
