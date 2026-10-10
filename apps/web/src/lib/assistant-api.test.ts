import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({ getToken: vi.fn(async () => "t") }));

import { ApiError } from "./api-client";
import { applyAction, applyProgress, sendMessage } from "./assistant-api";

afterEach(() => vi.unstubAllGlobals());

describe("applyAction", () => {
  const done = { actionId: "a", status: "applied", contentId: "c1", assetId: null, errorCode: null, updatedAt: "2026-10-08T00:00:00.000Z" };

  it("POST một lần tới endpoint Apply của backend, không body, không tự gọi API khác", async () => {
    const calls: { method: string; url: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ method: init.method ?? "GET", url, body: init.body });
      return Response.json(done);
    }));
    await expect(applyAction("p", "m", "a")).resolves.toEqual(done);
    expect(calls).toEqual([{ method: "POST", url: "/api/projects/p/assistant/messages/m/actions/a/apply", body: undefined }]);
  });

  it("GET tiến độ cùng URL; lỗi 409 giữ mã CONFLICT để thẻ hiện lại phần đã xong", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) =>
      init.method === "POST" ? Response.json({ code: "CONFLICT", message: "Post changed", details: null }, { status: 409 }) : Response.json({ ...done, status: "partial" }),
    ));
    await expect(applyAction("p", "m", "a")).rejects.toMatchObject({ code: "CONFLICT" } satisfies Partial<ApiError>);
    expect((await applyProgress("p", "m", "a")).status).toBe("partial");
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
