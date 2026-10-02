import type { Sky } from "../sky";
import { anim, hor, LAYOUT, O, rng, seaH, shore } from "./shared";

const rand = rng(11);
/** 16 "hạt sáng" của vệt phản chiếu: càng gần bờ càng rộng, thưa và lệch ngang. */
const GLINTS = Array.from({ length: 16 }, (_, i) => {
  const t = i / 15;
  return {
    y: 10 + Math.pow(t, 1.25) * (seaH - 30),
    dx: (rand() - 0.5) * (14 + t * 90),
    rx: 8 + t * 46,
    ry: 1.6 + t * 2.4,
    op: 1 - t * 0.5,
    dur: 2 + rand() * 2.5,
    delay: rand() * 4,
  };
});

/** Gradient dùng chung cho quầng sáng; đặt trong <defs>. */
export function LightDefs({ sky }: { sky: Sky }) {
  const c = sky.sun.color;
  return (
    <>
      <radialGradient id="halo-sun">
        <stop offset="0" stopColor={c} stopOpacity="0.85" />
        <stop offset="0.35" stopColor={c} stopOpacity="0.32" />
        <stop offset="1" stopColor={c} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="halo-moon">
        <stop offset="0" stopColor="#DCE6FF" stopOpacity="0.8" />
        <stop offset="0.35" stopColor="#B5C7FF" stopOpacity="0.28" />
        <stop offset="1" stopColor="#B5C7FF" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="horizon-glow">
        <stop offset="0" stopColor={c} stopOpacity="0.9" />
        <stop offset="1" stopColor={c} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="water-sun">
        <stop offset="0" stopColor={c} stopOpacity="0.55" />
        <stop offset="1" stopColor={c} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="water-moon">
        <stop offset="0" stopColor="#DCE6FF" stopOpacity="0.4" />
        <stop offset="1" stopColor="#DCE6FF" stopOpacity="0" />
      </radialGradient>
    </>
  );
}

const blend = { mixBlendMode: "screen" } as const;

/** Mặt trời + mặt trăng với quầng sáng nhiều tầng (vẽ sau sao, trước mây và biển). */
export function SkyLight({ sky }: { sky: Sky }) {
  const { sun, moon } = sky;
  const rays = Array.from({ length: 12 }, (_, k) => k * 30);
  return (
    <>
      {/* ánh sáng lan dọc chân trời khi mọc/lặn */}
      <ellipse cx={sun.x} cy={hor} rx={620} ry={90} fill="url(#horizon-glow)" opacity={sky.sunsetGlow * 0.75} style={blend} />

      <g transform={`translate(${sun.x} ${sun.y})`}>
        <g style={blend}>
          <circle r={400} fill="url(#halo-sun)" opacity={0.35 + sky.sunsetGlow * 0.3} />
          <circle r={210} fill="url(#halo-sun)" opacity={0.6} />
          <circle r={100} fill="url(#halo-sun)" />
        </g>
        <g className="spin-slow" fill={sun.color} opacity={0.4}>
          {rays.map((a) => (
            <path key={a} d="M-7 -78L0 -132L7 -78z" transform={`rotate(${a})`} />
          ))}
        </g>
        <circle r={55} fill={sun.color} />
        <circle r={55} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={4} />
      </g>

      <g transform={`translate(${moon.x} ${moon.y})`} opacity={sky.starOp}>
        <g style={blend}>
          <circle r={300} fill="url(#halo-moon)" opacity={0.35} />
          <circle r={160} fill="url(#halo-moon)" opacity={0.6} />
          <circle r={80} fill="url(#halo-moon)" />
        </g>
        <circle r={52} fill="none" stroke="#DCE6FF" strokeOpacity={0.3} strokeWidth={3} />
        <circle r={39} fill="#EEF1FA" />
        <circle cx={-12} cy={-9} r={7} fill="rgba(150,160,190,0.35)" />
        <circle cx={13} cy={9} r={9} fill="rgba(150,160,190,0.3)" />
        <circle cx={-8} cy={19} r={4.5} fill="rgba(150,160,190,0.3)" />
      </g>
    </>
  );
}

/**
 * Mọi nguồn sáng ban đêm (lửa trại, đèn lồng, trăng trên cát). Vẽ SAU lớp phủ đêm và
 * trộn `screen` một lần cho cả nhóm, để không bị phủ tối và làm vật xung quanh sáng lên.
 */
export function NightLights({ sky }: { sky: Sky }) {
  const { fire, tent, tri, umbrella } = LAYOUT;
  const lamps = [
    { x: tent.x + 30, y: tent.y - 16, r: 34, pool: 70 },
    { x: tri.x, y: tri.y - 14, r: 30, pool: 60 },
    { x: umbrella.x + 78, y: umbrella.y + 58, r: 44, pool: 90 },
  ];
  const pool = (cx: number, cy: number, rx: number, extra?: string) => (
    <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx={rx} ry={rx * 0.22} fill="url(#lamp)" className={extra} />
  );
  return (
    <>
      <g opacity={sky.starOp}>
        <g style={blend}>
          <circle cx={fire.x} cy={fire.y - 14} r={70} fill="url(#lamp)" className="glow" />
          {pool(fire.x, fire.y + 2, 170, "glow")}
          {lamps.map((l) => (
            <g key={l.x}>
              <circle cx={l.x} cy={l.y} r={l.r} fill="url(#lamp)" />
              {pool(l.x, l.y + 24, l.pool)}
            </g>
          ))}
        </g>
        <g transform={`translate(${fire.x} ${fire.y})`}>
          <g className="flicker"><path d="M-8 -6Q-10 -22 0 -32Q10 -22 8 -6Z" fill="#FF8A3D" stroke={O} strokeWidth={1.4} strokeLinejoin="round" /></g>
          <g className="flicker" style={{ animationDelay: "-0.2s" }}><path d="M-4 -6Q-5 -16 0 -22Q5 -16 4 -6Z" fill="#FFE066" /></g>
        </g>
      </g>
      {/* ánh trăng hắt lên bãi cát */}
      <ellipse cx={sky.moon.x} cy={shore + 70} rx={420} ry={80} fill="url(#water-moon)" opacity={sky.moonGlintOp * 0.7} style={blend} />
    </>
  );
}

/** Vệt phản chiếu dưới nước: chuỗi elip nhấp nháy, không phải cột thẳng (vẽ sau lớp phủ đêm). */
export function WaterGlints({ sky }: { sky: Sky }) {
  const one = (x: number, fill: string, op: number, gradient: string, key: string) => (
    <g key={key} opacity={op}>
      <ellipse cx={x} cy={hor + seaH * 0.35} rx={280} ry={seaH * 0.5} fill={`url(#${gradient})`} style={blend} />
      {GLINTS.map((g, i) => (
        <g key={i} transform={`translate(${x + g.dx} ${hor + g.y})`}>
          <ellipse rx={g.rx} ry={g.ry} fill={fill} opacity={g.op} className="shimmer" style={anim(g.dur, g.delay)} />
          <ellipse rx={g.rx * 0.4} ry={g.ry * 0.6} fill="#fff" opacity={g.op} className="shimmer" style={anim(g.dur, g.delay + 0.4)} />
        </g>
      ))}
    </g>
  );
  return (
    <g>
      {one(sky.sun.x, sky.sun.color, sky.sunGlintOp, "water-sun", "sun")}
      {one(sky.moon.x, "#EBF0FF", sky.moonGlintOp, "water-moon", "moon")}
    </g>
  );
}
