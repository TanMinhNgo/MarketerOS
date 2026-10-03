import type { ReactNode } from "react";
import { HERO_Y, HeroMascot, SeaPeople, SitPerson, TentPerson, WALKERS, WalkerFigure } from "./beach/Beachgoers";
import { LightDefs, NightLights, SkyLight, WaterGlints } from "./beach/Light";
import { Boats, CampfireLogs, Chair, CoconutTable, DomeTent, Islands, TriTent, Umbrella } from "./beach/Props";
import { anim, H, hor, LAYOUT, O, rng, seaH, shore, W } from "./beach/shared";
import { GroundShadow, shade, type Shade } from "./beach/Shadow";
import { Wind } from "./beach/Wind";
import type { Sky } from "./sky";

const rand = rng(7);
const between = (a: number, b: number) => a + rand() * (b - a);
const STARS = Array.from({ length: 45 }, () => ({
  cx: Math.round(between(8, W - 8)),
  cy: Math.round(between(50, hor * 0.85)),
  r: [1, 1.2, 1.6, 2][Math.floor(rand() * 4)],
  dur: between(2, 5),
  delay: between(0, 5),
}));
const SPECKS = Array.from({ length: 40 }, () => ({ cx: Math.round(between(0, W)), cy: Math.round(between(30, H - shore)), r: [1, 1.5, 2][Math.floor(rand() * 3)] }));
const GLITTER = Array.from({ length: 26 }, () => ({
  cx: Math.round(between(10, W - 10)),
  cy: Math.round(between(8, seaH - 60)),
  rx: [3, 4, 6][Math.floor(rand() * 3)],
  dur: between(2, 4),
  delay: between(0, 4),
}));

/** Đường sóng lặp n chu kỳ trên mỗi 1440px, dài 2W để trượt vô hạn. */
function wavePath(amp: number, n: number, m: number) {
  const p = W / n;
  let d = `M0,${m} Q${p / 4},${m - 2 * amp} ${p / 2},${m}`;
  for (let k = 2; k <= 4 * n; k++) d += ` T${(p * k) / 2},${m}`;
  return d;
}

function Crest({ y, amp, n, sw, op, dur, rev, delay }: { y: number; amp: number; n: number; sw: number; op: number; dur: number; rev: boolean; delay: number }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <g className={rev ? "wave-r" : "wave-l"} style={anim(dur, delay)}>
        <path d={wavePath(amp, n, amp + sw)} fill="none" stroke="#fff" strokeWidth={sw} strokeLinecap="round" opacity={op} />
      </g>
    </g>
  );
}

const CLOUDS = [
  { y: 66, sc: 0.9, dur: 150, delay: 40, op: 0.95 },
  { y: 141, sc: 0.6, dur: 210, delay: 120, op: 0.8 },
  { y: 215, sc: 1.1, dur: 180, delay: 15, op: 0.9 },
  { y: 100, sc: 0.5, dur: 260, delay: 200, op: 0.7 },
];
const GULLS = [
  { y: hor * 0.3, sc: 1, dur: 34, delay: 5, bob: 4 },
  { y: hor * 0.42, sc: 0.7, dur: 48, delay: 22, bob: 5 },
  { y: hor * 0.2, sc: 0.9, dur: 41, delay: 30, bob: 3.5 },
  { y: hor * 0.55, sc: 0.6, dur: 56, delay: 9, bob: 4.5 },
];

/** Bóng cá mờ dưới nước (không viền, không màu sặc sỡ) để hoà vào biển. `rev`: bơi sang trái. */
const FISH = [
  { y: hor + 55, sc: 0.3, dur: 100, delay: 30, rev: false },
  { y: hor + 70, sc: 0.35, dur: 95, delay: 12, rev: true },
  { y: hor + 100, sc: 0.42, dur: 88, delay: 60, rev: true },
  { y: hor + 125, sc: 0.5, dur: 80, delay: 45, rev: false },
  { y: hor + 132, sc: 0.45, dur: 80, delay: 47, rev: false },
  { y: hor + 155, sc: 0.55, dur: 74, delay: 20, rev: false },
  { y: hor + 175, sc: 0.6, dur: 70, delay: 5, rev: true },
  { y: hor + 195, sc: 0.62, dur: 66, delay: 38, rev: true },
];

function Fish({ y, sc, dur, delay, rev }: (typeof FISH)[number]) {
  return (
    <g transform={`translate(0 ${y})`} opacity={0.22}>
      <g className={rev ? "walk-l" : "walk-r"} style={anim(dur, delay)}>
        <g className="bob-s" style={anim(2.6 + sc, delay)}>
          <g transform={`scale(${rev ? -sc : sc} ${sc})`} fill="#0B4F73">
            <path className="tail-wag" d="M11 12L0 3Q3 12 0 21z" />
            <ellipse cx={25} cy={12} rx={15} ry={7.5} />
          </g>
        </g>
      </g>
    </g>
  );
}

/** Chiếu độ cao trên trời (0..hor) xuống mặt biển để đặt bóng. */
const seaY = (y: number) => hor + 36 + (y / hor) * (seaH - 100);

/** Bóng mây trên mặt biển: cùng thời lượng/trễ với mây nên đồng bộ pha. */
function CloudShadow({ y, sc, dur, delay, sh, sky }: { y: number; sc: number; dur: number; delay: number; sh: Shade; sky: Sky }) {
  return (
    <g className="drift" style={anim(dur, delay)}>
      <g transform={`translate(${sh.k * 70} ${seaY(y)}) scale(${sc} ${sc * 0.2}) translate(0 -75)`} fill="#0A2540" opacity={sh.op * 0.7 * sky.cloudOp}>
        <ellipse cx={70} cy={78} rx={60} ry={30} />
        <ellipse cx={140} cy={58} rx={70} ry={42} />
        <ellipse cx={215} cy={72} rx={64} ry={34} />
        <ellipse cx={150} cy={92} rx={120} ry={26} />
      </g>
    </g>
  );
}

/** Bóng mòng biển lướt trên mặt biển, cùng nhịp bay và vỗ cánh. */
function GullShadow({ y, sc, dur, delay, sh }: { y: number; sc: number; dur: number; delay: number; sh: Shade }) {
  return (
    <g transform={`translate(0 ${seaY(y)})`}>
      <g className="walk-r" style={anim(dur, delay)}>
        <g transform={`translate(${sh.k * 40} 0) scale(${sc} ${sc * 0.25})`} opacity={sh.op * 0.8}>
          <g className="flap">
            <path d="M2 14Q11 -2 22 12Q33 -2 42 14Q33 8 22 17Q11 8 2 14z" fill="#0A2540" />
          </g>
        </g>
      </g>
    </g>
  );
}

function Cloud({ y, sc, dur, delay, op, sky }: { y: number; sc: number; dur: number; delay: number; op: number; sky: Sky }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <g className="drift" style={{ ...anim(dur, delay), opacity: sky.cloudOp }}>
        <g transform={`scale(${sc})`} fill="#fff" fillOpacity={op}>
          <ellipse cx={70} cy={78} rx={60} ry={30} />
          <ellipse cx={140} cy={58} rx={70} ry={42} />
          <ellipse cx={215} cy={72} rx={64} ry={34} />
          <ellipse cx={270} cy={88} rx={56} ry={24} />
          <ellipse cx={150} cy={92} rx={120} ry={26} />
        </g>
      </g>
    </g>
  );
}

function Palm({ x, base, h, flip, delay, sh }: { x: number; base: number; h: number; flip: boolean; delay: number; sh: Shade }) {
  const s = h / 300;
  return (
    <>
    <g transform={`translate(${x + 100 * s} ${base})`}><GroundShadow w={h * 0.32} h={h} shade={sh} /></g>
    <g transform={`translate(${x} ${base - h}) scale(${s})`}>
      <g className="sway" style={anim(4, delay)}>
        <g transform={flip ? "translate(200 0) scale(-1 1)" : undefined}>
          <path d="M92 298Q110 200 92 112L106 110Q128 200 118 298z" fill="#A9744A" stroke={O} strokeWidth={3} strokeLinejoin="round" />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <path key={k} d={`M${97 + k * 0.6} ${126 + k * 26}l16 3`} stroke={O} strokeWidth={2} opacity={0.4} />
          ))}
          {[-165, -130, -95, -60, -25, 10, 170].map((a, i) => (
            <g key={a} transform={`translate(98 108) rotate(${a})`}>
              <path className="frond" style={anim(2.2 + (i % 3) * 0.4, i * 0.3)} d="M0 0Q40 -40 96 0Q50 -18 0 0z" fill="#22A06B" stroke={O} strokeWidth={2.5} strokeLinejoin="round" />
            </g>
          ))}
          <circle cx={94} cy={116} r={6} fill="#7A4A2A" stroke={O} strokeWidth={2} />
          <circle cx={106} cy={118} r={6} fill="#7A4A2A" stroke={O} strokeWidth={2} />
        </g>
      </g>
    </g>
    </>
  );
}

function Gull({ y, sc, dur, delay, bob }: { y: number; sc: number; dur: number; delay: number; bob: number }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <g className="walk-r" style={anim(dur, delay)}>
        <g className="bob-y" style={{ animationDuration: `${bob}s` }}>
          <g transform={`scale(${sc})`}>
            <g className="flap">
              <path d="M2 14Q11 -2 22 12Q33 -2 42 14Q33 8 22 17Q11 8 2 14z" fill="#fff" stroke={O} strokeWidth={1.6} strokeLinejoin="round" />
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

export function BeachScene({ sky }: { sky: Sky }) {
  const period = W / 6;
  let top = `M0,14 Q${period / 4},6 ${period / 2},14`;
  for (let k = 2; k <= 12; k++) top += ` T${(period * k) / 2},14`;
  const sandH = H - shore + 14;
  const sh = shade(sky);

  // Vật thể + người xếp theo y chân (làn walker cố định) để vật gần che vật xa.
  const depth: [number, ReactNode][] = [
    [LAYOUT.umbrella.y + 128, <Umbrella key="umbrella" shade={sh} />],
    [LAYOUT.chairs[1].y, <CoconutTable key="table" x={LAYOUT.chairs[1].x + 52} y={LAYOUT.chairs[1].y} shade={sh} />],
    ...LAYOUT.chairs.map((c): [number, ReactNode] => [c.y, <Chair key={c.x} {...c} shade={sh} />]),
    [LAYOUT.chairs[0].y + 0.5, <SitPerson key="sit" />],
    [LAYOUT.tent.y, <DomeTent key="dome" shade={sh} />],
    [LAYOUT.tent.y + 0.5, <TentPerson key="tentperson" shade={sh} />],
    [LAYOUT.tri.y, <TriTent key="tri" shade={sh} />],
    [LAYOUT.fire.y, <CampfireLogs key="fire" />],
    [HERO_Y, <HeroMascot key="hero" shade={sh} />],
    ...WALKERS.map((w): [number, ReactNode] => [w.y, <WalkerFigure key={w.who} {...w} shade={sh} />]),
  ];
  depth.sort((a, b) => a[0] - b[0]);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${sky.top} 0%, ${sky.bottom} ${(hor / H) * 100}%, ${sky.bottom} 100%)` }} />
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse" gradientTransform={`translate(0 ${hor}) scale(1 ${seaH})`}>
            <stop offset="0" stopColor="#1E9FCF" />
            <stop offset="0.5" stopColor="#35C2DB" />
            <stop offset="1" stopColor="#86E4E0" />
          </linearGradient>
          <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E2BE84" />
            <stop offset="0.22" stopColor="#F3DBA8" />
            <stop offset="1" stopColor="#EDCF98" />
          </linearGradient>
          <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.4" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="lamp">
            <stop offset="0" stopColor="#FFBE5A" stopOpacity="0.85" />
            <stop offset="1" stopColor="#FFBE5A" stopOpacity="0" />
          </radialGradient>
          <LightDefs sky={sky} />
        </defs>

        <g opacity={sky.starOp}>
          {STARS.map((s, i) => (
            <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#fff" className="twinkle" style={anim(s.dur, s.delay)} />
          ))}
        </g>

        <SkyLight sky={sky} />

        {CLOUDS.map((c) => (
          <Cloud key={c.y} {...c} sky={sky} />
        ))}
        <Wind />

        <Islands sky={sky} />
        <rect x={0} y={hor} width={W} height={H - hor} fill="url(#sea)" />
        <rect x={0} y={hor} width={W} height={34} fill="url(#haze)" />
        {CLOUDS.map((c) => (
          <CloudShadow key={c.y} {...c} sh={sh} sky={sky} />
        ))}
        {GULLS.map((g) => (
          <GullShadow key={g.dur} {...g} sh={sh} />
        ))}

        <g transform={`translate(0 ${shore - 14})`}>
          <path d={`${top} L${W},${sandH} L0,${sandH}Z`} fill="url(#sand)" />
          {SPECKS.map((s, i) => (
            <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#D1AE70" opacity={0.5} />
          ))}
        </g>

        {Array.from({ length: 6 }, (_, i) => (
          <Crest key={i} y={hor + seaH * (0.1 + 0.14 * i)} amp={2 + i * 1.4} n={Math.max(4, 9 - i)} sw={1.6 + i * 0.5} op={0.22 + 0.06 * i} dur={46 - i * 4} rev={i % 2 === 1} delay={i * 7} />
        ))}
        <Crest y={shore - 26} amp={6} n={5} sw={9} op={0.85} dur={16} rev={false} delay={3} />
        <Crest y={shore - 12} amp={5} n={6} sw={5} op={0.6} dur={22} rev delay={9} />

        <g transform={`translate(0 ${hor})`} opacity={sky.glitterOp}>
          {GLITTER.map((g, i) => (
            <ellipse key={i} cx={g.cx} cy={g.cy} rx={g.rx} ry={1.2} fill="#fff" className="glit" style={anim(g.dur, g.delay)} />
          ))}
        </g>

        {FISH.map((f) => (
          <Fish key={f.y} {...f} />
        ))}

        <Boats />
        <SeaPeople />

        {depth.map(([, node]) => node)}

        <Palm x={W - 250} base={H - 26} h={330} flip={false} delay={1} sh={sh} />
        <Palm x={W - 150} base={H - 10} h={260} flip delay={3} sh={sh} />
        <Palm x={-30} base={H - 20} h={300} flip delay={2} sh={sh} />

        {GULLS.map((g) => (
          <Gull key={g.dur} {...g} />
        ))}

        <rect x={0} y={hor} width={W} height={H - hor} fill="#080E34" opacity={sky.nightOp} />
        <NightLights sky={sky} />
        <WaterGlints sky={sky} />
      </svg>
    </div>
  );
}
