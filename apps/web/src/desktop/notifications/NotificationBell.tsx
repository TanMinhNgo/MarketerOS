"use client";

import { Bell, BellOff, ChevronLeft, Settings2 } from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { KIND_STYLE } from "@/components/toast-card";
import { selectMine, selectUnread, useNotifications, type AppNotification } from "@/lib/notify/notification-store";
import { osPermission, requestOsPermission } from "@/lib/notify/os";
import { cn } from "@/lib/utils";
import { useWindowStore } from "../window-store";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(t: number) {
  const s = Math.round((t - Date.now()) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}
const isToday = (t: number) => new Date(t).toDateString() === new Date().toDateString();

function Row({ n, onOpen }: { n: AppNotification; onOpen: (n: AppNotification) => void }) {
  const style = KIND_STYLE[n.kind];
  const Icon = style.icon;
  return (
    <li>
      <button type="button" onClick={() => onOpen(n)} className={cn("flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent", !n.read && "bg-primary/5")}>
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2 border-[#3B2A4A]" style={{ background: style.color, color: style.ink }}>
          <Icon className="size-3.5" strokeWidth={2.6} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-snug">{n.title}</span>
          {n.description && <span className="line-clamp-2 block text-xs text-muted-foreground">{n.description}</span>}
          <span className="mt-0.5 block text-[11px] text-muted-foreground">{ago(n.createdAt)}</span>
        </span>
        {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
      </button>
    </li>
  );
}

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full border-2 border-[#3B2A4A] transition-colors", checked ? "bg-primary" : "bg-muted")}
      >
        <span className={cn("absolute top-0.5 size-4 rounded-full border-2 border-[#3B2A4A] bg-white transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

function Settings() {
  const prefs = useNotifications((s) => s.prefs);
  const setPrefs = useNotifications((s) => s.setPrefs);
  const [blocked, setBlocked] = useState(osPermission() === "denied");
  const unsupported = osPermission() === "unsupported";

  const toggleOs = async (on: boolean) => {
    if (!on) return setPrefs({ os: false });
    const result = await requestOsPermission();
    setBlocked(result === "denied");
    setPrefs({ os: result === "granted" });
  };

  return (
    <div className="divide-y px-4 py-1">
      <Toggle
        id="notif-os"
        label="Desktop notifications"
        hint={unsupported ? "This browser doesn't support desktop notifications." : blocked ? "Blocked by your browser. Allow notifications for this site in the browser's site settings." : "Shown on your computer when MarketOS is in another tab."}
        checked={prefs.os && !blocked}
        onChange={toggleOs}
      />
      <Toggle id="notif-reminders" label="Posting reminders" hint="A daily summary and a reminder 15 minutes before each scheduled post." checked={prefs.reminders} onChange={(v) => setPrefs({ reminders: v })} />
    </div>
  );
}

/** Chuông trên header: lịch sử thông báo, đánh dấu đã đọc, cài đặt nhắc lịch và thông báo máy tính. */
export function NotificationBell() {
  // selectMine trả mảng mới mỗi lần gọi: so sánh nông để không render lặp vô hạn.
  const items = useNotifications(useShallow(selectMine));
  const unread = useNotifications(selectUnread);
  const { markRead, markAllRead, clear } = useNotifications.getState();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "settings">("list");

  const openItem = (n: AppNotification) => {
    markRead(n.id);
    if (n.appId) useWindowStore.getState().open(n.appId);
    setOpen(false);
  };

  const groups: [string, AppNotification[]][] = [
    ["Today", items.filter((n) => isToday(n.createdAt))],
    ["Earlier", items.filter((n) => !isToday(n.createdAt))],
  ];

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setView("list");
      }}
    >
      <Popover.Trigger asChild>
        <button type="button" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative grid size-8 place-items-center rounded-md transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-current">
          <Bell className={cn("size-4", unread > 0 && "origin-top animate-[bell-ring_1.2s_ease-in-out_1]")} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full border-2 border-[#3B2A4A] bg-[#FF5D7A] px-0.5 text-[9px] font-bold leading-none text-white">{unread > 9 ? "9+" : unread}</span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} collisionPadding={12} className="z-50 w-[360px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border-2 border-[#3B2A4A] bg-background text-foreground shadow-[0_6px_0_#3B2A4A] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <header className="flex items-center gap-1 border-b px-3 py-2.5">
            {view === "settings" ? (
              <>
                <button type="button" aria-label="Back to notifications" onClick={() => setView("list")} className="grid size-7 place-items-center rounded-md hover:bg-accent">
                  <ChevronLeft className="size-4" />
                </button>
                <h2 className="font-display text-sm font-bold">Notification settings</h2>
              </>
            ) : (
              <>
                <h2 className="pl-1 font-display text-sm font-bold">Notifications</h2>
                {unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{unread}</span>}
                <div className="flex-1" />
                <button type="button" disabled={!unread} onClick={markAllRead} className="rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-accent disabled:text-muted-foreground disabled:hover:bg-transparent">
                  Mark all read
                </button>
                <button type="button" aria-label="Notification settings" onClick={() => setView("settings")} className="grid size-7 place-items-center rounded-md hover:bg-accent">
                  <Settings2 className="size-4" />
                </button>
              </>
            )}
          </header>

          {view === "settings" ? (
            <Settings />
          ) : items.length === 0 ? (
            <div className="grid place-items-center px-6 py-10 text-center">
              <BellOff className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground">Finished AI content, posting reminders and account updates show up here.</p>
            </div>
          ) : (
            <>
              <div className="max-h-[min(60vh,420px)] overflow-y-auto p-1.5">
                {groups.map(([label, list]) =>
                  list.length ? (
                    <section key={label} aria-label={label}>
                      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                      <ul>{list.map((n) => <Row key={n.id} n={n} onOpen={openItem} />)}</ul>
                    </section>
                  ) : null,
                )}
              </div>
              <footer className="flex justify-end border-t px-3 py-2">
                <button type="button" onClick={clear} className="rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
                  Clear all
                </button>
              </footer>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
