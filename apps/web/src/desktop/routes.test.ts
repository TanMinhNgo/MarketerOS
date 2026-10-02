import { beforeEach, describe, expect, it } from "vitest";
import { loadLayout, resetLayoutCache, saveLayout } from "./layout-storage";
import { appIdFromPath, routeFor } from "./routes";
import { initialWindowState, useWindowStore } from "./window-store";

describe("routes", () => {
  it("appId <-> route", () => {
    expect(routeFor("content-studio")).toBe("/apps/content-studio");
    expect(routeFor(null)).toBe("/");
    expect(routeFor("khong-co")).toBe("/");
    expect(appIdFromPath("/apps/content-studio")).toBe("content-studio");
    expect(appIdFromPath("/apps/content-studio/")).toBe("content-studio");
    expect(appIdFromPath("/")).toBeNull();
    expect(appIdFromPath("/apps/khong-co")).toBeNull();
  });
});

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) },
  });
  return data;
}

describe("layout-storage", () => {
  beforeEach(() => {
    resetLayoutCache();
    useWindowStore.setState({ ...initialWindowState, windows: [] });
  });

  it("dữ liệu hỏng hoặc sai kiểu thì coi như rỗng", () => {
    fakeStorage({ "marketos.layout.v1": "{khong-phai-json" });
    expect(loadLayout()).toEqual({});
    resetLayoutCache();
    fakeStorage({ "marketos.layout.v1": JSON.stringify({ trash: { x: "a" } }) });
    expect(loadLayout()).toEqual({});
  });

  it("localStorage ném lỗi thì không văng", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } },
    });
    expect(loadLayout()).toEqual({});
    expect(() => saveLayout([{ appId: "trash", x: 1, y: 2, w: 400, h: 300, maximized: false }])).not.toThrow();
  });

  it("lưu rồi mở lại thì khôi phục vị trí, kẹp theo viewport hiện tại", () => {
    const data = fakeStorage();
    saveLayout([{ appId: "trash", x: 100, y: 80, w: 500, h: 300, maximized: false }]);
    expect(JSON.parse(data["marketos.layout.v1"]).trash).toEqual({ x: 100, y: 80, w: 500, h: 300 });

    useWindowStore.getState().open("trash");
    expect(useWindowStore.getState().windows[0]).toMatchObject({ x: 100, y: 80, w: 500, h: 300 });

    useWindowStore.setState({ ...initialWindowState, windows: [] });
    useWindowStore.getState().setArea(400, 320);
    useWindowStore.getState().open("trash");
    const w = useWindowStore.getState().windows[0];
    expect(w.x + w.w).toBeLessThanOrEqual(400);
    expect(w.y + w.h).toBeLessThanOrEqual(320);
  });

  it("không lưu cửa sổ đang phóng to", () => {
    const data = fakeStorage();
    saveLayout([{ appId: "trash", x: 0, y: 0, w: 1000, h: 700, maximized: true }]);
    expect(data["marketos.layout.v1"]).toBe("{}");
  });
});
