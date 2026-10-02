/** Toạ độ cảnh bãi biển (viewBox cố định 1440x900). */
export const SCENE = { W: 1440, H: 900, hor: 414, shore: 666 } as const;

export interface SkyUi {
  barBg: string;
  barInk: string;
  pillBg: string;
  dockBg: string;
  labelBg: string;
  labelInk: string;
  titleInk: string;
  titleShadow: string;
}

export interface Sky {
  top: string;
  bottom: string;
  sun: { x: number; y: number; color: string };
  moon: { x: number; y: number };
  /** 0 = đêm, 1 = ban ngày. */
  daylight: number;
  starOp: number;
  cloudOp: number;
  nightOp: number;
  glitterOp: number;
  sunGlintOp: number;
  moonGlintOp: number;
  /** 0–1, đậm nhất khi mặt trời sát chân trời (bình minh/hoàng hôn). */
  sunsetGlow: number;
  ui: SkyUi;
}

const STOPS: [number, string, string][] = [
  [0, "#050B24", "#16214D"],
  [5, "#1B2456", "#6B4B8A"],
  [6.5, "#7DB6EE", "#FFC58A"],
  [9, "#4FA8F0", "#BDE6FF"],
  [13, "#2F93EA", "#A8DCFF"],
  [17, "#4FA0E8", "#FFD9A0"],
  [18, "#5B6FC4", "#FF9A6B"],
  [19, "#23306E", "#6B4B8A"],
  [20.5, "#0A1230", "#1C2A5C"],
  [22, "#050B24", "#16214D"],
  [24, "#050B24", "#16214D"],
];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return (
    "#" +
    x
      .map((v, i) =>
        Math.round(v + (y[i] - v) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/** Mặt trời/mặt trăng đi theo cung tròn; p=0 mọc (trái), p=0.5 đỉnh, p=1 lặn (phải). */
function arc(p: number) {
  const { W, hor } = SCENE;
  return {
    x: W / 2 - Math.cos(Math.PI * p) * W * 0.42,
    y: hor - Math.sin(Math.PI * p) * (hor - 110),
  };
}

/** Trạng thái bầu trời theo giờ (0–24, có thể lẻ). */
export function computeSky(hour: number): Sky {
  const { hor } = SCENE;
  const h = ((hour % 24) + 24) % 24;

  const sunP = (h - 6) / 12;
  const moonP = ((((h - 18) % 24) + 24) % 24) / 12;
  const sun = arc(sunP);
  const moon = arc(moonP);
  const elevation = Math.sin(Math.PI * sunP);
  const daylight = clamp((elevation + 0.05) / 0.45, 0, 1);

  let i = 0;
  while (i < STOPS.length - 2 && h >= STOPS[i + 1][0]) i++;
  const [h0, top0, bot0] = STOPS[i];
  const [h1, top1, bot1] = STOPS[i + 1];
  const t = clamp((h - h0) / (h1 - h0), 0, 1);

  const day = daylight > 0.5;
  const above = (y: number) => clamp((hor - y) / 140, 0, 1);

  return {
    top: mix(top0, top1, t),
    bottom: mix(bot0, bot1, t),
    sun: { ...sun, color: mix("#FF7A3D", "#FFE066", clamp(elevation * 2.5, 0, 1)) },
    moon,
    daylight,
    starOp: clamp(1 - daylight * 1.6, 0, 1),
    cloudOp: 0.3 + 0.7 * daylight,
    nightOp: 0.55 * (1 - daylight),
    glitterOp: daylight * 0.9,
    sunGlintOp: sun.y < hor ? above(sun.y) * daylight * 0.8 : 0,
    moonGlintOp: moon.y < hor ? above(moon.y) * (1 - daylight) * 0.7 : 0,
    sunsetGlow: clamp(1 - Math.abs(elevation) / 0.35, 0, 1),
    ui: {
      barBg: day ? "rgba(255,255,255,0.45)" : "rgba(14,20,56,0.5)",
      barInk: day ? "#12284A" : "#F4F7FF",
      pillBg: day ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.14)",
      dockBg: day ? "rgba(255,255,255,0.38)" : "rgba(16,22,64,0.45)",
      labelBg: day ? "rgba(255,255,255,0.6)" : "rgba(16,22,64,0.55)",
      labelInk: day ? "#12284A" : "#F4F7FF",
      titleInk: day ? "#0B2A4F" : "#F4F7FF",
      titleShadow: day ? "rgba(255,255,255,0.75)" : "rgba(10,20,70,0.85)",
    },
  };
}
