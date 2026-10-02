import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssistantAction, BrandBriefResponse, ContentResponse } from "@marketos/shared";

vi.mock("@clerk/nextjs", () => ({ getToken: vi.fn(async () => "t") }));

import { ApiError } from "./api-client";
import { applyAction, mergeBrief, sendMessage } from "./assistant-api";

const content = (status: ContentResponse["status"], scheduledAt: string | null = null): ContentResponse => ({
  id: "c1", projectId: "p", generationId: null, channel: "FACEBOOK", title: "T", body: "B", hashtags: [], cta: null, status, scheduledAt, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
});
const brief: BrandBriefResponse = {
  id: "b", projectId: "p", product: "P", audience: "A", tone: "friendly", language: "vi", businessAddress: null, keyMessages: ["k"], avoidWords: [], samplePosts: [], brandColors: [], visualStyle: null, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
};
const at = "2026-10-12T09:00:00.000Z";

/** fetch giả: GET trả `get`, ghi lại các lời gọi ghi (POST/PATCH/PUT). */
function server(get: unknown) {
  const writes: { method: string; url: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    if ((init.method ?? "GET") === "GET") return Response.json(get);
    const body = JSON.parse(String(init.body));
    writes.push({ method: init.method!, url, body });
    return Response.json(url.includes("brand-brief") ? { ...brief, ...body } : { ...content("DRAFT"), ...body });
  }));
  return writes;
}

afterEach(() => vi.unstubAllGlobals());

describe("applyAction", () => {
  const schedule: AssistantAction = { type: "schedule", id: "a", status: "proposed", contentId: "c1", scheduledAt: at };

  it("lên lịch bài đã duyệt: READY → SCHEDULED", async () => {
    const writes = server(content("READY"));
    await applyAction("p", schedule);
    expect(writes).toEqual([{ method: "PATCH", url: "/api/projects/p/contents/c1", body: { status: "SCHEDULED", scheduledAt: at } }]);
  });

  it("không bao giờ lên lịch bài chưa duyệt", async () => {
    const writes = server(content("DRAFT"));
    await expect(applyAction("p", schedule)).rejects.toBeInstanceOf(ApiError);
    expect(writes).toEqual([]);
  });

  it("bài Done chỉ dời ngày, không đổi trạng thái", async () => {
    const writes = server(content("DONE", "2026-10-01T09:00:00.000Z"));
    await applyAction("p", schedule);
    expect(writes[0].body).toEqual({ status: "DONE", scheduledAt: at });
  });

  it("sửa bài chỉ gửi đúng các trường được đề xuất", async () => {
    const writes = server(null);
    await applyAction("p", { type: "edit_content", id: "a", status: "proposed", contentId: "c1", body: "New" });
    expect(writes).toEqual([{ method: "PATCH", url: "/api/projects/p/contents/c1", body: { body: "New" } }]);
  });

  it("tạo nháp không gửi id/status/type của action", async () => {
    const writes = server(null);
    await applyAction("p", { type: "create_draft", id: "a", status: "proposed", channel: "TIKTOK", title: "T", body: "B", hashtags: ["#x"], cta: null });
    expect(writes[0]).toEqual({ method: "POST", url: "/api/projects/p/contents", body: { channel: "TIKTOK", title: "T", body: "B", hashtags: ["#x"], cta: null } });
  });

  it("sửa brief: lấy brief mới nhất, gộp thay đổi, PUT đủ trường", async () => {
    const writes = server(brief);
    await applyAction("p", { type: "update_brief", id: "a", status: "proposed", changes: { tone: "bold" } });
    expect(writes[0].method).toBe("PUT");
    expect(writes[0].body).toMatchObject({ product: "P", tone: "bold", keyMessages: ["k"], language: "vi" });
    expect(writes[0].body).not.toHaveProperty("id");
  });
});

describe("mergeBrief", () => {
  it("bỏ trường của server, giữ trường không đổi", () => {
    expect(mergeBrief(brief, { language: "en" })).toEqual({ product: "P", audience: "A", tone: "friendly", language: "en", businessAddress: null, keyMessages: ["k"], avoidWords: [], samplePosts: [], brandColors: [], visualStyle: null });
  });
});

describe("sendMessage", () => {
  const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const msg = (id: string, role: "user" | "assistant", text: string) => ({ id, role, content: text, createdAt: "2026-10-02T00:00:00.000Z", actions: [] });
  const stream = (body: string) => vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200 })));

  it("nối delta và trả kết quả của sự kiện done", async () => {
    stream(sse("message.delta", { text: "Xin " }) + sse("message.delta", { text: "chào" }) + sse("done", { userMessage: msg("u", "user", "Hi"), assistantMessage: msg("a", "assistant", "Xin chào") }));
    let text = "";
    const done = await sendMessage("p", "Hi", { onDelta: (t) => (text += t) });
    expect(text).toBe("Xin chào");
    expect(done.assistantMessage.id).toBe("a");
  });

  it("stream kết thúc mà không có done thì báo lỗi", async () => {
    stream(sse("message.delta", { text: "x" }));
    await expect(sendMessage("p", "Hi", { onDelta: () => {} })).rejects.toBeInstanceOf(ApiError);
  });
});
