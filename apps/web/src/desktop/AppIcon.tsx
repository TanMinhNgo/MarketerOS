import type { ReactNode } from "react";
import type { AppIconName } from "@/apps/registry";

const O = "#2B2350";

const stroke = (fill: string, sw = 3) => ({
  fill,
  stroke: O,
  strokeWidth: sw,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
});

function Sparkle({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  return (
    <path
      d={`M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`}
      {...stroke(fill, 2)}
    />
  );
}

const CAL_DOTS = [16, 28, 40].flatMap((x) => [35, 46].map((y) => ({ x, y })));

const STICKERS: Record<AppIconName, ReactNode> = {
  projects: (
    <>
      <path d="M6 18a4 4 0 0 1 4-4h14l6 6h24a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" {...stroke("#FFB43A")} />
      <path d="M4 31a4 4 0 0 1 4-3h48a4 4 0 0 1 4 5l-4 19a4 4 0 0 1-4 3H10a4 4 0 0 1-4-3z" {...stroke("#FF6F4A")} />
      <path d="M12 36h18" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.65} />
      <Sparkle cx={51} cy={11} r={7} fill="#FFF3A8" />
    </>
  ),
  brief: (
    <>
      <path d="M32 8C16 8 6 19 6 31c0 12 9 21 21 21 5 0 6-3 4-6-2-3 0-6 4-6h8c7 0 13-4 13-12C56 17 46 8 32 8z" {...stroke("#FFE3EE")} />
      <circle cx={19} cy={27} r={4.5} {...stroke("#FF4D6D", 2)} />
      <circle cx={29} cy={18} r={4.5} {...stroke("#FFC933", 2)} />
      <circle cx={41} cy={19} r={4.5} {...stroke("#2DD4BF", 2)} />
      <circle cx={48} cy={29} r={4.5} {...stroke("#6366F1", 2)} />
      <path d="M44 56 58 30" stroke={O} strokeWidth={9} strokeLinecap="round" />
      <path d="M44 56 58 30" stroke="#F4B860" strokeWidth={5} strokeLinecap="round" />
      <path d="M39 61c1-5 4-7 7-6l-3 7z" {...stroke("#FF4D6D", 2)} />
    </>
  ),
  studio: (
    <>
      <g transform="rotate(40 32 36)">
        <rect x={27} y={16} width={10} height={44} rx={4} {...stroke("#7C5CFF")} />
        <rect x={27} y={16} width={10} height={13} rx={4} {...stroke("#FFD84D")} />
      </g>
      <Sparkle cx={17} cy={17} r={10} fill="#FFD84D" />
      <Sparkle cx={51} cy={12} r={6} fill="#FF7AC6" />
      <Sparkle cx={54} cy={44} r={5} fill="#5EEAD4" />
    </>
  ),
  calendar: (
    <>
      <path d="M8 20a8 8 0 0 1 8-8h32a8 8 0 0 1 8 8v30a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8z" {...stroke("#FFFFFF")} />
      <path d="M8 20a8 8 0 0 1 8-8h32a8 8 0 0 1 8 8v7H8z" {...stroke("#21C2A3")} />
      <rect x={18} y={5} width={6} height={14} rx={3} {...stroke("#FFB43A", 2.5)} />
      <rect x={40} y={5} width={6} height={14} rx={3} {...stroke("#FFB43A", 2.5)} />
      {CAL_DOTS.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={9} height={8} rx={2.5} fill={x === 28 && y === 35 ? "#FF6F4A" : "#DCE6F5"} />
      ))}
    </>
  ),
  assistant: (
    <>
      <path d="M8 14a8 8 0 0 1 8-8h32a8 8 0 0 1 8 8v22a8 8 0 0 1-8 8H28l-12 11v-11a8 8 0 0 1-8-8z" {...stroke("#B9A6FF")} />
      <circle cx={22} cy={25} r={3.5} fill={O} />
      <circle cx={32} cy={25} r={3.5} fill={O} />
      <circle cx={42} cy={25} r={3.5} fill={O} />
      <Sparkle cx={53} cy={50} r={9} fill="#FFD84D" />
    </>
  ),
  plans: (
    <>
      <rect x={4} y={14} width={56} height={38} rx={8} {...stroke("#3B9CFF")} />
      <rect x={5.5} y={22} width={53} height={9} fill="#23439E" />
      <rect x={10} y={37} width={12} height={9} rx={2.5} {...stroke("#FFD84D", 2)} />
      <Sparkle cx={46} cy={41} r={8} fill="#FFD84D" />
    </>
  ),
  trash: (
    <>
      <path d="M14 22h36l-3 32a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4z" {...stroke("#9FB0C7")} />
      <g transform="rotate(-10 52 16)">
        <rect x={9} y={12} width={46} height={9} rx={4.5} {...stroke("#CBD5E4")} />
        <rect x={26} y={6} width={14} height={7} rx={3} {...stroke("#CBD5E4")} />
      </g>
      <path d="M26 30v20M32 30v20M38 30v20" stroke={O} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
    </>
  ),
  integrations: (
    <>
      <path d="M32 32L12 14M32 32L52 14M32 32L32 54" stroke={O} strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={12} cy={14} r={8} {...stroke("#3B82F6")} />
      <circle cx={52} cy={14} r={8} {...stroke("#EC4899")} />
      <circle cx={32} cy={54} r={8} {...stroke("#F59E0B")} />
      <circle cx={32} cy={32} r={12} {...stroke("#6366F1")} />
      <path d="M27 32L31 36L38 28" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  library: (
    <>
      <path d="M6 18a4 4 0 0 1 4-4h14l6 6h24a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" {...stroke("#2DD4BF")} />
      <g transform="rotate(-8 34 30)">
        <rect x={16} y={12} width={34} height={28} rx={4} {...stroke("#FFFFFF", 2.5)} />
        <circle cx={26} cy={22} r={3.5} fill="#FFD84D" />
        <path d="M18 38L30 26L38 33L44 28L48 38Z" fill="#4ADE80" stroke={O} strokeWidth={1.5} strokeLinejoin="round" />
      </g>
      <path d="M4 31a4 4 0 0 1 4-3h48a4 4 0 0 1 4 5l-4 19a4 4 0 0 1-4 3H10a4 4 0 0 1-4-3z" {...stroke("#14B8A6")} />
      <path d="M12 36h18" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.65} />
    </>
  ),
  reports: (
    <>
      <path d="M14 8h26l12 12v32a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z" {...stroke("#FFFFFF")} />
      <path d="M40 8v12h12" fill="#DCE6F5" stroke={O} strokeWidth={3} strokeLinejoin="round" />
      <path d="M17 18h14M17 25h10" stroke={O} strokeWidth={2.5} strokeLinecap="round" opacity={0.5} />
      <rect x={17} y={40} width={7} height={12} rx={1.5} {...stroke("#FF6F4A", 2)} />
      <rect x={28} y={33} width={7} height={19} rx={1.5} {...stroke("#38BDF8", 2)} />
      <rect x={39} y={26} width={7} height={26} rx={1.5} {...stroke("#4ADE80", 2)} />
    </>
  ),
  account: (
    <>
      <circle cx={32} cy={32} r={26} {...stroke("#6D5BFF")} />
      <circle cx={32} cy={26} r={9} {...stroke("#FFE3C7", 2.5)} />
      <path d="M14 50c3-10 11-14 18-14s15 4 18 14" {...stroke("#FFD84D", 2.5)} />
      <Sparkle cx={52} cy={12} r={6} fill="#FFF3A8" />
    </>
  ),
  docs: (
    <>
      <path d="M6 14c8-3 17-3 26 3v37c-9-6-18-6-26-3z" {...stroke("#FFFFFF")} />
      <path d="M58 14c-8-3-17-3-26 3v37c9-6 18-6 26-3z" {...stroke("#DCE6F5")} />
      <path d="M12 24c4-1 9-1 14 1M12 32c4-1 9-1 14 1M38 25c5-2 10-2 14-1M38 33c5-2 10-2 14-1" stroke={O} strokeWidth={2.5} strokeLinecap="round" opacity={0.45} />
      <Sparkle cx={50} cy={10} r={7} fill="#FFD84D" />
    </>
  ),
  about: (
    <>
      <circle cx={32} cy={32} r={26} {...stroke("#38BDF8")} />
      <circle cx={32} cy={20} r={4} fill="#fff" stroke={O} strokeWidth={2} />
      <path d="M32 28v18" stroke="#fff" strokeWidth={7} strokeLinecap="round" />
      <path d="M32 28v18" stroke={O} strokeWidth={2} strokeLinecap="round" opacity={0.0} />
      <Sparkle cx={52} cy={12} r={6} fill="#FFF3A8" />
    </>
  ),
  settings: (
    <>
      <g {...stroke("#A78BFA")}>
        {Array.from({ length: 8 }, (_, k) => (
          <rect key={k} x={27} y={4} width={10} height={14} rx={3} transform={`rotate(${k * 45} 32 32)`} />
        ))}
        <circle cx={32} cy={32} r={18} />
      </g>
      <circle cx={32} cy={32} r={7} {...stroke("#FFFFFF")} />
    </>
  ),
};

export function AppIcon({ name, size = 64 }: { name: AppIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="block">
      {STICKERS[name]}
    </svg>
  );
}

/** Logo MarketOS: chú mèo mascot (kẹp mây trên tai) nổi trên biển, nền tím-xanh. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7C6BFF" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
        <clipPath id="logo-clip">
          <rect x={2} y={2} width={60} height={60} rx={16} />
        </clipPath>
      </defs>
      <rect x={2} y={2} width={60} height={60} rx={16} fill="url(#logo-grad)" />
      <g clipPath="url(#logo-clip)">
        <path d="M0 47Q8 41 16 47T32 47T48 47T64 47V64H0Z" fill="#fff" opacity={0.85} />
      </g>
      <g strokeLinejoin="round" strokeLinecap="round">
        <path d="M14 31L15 12L28 22Z" fill="#FFF6EC" stroke={O} strokeWidth={2.6} />
        <path d="M50 31L49 12L36 22Z" fill="#FFF6EC" stroke={O} strokeWidth={2.6} />
        <path d="M17.5 25L18 17.5L23.5 21.5Z" fill="#FFB3C1" />
        <path d="M46.5 25L46 17.5L40.5 21.5Z" fill="#FFB3C1" />
        <ellipse cx={32} cy={37} rx={19} ry={16} fill="#FFF6EC" stroke={O} strokeWidth={2.6} />
        <ellipse cx={25} cy={36} rx={3} ry={4.2} fill={O} />
        <ellipse cx={39} cy={36} rx={3} ry={4.2} fill={O} />
        <circle cx={26} cy={34.5} r={1.1} fill="#fff" />
        <circle cx={40} cy={34.5} r={1.1} fill="#fff" />
        <ellipse cx={20} cy={42} rx={3} ry={1.8} fill="#FF8FA3" opacity={0.65} />
        <ellipse cx={44} cy={42} rx={3} ry={1.8} fill="#FF8FA3" opacity={0.65} />
        <ellipse cx={32} cy={41} rx={1.6} ry={1.1} fill="#FF8FA3" />
        <path d="M29.5 43.5Q32 46 34.5 43.5" fill="none" stroke={O} strokeWidth={2} />
        <g fill="#fff" stroke={O} strokeWidth={1.6}>
          <circle cx={39} cy={26.5} r={3.3} />
          <circle cx={43} cy={25} r={4} />
          <circle cx={47} cy={27} r={3.1} />
        </g>
      </g>
    </svg>
  );
}
