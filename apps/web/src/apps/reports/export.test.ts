import type { ContentResponse } from "@marketos/shared";
import { describe, expect, it } from "vitest";
import { postsCsv } from "./export";

const post: ContentResponse = {
  id: "1",
  projectId: "p",
  generationId: null,
  channel: "FACEBOOK",
  title: 'Ưu đãi "Thu" =SUM(A1)',
  body: "Dòng 1\nDòng 2, có dấu phẩy",
  hashtags: ["#sale", "#thu"],
  cta: "-50% hôm nay",
  status: "SCHEDULED",
  scheduledAt: "2026-10-05T02:00:00.000Z",
  createdAt: "2026-10-01T08:30:00.000Z",
  updatedAt: "2026-10-01T08:30:00.000Z",
};

describe("postsCsv", () => {
  it("có BOM, bọc nháy, giữ xuống dòng/dấu phẩy và chặn công thức Excel", () => {
    const csv = postsCsv([post]);
    expect(csv.startsWith("﻿\"Title\",\"Channel\"")).toBe(true);
    const row = csv.split("\r\n")[1];
    expect(row).toContain('"Ưu đãi ""Thu"" =SUM(A1)"'); // không bắt đầu bằng = nên giữ nguyên
    expect(row).toContain('"Facebook","Scheduled","2026-10-05 02:00","2026-10-01 08:30"');
    expect(row).toContain('"Dòng 1\nDòng 2, có dấu phẩy"');
    expect(row).toContain(`"'-50% hôm nay"`);
    expect(postsCsv([{ ...post, title: "=HYPERLINK(1)" }]).split("\r\n")[1].startsWith(`"'=HYPERLINK(1)"`)).toBe(true);
  });
});
