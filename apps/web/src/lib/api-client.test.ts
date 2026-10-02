import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@clerk/nextjs", () => ({ getToken: vi.fn(async () => "tok_123") }));

import { api, ApiError, errorMessage } from "./api-client";

const Schema = z.object({ ok: z.boolean() });
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe("api-client", () => {
  it("gắn Bearer token và trả dữ liệu đã validate", async () => {
    const fetchMock = reply(200, { ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await expect(api("/api/x", Schema)).resolves.toEqual({ ok: true });
    const init = (fetchMock.mock.calls as unknown as [string, RequestInit][])[0][1];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok_123");
  });

  it("gửi body JSON kèm Content-Type", async () => {
    const fetchMock = reply(200, { ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await api("/api/x", Schema, { method: "POST", body: { a: 1 } });
    const init = (fetchMock.mock.calls as unknown as [string, RequestInit][])[0][1];
    expect(init.body).toBe('{"a":1}');
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("parse lỗi { code, message, details } thành ApiError", async () => {
    vi.stubGlobal("fetch", reply(404, { code: "NOT_FOUND", message: "Không có", details: null }));
    const err = await api("/api/x", Schema).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, code: "NOT_FOUND", message: "Không có" });
  });

  it("lỗi không đúng định dạng thì rơi về INTERNAL / SERVICE_UNAVAILABLE", async () => {
    vi.stubGlobal("fetch", reply(500, "boom"));
    await expect(api("/api/x", Schema)).rejects.toMatchObject({ code: "INTERNAL" });
    vi.stubGlobal("fetch", reply(503, null));
    await expect(api("/api/x", Schema)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("mất mạng thì SERVICE_UNAVAILABLE", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(api("/api/x", Schema)).rejects.toMatchObject({ status: 0, code: "SERVICE_UNAVAILABLE" });
  });

  it("phản hồi sai schema thì ném lỗi thay vì trả dữ liệu rác", async () => {
    vi.stubGlobal("fetch", reply(200, { ok: "yes" }));
    await expect(api("/api/x", Schema)).rejects.toThrow();
  });

  it("errorMessage returns an English message per error code", () => {
    expect(errorMessage(new ApiError(401, "UNAUTHORIZED", "x"))).toMatch(/sign in/);
    expect(errorMessage(new ApiError(402, "PLAN_LIMIT", "Hết 3 project"))).toBe("Hết 3 project");
    expect(errorMessage(new Error("x"))).toMatch(/went wrong/);
  });
});
