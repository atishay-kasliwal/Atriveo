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
import {
  AddFriendIcon,
  Divider,
  DownloadIcon,
  LogoutIcon,
  MenuItem,
  ProfileIcon,
  SectionLabel,
  TemplateIcon,
  UploadIcon,
  type HeaderMenuAction,
} from "./headerAvatarMenuParts";

type HeaderAvatarMenuProps = {
  onImportCsv: () => void;
  onExportCsv: () => void;
  onAddFriend: () => void;
  onLogout: () => void;
  onProfile: () => void;
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

export default function HeaderAvatarMenu({
  onImportCsv,
  onExportCsv,
  onAddFriend,
  onLogout,
  onProfile,
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
      { id: "profile", label: "Edit Profile", section: "account", icon: <ProfileIcon />, onSelect: onProfile },
      {
        id: "logout",
        label: "Logout",
        section: "account",
        tone: "danger",
        icon: <LogoutIcon />,
        onSelect: onLogout,
      },
    ],
    [onAddFriend, onExportCsv, onImportCsv, onLogout, onProfile, templateHref],
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

