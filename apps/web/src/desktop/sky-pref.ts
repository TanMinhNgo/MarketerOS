import { clockMinutes, VN_TZ } from "./sky";

/** Cookie (không phải localStorage) để server dựng đúng cảnh ngay từ HTML, không nhảy cảnh khi tải. */
export const SKY_COOKIE = "marketos-sky";

/** Cảnh cố định (phút trong ngày); `auto` đi theo đồng hồ. */
export const SCENES = { auto: null, dawn: 6 * 60, day: 12 * 60, sunset: 18 * 60, night: 22 * 60 } as const;
export type Scene = keyof typeof SCENES;
export type Motion = "system" | "reduce" | "full";

export interface SkyPref {
  scene: Scene;
  /** Múi giờ của đồng hồ cảnh khi `auto`. */
  tz: string;
  motion: Motion;
}

export const DEFAULT_SKY_PREF: SkyPref = { scene: "auto", tz: VN_TZ, motion: "system" };

const validTz = (tz: unknown): tz is string => {
  if (typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** Đọc cookie; giá trị lạ / hỏng thì dùng mặc định từng trường. */
export function parseSkyPref(raw: string | undefined): SkyPref {
  let v: Partial<Record<keyof SkyPref, unknown>> = {};
  try {
    v = raw ? JSON.parse(decodeURIComponent(raw)) : {};
  } catch {
    // cookie hỏng: dùng mặc định
  }
  return {
    scene: typeof v.scene === "string" && v.scene in SCENES ? (v.scene as Scene) : DEFAULT_SKY_PREF.scene,
    tz: validTz(v.tz) ? v.tz : DEFAULT_SKY_PREF.tz,
    motion: v.motion === "reduce" || v.motion === "full" ? v.motion : "system",
  };
}

export const skyMinutes = (p: SkyPref, now = new Date()) => SCENES[p.scene] ?? clockMinutes(p.tz, now);
