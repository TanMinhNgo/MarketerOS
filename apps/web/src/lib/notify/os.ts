/** Thông báo của hệ điều hành qua Notification API của trình duyệt. */

export const osSupported = () => typeof window !== "undefined" && "Notification" in window;

export const osPermission = (): NotificationPermission | "unsupported" => (osSupported() ? Notification.permission : "unsupported");

/** Chỉ gọi từ thao tác của người dùng (bấm nút bật); trình duyệt chặn nếu tự xin quyền. */
export async function requestOsPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!osSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Gửi khi tab đang ẩn và đã có quyền; bấm vào thì đưa người dùng về đúng tab. */
export function showOsNotification(title: string, body: string | undefined, tag: string, onClick?: () => void) {
  if (!osSupported() || Notification.permission !== "granted" || !document.hidden) return;
  try {
    const n = new Notification(title, { body, tag, icon: "/icon.svg" });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    // một số trình duyệt (vd. Android) chỉ cho gửi qua service worker: bỏ qua
  }
}
