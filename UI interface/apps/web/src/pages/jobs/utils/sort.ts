import type { SortField, SortOrder } from "../types";

export function compareJobs(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  field: SortField,
  order: SortOrder,
  useArchiveDate: boolean,
): number {
  const avRaw = a[field];
  const bvRaw = b[field];
  const av =
    field === "date_saved" && useArchiveDate
      ? // prefer archive_date when present for archive view
        ((a as any).archive_date ?? avRaw)
      : avRaw;
  const bv = field === "date_saved" && useArchiveDate ? ((b as any).archive_date ?? bvRaw) : bvRaw;
  const empty = (v: unknown) => v == null || v === "";
  if (empty(av) && empty(bv)) return 0;
  if (empty(av)) return order === "asc" ? 1 : -1;
  if (empty(bv)) return order === "asc" ? -1 : 1;
  if (field === "date_saved" || field === "applied_at") {
    const da = new Date(String(av)).getTime();
    const db = new Date(String(bv)).getTime();
    return order === "asc" ? da - db : db - da;
  }
  const sa = String(av).toLowerCase();
  const sb = String(bv).toLowerCase();
  const cmp = sa.localeCompare(sb);
  return order === "asc" ? cmp : -cmp;
}
