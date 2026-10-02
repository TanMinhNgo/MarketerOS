import { ContentListResponseSchema, ContentResponseSchema, type ContentResponse, type ContentStatusSchema } from "@marketos/shared";
import type { z } from "zod";
import { api } from "./api-client";

export type ContentStatus = z.infer<typeof ContentStatusSchema>;
export type SchedulePatch = { status?: ContentStatus; scheduledAt?: string | null };

/** DRAFT = AI viết xong, chờ chủ tài khoản duyệt; READY = đã duyệt, chưa lên lịch. */
export const STATUS_LABEL: Record<ContentStatus, string> = { DRAFT: "Needs review", READY: "Approved", SCHEDULED: "Scheduled", DONE: "Done" };

/** Trạng thái có thể chọn từ mỗi trạng thái, khớp luật backend (SCHEDULED phải về READY trước khi bỏ duyệt). */
export const NEXT_STATUSES: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: ["DRAFT", "READY"],
  READY: ["DRAFT", "READY", "SCHEDULED"],
  SCHEDULED: ["READY", "SCHEDULED", "DONE"],
  DONE: ["READY", "SCHEDULED", "DONE"],
};

/**
 * Patch gửi backend để đưa `item` về `status` + `scheduledAt`.
 * Trả `null` khi không có gì thay đổi, chuỗi khi yêu cầu không hợp lệ (thông điệp cho người dùng).
 */
export function schedulePatch(item: Pick<ContentResponse, "status" | "scheduledAt">, status: ContentStatus, scheduledAt: string | null): SchedulePatch | string | null {
  if (status === "SCHEDULED" || status === "DONE") {
    if (item.status === "DRAFT") return "Approve this draft before scheduling it.";
    if (!scheduledAt) return "Pick a date to schedule this content.";
    return status === item.status && scheduledAt === item.scheduledAt ? null : { status, scheduledAt };
  }
  // READY/DRAFT không giữ lịch: backend tự xoá `scheduledAt` khi chuyển trạng thái.
  if (status !== item.status) return { status };
  if (status === "DRAFT" && item.scheduledAt && !scheduledAt) return { scheduledAt: null };
  if (status === "DRAFT" && scheduledAt && scheduledAt !== item.scheduledAt) return "Approve this draft before scheduling it.";
  return null;
}

// ponytail: một trang 100 mục cho mỗi khoảng/cột; cần nhiều hơn thì phân trang.
const list = async (projectId: string, query: string) => (await api(`/api/projects/${projectId}/contents?page=1&limit=100&${query}`, ContentListResponseSchema)).items;

/** Nội dung có `scheduledAt` trong [from, to) — backend giới hạn khoảng tối đa 62 ngày. */
export const fetchRange = (projectId: string, from: Date, to: Date) => list(projectId, `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);

/** Nội dung chưa lên lịch (cột Unscheduled). */
export const fetchUnscheduled = (projectId: string) => list(projectId, "unscheduled=true");

/**
 * Gộp danh sách theo khoảng và danh sách chưa lên lịch. Trong lúc tải lại, một mục có thể nằm ở cả hai
 * (một bản cũ) — giữ bản `updatedAt` mới hơn.
 */
export function mergeById(...lists: (ContentResponse[] | undefined)[]): ContentResponse[] {
  const map = new Map<string, ContentResponse>();
  for (const item of lists.flatMap((l) => l ?? [])) {
    const prev = map.get(item.id);
    if (!prev || item.updatedAt > prev.updatedAt) map.set(item.id, item);
  }
  return [...map.values()];
}

export const updateSchedule = (projectId: string, id: string, patch: SchedulePatch) =>
  api(`/api/projects/${projectId}/contents/${id}`, ContentResponseSchema, { method: "PATCH", body: patch });
