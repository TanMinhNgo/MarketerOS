export interface ReminderItem {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
}

export interface DueReminder {
  key: string;
  type: "digest" | "soon";
  title: string;
  description: string;
}

/** Nhắc trước giờ đăng. */
export const LEAD_MS = 15 * 60_000;
/** Đã quá giờ đăng lâu hơn mức này thì không nhắc nữa (ví dụ mở máy lại vào buổi tối). */
const STALE_MS = 60 * 60_000;

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const clock = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/**
 * Tính các lời nhắc đến hạn ngay bây giờ và thời điểm cần kiểm tra lần tới (để đặt một setTimeout
 * thay vì kiểm tra liên tục). `fired` là khoá các lời nhắc đã gửi.
 */
export function planReminders(projectId: string, items: ReminderItem[], now: Date, fired: ReadonlySet<string>): { due: DueReminder[]; nextAt: number | null } {
  const due: DueReminder[] = [];
  let nextAt: number | null = null;
  const later = (t: number) => {
    if (t > now.getTime() && (nextAt === null || t < nextAt)) nextAt = t;
  };

  const scheduled = items.filter((i) => i.status === "SCHEDULED" && i.scheduledAt);
  const today = dayKey(now);

  // (a) tóm tắt mỗi ngày một lần
  const todays = scheduled.filter((i) => dayKey(new Date(i.scheduledAt!)) === today);
  const digestKey = `digest:${projectId}:${today}`;
  if (todays.length && !fired.has(digestKey)) {
    const names = todays.slice(0, 3).map((i) => i.title).join(", ");
    due.push({
      key: digestKey,
      type: "digest",
      title: `${todays.length} post${todays.length === 1 ? "" : "s"} scheduled today`,
      description: todays.length > 3 ? `${names} and ${todays.length - 3} more` : names,
    });
  }
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  later(tomorrow.getTime());

  // (b) nhắc trước giờ đăng 15 phút
  for (const item of scheduled) {
    const at = new Date(item.scheduledAt!).getTime();
    const key = `soon:${item.id}:${item.scheduledAt}`;
    if (fired.has(key)) continue;
    const remindAt = at - LEAD_MS;
    if (now.getTime() >= remindAt && now.getTime() <= at + STALE_MS) {
      due.push({ key, type: "soon", title: `Time to post: ${item.title}`, description: `Scheduled for ${clock(new Date(at))}.` });
    } else {
      later(remindAt);
    }
  }

  return { due, nextAt };
}
