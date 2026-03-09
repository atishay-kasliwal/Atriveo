export function getDueTag(endDate: unknown): { label: string; tone: "ok" | "warn" | "danger" | "neutral" } {
  if (!endDate) return { label: "No due date", tone: "neutral" };
  const raw = String(endDate).slice(0, 10);
  const due = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(due.getTime())) return { label: "No due date", tone: "neutral" };
  const today = new Date();
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `Overdue ${Math.abs(diffDays)}d`, tone: "danger" };
  if (diffDays === 0) return { label: "Due today", tone: "warn" };
  if (diffDays <= 3) return { label: `Due in ${diffDays}d`, tone: "warn" };
  return { label: `Due in ${diffDays}d`, tone: "ok" };
}
