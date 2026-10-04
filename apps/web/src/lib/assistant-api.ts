import {
  AssistantDoneSchema,
  AssistantMessageDeltaSchema,
  AssistantMessageSchema,
  AssistantMessagesResponseSchema,
  AssetSchema,
  BrandBriefResponseSchema,
  ContentAssetsResponseSchema,
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
export function fetchMessages(projectId: string, before?: string) {
  const q = new URLSearchParams({ limit: "30" });
  if (before) q.set("before", before);
  return api(`${base(projectId)}?${q}`, AssistantMessagesResponseSchema);
}

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

const SERVER_FIELDS = new Set(["id", "projectId", "createdAt", "updatedAt"]);
const CONTENT_FIELDS = ["title", "body", "hashtags", "cta"] as const;

/** Gộp thay đổi assistant đề xuất vào brief hiện tại thành body PUT đầy đủ (PUT thay toàn bộ trường). */
export function mergeBrief(brief: BrandBriefResponse, changes: Extract<AssistantAction, { type: "update_brief" }>["changes"]): UpsertBrandBriefInput {
  const fields = Object.fromEntries(Object.entries(brief).filter(([k]) => !SERVER_FIELDS.has(k)));
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
      const created = await api(contents, ContentResponseSchema, { method: "POST", body: { channel, title, body, hashtags, cta } });
      const ids = [...(action.assetIds ?? [])];
      if (action.imagePrompt) ids.push(await generateAsset(projectId, action.imagePrompt, title));
      if (ids.length) await attachAssets(projectId, created.id, ids, "replace");
      return;
    }
    case "edit_content": {
      const fields = Object.fromEntries(CONTENT_FIELDS.filter((f) => f in action).map((f) => [f, action[f]]));
      if (Object.keys(fields).length) await api(`${contents}/${action.contentId}`, ContentResponseSchema, { method: "PATCH", body: fields });
      const ids = [...(action.assetIds ?? [])];
      if (action.imagePrompt) ids.push(await generateAsset(projectId, action.imagePrompt));
      if (ids.length) await attachAssets(projectId, action.contentId, ids, action.assetMode ?? "append");
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
    case "generate_image": {
      const id = await generateAsset(projectId, action.prompt, action.name, action.size);
      if (action.attachToContentId) await attachAssets(projectId, action.attachToContentId, [id], "append");
      return;
    }
    case "attach_media":
      await attachAssets(projectId, action.contentId, action.assetIds, action.mode);
      return;
  }
}

export const MAX_IMAGES = 10;

/** Tạo một ảnh AI (tốn 1 lượt ảnh, Idempotency-Key mới mỗi lần Apply), trả về ID ảnh. */
async function generateAsset(projectId: string, prompt: string, name?: string, size = "1024x1024"): Promise<string> {
  const res = await request(`/api/projects/${projectId}/images/generate`, {
    method: "POST",
    body: { prompt, size, ...(name ? { name: name.slice(0, 200) } : {}) },
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
  return AssetSchema.parse(await res.json()).id;
}

/** Ghép ảnh vào bài: `append` giữ ảnh cũ (bỏ trùng) rồi thêm vào cuối, `replace` thay toàn bộ. Backend kiểm ownership/DONE. */
export function mergeAssetIds(current: string[], ids: string[], mode: "append" | "replace"): string[] {
  const next = mode === "replace" ? ids : [...current, ...ids.filter((id) => !current.includes(id))];
  if (next.length > MAX_IMAGES) throw new ApiError(400, "VALIDATION", `A post can have up to ${MAX_IMAGES} images. Remove some first.`);
  return next;
}

async function attachAssets(projectId: string, contentId: string, ids: string[], mode: "append" | "replace") {
  const path = `/api/projects/${projectId}/contents/${contentId}/assets`;
  const current = mode === "replace" ? [] : (await api(path, ContentAssetsResponseSchema)).items.map((a) => a.id);
  await api(path, ContentAssetsResponseSchema, { method: "PUT", body: { assetIds: mergeAssetIds(current, ids, mode) } });
}
