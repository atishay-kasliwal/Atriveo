import type {
  ActiveOaRecord,
  IncomingFriendRequest,
  NetworkDeadlineRecord,
} from "./api";

export type PendingDeadlineAlert = {
  id: string;
  company: string;
  position: string;
  end_date: string;
  days_to_deadline: number;
  deadline_state: "overdue" | "today" | "upcoming";
};

export function derivePendingDeadlineAlerts(
  rows: Array<Record<string, unknown>>,
  anchorDay: string,
): PendingDeadlineAlert[] {
  const anchorDate = new Date(`${anchorDay}T00:00:00`);
  return rows
    .map((row) => {
      const endDateRaw = String(row.end_date ?? "").trim();
      if (!endDateRaw) return null;
      const targetDate = new Date(`${endDateRaw}T00:00:00`);
      if (Number.isNaN(targetDate.getTime())) return null;

      const daysToDeadline = Math.floor((targetDate.getTime() - anchorDate.getTime()) / 86400000);
      const deadlineState: PendingDeadlineAlert["deadline_state"] =
        daysToDeadline < 0 ? "overdue" : daysToDeadline === 0 ? "today" : "upcoming";

      return {
        id: String(row.id ?? `${endDateRaw}-${String(row.company ?? "")}-${String(row.position_name ?? "")}`),
        company: String(row.company ?? "Task").trim() || "Task",
        position: String(row.position_name ?? "").trim(),
        end_date: endDateRaw,
        days_to_deadline: daysToDeadline,
        deadline_state: deadlineState,
      };
    })
    .filter((item): item is PendingDeadlineAlert => item !== null)
    .filter((item) => item.days_to_deadline <= 7)
    .sort((a, b) => a.days_to_deadline - b.days_to_deadline);
}

export function buildNotificationSignature(
  incomingRows: IncomingFriendRequest[],
  oaRows: ActiveOaRecord[],
  pendingRows: PendingDeadlineAlert[],
  friendDeadlineRows: NetworkDeadlineRecord[],
): string {
  return JSON.stringify({
    incoming: incomingRows.map((r) => String(r.friendship_id)).sort(),
    ownDeadlines: oaRows
      .map((r) => `${r.id}:${r.oa_urgency}:${r.oa_deadline_date ?? ""}`)
      .sort(),
    taskDeadlines: pendingRows
      .map((r) => `${r.id}:${r.deadline_state}:${r.end_date}`)
      .sort(),
    friendDeadlines: friendDeadlineRows
      .map((r) => `${r.friend_id}:${r.job_id}:${r.deadline_state}:${r.oa_deadline_date ?? ""}`)
      .sort(),
  });
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return "No date";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function getPersonLabel(name: string | null | undefined, email: string | null | undefined): string {
  const rawName = String(name ?? "").trim();
  if (rawName) return rawName;
  const rawEmail = String(email ?? "").trim();
  if (!rawEmail) return "Friend";
  return rawEmail.includes("@") ? rawEmail.split("@")[0] : rawEmail;
}

export function getOwnDeadlineLabel(item: ActiveOaRecord): string {
  if (item.oa_urgency === "today") return "Due today";
  if (item.oa_urgency === "overdue") {
    const days = Math.abs(Number(item.days_to_deadline ?? 0));
    return days === 1 ? "Overdue by 1 day" : `Overdue by ${days} days`;
  }
  const days = Number(item.days_to_deadline ?? 0);
  return days <= 1 ? "Due tomorrow" : `Due in ${days} days`;
}

export function getPendingDeadlineLabel(item: PendingDeadlineAlert): string {
  if (item.deadline_state === "today") return "Due today";
  if (item.deadline_state === "overdue") {
    const days = Math.abs(item.days_to_deadline);
    return days === 1 ? "Overdue by 1 day" : `Overdue by ${days} days`;
  }
  return item.days_to_deadline === 1 ? "Due tomorrow" : `Due in ${item.days_to_deadline} days`;
}

export function getFriendDeadlineLabel(item: NetworkDeadlineRecord): string {
  if (item.deadline_state === "today") {
    return `Reached deadline today · ${formatDateShort(item.oa_deadline_date)}`;
  }
  const days = Math.abs(Number(item.days_to_deadline ?? 0));
  return `Overdue by ${days} day${days === 1 ? "" : "s"} · ${formatDateShort(item.oa_deadline_date)}`;
}
