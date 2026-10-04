"use client";

import {
  AssetListResponseSchema,
  AssetSchema,
  AssetUrlResponseSchema,
  ContentAssetsResponseSchema,
  type Asset,
  type GenerateImageInput,
} from "@marketos/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, request } from "./api-client";
import { keys } from "./queries";

export type { Asset };

const base = (projectId: string) => `/api/projects/${projectId}`;
const assetsKey = (projectId: string) => ["assets", projectId] as const;
const contentAssetsKey = (projectId: string, contentId: string) => ["content-assets", projectId, contentId] as const;

export const MAX_UPLOAD = 10 * 1024 * 1024;
export const UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_PER_POST = 10;

/** Thư viện ảnh của dự án, mới nhất trước, tải thêm theo cursor. */
export function useAssets(projectId: string) {
  return useInfiniteQuery({
    queryKey: assetsKey(projectId),
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams({ limit: "30" });
      if (pageParam) q.set("before", pageParam);
      return api(`${base(projectId)}/assets?${q}`, AssetListResponseSchema);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? last.items.at(-1)?.id : undefined),
  });
}

/** URL ký sẵn sống 5 phút: giữ 4 phút rồi xin lại để ảnh không vỡ khi để lâu. */
export const useAssetUrl = (projectId: string, assetId: string) =>
  useQuery({
    queryKey: ["asset-url", projectId, assetId],
    queryFn: () => api(`${base(projectId)}/assets/${assetId}/url`, AssetUrlResponseSchema),
    staleTime: 4 * 60_000,
    refetchInterval: 4 * 60_000,
  });

function useRefreshLibrary(projectId: string) {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: assetsKey(projectId) }), qc.invalidateQueries({ queryKey: keys.usage })]);
}

export function useGenerateImage(projectId: string) {
  const refresh = useRefreshLibrary(projectId);
  return useMutation({
    meta: { silent: true },
    mutationFn: async (input: GenerateImageInput) => {
      const res = await request(`${base(projectId)}/images/generate`, { method: "POST", body: input, headers: { "Idempotency-Key": crypto.randomUUID() } });
      return AssetSchema.parse(await res.json());
    },
    onSuccess: refresh,
  });
}

/** Upload multipart (không qua api() vì body không phải JSON). Kiểm loại/kích thước trước để báo sớm; backend vẫn kiểm lại. */
export function useUpload(projectId: string) {
  const refresh = useRefreshLibrary(projectId);
  return useMutation({
    meta: { silent: true },
    mutationFn: async (file: File) => {
      if (!UPLOAD_TYPES.includes(file.type)) throw new ApiError(400, "VALIDATION", "Only PNG, JPEG and WebP images can be uploaded.");
      if (file.size > MAX_UPLOAD) throw new ApiError(413, "VALIDATION", "Images can be up to 10 MB.");
      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name.replace(/\.[^.]+$/, "").slice(0, 200) || "Image");
      const res = await request(`${base(projectId)}/assets/upload`, { method: "POST", form });
      return AssetSchema.parse(await res.json());
    },
    onSuccess: refresh,
  });
}

export function useDeleteAsset(projectId: string) {
  const refresh = useRefreshLibrary(projectId);
  return useMutation({
    meta: { silent: true },
    mutationFn: (id: string) => request(`${base(projectId)}/assets/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

export const useContentAssets = (projectId: string, contentId: string) =>
  useQuery({ queryKey: contentAssetsKey(projectId, contentId), queryFn: () => api(`${base(projectId)}/contents/${contentId}/assets`, ContentAssetsResponseSchema) });

/** Thay toàn bộ ảnh của bài (theo thứ tự). Bài đã duyệt bị đưa về Needs review nên làm mới cả danh sách bài. */
export function useSetContentAssets(projectId: string, contentId: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: (assetIds: string[]) => api(`${base(projectId)}/contents/${contentId}/assets`, ContentAssetsResponseSchema, { method: "PUT", body: { assetIds } }),
    onSuccess: (data) => {
      qc.setQueryData(contentAssetsKey(projectId, contentId), data);
      return Promise.all([qc.invalidateQueries({ queryKey: keys.contents(projectId) }), qc.invalidateQueries({ queryKey: ["publications", projectId] })]);
    },
  });
}

export const formatBytes = (b: string) => {
  const n = Number(b);
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
};
