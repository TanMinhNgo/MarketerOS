import { getToken } from "@clerk/nextjs";
import { ApiErrorSchema, type ErrorCode } from "@marketos/shared";
import type { z } from "zod";

/** Lỗi API đã chuẩn hoá theo { code, message, details } của backend. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Init {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Gửi request tới /api/* (Next rewrite sang NestJS) kèm Bearer token Clerk; Clerk tự làm mới token.
 * Trả về Response khi 2xx, ngược lại ném ApiError theo { code, message, details } của backend.
 */
export async function request(path: string, { method = "GET", body, signal, headers }: Init & { headers?: Record<string, string> } = {}): Promise<Response> {
  const token = await getToken();
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      signal,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "SERVICE_UNAVAILABLE", "Couldn't reach the server.");
  }
  if (!res.ok) {
    const json: unknown = await res.json().catch(() => null);
    const parsed = ApiErrorSchema.safeParse(json);
    if (parsed.success) throw new ApiError(res.status, parsed.data.code, parsed.data.message, parsed.data.details);
    throw new ApiError(res.status, res.status >= 502 ? "SERVICE_UNAVAILABLE" : "INTERNAL", `Error ${res.status}`);
  }
  return res;
}

/** Gọi /api/* rồi kiểm tra phản hồi JSON bằng schema Zod trong packages/shared. */
export async function api<T>(path: string, schema: z.ZodType<T>, init: Init = {}): Promise<T> {
  const res = await request(path, init);
  return schema.parse(await res.json());
}

/** Thông điệp thân thiện cho người dùng theo mã lỗi chung. */
export function errorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Please try again.";
  switch (e.code) {
    case "UNAUTHORIZED":
      return "Your session has expired. Please sign in again.";
    case "NOT_FOUND":
      return "Not found (it may have been deleted).";
    case "VALIDATION":
      return "Some fields are invalid. Please check and try again.";
    case "RATE_LIMITED":
      return "You're going too fast. Please try again in a few minutes.";
    case "SERVICE_UNAVAILABLE":
      return "The server isn't ready. Please try again later.";
    case "PLAN_REQUIRED":
    case "PLAN_LIMIT":
    case "QUOTA_EXCEEDED":
    case "FORBIDDEN":
    case "CONFLICT":
      return e.message;
    default:
      return "Something went wrong. Please try again.";
  }
}
