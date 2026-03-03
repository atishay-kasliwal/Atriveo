import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useLocation } from "react-router-dom";

type QuickCreateSplitButtonProps = {
  onNewApplication: () => void;
  onCreateTask: () => void;
  onLogNote: () => void;
};

type SplitAction = {
  id: "application" | "task" | "note";
  label: string;
  icon: string;
  run: () => void;
};

export default function QuickCreateSplitButton({
  onNewApplication,
  onCreateTask,
  onLogNote,
}: QuickCreateSplitButtonProps) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const actions = useMemo<SplitAction[]>(
    () => [
      { id: "application", label: "New Application", icon: "A", run: onNewApplication },
      { id: "task", label: "Create Task", icon: "T", run: onCreateTask },
      { id: "note", label: "Log Note", icon: "N", run: onLogNote },
    ],
    [onCreateTask, onLogNote, onNewApplication],
  );

  useEffect(() => {
    // Close the menu when route changes.
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) return;
    function onOutsideMouseDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!rootRef.current || !target) return;
      if (!rootRef.current.contains(target)) setIsOpen(false);
    }
    document.addEventListener("mousedown", onOutsideMouseDown);
    return () => document.removeEventListener("mousedown", onOutsideMouseDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onEsc(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [isOpen]);

  function openMenu(focusTarget: "first" | "last" | "none" = "none") {
    setIsOpen(true);
    if (focusTarget === "none") return;
    requestAnimationFrame(() => {
      if (focusTarget === "first") itemRefs.current[0]?.focus();
      if (focusTarget === "last") itemRefs.current[actions.length - 1]?.focus();
    });
  }

  function runAction(action: SplitAction) {
    setIsOpen(false);
    action.run();
  }

  function onPrimaryKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu("last");
    }
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu("last");
    }
  }

  function onMenuItemKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
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
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <div className="app-split-create" ref={rootRef}>
      <button
        type="button"
        className="app-split-create-primary"
        onClick={onNewApplication}
        onKeyDown={onPrimaryKeyDown}
        aria-label="Create new item"
      >
        + New
      </button>
      <span className="app-split-create-divider" aria-hidden />
      <button
        ref={triggerRef}
        type="button"
        className="app-split-create-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label="Open create menu"
      >
        ▾
      </button>
      {isOpen ? (
        <ul id={menuId} className="app-split-create-menu" role="menu" aria-label="Create options">
          {actions.map((action, index) => (
            <li key={action.id} role="none">
              <button
                type="button"
                role="menuitem"
                className="app-split-create-menu-item"
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                onKeyDown={(event) => onMenuItemKeyDown(event, index)}
                onClick={() => runAction(action)}
              >
                <span className="app-split-create-menu-icon" aria-hidden>
                  {action.icon}
                </span>
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
