"use client";

import { toast } from "sonner";
import { ApiError, errorMessage } from "@/lib/api-client";
import { ToastCard, type NotifyAction } from "@/components/toast-card";
import { useWindowStore } from "@/desktop/window-store";
import { useNotifications, type NotifyKind } from "./notification-store";
import { showOsNotification } from "./os";

export interface NotifyOptions {
  kind?: NotifyKind;
  title: string;
  description?: string;
  action?: NotifyAction;
  /** Lưu vào chuông thông báo. */
  persist?: boolean;
  /** Gửi thêm thông báo hệ điều hành khi tab đang ẩn (nếu người dùng đã bật). */
  os?: boolean;
  /** Không hiện toast (chỉ lưu vào chuông / gửi hệ điều hành). */
  silent?: boolean;
  /** App mở khi bấm vào mục trong chuông; mặc định lấy từ action. */
  appId?: string;
  duration?: number;
  /** ID cố định của mục trong chuông (để gỡ khi nguồn đã hết, vd. cảnh báo vận hành). */
  id?: string;
}

/** Một cổng duy nhất cho mọi thông báo: toast, chuông và thông báo hệ điều hành. */
export function notify({ kind = "info", title, description, action, persist, os, silent, appId, duration, id }: NotifyOptions) {
  const ms = duration ?? (kind === "error" ? 8000 : kind === "reminder" ? 10000 : 5000);
  if (!silent) toast.custom((id) => <ToastCard id={id} kind={kind} title={title} description={description} action={action} duration={ms} />, { duration: ms });

  const target = appId ?? action?.appId;
  if (persist) useNotifications.getState().add({ id, kind, title, description, appId: target });
  if (os && useNotifications.getState().prefs.os) {
    showOsNotification(title, description, `${kind}:${title}`, target ? () => useWindowStore.getState().open(target) : undefined);
  }
}

type Shortcut = (title: string, rest?: Omit<NotifyOptions, "kind" | "title">) => void;
const by = (kind: NotifyKind): Shortcut => (title, rest) => notify({ ...rest, kind, title });

notify.success = by("success");
notify.info = by("info");
notify.warning = by("warning");
notify.error = by("error");
notify.reminder = by("reminder");

/** Toast cho lỗi API: hết lượt / cần nâng gói / chạm giới hạn là cảnh báo kèm nút xem gói, còn lại là lỗi. */
notify.apiError = (title: string, e: unknown) => {
  const limit = e instanceof ApiError && ["QUOTA_EXCEEDED", "PLAN_LIMIT", "PLAN_REQUIRED"].includes(e.code);
  if (limit) notify.warning(title, { description: errorMessage(e), action: { label: "See plans", appId: "plans-billing" } });
  else notify.error(title, { description: errorMessage(e) });
};
