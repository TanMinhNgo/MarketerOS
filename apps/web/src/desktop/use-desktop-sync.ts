"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { findApp } from "../apps/registry";
import { saveLayout } from "./layout-storage";
import { appIdFromPath, HOME, routeFor } from "./routes";
import { selectFocusedId, useWindowStore } from "./window-store";

/**
 * Đồng bộ hai chiều giữa cửa sổ đang focus và URL.
 * - URL -> store: chỉ khi pathname đổi (tải trang, back/forward). Nếu app đó đã đang focus thì bỏ qua.
 * - store -> URL: chỉ khi focus đổi, và bỏ qua nếu URL đã khớp.
 * Hai điều kiện "đã khớp thì thôi" chính là thứ chặn vòng lặp store <-> router.
 */
export function useUrlSync() {
  const pathname = usePathname();
  const router = useRouter();
  const focusedId = useWindowStore(selectFocusedId);
  const pathRef = useRef(pathname);
  const prevFocused = useRef<string | null | undefined>(undefined);

  // Khôi phục cửa sổ của phiên trước, trước khi URL -> store mở app trên URL lên trên cùng.
  // `persist` không có khi trình duyệt chặn localStorage: khi đó chỉ không khôi phục.
  useEffect(() => void useWindowStore.persist?.rehydrate(), []);

  useEffect(() => {
    pathRef.current = pathname;
    const st = useWindowStore.getState();
    const appId = appIdFromPath(pathname);
    if (appId) {
      if (appId !== selectFocusedId(st)) st.open(appId);
    } else if (pathname === HOME) {
      // "/" là desktop trống: back về đây thì thu mọi cửa sổ xuống Taskbar.
      for (const w of st.windows) if (!w.minimized) st.minimize(w.id);
    }
  }, [pathname]);

  useEffect(() => {
    // Đọc focus hiện tại từ store thay vì giá trị đã chụp lúc render: effect URL -> store vừa chạy
    // ngay trước đó (và React StrictMode chạy effect hai lần ở dev) nên giá trị render có thể đã cũ,
    // dẫn tới đẩy URL về "/" và thu nhỏ cửa sổ vừa mở từ deep link.
    const current = selectFocusedId(useWindowStore.getState());
    const prev = prevFocused.current;
    prevFocused.current = current;
    if (prev === undefined) return; // lần đầu: để URL -> store xử lý trước
    const target = routeFor(current);
    if (target === pathRef.current) return;
    // Cửa sổ vừa đóng thì thay thế entry để back không mở lại nó.
    const closed = prev !== null && !useWindowStore.getState().windows.some((w) => w.id === prev);
    if (closed) router.replace(target, { scroll: false });
    else router.push(target, { scroll: false });
  }, [focusedId, router]);
}

/** Lưu x, y, w, h vào localStorage mỗi khi hình học cửa sổ đổi (chỉ lúc thả chuột, không phải mỗi frame). */
export function useLayoutPersist() {
  useEffect(
    () =>
      useWindowStore.subscribe((s, p) => {
        if (s.windows === p.windows) return;
        const changed = s.windows.some((w) => {
          const o = p.windows.find((c) => c.id === w.id);
          return !o || o.x !== w.x || o.y !== w.y || o.w !== w.w || o.h !== w.h;
        });
        if (changed) saveLayout(s.windows.filter((w) => findApp(w.appId)));
      }),
    [],
  );
}
