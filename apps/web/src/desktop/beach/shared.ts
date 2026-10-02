import type { CSSProperties } from "react";
import { SCENE } from "../sky";

export const { W, H, hor, shore } = SCENE;
export const seaH = shore - hor;
/** Màu nét viền kiểu anime dùng chung. */
export const O = "#2B2350";
export const LINE = "#3B2A4A";

export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const anim = (dur: number, delay: number): CSSProperties => ({
  animationDuration: `${dur}s`,
  animationDelay: `-${delay}s`,
});

/** Vị trí các vật cố định trên bãi cát (toạ độ cảnh). */
export const LAYOUT = {
  umbrella: { x: 250, y: 730 },
  chairs: [
    { x: 410, y: 838, a: "#FF6B6B", b: "#FFFFFF" },
    { x: 480, y: 852, a: "#38BDF8", b: "#FFFFFF" },
  ],
  tent: { x: 1000, y: 830 },
  tri: { x: 1125, y: 812 },
  fire: { x: 900, y: 856 },
} as const;
