"use client";

import { useSyncExternalStore } from "react";
import { computeSky, type Sky } from "./sky";

const SSR_MINUTES = 12 * 60;

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

const VN_CLOCK = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hourCycle: "h23" });

/** Giờ hiện tại theo giờ Việt Nam (UTC+7), tính bằng phút nhưng chỉ đổi theo giờ nguyên. */
function getSnapshot(): number {
  const hour = Number(VN_CLOCK.formatToParts(new Date()).find((p) => p.type === "hour")?.value);
  return hour * 60;
}

export function useSky(): Sky {
  const minutes = useSyncExternalStore(subscribe, getSnapshot, () => SSR_MINUTES);
  return computeSky(minutes / 60);
}
