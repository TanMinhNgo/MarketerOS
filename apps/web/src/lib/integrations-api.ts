"use client";

import {
  ConnectionSchema,
  ConnectionsResponseSchema,
  FacebookPagesResponseSchema,
  OAuthStartResponseSchema,
  PublicationSchema,
  PublicationsResponseSchema,
  IntegrationProvidersResponseSchema,
  type IntegrationProvider,
  type ContentResponse,
  type PublishInput,
} from "@marketos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { api, request } from "./api-client";
import { keys, useUsage } from "./queries";

export type Connection = z.infer<typeof ConnectionSchema>;
export type Publication = z.infer<typeof PublicationSchema>;
export type Provider = IntegrationProvider;
export type ConnectionProvider = z.infer<typeof IntegrationProvidersResponseSchema>["items"][number];

/** Kênh có adapter xuất bản; Instagram yêu cầu ít nhất một ảnh. */
export const PUBLISHABLE = { FACEBOOK: "facebook", INSTAGRAM: "instagram", LINKEDIN: "linkedin", EMAIL: "smtp" } as const satisfies Partial<Record<Connection["channel"], Provider>>;
export const isPublishable = (channel: string): channel is Connection["channel"] => channel in PUBLISHABLE;

export const ERROR_TEXT: Record<NonNullable<Publication["errorCode"]>, string> = {
  TOKEN_EXPIRED: "The connection expired. Reconnect the account in Integrations.",
  PERMISSION_DENIED: "MarketOS isn't allowed to post to this account. Reconnect and grant posting permission.",
  RATE_LIMITED: "The platform is limiting posts right now. Try again later.",
  CONTENT_REJECTED: "The platform rejected this post. Edit it and try again.",
  PROVIDER_ERROR: "The platform had a problem. Check the account before trying again, it may already be posted.",
};

const base = (projectId: string) => `/api/projects/${projectId}`;
const connectionsKey = (projectId: string) => ["connections", projectId] as const;
const publicationsKey = (projectId: string) => ["publications", projectId] as const;

/** Có quyền Integrations (Pro/Max, backend xác minh)? Không có thì không gọi API (tránh 403). */
export const useCanPublish = () => useUsage().data?.features.includes("channel_publishing") ?? false;

export function useConnections(projectId: string) {
  const enabled = useCanPublish();
  return useQuery({ queryKey: connectionsKey(projectId), queryFn: () => api(`${base(projectId)}/connections`, ConnectionsResponseSchema), enabled });
}

export function useConnectionProviders(projectId: string) {
  const enabled = useCanPublish();
  return useQuery({ queryKey: ["connection-providers", projectId], queryFn: () => api(`${base(projectId)}/connections/providers`, IntegrationProvidersResponseSchema), enabled });
}
export const visibleConnectionProviders = (providers: ConnectionProvider[], connections: Connection[]) =>
  providers.filter(p => p.configured || connections.some(c => c.channel === p.channel));

/** Kết nối đang dùng được cho một kênh của dự án. */
export function useChannelConnection(projectId: string, channel: string) {
  return useConnections(projectId).data?.items.find((c) => c.channel === channel && c.status === "CONNECTED");
}

const busy = (p: Publication) => p.status === "QUEUED" || p.status === "PUBLISHING";

/**
 * Mọi lần đăng của dự án, mới nhất trước (tải hết theo cursor).
 * Còn lần đang chờ / đang đăng thì poll 5 giây; xong thì làm mới danh sách bài (bài chuyển Done).
 */
// ponytail: tải hết theo cursor; dự án có hàng nghìn lần đăng thì cần phân trang ở UI.
export function usePublications(projectId: string) {
  const qc = useQueryClient();
  const enabled = useCanPublish();
  return useQuery({
    queryKey: publicationsKey(projectId),
    enabled,
    queryFn: async () => {
      const items: Publication[] = [];
      let before: string | undefined;
      for (;;) {
        const q = new URLSearchParams({ limit: "100" });
        if (before) q.set("before", before);
        // Tuần tự vì trang sau cần cursor của trang trước.
        const page = await api(`${base(projectId)}/publications?${q}`, PublicationsResponseSchema); // NOSONAR
        items.push(...page.items);
        before = page.items.at(-1)?.id;
        if (!page.hasMore || !before) break;
      }
      const prev = qc.getQueryData<Publication[]>(publicationsKey(projectId));
      if (prev?.some(busy) && !items.some(busy)) void qc.invalidateQueries({ queryKey: keys.contents(projectId) });
      return items;
    },
    refetchInterval: (q) => (q.state.data?.some(busy) ? 5000 : false),
  });
}

/** Lần đăng gần nhất của một bài (danh sách đã sắp mới nhất trước). */
export const latestFor = (pubs: Publication[] | undefined, contentId: string) => pubs?.find((p) => p.contentId === contentId);

/** Bài đang được đăng lên kênh: khoá sửa chữ/ảnh (backend trả 409 nếu vẫn gửi). */
export const isPublishing = (pubs: Publication[] | undefined, contentId: string) => latestFor(pubs, contentId)?.status === "PUBLISHING";

export function usePublishNow(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    /** `key`: giữ nguyên khi thử lại cùng một lần gửi (mất kết nối), tạo mới khi chủ động gửi lần mới. Email cần `email.to`; mạng xã hội không có body. */
    mutationFn: async ({ content, key, email }: { content: Pick<ContentResponse, "id">; key: string; email?: PublishInput["email"] }) => {
      const res = await request(`${base(projectId)}/contents/${content.id}/publish`, { method: "POST", headers: { "Idempotency-Key": key }, body: email ? { email } : undefined });
      return PublicationSchema.parse(await res.json());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: publicationsKey(projectId) }),
  });
}

/** Bắt đầu OAuth: backend trả URL của nền tảng, trình duyệt chuyển sang đó rồi quay về /apps/integrations. */
export function useStartConnect(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: async (provider: Provider) => {
      if (provider === "smtp") {
        await api(`${base(projectId)}/connections/smtp`, ConnectionSchema, { method: "POST" });
        await qc.invalidateQueries({ queryKey: connectionsKey(projectId) });
        return;
      }
      const { authUrl } = await api(`${base(projectId)}/connections/${provider}/start`, OAuthStartResponseSchema, { method: "POST" });
      globalThis.location.assign(authUrl);
    },
  });
}

export function useDisconnect(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: (id: string) => request(`${base(projectId)}/connections/${id}`, { method: "DELETE" }),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: connectionsKey(projectId) }), qc.invalidateQueries({ queryKey: publicationsKey(projectId) })]),
  });
}

export const useProviderAccounts = (projectId: string, session: string | null, provider: "facebook" | "instagram") =>
  useQuery({
    queryKey: ["provider-accounts", projectId, provider, session],
    enabled: !!session,
    queryFn: () => api(`${base(projectId)}/connections/${provider === "facebook" ? "facebook/pages" : "instagram/accounts"}?session=${encodeURIComponent(session ?? "")}`, FacebookPagesResponseSchema),
  });

export function useSelectProviderAccount(projectId: string, provider: "facebook" | "instagram") {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: (input: { session: string; pageId: string }) => api(`${base(projectId)}/connections/${provider === "facebook" ? "facebook/pages" : "instagram/accounts"}`, ConnectionSchema, { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionsKey(projectId) }),
  });
}

/** Số liệu là chuỗi thập phân (BigInt ở DB) hoặc null khi nền tảng không cung cấp. */
export const metric = (v: string | null | undefined) => (v == null ? null : Number(v));
