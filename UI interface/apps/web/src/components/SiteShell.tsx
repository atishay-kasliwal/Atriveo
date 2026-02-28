type SiteShellProps = {
  children: React.ReactNode;
};

export default function SiteShell({ children }: SiteShellProps) {
  return (
    <>
      <div className="dashboard-bg-art" aria-hidden />
      <div className="dashboard-page-content">{children}</div>
    </>
  );
}
