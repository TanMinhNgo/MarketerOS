import {
  AssistantDoneSchema,
  AssistantMessageDeltaSchema,
  AssistantMessageSchema,
  AssistantMessagesResponseSchema,
  BrandBriefResponseSchema,
  ContentResponseSchema,
  UpsertBrandBriefSchema,
  type AssistantAction,
  type AssistantDone,
  type BrandBriefResponse,
  type UpsertBrandBriefInput,
} from "@marketos/shared";
import { api, ApiError, request } from "./api-client";
import { schedulePatch } from "./calendar-api";
import { postSse } from "./generate";

const base = (projectId: string) => `/api/projects/${projectId}/assistant/messages`;

/** Một trang lịch sử, mới nhất trước; `before` là id tin nhắn cuối của trang trước. */
export const fetchMessages = (projectId: string, before?: string) =>
  api(`${base(projectId)}?limit=30${before ? `&before=${encodeURIComponent(before)}` : ""}`, AssistantMessagesResponseSchema);

/** Gửi một tin và stream câu trả lời; `onDelta` nhận đoạn chữ nối thêm, kết quả chính thức là sự kiện `done`. */
export async function sendMessage(projectId: string, content: string, { signal, onDelta }: { signal?: AbortSignal; onDelta: (text: string) => void }): Promise<AssistantDone> {
  let done: AssistantDone | null = null;
  await postSse(base(projectId), { content }, signal, (event, payload) => {
    if (event === "message.delta") {
      const p = AssistantMessageDeltaSchema.safeParse(payload);
      if (p.success) onDelta(p.data.text);
    } else if (event === "done") {
      const p = AssistantDoneSchema.safeParse(payload);
      if (p.success) done = p.data;
    }
  });
  if (!done) throw new ApiError(502, "SERVICE_UNAVAILABLE", "The reply ended before it finished. Please try again.");
  return done;
}

export const clearMessages = (projectId: string) => request(base(projectId), { method: "DELETE" });

export const markAction = (projectId: string, messageId: string, actionId: string, status: "applied" | "dismissed") =>
  api(`${base(projectId)}/${messageId}/actions/${actionId}`, AssistantMessageSchema, { method: "PATCH", body: { status } });

const SERVER_FIELDS = ["id", "projectId", "createdAt", "updatedAt"];
const CONTENT_FIELDS = ["title", "body", "hashtags", "cta"] as const;

/** Gộp thay đổi assistant đề xuất vào brief hiện tại thành body PUT đầy đủ (PUT thay toàn bộ trường). */
export function mergeBrief(brief: BrandBriefResponse, changes: Extract<AssistantAction, { type: "update_brief" }>["changes"]): UpsertBrandBriefInput {
  const fields = Object.fromEntries(Object.entries(brief).filter(([k]) => !SERVER_FIELDS.includes(k)));
  return UpsertBrandBriefSchema.parse({ ...fields, ...changes });
}

/**
 * Thực thi một hành động assistant đề xuất bằng API sẵn có, nên luật duyệt / lịch / giới hạn gói vẫn do backend kiểm.
 * Không bao giờ duyệt bài: lên lịch chỉ áp cho bài đã duyệt (theo `schedulePatch`).
 */
export async function applyAction(projectId: string, action: AssistantAction): Promise<void> {
  const contents = `/api/projects/${projectId}/contents`;
  switch (action.type) {
    case "create_draft": {
      const { channel, title, body, hashtags, cta } = action;
      await api(contents, ContentResponseSchema, { method: "POST", body: { channel, title, body, hashtags, cta } });
      return;
    }
    case "edit_content": {
      const fields = Object.fromEntries(CONTENT_FIELDS.filter((f) => f in action).map((f) => [f, action[f]]));
      await api(`${contents}/${action.contentId}`, ContentResponseSchema, { method: "PATCH", body: fields });
      return;
    }
    case "schedule": {
      const item = await api(`${contents}/${action.contentId}`, ContentResponseSchema);
      const patch = schedulePatch(item, item.status === "READY" ? "SCHEDULED" : item.status, action.scheduledAt);
      if (typeof patch === "string") throw new ApiError(409, "CONFLICT", patch);
      if (patch) await api(`${contents}/${action.contentId}`, ContentResponseSchema, { method: "PATCH", body: patch });
      return;
    }
    case "update_brief": {
      const brief = await api(`/api/projects/${projectId}/brand-brief`, BrandBriefResponseSchema);
      await api(`/api/projects/${projectId}/brand-brief`, BrandBriefResponseSchema, { method: "PUT", body: mergeBrief(brief, action.changes) });
      return;
    }
  }
}
