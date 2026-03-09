import { NavLink } from "react-router-dom";

type MobileNavItem = {
  to: string;
  label: string;
  end?: boolean;
  icon: React.ReactNode;
};

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 10.75 12 4l9 6.75" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.75 10.5v8.25h10.5V10.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="6.75" width="17" height="12.5" rx="2.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 6.75V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v1.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 12.25H20.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="10.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 18a4.5 4.5 0 0 1 9 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13.5 18a3 3 0 0 1 6 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.75v4.75l3.25 1.75" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_ITEMS: MobileNavItem[] = [
  { to: ".", label: "Home", end: true, icon: <HomeIcon /> },
  { to: "jobs", label: "Applications", icon: <BriefcaseIcon /> },
  { to: "network", label: "Analytics", icon: <PeopleIcon /> },
  { to: "pending", label: "Follow Up", icon: <ClockIcon /> },
];

export default function MobileBottomNav() {
  return (
    <>
      <style>
        {`
          .mobile-bottom-nav {
            display: none;
          }

          @media (max-width: 640px) {
            .mobile-bottom-nav {
              display: block;
              position: fixed;
              left: 0;
              right: 0;
              bottom: 0;
              z-index: 55;
              border-top: 1px solid color-mix(in srgb, var(--bg-card-border) 88%, transparent);
              background: color-mix(in srgb, var(--bg-card) 96%, transparent);
              box-shadow: 0 -10px 26px color-mix(in srgb, #020617 14%, transparent);
              backdrop-filter: blur(10px);
              -webkit-backdrop-filter: blur(10px);
              padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
            }

            .mobile-bottom-nav__list {
              list-style: none;
              margin: 0 auto;
              padding: 0;
              max-width: 560px;
              display: flex;
              align-items: stretch;
              justify-content: space-between;
              gap: 4px;
            }

            .mobile-bottom-nav__item {
              flex: 1 1 0;
              min-width: 0;
            }

            .mobile-bottom-nav__link {
              min-height: 44px;
              border-radius: 12px;
              text-decoration: none;
              color: var(--text-muted);
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 4px;
              padding: 6px 4px;
              font-size: 0.68rem;
              font-weight: 600;
              line-height: 1.15;
              letter-spacing: 0.01em;
              transition: color 0.18s ease, background-color 0.18s ease;
            }

            .mobile-bottom-nav__link:focus-visible {
              outline: 2px solid color-mix(in srgb, var(--accent) 38%, transparent);
              outline-offset: 2px;
            }

            .mobile-bottom-nav__link.is-active {
              color: var(--accent);
              background: color-mix(in srgb, var(--accent) 12%, transparent);
            }

            .mobile-bottom-nav__icon {
              width: 18px;
              height: 18px;
              display: block;
            }

            .mobile-bottom-nav__icon svg {
              width: 100%;
              height: 100%;
              display: block;
            }

            .app-nav-bottom {
              display: none;
            }

            .page-main.page-main--mobile-nav-safe {
              padding-bottom: calc(88px + env(safe-area-inset-bottom));
            }
          }
        `}
      </style>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <ul className="mobile-bottom-nav__list">
          {NAV_ITEMS.map((item) => (
            <li key={item.to} className="mobile-bottom-nav__item">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `mobile-bottom-nav__link${isActive ? " is-active" : ""}`
                }
              >
                <span className="mobile-bottom-nav__icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

