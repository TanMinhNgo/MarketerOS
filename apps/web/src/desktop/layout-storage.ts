import { z } from "zod";

const KEY = "marketos.layout.v1";

const Saved = z.record(z.string(), z.object({ x: z.number().finite(), y: z.number().finite(), w: z.number().finite(), h: z.number().finite() }));
export type SavedLayout = z.infer<typeof Saved>;

interface Geometry { appId: string; x: number; y: number; w: number; h: number; maximized: boolean }

let cache: SavedLayout | null = null;

/** Đọc layout đã lưu (x, y, w, h theo appId). localStorage lỗi/bị chặn/dữ liệu hỏng thì coi như rỗng. */
export function loadLayout(): SavedLayout {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = Saved.safeParse(raw ? JSON.parse(raw) : {});
    cache = parsed.success ? parsed.data : {};
  } catch {
    cache = {};
  }
  return cache;
}

/** Ghi hình học của các cửa sổ (bỏ qua cửa sổ đang phóng to để giữ cỡ khôi phục). */
export function saveLayout(windows: Geometry[]) {
  const next = { ...loadLayout() };
  for (const w of windows) if (!w.maximized) next[w.appId] = { x: w.x, y: w.y, w: w.w, h: w.h };
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Chế độ riêng tư/đầy bộ nhớ: bỏ qua, layout chỉ không được nhớ.
  }
}

/** Quên kích thước/vị trí đã lưu của mọi app (Settings → Reset window layout). */
export function clearLayout() {
  cache = {};
  try {
    localStorage.removeItem(KEY);
  } catch {
    // bị chặn: không có gì để xoá
  }
}

/** Chỉ dùng cho test. */
export function resetLayoutCache() {
  cache = null;
}
