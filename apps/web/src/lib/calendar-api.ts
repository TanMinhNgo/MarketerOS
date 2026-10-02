import { ContentListResponseSchema, type ContentResponse, type ContentStatusSchema } from "@marketos/shared";
import type { z } from "zod";
import { api } from "./api-client";

export type ContentStatus = z.infer<typeof ContentStatusSchema>;
export interface SchedulePatch {
  status: ContentStatus;
  scheduledAt: string | null;
}

/**
 * Backend hiện chưa cho PATCH `status`/`scheduledAt` và chưa lọc theo from/to (xem CONTRACT-CHANGES.md).
 * Trong lúc chờ, lịch được lưu cục bộ trên thiết bị này và phủ lên dữ liệu thật. Khi backend sẵn sàng,
 * bật cờ này và chỉ cần sửa `updateSchedule`; phần giao diện không đổi.
 */
export const SERVER_SCHEDULING = false;

const KEY = (projectId: string) => `marketos.calendar.v1.${projectId}`;
type Overlay = Record<string, SchedulePatch>;

const isPatch = (v: unknown): v is SchedulePatch => {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return typeof p.status === "string" && (p.scheduledAt === null || typeof p.scheduledAt === "string");
};

export function loadOverlay(projectId: string): Overlay {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(projectId)) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => isPatch(v))) as Overlay;
  } catch {
    return {};
  }
}

function saveOverlay(projectId: string, overlay: Overlay) {
  try {
    localStorage.setItem(KEY(projectId), JSON.stringify(overlay));
  } catch {
    // Bộ nhớ bị chặn/đầy: lịch chỉ không được nhớ sau khi tải lại.
  }
}

/** Phủ lịch cục bộ lên nội dung từ server; nội dung đã bị xoá ở server thì bỏ qua. */
export const applyOverlay = (items: ContentResponse[], overlay: Overlay): ContentResponse[] => items.map((i) => (overlay[i.id] ? { ...i, ...overlay[i.id] } : i));

export async function fetchCalendarItems(projectId: string): Promise<ContentResponse[]> {
  const list = await api(`/api/projects/${projectId}/contents?page=1&limit=100`, ContentListResponseSchema);
  return SERVER_SCHEDULING ? list.items : applyOverlay(list.items, loadOverlay(projectId));
}

export async function updateSchedule(projectId: string, id: string, patch: SchedulePatch): Promise<void> {
  if (SERVER_SCHEDULING) throw new Error("Server scheduling is not implemented yet.");
  saveOverlay(projectId, { ...loadOverlay(projectId), [id]: patch });
}
