import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({ getToken: vi.fn(async () => "tok_1") }));

import { ApiError } from "./api-client";
import { streamGenerate, streamRegenerate, type GenerateEvent } from "./generate";
import { createSseParser, type SseEvent } from "./sse";

const v = (n: number) => ({ title: `T${n}`, body: `B${n}`, hashtags: ["#a"], cta: "Go" });
const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const enc = new TextEncoder();
const input = { channel: "FACEBOOK" as const, goal: "g", topic: "t" };

function streamOf(chunks: string[]) {
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("createSseParser", () => {
  const collect = (chunks: string[]) => {
    const out: SseEvent[] = [];
    const feed = createSseParser((e) => out.push(e));
    chunks.forEach(feed);
    return out;
  };

  it("ghép sự kiện bị cắt giữa chừng giữa hai chunk", () => {
    const text = sse("variant.delta", { index: 0, variant: { title: "x" } });
    expect(collect([text.slice(0, 12), text.slice(12, 30), text.slice(30)])).toEqual([{ event: "variant.delta", data: '{"index":0,"variant":{"title":"x"}}' }]);
  });

  it("hỗ trợ CRLF, nhiều dòng data và bỏ qua comment", () => {
    expect(collect([": ping\r\n\r\nevent: a\r\ndata: 1\r\ndata: 2\r\n\r\n"])).toEqual([{ event: "a", data: "1\n2" }]);
  });

  it("chưa có dòng trống kết thúc thì chưa phát sự kiện", () => {
    expect(collect(["event: a\ndata: 1\n"])).toEqual([]);
  });
});

describe("streamGenerate", () => {
  it("phát delta, variant và done theo thứ tự, gửi Idempotency-Key là UUID", async () => {
    const done = { generationId: "g1", variants: [v(0), v(1), v(2)] };
    const body = [sse("variant.delta", { index: 0, variant: { title: "T" } }), sse("variant.done", { index: 0, variant: v(0) }), sse("done", done)].join("");
    const fetchMock = vi.fn(async () => new Response(streamOf([body.slice(0, 20), body.slice(20)]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const events: GenerateEvent[] = [];
    await streamGenerate("p1", input, { onEvent: (e) => events.push(e) });

    expect(events.map((e) => e.type)).toEqual(["delta", "variant", "done"]);
    const init = (fetchMock.mock.calls as unknown as [string, RequestInit][])[0];
    expect(init[0]).toBe("/api/projects/p1/generate");
    const headers = init[1].headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers.Authorization).toBe("Bearer tok_1");
  });

  it("sự kiện error giữa chừng ném ApiError", async () => {
    const body = sse("variant.delta", { index: 0, variant: { title: "T" } }) + sse("error", { code: "SERVICE_UNAVAILABLE", message: "Boom", details: null });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(streamOf([body]), { status: 200 })));
    await expect(streamGenerate("p1", input, { onEvent: () => {} })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", message: "Boom" });
  });

  it("429 trước khi stream ném QUOTA_EXCEEDED", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "QUOTA_EXCEEDED", message: "Used up", details: null }), { status: 429 })));
    const err = await streamGenerate("p1", input, { onEvent: () => {} }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 429, code: "QUOTA_EXCEEDED" });
  });

  it("mảnh JSON hỏng bị bỏ qua, không làm hỏng cả luồng", async () => {
    const done = { generationId: "g1", variants: [v(0), v(1), v(2)] };
    const body = "event: variant.delta\ndata: {broken\n\n" + sse("done", done);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(streamOf([body]), { status: 200 })));
    const events: GenerateEvent[] = [];
    await streamGenerate("p1", input, { onEvent: (e) => events.push(e) });
    expect(events.map((e) => e.type)).toEqual(["done"]);
  });
});

describe("streamRegenerate", () => {
  it("gọi /generate/variant và đọc done chỉ có 1 biến thể", async () => {
    const fetchMock = vi.fn(async () => new Response(streamOf([sse("variant.delta", { index: 2, variant: { title: "N" } }), sse("done", { generationId: "g2", variants: [v(9)] })]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const events: GenerateEvent[] = [];
    await streamRegenerate("p1", { input, others: [v(0), v(1)], index: 2 }, { onEvent: (e) => events.push(e) });
    expect((fetchMock.mock.calls as unknown as [string][])[0][0]).toBe("/api/projects/p1/generate/variant");
    expect(events).toEqual([
      { type: "delta", index: 2, variant: { title: "N" } },
      { type: "done", generationId: "g2", variants: [v(9)] },
    ]);
  });
});
