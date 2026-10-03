"use client";

import { useSyncExternalStore } from "react";
import { computeSky, vnMinutes, type Sky } from "./sky";

/** Chỉ cập nhật đúng đầu mỗi giờ (6h, 7h, ...), không poll liên tục. */
function subscribe(onChange: () => void) {
  let t: ReturnType<typeof setTimeout>;
  const arm = () => {
    t = setTimeout(() => {
      onChange();
      arm();
    }, 3_600_000 - (Date.now() % 3_600_000) + 500); // UTC+7 là số giờ nguyên nên mốc giờ trùng nhau
  };
  arm();
  return () => clearTimeout(t);
}

const getSnapshot = () => vnMinutes();

/**
 * `initialMinutes`: giờ server tính lúc nhận request. HTML và lần hydrate dùng cùng giá trị này
 * nên cảnh hiện đúng giờ ngay từ đầu, không nhảy từ giá trị mặc định sang giờ thật.
 */
export function useSky(initialMinutes: number): Sky {
  const minutes = useSyncExternalStore(subscribe, getSnapshot, () => initialMinutes);
  return computeSky(minutes / 60);
}
