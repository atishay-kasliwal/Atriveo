export type CanvasTheme = {
  mode: "light" | "dark";
  fontFamily: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  grid: string;
  gridOpacity: number;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipShadow: string;
};

export function rgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const safe = normalized.length === 3
    ? normalized.split("").map((c) => `${c}${c}`).join("")
    : normalized;
  const r = Number.parseInt(safe.slice(0, 2), 16);
  const g = Number.parseInt(safe.slice(2, 4), 16);
  const b = Number.parseInt(safe.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function resolveTheme(modeOverride?: "light" | "dark"): CanvasTheme {
  const fallback: CanvasTheme = {
    mode: "dark",
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    textPrimary: "#F8FAFC",
    textSecondary: "#CBD5E1",
    textMuted: "#94A3B8",
    grid: "rgba(51,65,85,0.35)",
    gridOpacity: 0.42,
    tooltipBg: "#0F172A",
    tooltipBorder: "rgba(148,163,184,0.34)",
    tooltipShadow: "0 14px 28px rgba(2, 6, 23, 0.5)",
  };

  if (typeof window === "undefined") return fallback;

  const styles = window.getComputedStyle(document.documentElement);
  const value = (name: string, backup: string) => styles.getPropertyValue(name).trim() || backup;

  const mode = modeOverride ?? ((document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark") as "light" | "dark");
  return {
    mode,
    fontFamily: value("--font-header", fallback.fontFamily),
    textPrimary: mode === "light" ? "#0F172A" : value("--chart-text", fallback.textPrimary),
    textSecondary: mode === "light" ? "#334155" : value("--chart-text-secondary", fallback.textSecondary),
    textMuted: mode === "light" ? "#64748B" : "#94A3B8",
    grid: mode === "light" ? "#C7D2E4" : value("--network-chart-grid", fallback.grid),
    gridOpacity: mode === "light" ? 0.72 : 0.42,
    tooltipBg: mode === "light" ? "#FFFFFF" : value("--chart-tooltip-bg", fallback.tooltipBg),
    tooltipBorder: mode === "light" ? "#DCE6F5" : value("--chart-tooltip-border", fallback.tooltipBorder),
    tooltipShadow: mode === "light" ? "0 12px 28px rgba(15, 23, 42, 0.14)" : value("--chart-tooltip-shadow", fallback.tooltipShadow),
  };
}
