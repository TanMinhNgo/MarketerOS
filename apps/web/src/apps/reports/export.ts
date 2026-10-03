import type { ContentResponse } from "@marketos/shared";
import { STATUS_LABEL } from "../../lib/calendar-api";
import { channelLabel } from "../content-studio/channels";

/**
 * Một ô CSV: bọc nháy kép, nhân đôi nháy bên trong. Ô bắt đầu bằng = + - @ (hoặc tab/CR) bị Excel
 * hiểu là công thức (CSV injection) nên thêm dấu ' phía trước.
 */
function cell(v: string | number | null | undefined): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}

const iso = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "");

/** Danh sách bài thành CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt). Giờ theo UTC, ghi rõ ở tiêu đề cột. */
export function postsCsv(items: ContentResponse[]): string {
  const head = ["Title", "Channel", "Status", "Scheduled (UTC)", "Created (UTC)", "Body", "Hashtags", "Call to action"];
  const rows = items.map((c) => [c.title, channelLabel(c.channel), STATUS_LABEL[c.status], iso(c.scheduledAt), iso(c.createdAt), c.body, c.hashtags.join(" "), c.cta]);
  return "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
