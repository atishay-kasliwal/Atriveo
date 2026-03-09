export function computeUserInitials(firstName: string | null | undefined, lastName: string | null | undefined, email: string): string {
  const first = String(firstName ?? "").trim();
  const last = String(lastName ?? "").trim();
  if (first || last) {
    const firstLetter = first ? first[0] : "";
    const lastLetter = last ? last[0] : "";
    const pair = `${firstLetter}${lastLetter}`.toUpperCase();
    if (pair) return pair.slice(0, 2);
  }

  const local = String(email || "")
    .split("@")[0]
    ?.replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
  if (!local) return "U";
  const parts = local.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) || "U").toUpperCase();
}
