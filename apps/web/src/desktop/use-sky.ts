"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { computeSky, type Sky } from "./sky";
import { DEFAULT_SKY_PREF, parseSkyPref, SKY_COOKIE, skyMinutes, type SkyPref } from "./sky-pref";

const readCookie = () => document.cookie.split("; ").find((c) => c.startsWith(`${SKY_COOKIE}=`))?.slice(SKY_COOKIE.length + 1);

/** Tuỳ chọn cảnh nền (Settings). Đọc cookie ngay lúc tải module: cùng giá trị server đã dùng để dựng HTML. */
export const useSkyPref = create<{ pref: SkyPref; setPref: (p: Partial<SkyPref>) => void }>()((set, get) => ({
  pref: typeof document === "undefined" ? DEFAULT_SKY_PREF : parseSkyPref(readCookie()),
  setPref: (p) => {
    const pref = { ...get().pref, ...p };
    document.cookie = `${SKY_COOKIE}=${encodeURIComponent(JSON.stringify(pref))}; path=/; max-age=31536000; samesite=lax`;
    set({ pref });
  },
}));

/** Kiểm mỗi phút (giá trị chỉ đổi theo giờ nguyên nên không render thừa); đúng cả múi giờ lệch 30 phút. */
function subscribe(onChange: () => void) {
  const t = setInterval(onChange, 60_000);
  return () => clearInterval(t);
}

/**
 * `initialMinutes`: server tính từ cùng cookie lúc nhận request. HTML và lần hydrate dùng cùng giá trị này
 * nên cảnh hiện đúng ngay từ đầu, không nhảy từ giá trị mặc định sang giờ thật.
 */
export function useSky(initialMinutes: number): Sky {
  const pref = useSkyPref((s) => s.pref);
  const minutes = useSyncExternalStore(subscribe, () => skyMinutes(pref), () => initialMinutes);
  return computeSky(minutes / 60);
}
