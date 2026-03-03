import { useLocation } from "react-router-dom";

type SiteShellProps = {
  children: React.ReactNode;
};

export default function SiteShell({ children }: SiteShellProps) {
  const location = useLocation();
  const isDashboardRoute =
    location.pathname.startsWith("/dashboard") || location.pathname.startsWith("/app");

  if (!isDashboardRoute) {
    return <div className="marketing-page-content">{children}</div>;
  }

  return (
    <>
      <div className="dashboard-bg-art" aria-hidden />
      <div className="dashboard-page-content">{children}</div>
    </>
  );
}
