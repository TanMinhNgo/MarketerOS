"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState, type CSSProperties } from "react";
import { useNotifications } from "@/lib/notify/notification-store";
import { BeachScene } from "./BeachScene";
import { DesktopIcons } from "./DesktopIcons";
import { MenuBar } from "./MenuBar";
import { MobileHome } from "./MobileHome";
import { MobileSheet } from "./MobileSheet";
import { useScheduleReminders } from "./notifications/use-schedule-reminders";
import { SearchPalette } from "./search/SearchPalette";
import { Taskbar } from "./Taskbar";
import { useLayoutPersist, useUrlSync } from "./use-desktop-sync";
import { useIsMobile } from "./use-mobile";
import { useSky } from "./use-sky";
import { WindowLayer } from "./WindowLayer";
import { useWindowStore } from "./window-store";

export function Desktop({ skyMinutes }: Readonly<{ skyMinutes: number }>) {
  const sky = useSky(skyMinutes);
  const isMobile = useIsMobile();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const open = useWindowStore((s) => s.open);
  useUrlSync();
  useScheduleReminders();
  // Thông báo trong chuông thuộc về từng tài khoản Clerk.
  const { user } = useUser();
  useEffect(() => useNotifications.getState().setUser(user?.id ?? null), [user?.id]);
  useLayoutPersist();

  // Mobile chỉ hiện một app một lúc: mở app mới thì đóng các app khác.
  const openOnly = (id: string) => {
    const { windows, close } = useWindowStore.getState();
    for (const w of windows) if (w.id !== id) close(w.id);
    open(id);
  };

  const { ui } = sky;
  const vars = {
    "--bar-bg": ui.barBg,
    "--bar-ink": ui.barInk,
    "--pill-bg": ui.pillBg,
    "--dock-bg": ui.dockBg,
    "--label-bg": ui.labelBg,
    "--label-ink": ui.labelInk,
    "--title-ink": ui.titleInk,
    "--title-shadow": ui.titleShadow,
  } as CSSProperties;

  return (
    <main className="fixed inset-0 overflow-hidden" style={vars}>
      {/* nền: bấm vào chỗ trống thì bỏ chọn icon */}
      <div className="absolute inset-0" onClick={() => setSelectedId(null)}>
        <BeachScene sky={sky} />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-24 z-0 text-center"
        style={{ color: "var(--title-ink)", textShadow: "0 2px 30px var(--title-shadow)" }}
      >
        <h1 className="font-display text-[clamp(44px,7vw,96px)] font-bold leading-none tracking-tight">MarketOS</h1>
        <p className="mt-2 text-[clamp(14px,1.6vw,20px)] font-medium">AI assistant for solo marketers</p>
      </div>

      <MenuBar />
      <SearchPalette />
      {isMobile ? (
        <>
          <MobileHome onOpen={openOnly} />
          <MobileSheet />
        </>
      ) : (
        <>
          <DesktopIcons selectedId={selectedId} onSelect={setSelectedId} onOpen={open} />
          <WindowLayer />
          <Taskbar />
        </>
      )}
    </main>
  );
}
