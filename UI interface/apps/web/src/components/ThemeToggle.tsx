type ThemeToggleProps = {
  theme: "light" | "dark";
  onToggle: () => void;
  className?: string;
};

type IconProps = {
  className?: string;
};

function SunIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.55 1.55M17.52 17.52l1.55 1.55M2 12h2.2M19.8 12H22M4.93 19.07l1.55-1.55M17.52 6.48l1.55-1.55" />
    </svg>
  );
}

function MoonIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.7A9 9 0 1 1 11.3 3a7.2 7.2 0 0 0 9.7 9.7z" />
    </svg>
  );
}

export function ThemeToggle({ theme, onToggle, className = "" }: ThemeToggleProps) {
  const nextLabel = theme === "light" ? "Dark mode" : "Light mode";

  return (
    <button
      type="button"
      className={`theme-toggle theme-toggle--${theme} ${className}`.trim()}
      onClick={onToggle}
      aria-label={`Switch to ${nextLabel}`}
      aria-pressed={theme === "dark"}
    >
      <span className="theme-toggle-track" aria-hidden>
        <SunIcon className="theme-toggle-glyph theme-toggle-glyph--sun" />
        <MoonIcon className="theme-toggle-glyph theme-toggle-glyph--moon" />
        <span className="theme-toggle-thumb">
          {theme === "light" ? (
            <SunIcon className="theme-toggle-thumb-icon" />
          ) : (
            <MoonIcon className="theme-toggle-thumb-icon" />
          )}
        </span>
      </span>
    </button>
  );
}
