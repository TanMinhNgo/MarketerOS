import type { ContentResponse } from "@marketos/shared";
import { describe, expect, it } from "vitest";
import { summarize, weekStart } from "./summary";

const item = (p: Partial<ContentResponse>): ContentResponse => ({
  id: Math.random().toString(36),
  projectId: "p",
  generationId: null,
  channel: "FACEBOOK",
  title: "t",
  body: "b",
  hashtags: [],
  cta: null,
  status: "DRAFT",
  scheduledAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...p,
});

describe("summarize", () => {
  // Thứ Bảy 03/10/2026, 12:00 giờ máy.
  const now = new Date(2026, 9, 3, 12);
  const at = (day: number, h = 9) => new Date(2026, 9, day, h).toISOString();

  it("đếm theo trạng thái, kênh, việc cần làm và 4 tuần tới", () => {
    const s = summarize(
      [
        item({ status: "DRAFT" }),
        item({ status: "READY" }),
        item({ status: "READY", scheduledAt: at(4) }),
        item({ status: "SCHEDULED", scheduledAt: at(3, 8), channel: "BLOG" }), // đã qua trong hôm nay
        item({ status: "SCHEDULED", scheduledAt: at(6), channel: "BLOG" }), // tuần sau
        item({ status: "SCHEDULED", scheduledAt: at(22) }), // tuần thứ 4 (19–25/10)
        item({ status: "SCHEDULED", scheduledAt: at(30) }), // ngoài 4 tuần
        item({ status: "DONE", scheduledAt: at(1) }),
      ],
      now,
    );
    expect(s.total).toBe(8);
    expect(s.byStatus).toEqual({ DRAFT: 1, READY: 2, SCHEDULED: 4, DONE: 1 });
    expect(s.readyUnscheduled).toBe(1);
    expect(s.upcoming).toBe(3);
    expect(s.channels.map((c) => [c.channel, c.total])).toEqual([["FACEBOOK", 6], ["BLOG", 2]]);
    expect(s.weeks.map((w) => w.count)).toEqual([3, 1, 0, 1]);
    expect(s.weeks[0].start).toEqual(new Date(2026, 8, 28));
  });

  it("tuần bắt đầu thứ Hai, kể cả khi hôm nay là Chủ nhật", () => {
    expect(weekStart(new Date(2026, 9, 4, 23))).toEqual(new Date(2026, 8, 28));
    expect(weekStart(new Date(2026, 9, 5, 0))).toEqual(new Date(2026, 9, 5));
  });
});
