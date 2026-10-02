import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContentResponse } from "@marketos/shared";

vi.mock("@clerk/nextjs", () => ({ getToken: vi.fn(async () => "t") }));

import { applyOverlay, loadOverlay, updateSchedule } from "./calendar-api";
import { addDays, groupByDay, monthGrid, moveToDay, startOfWeek, toKey, weekDays } from "./calendar-utils";

const item = (id: string, scheduledAt: string | null = null): ContentResponse => ({
  id, projectId: "p", generationId: null, channel: "FACEBOOK", title: id, body: "b", hashtags: [], cta: null, status: "DRAFT", scheduledAt, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
});

describe("calendar-utils", () => {
  it("startOfWeek luôn là thứ Hai", () => {
    expect(toKey(startOfWeek(new Date(2026, 9, 4)))).toBe("2026-09-28"); // Chủ nhật 4/10 -> thứ Hai 28/9
    expect(toKey(startOfWeek(new Date(2026, 9, 5)))).toBe("2026-10-05");
    expect(weekDays(new Date(2026, 9, 7)).map(toKey)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
  });

  it("lưới tháng có 42 ô liên tiếp, bắt đầu thứ Hai và chứa cả tháng", () => {
    const grid = monthGrid(2026, 9);
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1);
    expect(grid.map(toKey)).toContain("2026-10-01");
    expect(grid.map(toKey)).toContain("2026-10-31");
    grid.slice(1).forEach((d, i) => expect(toKey(d)).toBe(toKey(addDays(grid[i], 1))));
  });

  it("moveToDay: chưa có lịch thì 09:00, đã có lịch thì giữ giờ", () => {
    const fresh = new Date(moveToDay(null, "2026-10-12"));
    expect([fresh.getFullYear(), fresh.getMonth(), fresh.getDate(), fresh.getHours(), fresh.getMinutes()]).toEqual([2026, 9, 12, 9, 0]);
    const keep = new Date(moveToDay(new Date(2026, 9, 3, 14, 30).toISOString(), "2026-10-20"));
    expect([keep.getDate(), keep.getHours(), keep.getMinutes()]).toEqual([20, 14, 30]);
  });

  it("groupByDay gom theo ngày địa phương, sắp theo giờ, bỏ nội dung chưa lên lịch", () => {
    const a = item("a", new Date(2026, 9, 12, 15, 0).toISOString());
    const b = item("b", new Date(2026, 9, 12, 8, 0).toISOString());
    const c = item("c");
    const map = groupByDay([a, b, c]);
    expect(map.get("2026-10-12")?.map((i) => i.id)).toEqual(["b", "a"]);
    expect([...map.keys()]).toEqual(["2026-10-12"]);
  });
});

describe("calendar-api overlay", () => {
  afterEach(() => vi.unstubAllGlobals());
  const store = () => {
    const data: Record<string, string> = {};
    vi.stubGlobal("localStorage", { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) });
    return data;
  };

  it("lưu và đọc lại lịch cục bộ theo dự án, phủ lên dữ liệu thật", async () => {
    store();
    await updateSchedule("p", "a", { status: "SCHEDULED", scheduledAt: "2026-10-12T09:00:00.000Z" });
    expect(loadOverlay("p")).toEqual({ a: { status: "SCHEDULED", scheduledAt: "2026-10-12T09:00:00.000Z" } });
    expect(loadOverlay("other")).toEqual({});
    const merged = applyOverlay([item("a"), item("b")], loadOverlay("p"));
    expect(merged[0]).toMatchObject({ status: "SCHEDULED", scheduledAt: "2026-10-12T09:00:00.000Z" });
    expect(merged[1].status).toBe("DRAFT");
  });

  it("dữ liệu hỏng hoặc localStorage ném lỗi thì coi như rỗng", () => {
    const data = store();
    data["marketos.calendar.v1.p"] = "{hong";
    expect(loadOverlay("p")).toEqual({});
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(loadOverlay("p")).toEqual({});
  });

  it("bỏ qua mục sai định dạng", () => {
    const data = store();
    data["marketos.calendar.v1.p"] = JSON.stringify({ ok: { status: "DONE", scheduledAt: null }, bad: { status: 1 } });
    expect(Object.keys(loadOverlay("p"))).toEqual(["ok"]);
  });
});
