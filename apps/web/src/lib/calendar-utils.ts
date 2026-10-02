import type { ContentResponse } from "@marketos/shared";

const pad = (n: number) => String(n).padStart(2, "0");

/** Khoá ngày theo giờ địa phương: YYYY-MM-DD. */
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Thứ Hai đầu tuần chứa `d`. */
export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const weekDays = (anchor: Date): Date[] => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i));

/** Lưới tháng 6 tuần (42 ô), tuần bắt đầu từ thứ Hai. */
export function monthGrid(year: number, month: number): Date[] {
  const first = startOfWeek(new Date(year, month, 1));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

/**
 * ISO của `dayKey` khi kéo một nội dung sang ngày đó: giữ nguyên giờ nếu đã có lịch, nếu chưa thì 09:00.
 */
export function moveToDay(currentIso: string | null, dayKey: string): string {
  const day = fromKey(dayKey);
  const base = currentIso ? new Date(currentIso) : null;
  day.setHours(base ? base.getHours() : 9, base ? base.getMinutes() : 0, 0, 0);
  return day.toISOString();
}

/** Gom nội dung đã lên lịch theo ngày (giờ địa phương), mỗi ngày sắp theo giờ. */
export function groupByDay(items: ContentResponse[]): Map<string, ContentResponse[]> {
  const map = new Map<string, ContentResponse[]>();
  for (const item of items) {
    if (!item.scheduledAt) continue;
    const key = toKey(new Date(item.scheduledAt));
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  for (const list of map.values()) list.sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  return map;
}

export const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
