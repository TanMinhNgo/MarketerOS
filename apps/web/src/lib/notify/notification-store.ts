import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export type NotifyKind = "success" | "info" | "warning" | "error" | "reminder";

export interface AppNotification {
  id: string;
  kind: NotifyKind;
  title: string;
  description?: string;
  /** App mở ra khi bấm vào thông báo trong chuông. */
  appId?: string;
  createdAt: number;
  read: boolean;
  /** Tài khoản Clerk sở hữu thông báo; null = khách. */
  userId: string | null;
}

export interface NotifyPrefs {
  /** Thông báo của hệ điều hành khi tab đang ẩn (cần người dùng cấp quyền). */
  os: boolean;
  /** Nhắc lịch đăng bài từ Content Calendar. */
  reminders: boolean;
}

interface NotificationState {
  items: AppNotification[];
  /** Khoá các lời nhắc đã gửi, để tải lại trang không nhắc trùng. */
  fired: string[];
  prefs: NotifyPrefs;
  userId: string | null;
  setUser: (userId: string | null) => void;
  add: (n: Pick<AppNotification, "kind" | "title" | "description" | "appId">) => AppNotification;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
  setPrefs: (p: Partial<NotifyPrefs>) => void;
  /** Ghi nhận một lời nhắc; trả về false nếu đã gửi trước đó. */
  markFired: (key: string) => boolean;
}

export const MAX_NOTIFICATIONS = 50;
const MAX_FIRED = 300;

/** localStorage có thể bị chặn (chế độ riêng tư): lỗi thì coi như không lưu được. */
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // bỏ qua: thông báo chỉ không được nhớ sau khi tải lại
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      // bỏ qua
    }
  },
};

const mine = (s: Pick<NotificationState, "userId">) => (n: AppNotification) => n.userId === s.userId;

export const useNotifications = create<NotificationState>()(
  persist(
    (set, get) => ({
      items: [],
      fired: [],
      prefs: { os: false, reminders: true },
      userId: null,
      setUser: (userId) => set({ userId }),
      add: (n) => {
        const item: AppNotification = { ...n, id: crypto.randomUUID(), createdAt: Date.now(), read: false, userId: get().userId };
        // giữ 50 mục mới nhất của mỗi tài khoản
        set((s) => {
          const own = [item, ...s.items.filter(mine(s))].slice(0, MAX_NOTIFICATIONS);
          return { items: [...own, ...s.items.filter((i) => !mine(s)(i))] };
        });
        return item;
      },
      markRead: (id) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, read: true } : i)) })),
      markAllRead: () => set((s) => ({ items: s.items.map((i) => (mine(s)(i) ? { ...i, read: true } : i)) })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set((s) => ({ items: s.items.filter((i) => !mine(s)(i)) })),
      setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),
      markFired: (key) => {
        if (get().fired.includes(key)) return false;
        set((s) => ({ fired: [...s.fired, key].slice(-MAX_FIRED) }));
        return true;
      },
    }),
    {
      name: "marketos.notifications.v1",
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ items, fired, prefs }) => ({ items, fired, prefs }),
    },
  ),
);

/** Thông báo của tài khoản đang đăng nhập, mới nhất trước. */
export const selectMine = (s: NotificationState) => s.items.filter(mine(s));
export const selectUnread = (s: NotificationState) => s.items.filter((i) => mine(s)(i) && !i.read).length;
