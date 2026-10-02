import { Mascot, type MascotProps } from "./Mascot";
import { anim, H, hor, LAYOUT, LINE, seaH, W } from "./shared";
import { GroundShadow, type Shade } from "./Shadow";

type Look = Omit<MascotProps, "pose">;

/** Mascot gốc của MarketOS (mèo lông trắng, kẹp mây); các bạn khác là loài khác hẳn. */
export const HERO: Look = { species: "cat", skin: "#F4F1FF", hairColor: "#4C3FD0", eye: "#38BDF8", top: "#4C3FD0", bottom: "#FFB43A" };

const CAST: Record<string, Look> = {
  sakura: { species: "bunny", skin: "#FFE3EC", hairColor: "#FF8FB1", eye: "#A78BFA", top: "#FF6B6B", bottom: "#FFFFFF", accessory: "strawHat" },
  ren: { species: "fox", skin: "#F58A3A", hairColor: "#1F2A44", eye: "#4ADE80", top: "#38BDF8", bottom: "#F5E6C8", accessory: "shades" },
  mika: { species: "bear", skin: "#B9835A", hairColor: "#F2D9B8", eye: "#F59E0B", top: "#FBBF24", bottom: "#2B4C7E" },
  kai: { species: "shiba", skin: "#E8A860", hairColor: "#FFF1DC", eye: "#38BDF8", top: "#4ADE80", bottom: "#FFFFFF", accessory: "cap" },
  yuna: { species: "penguin", skin: "#2B3A67", hairColor: "#FFA726", eye: "#F472B6", top: "#F472B6", bottom: "#E2E8F0" },
  bo: { species: "bear", skin: "#6B4A3A", hairColor: "#D8B79A", eye: "#38BDF8", top: "#60A5FA", bottom: "#FFFFFF" },
};

export interface Walker { who: keyof typeof CAST; y: number; sc: number; dur: number; delay: number; dir: 1 | -1 }

/** Mỗi làn cách nhau >= 40px (y chân), đi ngược chiều xen kẽ để hiếm khi chồng nhau. */
export const WALKERS: Walker[] = [
  { who: "sakura", y: 716, sc: 0.8, dur: 88, delay: 10, dir: 1 },
  { who: "kai", y: 756, sc: 0.9, dur: 72, delay: 25, dir: -1 },
  { who: "ren", y: 796, sc: 1.0, dur: 64, delay: 40, dir: 1 },
  { who: "yuna", y: 892, sc: 1.15, dur: 110, delay: 5, dir: -1 },
];

const SWIMMERS: { who: keyof typeof CAST; x: number; fy: number; sc: number; float?: boolean; delay: number }[] = [
  { who: "bo", x: 330, fy: 0.74, sc: 1.05, delay: 0 },
  { who: "yuna", x: 640, fy: 0.62, sc: 0.85, float: true, delay: 1.3 },
  { who: "mika", x: 930, fy: 0.78, sc: 1.1, delay: 2.1 },
  { who: "sakura", x: 1180, fy: 0.68, sc: 0.9, float: true, delay: 0.7 },
];

export function WalkerFigure({ who, y, sc, dur, delay, dir, shade }: Walker & { shade: Shade }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <g className={dir > 0 ? "walk-r" : "walk-l"} style={anim(dur, delay)}>
        <g transform={`scale(${sc})`}><GroundShadow w={26} h={58} shade={shade} /></g>
        <g transform={`scale(${dir * sc} ${sc})`}>
          <Mascot pose="walk" {...CAST[who]} />
        </g>
      </g>
    </g>
  );
}

/** Tất cả nhân vật trên cảnh: người bơi, người lướt sóng, người trên cát. */
export function SeaPeople() {
  return (
    <>
      <g transform={`translate(${Math.round(W * 0.33)} ${Math.round(hor + seaH * 0.5) + 44})`}>
        <g className="surf">
          <path d="M-36 8Q-18 -18 6 -2Q20 8 34 2" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" />
          <ellipse cx={0} cy={2} rx={26} ry={4.5} fill="#FF6B6B" stroke={LINE} strokeWidth={1.6} />
          <g transform="translate(0 0) scale(0.8)">
            <Mascot pose="stand" {...CAST.kai} accessory="none" />
          </g>
        </g>
      </g>
      {SWIMMERS.map((s) => (
        <g key={s.x} transform={`translate(${s.x} ${hor + seaH * s.fy + 30})`}>
          <g className="swim-drift" style={anim(9 + s.delay * 2, s.delay * 3)}>
            <g className="bob-s" style={anim(2.4 + s.delay * 0.3, s.delay)}>
              <g transform={`scale(${s.sc})`}>
                <Mascot pose={s.float ? "float" : "swim"} {...CAST[s.who]} ring={s.float ? "#FF5A5F" : undefined} />
              </g>
            </g>
          </g>
        </g>
      ))}
    </>
  );
}

/** Người ngồi ghế đầu tiên; y dùng để xếp lớp theo độ sâu. */
export function SitPerson() {
  const chair = LAYOUT.chairs[0];
  return (
    <g transform={`translate(${chair.x + 2} ${chair.y - 12}) scale(0.9)`}>
      <Mascot pose="sit" {...CAST.ren} />
    </g>
  );
}

/** Người vẫy tay cạnh lều. */
export function TentPerson({ shade }: { shade: Shade }) {
  return (
    <g transform={`translate(${LAYOUT.tent.x + 58} ${LAYOUT.tent.y}) scale(0.95)`}>
      <GroundShadow w={26} h={58} shade={shade} />
      <Mascot pose="wave" {...CAST.mika} />
    </g>
  );
}

/** Mascot chính của MarketOS, vẫy tay ở tiền cảnh. */
export const HERO_Y = H - 30;
export function HeroMascot({ shade }: { shade: Shade }) {
  return (
    <g transform={`translate(560 ${HERO_Y}) scale(2.1)`}>
      <GroundShadow w={26} h={58} shade={shade} />
      <Mascot pose="wave" {...HERO} accessory="none" />
    </g>
  );
}
