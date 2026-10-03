import type { ContentResponse } from "@marketos/shared";
import type { ContentStatus } from "@/lib/calendar-api";

const STATUSES: ContentStatus[] = ["DRAFT", "READY", "SCHEDULED", "DONE"];
const zero = (): Record<ContentStatus, number> => ({ DRAFT: 0, READY: 0, SCHEDULED: 0, DONE: 0 });

export interface ContentSummary {
  total: number;
  byStatus: Record<ContentStatus, number>;
  /** Đã duyệt nhưng chưa có lịch: việc cần làm tiếp. */
  readyUnscheduled: number;
  /** Đã lên lịch, thời điểm đăng còn ở phía trước. */
  upcoming: number;
  channels: { channel: string; total: number; byStatus: Record<ContentStatus, number> }[];
  /** 4 tuần (thứ Hai → Chủ nhật, giờ máy) tính từ tuần hiện tại; số bài có lịch trong tuần. */
  weeks: { start: Date; count: number }[];
}

/** Thứ Hai 00:00 (giờ máy) của tuần chứa `d`. */
export function weekStart(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

export function summarize(items: ContentResponse[], now = new Date()): ContentSummary {
  const byStatus = zero();
  const channels = new Map<string, Record<ContentStatus, number>>();
  const first = weekStart(now);
  // 5 mốc (đầu 4 tuần + cuối tuần thứ 4), tạo theo ngày lịch nên đúng cả khi đổi giờ mùa hè.
  const bounds = [0, 1, 2, 3, 4].map((i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i * 7));
  const weeks = bounds.slice(0, 4).map((start) => ({ start, count: 0 }));
  let readyUnscheduled = 0;
  let upcoming = 0;

  for (const c of items) {
    byStatus[c.status]++;
    const ch = channels.get(c.channel) ?? zero();
    ch[c.status]++;
    channels.set(c.channel, ch);
    if (c.status === "READY" && !c.scheduledAt) readyUnscheduled++;
    if (!c.scheduledAt) continue;
    const at = new Date(c.scheduledAt);
    if (c.status === "SCHEDULED" && at >= now) upcoming++;
    const w = weeks.findIndex((_, i) => at >= bounds[i] && at < bounds[i + 1]);
    if (w >= 0) weeks[w].count++;
  }

  return {
    total: items.length,
    byStatus,
    readyUnscheduled,
    upcoming,
    channels: [...channels].map(([channel, s]) => ({ channel, byStatus: s, total: STATUSES.reduce((n, k) => n + s[k], 0) })).sort((a, b) => b.total - a.total),
    weeks,
  };
}
