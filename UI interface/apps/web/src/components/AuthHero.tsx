import { useMemo } from "react";

type SparkPoint = {
  value: number;
  date: string; // YYYY-MM-DD
};

function generateSparkline(seedKey: string, days = 60): SparkPoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const base = Number(`${today.getFullYear()}${today.getMonth() + 1}${today.getDate()}`);

  let seed = base || 1;
  for (let i = 0; i < seedKey.length; i += 1) {
    seed = (seed * 31 + seedKey.charCodeAt(i)) & 0x7fffffff;
  }

  const startMs = today.getTime() - (days - 1) * 24 * 60 * 60 * 1000;
  const points: SparkPoint[] = [];
  let x = seed || 1;

  for (let i = 0; i < days; i += 1) {
    const current = new Date(startMs + i * 24 * 60 * 60 * 1000);
    x = (1103515245 * x + 12345) & 0x7fffffff;
    const t = x / 0x7fffffff;
    const value = 0.25 + t * 0.6; // keep between 0.25 and 0.85
    points.push({
      value,
      date: current.toISOString().slice(0, 10),
    });
  }

  return points;
}

function formatShortDateLabel(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type HeroMetricCardProps = {
  title: string;
  subtitle: string;
  primary: string;
  change: string;
  seedKey: string;
};

function HeroMetricCard({ title, subtitle, primary, change, seedKey }: HeroMetricCardProps) {
  const series = useMemo(() => generateSparkline(seedKey, 60), [seedKey]);
  const pathD = useMemo(() => {
    if (!series.length) return "";
    const lastIndex = series.length - 1 || 1;
    return series
      .map(({ value }, idx) => {
        const x = lastIndex === 0 ? 0 : (idx / lastIndex) * 100;
        const y = 35 - value * 22;
        return `${idx === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [series]);

  const dateTicks = useMemo(() => {
    if (!series.length) return [];
    const lastIndex = series.length - 1 || 1;
    const indices = Array.from(
      new Set([
        0,
        Math.floor(series.length / 2),
        series.length - 1,
      ]),
    ).filter((i) => i >= 0 && i < series.length);
    return indices.map((idx) => {
      const point = series[idx];
      const x = lastIndex === 0 ? 0 : (idx / lastIndex) * 100;
      return {
        x,
        label: formatShortDateLabel(point.date),
      };
    });
  }, [series]);

  const lineId = `auth-hero-line-${seedKey}`;
  const fillId = `auth-hero-fill-${seedKey}`;

  return (
    <article className="auth-hero-card">
      <header className="auth-hero-card-header">
        <div>
          <p className="auth-hero-card-title">{title}</p>
          <p className="auth-hero-card-subtitle">{subtitle}</p>
        </div>
        <div className="auth-hero-card-metric">
          <span className="auth-hero-card-value">{primary}</span>
          <span className="auth-hero-card-change">{change}</span>
        </div>
      </header>
      <svg
        className="auth-hero-chart"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={lineId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.35)" />
            <stop offset="100%" stopColor="rgba(15, 23, 42, 0)" />
          </linearGradient>
        </defs>
        {pathD ? (
          <>
            <path
              d={`${pathD} V 40 H 0 Z`}
              fill={`url(#${fillId})`}
              stroke="none"
            />
            <path
              d={pathD}
              fill="none"
              stroke={`url(#${lineId})`}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            {series.map(({ value }, idx) => {
              const lastIndex = series.length - 1 || 1;
              const x = lastIndex === 0 ? 0 : (idx / lastIndex) * 100;
              const y = 35 - value * 22;
              if (idx % 5 !== 0 && idx !== series.length - 1) return null;
              return (
                <circle
                  key={idx}
                  cx={x}
                  cy={y}
                  r={0.8}
                  fill="#e0f2fe"
                  opacity={0.8}
                />
              );
            })}
            {dateTicks.map((tick, idx) => (
              <text
                key={idx}
                x={tick.x}
                y={38.5}
                textAnchor="middle"
                fontSize={3}
                fill="rgba(148, 163, 184, 0.9)"
              >
                {tick.label}
              </text>
            ))}
          </>
        ) : null}
      </svg>
      <footer className="auth-hero-card-footer">
        <span>Today&apos;s illustrative signal</span>
        <span className="auth-hero-card-footnote">Updates daily</span>
      </footer>
    </article>
  );
}

type AuthHeroProps = {
  kicker: string;
  title: string;
  subtitle: string;
  description: string;
  footnote?: string;
};

export function AuthHero({ kicker, title, subtitle, description, footnote }: AuthHeroProps) {
  return (
    <section className="auth-hero" aria-label="Preview of upcoming dashboard">
      <p className="auth-hero-kicker">{kicker}</p>
      <h1 className="auth-hero-title">{title}</h1>
      <p className="auth-hero-subtitle">{subtitle}</p>
      <p className="auth-hero-description">{description}</p>
      <div className="auth-hero-grid">
        <HeroMetricCard
          title="S&P 500"
          subtitle="Real-time snapshot"
          primary="4,538.73"
          change="+10.34%"
          seedKey="sp500"
        />
        <HeroMetricCard
          title="Nasdaq 100"
          subtitle="Market momentum"
          primary="15,436.12"
          change="+12.80%"
          seedKey="nasdaq100"
        />
      </div>
      <p className="auth-hero-footnote">{footnote || "Data is illustrative only. Product insights coming soon."}</p>
    </section>
  );
}

export { HeroMetricCard };
