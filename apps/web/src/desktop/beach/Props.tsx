import type { Sky } from "../sky";
import { anim, hor, LAYOUT, O, seaH, W } from "./shared";
import { GroundShadow, type Shade } from "./Shadow";

const st = (fill: string, sw = 2) => ({ fill, stroke: O, strokeWidth: sw, strokeLinejoin: "round" as const, strokeLinecap: "round" as const });

/** Ô che nắng + khăn trải cát. */
export function Umbrella({ shade }: { shade: Shade }) {
  const { x, y } = LAYOUT.umbrella;
  const pts: [number, number][] = [[10, 54], [40, 46], [70, 44], [100, 46], [130, 54]];
  return (
    <g transform={`translate(${x} ${y})`}>
      <g transform="translate(70 126)"><GroundShadow w={150} h={120} shade={shade} /></g>
      <path d="M70 40V124" stroke={O} strokeWidth={4} strokeLinecap="round" />
      {pts.slice(0, 4).map(([x0, y0], k) => (
        <path key={k} d={`M70 8L${x0} ${y0}L${pts[k + 1][0]} ${pts[k + 1][1]}z`} {...st(k % 2 === 0 ? "#FF5A5F" : "#fff")} />
      ))}
      <path d="M6 116L82 116L98 128L-8 128z" {...st("#38BDF8")} />
      <path d="M22 116L14 128M42 116L34 128M62 116L54 128" stroke="#fff" strokeWidth={3} />
      {/* đèn lồng treo cột ô (ánh sáng vẽ ở NightLights) */}
      <path d="M70 52H78" stroke={O} strokeWidth={1.4} />
      <rect x={74} y={52} width={8} height={11} rx={3} {...st("#FFE28A", 1.5)} />
    </g>
  );
}

/** Ghế bãi biển sọc; gốc (0,0) là giữa chân ghế. */
export function Chair({ x, y, a, b, shade }: { x: number; y: number; a: string; b: string; shade: Shade }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <GroundShadow w={44} h={38} shade={shade} />
      <path d="M-20 0L-14 -30M18 0L14 -14M-4 0L2 -14" stroke={O} strokeWidth={3} strokeLinecap="round" />
      <path d="M-20 -34L-9 -38L2 -12L-11 -10Z" {...st(a)} />
      <path d="M-15 -36L-4 -39L6 -13L-4 -11Z" fill={b} opacity={0.9} />
      <path d="M-11 -10L14 -13L17 -6L-8 -3Z" {...st(a)} />
      <path d="M-2 -11L2 -5" stroke={b} strokeWidth={3} />
    </g>
  );
}

/** Bàn nhỏ với trái dừa. */
export function CoconutTable({ x, y, shade }: { x: number; y: number; shade: Shade }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <GroundShadow w={30} h={26} shade={shade} />
      <path d="M-14 -16H14M0 -16V0M-8 0H8" stroke={O} strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={0} cy={-24} rx={9} ry={8} {...st("#F5F0E0")} />
      <path d="M-4 -30L-1 -38" stroke="#FF6B6B" strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

function Flag({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0V-26" stroke={O} strokeWidth={2} strokeLinecap="round" />
      <g className="flag" style={{ animationDelay: `-${(x % 7) / 10}s` }}>
        <path d="M0 -26L22 -22L0 -16Z" {...st(color, 1.5)} />
      </g>
    </g>
  );
}

function Lantern({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 -8V-14" stroke={O} strokeWidth={1.4} />
      <rect x={-4} y={-8} width={8} height={11} rx={3} {...st("#FFE28A", 1.5)} />
    </g>
  );
}

/** Lều vòm + cờ + đèn lồng (ánh sáng đèn vẽ ở NightLights). */
export function DomeTent({ shade }: { shade: Shade }) {
  const t = LAYOUT.tent;
  return (
    <>
      <g transform={`translate(${t.x} ${t.y})`}>
        <GroundShadow w={100} h={54} shade={shade} />
        <path d="M-70 0L-40 -4M70 0L44 -4" stroke={O} strokeWidth={1.4} strokeDasharray="3 3" />
        <path d="M-46 0Q-46 -50 0 -54Q46 -50 46 0Z" {...st("#FF8A5B", 2.5)} />
        <path d="M-46 0Q-44 -34 -22 -47L-14 0Z" fill="#FFB08A" opacity={0.7} />
        <path d="M-14 0Q-14 -30 0 -32Q14 -30 14 0Z" {...st("#5B2A1E")} />
        <path d="M0 -32V0" stroke={O} strokeWidth={1.4} />
      </g>
      <Flag x={t.x} y={t.y - 54} color="#FFD84D" />
      <Lantern x={t.x + 30} y={t.y - 16} />
    </>
  );
}

/** Lều tam giác + cờ + đèn lồng. */
export function TriTent({ shade }: { shade: Shade }) {
  const r = LAYOUT.tri;
  return (
    <>
      <g transform={`translate(${r.x} ${r.y})`}>
        <GroundShadow w={84} h={62} shade={shade} />
        <path d="M-40 0L0 -62L40 0Z" {...st("#2DD4BF", 2.5)} />
        <path d="M-40 0L0 -62L-8 0Z" fill="#5EEAD4" opacity={0.6} />
        <path d="M-12 0L0 -30L12 0Z" {...st("#0F3D3A")} />
      </g>
      <Flag x={r.x} y={r.y - 62} color="#FF7AC6" />
      <Lantern x={r.x} y={r.y - 14} />
    </>
  );
}

/** Củi trại; lửa và quầng sáng nằm ở NightLights (phải vẽ sau lớp phủ đêm). */
export function CampfireLogs() {
  const { x, y } = LAYOUT.fire;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-16 0L14 -8M16 0L-14 -8" stroke="#7A4A2A" strokeWidth={5} strokeLinecap="round" />
      <path d="M-16 0L14 -8M16 0L-14 -8" stroke={O} strokeWidth={1.2} strokeLinecap="round" opacity={0.5} />
    </g>
  );
}

const wake = <path d="M-6 50Q-24 53 -40 49M-8 54Q-22 57 -34 54" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" opacity={0.6} />;

/** Ba loại thuyền trôi ngang ở các độ sâu khác nhau (xa thì nhỏ và chậm). */
export function Boats() {
  const at = (yFrac: number, sc: number, dur: number, delay: number, body: React.ReactNode) => (
    <g key={dur} transform={`translate(0 ${hor + seaH * yFrac - 30 * sc}) scale(${sc})`}>
      <g className="walk-r" style={anim(dur / sc, delay)}>
        <ellipse cx={34} cy={55} rx={36} ry={3.5} fill="#0A2540" opacity={0.22} />
        <g className="bob-s" style={{ animationDuration: `${2 + sc}s` }}>
          {wake}
          {body}
        </g>
      </g>
    </g>
  );
  return (
    <>
      {/* du thuyền xa */}
      {at(0.05, 0.55, 420, 150, (
        <>
          <path d="M0 42H70L60 54H10Z" {...st("#fff", 1.6)} />
          <path d="M14 42V28H50V42M26 28V18H44V28" {...st("#E8F1FF", 1.6)} />
          <path d="M18 34H46" stroke="#38BDF8" strokeWidth={3} />
        </>
      ))}
      {/* thuyền buồm */}
      {at(0.14, 1, 300, Math.round(W * 0.2), (
        <>
          <path d="M4 42h48l-8 10H12z" {...st("#E8543A")} />
          <path d="M26 6V42" stroke={O} strokeWidth={2} />
          <path d="M28 8V38L48 38z" {...st("#fff", 1.6)} />
          <path d="M24 12V38L8 38z" {...st("#FFE9A8", 1.6)} />
        </>
      ))}
      {/* thuyền chài */}
      {at(0.3, 1.25, 360, 80, (
        <>
          <path d="M0 40H64L54 54H10Z" {...st("#2B6CB0")} />
          <rect x={20} y={26} width={18} height={14} rx={2} {...st("#F5E6C8", 1.6)} />
          <path d="M42 40V16M42 18L60 30" stroke={O} strokeWidth={2} strokeLinecap="round" />
          <circle cx={29} cy={33} r={3} fill="#38BDF8" />
        </>
      ))}
    </>
  );
}

interface IslandProps { x: number; w: number; lighthouse?: boolean; op?: number; sky: Sky }

function Island({ x, w, lighthouse, op = 0.8, sky }: IslandProps) {
  return (
    <g transform={`translate(${x} ${hor - 44})`} opacity={op}>
      <path d={`M0 46Q${w * 0.12} 12 ${w * 0.35} 24Q${w * 0.5} -4 ${w * 0.68} 22Q${w * 0.85} 12 ${w} 46Z`} fill="#3E9A8C" />
      <path d={`M${w * 0.1} 46Q${w * 0.3} 30 ${w * 0.5} 34Q${w * 0.75} 28 ${w * 0.95} 46Z`} fill="#2E7D6E" opacity={0.6} />
      {lighthouse && (
        <g transform={`translate(${w * 0.55} 14)`}>
          <path d="M-5 0L5 0L3 -36L-3 -36Z" fill="#fff" stroke="#3B2A4A" strokeWidth={1} />
          <path d="M-4.4 -10L4.4 -10L4 -18L-4 -18Z" fill="#E8543A" />
          <rect x={-4} y={-42} width={8} height={6} fill="#FFE28A" stroke="#3B2A4A" strokeWidth={1} />
          <g opacity={sky.starOp}>
            <path className="beam" d="M0 -39L90 -60L90 -18Z" fill="#FFF3B0" opacity={0.5} />
            <circle cx={0} cy={-39} r={16} fill="url(#lamp)" />
          </g>
        </g>
      )}
    </g>
  );
}

/** Ba hòn đảo xa, một hòn có hải đăng quét đèn ban đêm. */
export function Islands({ sky }: { sky: Sky }) {
  return (
    <>
      <Island x={Math.round(W * 0.62)} w={320} sky={sky} />
      <Island x={Math.round(W * 0.06)} w={200} lighthouse op={0.7} sky={sky} />
      <Island x={Math.round(W * 0.4)} w={120} op={0.6} sky={sky} />
    </>
  );
}
