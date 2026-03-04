import { useEffect, useId, useRef, useState } from "react";

type DropdownItem = {
  id: string;
  label: string;
  onSelect: () => void;
};

type DropdownButtonProps = {
  label: string;
  items: DropdownItem[];
  onPrimaryAction?: () => void;
  className?: string;
};

export default function DropdownButton({ label, items, onPrimaryAction, className = "" }: DropdownButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;
    function onOutsideMouseDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!rootRef.current || !target) return;
      if (!rootRef.current.contains(target)) setIsOpen(false);
    }
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", onOutsideMouseDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onOutsideMouseDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [isOpen]);

  return (
    <div className={`dropdown-button ${isOpen ? "is-open" : ""} ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className="dropdown-button-primary"
        onClick={() => {
          if (onPrimaryAction) onPrimaryAction();
          else setIsOpen((prev) => !prev);
        }}
      >
        <span className="dropdown-button-plus" aria-hidden="true">
          <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </span>
        <span>{label}</span>
      </button>
      <button
        type="button"
        className={`dropdown-button-trigger${isOpen ? " is-open" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={`Open ${label} menu`}
      >
        <span className={`dropdown-button-chevron${isOpen ? " is-open" : ""}`} aria-hidden="true">
          <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
            <path d="M4 10l4-4 4 4" />
          </svg>
        </span>
      </button>
      {isOpen ? (
        <ul id={menuId} className="dropdown-button-menu" role="menu" aria-label={`${label} menu`}>
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                className="dropdown-button-item"
                onClick={() => {
                  setIsOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
