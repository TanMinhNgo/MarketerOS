import { describe, expect, it, vi } from "vitest";
import type { ContentResponse } from "@marketos/shared";

vi.mock("@clerk/nextjs", () => ({ getToken: vi.fn(async () => "t") }));

import { findPlaceholders } from "../apps/content-studio/approve-checklist";
import { mergeById, NEXT_STATUSES, schedulePatch } from "./calendar-api";
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

describe("schedulePatch theo luật duyệt của backend", () => {
  const at = "2026-10-12T09:00:00.000Z";
  const it2 = (status: ContentResponse["status"], scheduledAt: string | null = null) => ({ status, scheduledAt });

  it("bài chưa duyệt không lên lịch được", () => {
    expect(schedulePatch(it2("DRAFT"), "SCHEDULED", at)).toBeTypeOf("string");
    expect(schedulePatch(it2("DRAFT"), "DRAFT", at)).toBeTypeOf("string");
  });

  it("duyệt, lên lịch, dời lịch, hoàn tất", () => {
    expect(schedulePatch(it2("DRAFT"), "READY", null)).toEqual({ status: "READY" });
    expect(schedulePatch(it2("READY"), "SCHEDULED", at)).toEqual({ status: "SCHEDULED", scheduledAt: at });
    expect(schedulePatch(it2("READY"), "SCHEDULED", null)).toBeTypeOf("string");
    expect(schedulePatch(it2("SCHEDULED", at), "SCHEDULED", "2026-10-13T09:00:00.000Z")).toEqual({ status: "SCHEDULED", scheduledAt: "2026-10-13T09:00:00.000Z" });
    expect(schedulePatch(it2("SCHEDULED", at), "DONE", at)).toEqual({ status: "DONE", scheduledAt: at });
    expect(schedulePatch(it2("SCHEDULED", at), "SCHEDULED", at)).toBeNull();
  });

  it("bỏ lịch: bài đã duyệt về READY, bản nháp giữ lịch cũ thì chỉ xoá lịch", () => {
    expect(schedulePatch(it2("SCHEDULED", at), "READY", null)).toEqual({ status: "READY" });
    expect(schedulePatch(it2("DRAFT", at), "DRAFT", null)).toEqual({ scheduledAt: null });
    expect(schedulePatch(it2("DRAFT"), "DRAFT", null)).toBeNull();
  });

  it("NEXT_STATUSES không cho SCHEDULED về thẳng DRAFT", () => {
    expect(NEXT_STATUSES.SCHEDULED).not.toContain("DRAFT");
    expect(NEXT_STATUSES.DRAFT).not.toContain("SCHEDULED");
  });

  it("findPlaceholders tìm [..] và {{..}}, không trùng", () => {
    expect(findPlaceholders({ title: "Hi", body: "Ở [Địa chỉ doanh nghiệp]\n{{unsubscribe_link}} [Địa chỉ doanh nghiệp]", cta: null })).toEqual(["[Địa chỉ doanh nghiệp]", "{{unsubscribe_link}}"]);
    expect(findPlaceholders({ title: "Hi", body: "Không có gì", cta: null })).toEqual([]);
  });
});

describe("mergeById", () => {
  it("gộp hai danh sách, mục trùng giữ bản updatedAt mới hơn", () => {
    const old = { ...item("a"), updatedAt: "2026-10-01T00:00:00.000Z" };
    const fresh = { ...item("a", "2026-10-12T09:00:00.000Z"), updatedAt: "2026-10-02T00:00:00.000Z" };
    expect(mergeById([fresh], [old, item("b")])).toEqual([fresh, item("b")]);
    expect(mergeById([old], [fresh])).toEqual([fresh]);
    expect(mergeById(undefined, [item("b")])).toEqual([item("b")]);
  });
});
