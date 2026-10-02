import { beforeEach, describe, expect, it } from "vitest";
import { MAX_NOTIFICATIONS, selectMine, selectUnread, useNotifications } from "./notification-store";
import { LEAD_MS, planReminders, type ReminderItem } from "./reminders";

const s = () => useNotifications.getState();

describe("notification-store", () => {
  beforeEach(() => useNotifications.setState({ items: [], fired: [], userId: "u1", prefs: { os: false, reminders: true } }));

  it("thêm mới nhất lên đầu, đếm chưa đọc, đánh dấu đã đọc", () => {
    s().add({ kind: "success", title: "A" });
    const b = s().add({ kind: "error", title: "B" });
    expect(selectMine(s()).map((n) => n.title)).toEqual(["B", "A"]);
    expect(selectUnread(s())).toBe(2);
    s().markRead(b.id);
    expect(selectUnread(s())).toBe(1);
    s().markAllRead();
    expect(selectUnread(s())).toBe(0);
  });

  it(`giữ tối đa ${MAX_NOTIFICATIONS} mục cho mỗi tài khoản`, () => {
    for (let i = 0; i < MAX_NOTIFICATIONS + 5; i++) s().add({ kind: "info", title: `n${i}` });
    expect(selectMine(s())).toHaveLength(MAX_NOTIFICATIONS);
    expect(selectMine(s())[0].title).toBe(`n${MAX_NOTIFICATIONS + 4}`);
  });

  it("mỗi tài khoản chỉ thấy và xoá thông báo của mình", () => {
    s().add({ kind: "info", title: "của u1" });
    s().setUser("u2");
    s().add({ kind: "info", title: "của u2" });
    expect(selectMine(s()).map((n) => n.title)).toEqual(["của u2"]);
    s().clear();
    s().setUser("u1");
    expect(selectMine(s()).map((n) => n.title)).toEqual(["của u1"]);
  });

  it("markFired chỉ trả true lần đầu", () => {
    expect(s().markFired("k")).toBe(true);
    expect(s().markFired("k")).toBe(false);
  });
});

describe("planReminders", () => {
  const now = new Date(2026, 9, 2, 9, 0); // 09:00 ngày 2/10
  const at = (h: number, m = 0, d = 2) => new Date(2026, 9, d, h, m).toISOString();
  const item = (id: string, scheduledAt: string | null, status = "SCHEDULED"): ReminderItem => ({ id, title: id, status, scheduledAt });

  it("tóm tắt bài hôm nay một lần mỗi ngày", () => {
    const items = [item("a", at(14)), item("b", at(18)), item("c", at(10, 0, 3))];
    const { due } = planReminders("p", items, now, new Set());
    expect(due.find((d) => d.type === "digest")?.title).toBe("2 posts scheduled today");
    expect(planReminders("p", items, now, new Set(["digest:p:2026-10-02"])).due.some((d) => d.type === "digest")).toBe(false);
  });

  it("nhắc khi còn 15 phút và đặt hẹn cho bài sắp tới", () => {
    const items = [item("soon", at(9, 10)), item("later", at(11))];
    const { due, nextAt } = planReminders("p", items, now, new Set(["digest:p:2026-10-02"]));
    expect(due.map((d) => d.key)).toEqual([`soon:soon:${at(9, 10)}`]);
    expect(nextAt).toBe(new Date(at(11)).getTime() - LEAD_MS);
  });

  it("bỏ qua bài không SCHEDULED, chưa có giờ, đã nhắc hoặc đã quá giờ lâu", () => {
    const items = [item("draft", at(9, 5), "READY"), item("none", null), item("old", at(7)), item("done", at(9, 5))];
    const fired = new Set(["digest:p:2026-10-02", `soon:done:${at(9, 5)}`]);
    expect(planReminders("p", items, now, fired).due).toEqual([]);
  });

  it("không có gì sắp tới thì hẹn kiểm tra lại vào nửa đêm", () => {
    expect(planReminders("p", [], now, new Set()).nextAt).toBe(new Date(2026, 9, 3).getTime());
  });
});
