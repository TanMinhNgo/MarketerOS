import { SCENE, type Sky } from "../sky";

/** Hướng và độ đậm của bóng: k > 0 bóng đổ sang phải (nguồn sáng bên trái). */
export interface Shade { k: number; op: number }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Bóng theo nguồn sáng đang chiếu: mặt trời ban ngày, mặt trăng ban đêm (mờ hơn). */
export function shade(sky: Sky): Shade {
  const { W, hor } = SCENE;
  const night = sky.daylight < 0.35;
  const src = night ? sky.moon : sky.sun;
  const elev = clamp((hor - src.y) / (hor - 110), 0, 1);
  const k = clamp((W / 2 - src.x) / (0.42 * W), -1, 1) * (0.4 + 0.6 * (1 - elev));
  const op = night ? 0.14 * clamp(elev * 3, 0, 1) * (1 - sky.daylight) : 0.3 * sky.daylight;
  return { k, op };
}

/** Bóng elip dưới chân vật cao h, rộng w; gốc (0,0) là điểm chạm đất. */
export function GroundShadow({ w, h, shade: s }: { w: number; h: number; shade: Shade }) {
  if (s.op < 0.01) return null;
  return <ellipse cx={s.k * h * 0.5} cy={1} rx={w / 2 + Math.abs(s.k) * h * 0.5} ry={Math.max(3, w * 0.14)} fill="#1B1030" opacity={s.op} />;
}
