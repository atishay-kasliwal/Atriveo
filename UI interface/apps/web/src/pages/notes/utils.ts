import type { NotePriority, NoteRow } from "./types";

export function normalizePriority(note: NoteRow): NotePriority {
  const raw = String(note.priority ?? "").trim();
  if (raw === "High" || raw === "Medium" || raw === "Low" || raw === "Archive") {
    return raw;
  }
  return note.is_done ? "Archive" : "Medium";
}

export function splitNote(comments: string): { title: string; body: string } {
  const [titleLine, ...restLines] = comments.split("\n");
  const cleaned = restLines
    .map((line) => line.trim())
    .map((line) => {
      const m = /^last\\s*date\\s*:\\s*\\d{4}-\\d{2}-\\d{2}\\s*(.*)$/i.exec(line);
      if (!m) return line;
      return (m[1] ?? "").trim();
    })
    .filter((line) => line.length > 0)
    .join("\n");
  return {
    title: titleLine?.trim() || "(Untitled)",
    body: cleaned,
  };
}

export function splitNoteForEdit(comments: string): { title: string; body: string } {
  const [titleLine, ...restLines] = comments.split("\n");
  const title = titleLine?.trim() || "";
  const body = restLines
    .map((line) => line.trim())
    .map((line) => {
      const m = /^last\s*date\s*:\s*\d{4}-\d{2}-\d{2}\s*(.*)$/i.exec(line);
      if (!m) return line;
      return (m[1] ?? "").trim();
    })
    .filter((line) => line.length > 0)
    .join("\n");
  return { title, body };
}
