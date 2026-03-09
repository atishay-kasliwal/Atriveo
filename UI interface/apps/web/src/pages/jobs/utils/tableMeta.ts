export function getStatusMeta(raw: string) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "rejected") return { label: "Rejected", cls: "status-chip status-chip--rejected" };
  if (value === "under consideration") return { label: "Under review", cls: "status-chip status-chip--review" };
  if (value === "open") return { label: "Open", cls: "status-chip status-chip--open" };
  return { label: raw || "Applied", cls: "status-chip status-chip--applied" };
}

export function getKeywordMeta(raw: string) {
  const value = String(raw || "Medium").trim().toLowerCase();
  if (value === "strong") return { label: "Strong", cls: "" };
  if (value === "weak" || value === "week") return { label: "Weak", cls: "" };
  return { label: "Medium", cls: "" };
}
