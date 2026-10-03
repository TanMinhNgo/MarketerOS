import { beforeEach, describe, expect, it, vi } from "vitest";

// Test chạy trên Node (không có localStorage); persist đọc storage lúc tạo store nên phải có trước khi import.
vi.hoisted(() => {
  const m = new Map<string, string>();
  globalThis.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() } as unknown as Storage;
});

import { initialWindowState, MIN_H, MIN_W, selectFocusedId, useWindowStore } from "./window-store";

const s = () => useWindowStore.getState();
const win = (id: string) => s().windows.find((w) => w.id === id)!;

beforeEach(() => {
  localStorage.clear();
  useWindowStore.setState({ ...initialWindowState, windows: [] });
});

describe("open", () => {
  it("mở app mới to hơn kích thước mặc định của registry (×1.25)", () => {
    s().open("trash");
    expect(s().windows).toHaveLength(1);
    expect(win("trash")).toMatchObject({ w: 700, h: 500, minimized: false, maximized: false });
  });

  it("app đã mở thì focus thay vì tạo thêm", () => {
    s().open("trash");
    s().open("settings");
    s().open("trash");
    expect(s().windows).toHaveLength(2);
    expect(selectFocusedId(s())).toBe("trash");
  });

  it("app đang thu nhỏ thì khôi phục khi mở lại", () => {
    s().open("trash");
    s().minimize("trash");
    s().open("trash");
    expect(win("trash").minimized).toBe(false);
  });

  it("bỏ qua appId không có trong registry", () => {
    s().open("khong-ton-tai");
    expect(s().windows).toHaveLength(0);
  });

  it("xếp tầng +30px so với cửa sổ mở trước", () => {
    s().open("trash");
    s().open("settings");
    expect(win("settings").x).toBe(win("trash").x + 30);
    expect(win("settings").y).toBe(win("trash").y + 30);
  });

  it("hết chỗ xếp tầng thì quay về góc đầu và vẫn nằm trong vùng", () => {
    s().setArea(1000, 620);
    s().open("trash");
    s().open("settings");
    s().open("projects");
    for (const w of s().windows) {
      expect(w.x).toBeGreaterThanOrEqual(0);
      expect(w.y).toBeGreaterThanOrEqual(0);
      expect(w.x + w.w).toBeLessThanOrEqual(1000);
      expect(w.y + w.h).toBeLessThanOrEqual(620);
    }
    expect(win("projects").x).toBe(win("trash").x);
  });
});

describe("z-order", () => {
  it("focus đặt z = ++topZ", () => {
    s().open("trash");
    s().open("settings");
    s().focus("trash");
    expect(win("trash").z).toBe(s().topZ);
    expect(win("trash").z).toBeGreaterThan(win("settings").z);
  });

  it("focus cửa sổ đang ở trên cùng không đổi state", () => {
    s().open("trash");
    const before = s().windows;
    s().focus("trash");
    expect(s().windows).toBe(before);
  });

  it("focus giữ nguyên tham chiếu các cửa sổ khác", () => {
    s().open("trash");
    s().open("settings");
    const other = win("settings");
    s().focus("trash");
    expect(win("settings")).toBe(other);
  });
});

describe("close / minimize / maximize", () => {
  it("close xoá cửa sổ", () => {
    s().open("trash");
    s().close("trash");
    expect(s().windows).toHaveLength(0);
  });

  it("thu nhỏ cửa sổ trên cùng thì focus chuyển cho cửa sổ kế tiếp", () => {
    s().open("trash");
    s().open("settings");
    s().minimize("settings");
    expect(selectFocusedId(s())).toBe("trash");
  });

  it("toggleMaximize bật/tắt và giữ nguyên toạ độ để khôi phục", () => {
    s().open("trash");
    const { x, y, w, h } = win("trash");
    s().toggleMaximize("trash");
    expect(win("trash").maximized).toBe(true);
    s().toggleMaximize("trash");
    expect(win("trash")).toMatchObject({ maximized: false, x, y, w, h });
  });
});

describe("move / resize / area", () => {
  it("move bị kẹp trong vùng desktop", () => {
    s().open("trash");
    s().move("trash", -500, 99999);
    const w = win("trash");
    expect(w.x).toBe(0);
    expect(w.y).toBe(s().area.h - w.h);
  });

  it("resize không nhỏ hơn 360x240 và không lớn hơn vùng", () => {
    s().open("trash");
    s().resize("trash", 10, 10);
    expect(win("trash")).toMatchObject({ w: MIN_W, h: MIN_H });
    s().resize("trash", 99999, 99999, 0, 0);
    expect(win("trash")).toMatchObject({ w: s().area.w, h: s().area.h });
  });

  it("thu nhỏ vùng desktop thì kéo cửa sổ tràn vào lại", () => {
    s().open("trash");
    s().move("trash", 800, 300);
    s().setArea(900, 500);
    const w = win("trash");
    expect(w.x + w.w).toBeLessThanOrEqual(900);
    expect(w.y + w.h).toBeLessThanOrEqual(500);
  });
});

describe("persist", () => {
  it("F5 khôi phục mọi cửa sổ đã lưu (giữ thu nhỏ, z), bỏ app không còn trong registry", async () => {
    const w = (appId: string, z: number, minimized = false) => ({ id: appId, appId, x: 10, y: 10, w: 500, h: 400, z, minimized, maximized: false });
    localStorage.setItem("marketos.windows.v1", JSON.stringify({ state: { windows: [w("projects", 1), w("trash", 3, true), w("gone-app", 2)], topZ: 3 }, version: 0 }));
    await useWindowStore.persist.rehydrate();
    expect(s().windows.map((x) => x.id)).toEqual(["projects", "trash"]);
    expect(win("trash")).toMatchObject({ minimized: true, z: 3 });
    expect(s().topZ).toBe(3);
  });
});
