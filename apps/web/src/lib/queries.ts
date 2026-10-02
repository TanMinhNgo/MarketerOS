import {
  BrandBriefResponseSchema,
  ContentListResponseSchema,
  ContentResponseSchema,
  MeResponseSchema,
  ProjectListResponseSchema,
  ProjectResponseSchema,
  type BrandBriefResponse,
  type ContentResponse,
  type CreateContentInput,
  type CreateProjectInput,
  type UpdateContentInput,
  type ProjectListResponse,
  type ProjectResponse,
  type UpdateProjectInput,
  type UpsertBrandBriefInput,
} from "@marketos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api-client";

/** Query key theo từng project; brief tách riêng gốc để refetch danh sách không kéo theo brief. */
export const keys = {
  me: ["me"] as const,
  projects: ["projects"] as const,
  trash: ["projects", "trash"] as const,
  brief: (projectId: string) => ["brief", projectId] as const,
  contents: (projectId: string) => ["contents", projectId] as const,
};

const LIST = "?page=1&limit=100";

export const useMe = (enabled = true) => useQuery({ queryKey: keys.me, queryFn: () => api("/api/me", MeResponseSchema), enabled });

export const useProjects = (enabled = true) => useQuery({ queryKey: keys.projects, queryFn: () => api(`/api/projects${LIST}`, ProjectListResponseSchema), enabled });

export const useTrash = () => useQuery({ queryKey: keys.trash, queryFn: () => api(`/api/projects/trash${LIST}`, ProjectListResponseSchema) });

/** Làm mới cả danh sách lẫn Trash vì một thao tác chuyển dự án qua lại giữa hai nơi. */
function useInvalidateProjects() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: keys.projects });
}

export function useCreateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => api("/api/projects", ProjectResponseSchema, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateProjectInput & { id: string }) => api(`/api/projects/${id}`, ProjectResponseSchema, { method: "PATCH", body: input }),
    onSuccess: invalidate,
  });
}

export function useTrashProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (id: string) => api(`/api/projects/${id}`, ProjectResponseSchema, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useRestoreProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (id: string) => api(`/api/projects/${id}/restore`, ProjectResponseSchema, { method: "POST" }),
    onSuccess: invalidate,
  });
}

/** Brief chưa có thì backend trả 404; coi như null để form hiện trống thay vì lỗi. */
export const useBrief = (projectId: string) =>
  useQuery({
    queryKey: keys.brief(projectId),
    queryFn: () =>
      api(`/api/projects/${projectId}/brand-brief`, BrandBriefResponseSchema).catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }),
  });

/** Lưu brief: cập nhật cache ngay (optimistic), lỗi thì hoàn lại giá trị cũ. */
export function useSaveBrief(projectId: string) {
  const qc = useQueryClient();
  const key = keys.brief(projectId);
  return useMutation({
    mutationFn: (input: UpsertBrandBriefInput) => api(`/api/projects/${projectId}/brand-brief`, BrandBriefResponseSchema, { method: "PUT", body: input }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BrandBriefResponse | null>(key);
      if (prev) qc.setQueryData<BrandBriefResponse>(key, { ...prev, ...input });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: (data) => qc.setQueryData(key, data),
  });
}

export type { ProjectListResponse, ProjectResponse };

/** Nội dung đã lưu của một dự án (nháp trong Content Studio). */
export const useContents = (projectId: string) =>
  useQuery({ queryKey: keys.contents(projectId), queryFn: () => api(`/api/projects/${projectId}/contents?page=1&limit=50`, ContentListResponseSchema) });

export function useSaveContent(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContentInput) => api(`/api/projects/${projectId}/contents`, ContentResponseSchema, { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.contents(projectId) }),
  });
}

export function useUpdateContent(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateContentInput & { id: string }) => api(`/api/projects/${projectId}/contents/${id}`, ContentResponseSchema, { method: "PATCH", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.contents(projectId) }),
  });
}

export function useDeleteContent(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/projects/${projectId}/contents/${id}`, ContentResponseSchema, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.contents(projectId) }),
  });
}

export type { ContentResponse, CreateContentInput };
