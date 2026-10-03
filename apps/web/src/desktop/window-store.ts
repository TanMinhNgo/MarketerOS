import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { findApp } from "../apps/registry";
import { loadLayout } from "./layout-storage";

export const MIN_W = 360;
export const MIN_H = 240;
const OPEN_SCALE = 1.25;
const CASCADE = 30;
const ORIGIN = 32;

export interface WindowState {
  /** Mỗi app chỉ có một cửa sổ nên id trùng appId. */
  id: string;
  appId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
}

export interface Area { w: number; h: number }
interface Rect { x: number; y: number; w: number; h: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

/** Ép hộp vào trong vùng desktop: kích thước trong [tối thiểu, vùng], toạ độ không tràn ra ngoài. */
export function fitRect(r: Rect, area: Area): Rect {
  const w = clamp(r.w, Math.min(MIN_W, area.w), area.w);
  const h = clamp(r.h, Math.min(MIN_H, area.h), area.h);
  return { w, h, x: clamp(r.x, 0, area.w - w), y: clamp(r.y, 0, area.h - h) };
}

interface WindowStore {
  windows: WindowState[];
  topZ: number;
  /** Vùng làm việc (dưới MenuBar, trên Taskbar), do WindowLayer đo. */
  area: Area;
  open: (appId: string) => void;
  close: (id: string) => void;
  focus: (id: string) => void;
  minimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, w: number, h: number, x?: number, y?: number) => void;
  setArea: (w: number, h: number) => void;
}

const patch = (list: WindowState[], id: string, p: Partial<WindowState>) => list.map((w) => (w.id === id ? { ...w, ...p } : w));

export const initialWindowState = { windows: [] as WindowState[], topZ: 0, area: { w: 1440, h: 800 } };

const createWindowStore = () =>
  create<WindowStore>()(persist((set) => ({
  ...initialWindowState,

  open: (appId) =>
    set((s) => {
      const app = findApp(appId);
      if (!app) return s;
      const existing = s.windows.find((w) => w.appId === appId);
      if (existing) {
        if (existing.z === s.topZ && !existing.minimized) return s;
        return { topZ: s.topZ + 1, windows: patch(s.windows, existing.id, { z: s.topZ + 1, minimized: false }) };
      }
      const saved = loadLayout()[appId];
      let rect: Rect;
      if (saved) {
        rect = fitRect(saved, s.area); // layout lần trước, kẹp lại theo viewport hiện tại
      } else {
        const last = s.windows.at(-1);
        // Mở to hơn defaultSize; màn hình nhỏ thì fitRect kẹp lại vừa khu vực desktop.
        const { w, h } = fitRect({ x: 0, y: 0, w: app.defaultSize.w * OPEN_SCALE, h: app.defaultSize.h * OPEN_SCALE }, s.area);
        let x = last ? last.x + CASCADE : ORIGIN;
        let y = last ? last.y + CASCADE : ORIGIN;
        // Hết chỗ xếp tầng thì quay về góc đầu thay vì dồn vào mép.
        if (x + w > s.area.w || y + h > s.area.h) x = y = ORIGIN;
        rect = fitRect({ x, y, w, h }, s.area);
      }
      const win: WindowState = { id: appId, appId, ...rect, z: s.topZ + 1, minimized: false, maximized: false };
      return { topZ: win.z, windows: [...s.windows, win] };
    }),

  close: (id) => set((s) => ({ windows: s.windows.filter((w) => w.id !== id) })),

  focus: (id) =>
    set((s) => {
      const win = s.windows.find((w) => w.id === id);
      if (!win || win.z === s.topZ) return s;
      return { topZ: s.topZ + 1, windows: patch(s.windows, id, { z: s.topZ + 1 }) };
    }),

  minimize: (id) => set((s) => ({ windows: patch(s.windows, id, { minimized: true }) })),

  toggleMaximize: (id) =>
    set((s) => {
      const win = s.windows.find((w) => w.id === id);
      if (!win) return s;
      return { topZ: s.topZ + 1, windows: patch(s.windows, id, { maximized: !win.maximized, z: s.topZ + 1 }) };
    }),

  move: (id, x, y) =>
    set((s) => {
      const win = s.windows.find((w) => w.id === id);
      if (!win || win.maximized) return s;
      const { x: nx, y: ny } = fitRect({ x, y, w: win.w, h: win.h }, s.area);
      return { windows: patch(s.windows, id, { x: nx, y: ny }) };
    }),

  resize: (id, w, h, x, y) =>
    set((s) => {
      const win = s.windows.find((c) => c.id === id);
      if (!win || win.maximized) return s;
      return { windows: patch(s.windows, id, fitRect({ x: x ?? win.x, y: y ?? win.y, w, h }, s.area)) };
    }),

  setArea: (w, h) =>
    set((s) => {
      if (s.area.w === w && s.area.h === h) return s;
      const area = { w, h };
      return { area, windows: s.windows.map((win) => (win.maximized ? win : { ...win, ...fitRect(win, area) })) };
    }),
}), {
  // Giữ các cửa sổ đang mở qua F5. Hydrate thủ công (useUrlSync) để render đầu khớp HTML server.
  name: "marketos.windows.v1",
  storage: createJSONStorage(() => localStorage),
  skipHydration: true,
  partialize: (s) => ({ windows: s.windows, topZ: s.topZ }),
  merge: (saved, current) => {
    const p = saved as Partial<Pick<WindowStore, "windows" | "topZ">> | undefined;
    return { ...current, topZ: p?.topZ ?? current.topZ, windows: (p?.windows ?? []).filter((w) => findApp(w.appId)) };
  },
}));

const globalForStore = globalThis as unknown as { __marketosWindowStore?: ReturnType<typeof createWindowStore> };

/**
 * Ở dev, HMR chạy lại module này mỗi khi file nó import (vd. registry.ts) đổi; nếu tạo store mới thì
 * cửa sổ đang mở biến mất và các component giữ hai store khác nhau. Giữ một instance trên globalThis.
 * (Sửa logic của chính store thì cần tải lại trang vì instance cũ vẫn dùng action cũ.)
 */
export const useWindowStore = globalForStore.__marketosWindowStore ?? createWindowStore();
if (process.env.NODE_ENV !== "production") globalForStore.__marketosWindowStore = useWindowStore;

/** Cửa sổ đang được focus: cửa sổ chưa thu nhỏ có z lớn nhất. */
export function selectFocusedId(s: Pick<WindowStore, "windows">): string | null {
  let top: WindowState | null = null;
  for (const w of s.windows) if (!w.minimized && (!top || w.z > top.z)) top = w;
  return top?.id ?? null;
}
