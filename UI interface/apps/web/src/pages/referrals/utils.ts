export function parseIsoDay(day: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const y = Number(match[1]);
  const month = Number(match[2]);
  const d = Number(match[3]);
  if (!y || month < 1 || month > 12 || d < 1 || d > 31) return null;
  return { y, m: month, d };
}

export function formatDayShort(day: string) {
  try {
    const p = parseIsoDay(day);
    if (!p) return day;
    return `${String(p.m).padStart(2, "0")}/${String(p.d).padStart(2, "0")}`;
  } catch {
    return day;
  }
}

export function textOrDash(value: unknown): string {
  const raw = String(value ?? "").trim();
  return raw || "—";
}

export function padReferralsWithDummyRows(
  rows: Array<Record<string, unknown>>,
  page: number,
  limit: number,
  type: "open" | "applied",
): Array<Record<string, unknown>> {
  if (rows.length === 0 || rows.length >= limit) return rows;
  const needed = limit - rows.length;
  const startNo = (page - 1) * limit + rows.length + 1;
  const dummyRows = Array.from({ length: needed }, (_, idx) => {
    const no = startNo + idx;
    const day = ((no % 27) + 1).toString().padStart(2, "0");
    const status = type === "open" ? "Requested" : no % 2 === 0 ? "Yes" : "No";
    return {
      id: `dummy-${type}-${page}-${no}`,
      request_date: `2026-03-${day}`,
      updated_date: `2026-03-${day}`,
      company: `Sample Company ${no}`,
      request_log: `Sample Role ${no}`,
      referral_received: status,
      referred_by_name: `Sample Referrer ${((no - 1) % 10) + 1}`,
      comment: "Dummy record for table preview",
      request_link: "",
      __dummy: true,
    } as Record<string, unknown>;
  });
  return [...rows, ...dummyRows];
}
