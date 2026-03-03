type AuthHeroProps = {
  kicker: string;
  title: string;
  subtitle: string;
  description: string;
  footnote?: string;
};

const defaultHighlights = [
  {
    title: "Single workspace",
    subtitle: "Jobs, referrals, notes, and tasks in one place.",
  },
  {
    title: "Daily execution clarity",
    subtitle: "See what is urgent and what moves your pipeline.",
  },
  {
    title: "Secure by default",
    subtitle: "PBKDF2-hashed passwords and token-based sessions.",
  },
];

export function AuthHero({ kicker, title, subtitle, description, footnote }: AuthHeroProps) {
  return (
    <section className="auth-hero" aria-label="Atriveo account overview">
      <p className="auth-hero-kicker">{kicker}</p>
      <h1 className="auth-hero-title">{title}</h1>
      <p className="auth-hero-subtitle">{subtitle}</p>
      <p className="auth-hero-description">{description}</p>
      <div className="auth-hero-grid" role="list" aria-label="Atriveo highlights">
        {defaultHighlights.map((item) => (
          <div key={item.title} className="auth-hero-point" role="listitem">
            <span className="auth-hero-point-dot" aria-hidden />
            <div>
              <p className="auth-hero-point-title">{item.title}</p>
              <p className="auth-hero-point-subtitle">{item.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="auth-hero-footnote">{footnote || "Use your account credentials to continue."}</p>
    </section>
  );
}
