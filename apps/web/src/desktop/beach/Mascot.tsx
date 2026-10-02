import { LINE } from "./shared";

export type Pose = "walk" | "stand" | "wave" | "sit" | "swim" | "float";
export type Species = "cat" | "fox" | "bear" | "bunny" | "penguin" | "shiba";
export type Accessory = "none" | "strawHat" | "shades" | "cap";

export interface MascotProps {
  pose?: Pose;
  species?: Species;
  /** Màu phụ: ruột tai, mõm, chóp đuôi. */
  hairColor: string;
  /** Màu lông. */
  skin?: string;
  eye?: string;
  top: string;
  bottom: string;
  accessory?: Accessory;
  /** Màu phao khi pose = "float". */
  ring?: string;
}

const ln = { stroke: LINE, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/** Tai (vẽ sau mặt), toạ độ bên trái, lật gương cho bên phải. */
function Ear({ species, skin, accent }: { species: Species; skin: string; accent: string }) {
  return (
    <>
      {[1, -1].map((s) => (
        <g key={s} transform={`scale(${s} 1)`} strokeWidth={1.4} {...ln}>
          {species === "cat" && (<><path d="M-14 -5L-14 -23L-3 -14Z" fill={skin} /><path d="M-12 -8L-12 -19L-6 -14Z" fill="#FFB3C1" stroke="none" /></>)}
          {species === "fox" && (<><path d="M-15 -4L-14 -27L-3 -14Z" fill={skin} /><path d="M-14 -27L-14.5 -20L-9.6 -21.8Z" fill={accent} stroke="none" /></>)}
          {species === "shiba" && (<><path d="M-15 -3L-14 -21L-4 -13Z" fill={skin} /><path d="M-13 -7L-13 -16L-8 -12Z" fill={accent} stroke="none" /></>)}
          {species === "bear" && (<><circle cx={-12} cy={-11} r={5.5} fill={skin} /><circle cx={-12} cy={-11} r={2.8} fill={accent} stroke="none" /></>)}
          {species === "bunny" && (
            <g transform="rotate(-8 -7 -14)"><ellipse cx={-7} cy={-25} rx={4.2} ry={11} fill={skin} /><ellipse cx={-7} cy={-25} rx={2} ry={8} fill="#FFB3C1" stroke="none" /></g>
          )}
        </g>
      ))}
    </>
  );
}

/** Mõm, mũi, râu — vẽ ngay trên mặt. */
function Muzzle({ species, accent }: { species: Species; accent: string }) {
  const nose = (fill: string) => <ellipse cx={0} cy={5.8} rx={1.9} ry={1.4} fill={fill} />;
  switch (species) {
    case "cat": return (<>{nose("#FF8FA3")}<path d="M-15 6L-21 5M-15 9L-21 10M15 6L21 5M15 9L21 10" stroke={LINE} strokeWidth={1} strokeLinecap="round" /></>);
    case "fox": return (<><path d="M-15.5 4Q-8 5 0 11Q8 5 15.5 4Q13 13 0 15Q-13 13 -15.5 4Z" fill="#fff" />{nose(LINE)}</>);
    case "bear": return (<><ellipse cx={0} cy={8} rx={6.5} ry={4.8} fill={accent} />{nose(LINE)}</>);
    case "shiba": return (<><ellipse cx={0} cy={8} rx={7} ry={5} fill={accent} />{nose(LINE)}</>);
    case "bunny": return (<>{nose("#FF8FA3")}<rect x={-1.6} y={10.4} width={3.2} height={3} rx={0.8} fill="#fff" stroke={LINE} strokeWidth={0.8} /></>);
    case "penguin": return (<><ellipse cx={0} cy={3} rx={12} ry={11} fill="#fff" /><path d="M-3 6Q0 4 3 6Q0 11 -3 6Z" fill="#FFA726" stroke={LINE} strokeWidth={0.9} strokeLinejoin="round" /></>);
  }
}

/**
 * Mascot MarketOS: thú chibi đầu tròn. Dấu hiệu nhận diện của mèo chủ: kẹp tóc hình đám mây.
 * Gốc toạ độ (0,0) là giữa hai bàn chân, nhân vật cao ~58 đơn vị.
 */
function Head({ species = "cat", hairColor, skin = "#FFE0C7", eye = "#38BDF8", accessory = "none" }: Pick<MascotProps, "species" | "hairColor" | "skin" | "eye" | "accessory">) {
  const hasHat = accessory === "strawHat" || accessory === "cap";
  return (
    <g>
      <Ear species={species} skin={skin} accent={hairColor} />

      {/* mặt */}
      <ellipse cx={0} cy={0} rx={15.5} ry={14.5} fill={skin} strokeWidth={1.4} {...ln} />
      <Muzzle species={species} accent={hairColor} />
      <ellipse cx={-10} cy={7} rx={3.2} ry={1.8} fill="#FF8FA3" opacity={0.55} />
      <ellipse cx={10} cy={7} rx={3.2} ry={1.8} fill="#FF8FA3" opacity={0.55} />
      <path d="M-2 9Q0 11.5 2 9" fill="none" strokeWidth={1.2} {...ln} />

      {/* mắt to kiểu anime */}
      {accessory === "shades" ? (
        <>
          <rect x={-11.5} y={-3} width={9.5} height={6.5} rx={2.6} fill="#1E1B3A" />
          <rect x={2} y={-3} width={9.5} height={6.5} rx={2.6} fill="#1E1B3A" />
          <path d="M-2 -0.5H2" stroke="#1E1B3A" strokeWidth={1.2} />
          <path d="M-9.5 -1.5L-6.5 -1.5M4 -1.5L7 -1.5" stroke="#fff" strokeWidth={1} opacity={0.7} />
        </>
      ) : (
        [-6, 6].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={1} rx={3.2} ry={4.3} fill={LINE} />
            <ellipse cx={x} cy={2.3} rx={2.4} ry={2.6} fill={eye} />
            <circle cx={x + 1.1} cy={-0.7} r={1.3} fill="#fff" />
            <circle cx={x - 1} cy={3.4} r={0.6} fill="#fff" />
            <path d={`M${x - 3.6} -2.2Q${x} -5.2 ${x + 3.6} -2.2`} fill="none" strokeWidth={1.2} {...ln} />
          </g>
        ))
      )}

      {/* phụ kiện */}
      {accessory === "strawHat" && (
        <>
          <path d="M-13 -11Q-13 -30 0 -30Q13 -30 13 -11Z" fill="#F5D68A" strokeWidth={1.4} {...ln} />
          <ellipse cx={0} cy={-11} rx={24} ry={5.5} fill="#F5D68A" strokeWidth={1.4} {...ln} />
          <path d="M-13 -13.5Q0 -10 13 -13.5L13 -11Q0 -8 -13 -11Z" fill="#FF6B6B" />
        </>
      )}
      {accessory === "cap" && (
        <>
          <path d="M-15 -8Q-15 -25 0 -25Q15 -25 15 -8Z" fill="#FF6B6B" strokeWidth={1.4} {...ln} />
          <path d="M3 -8Q18 -7 23 -3Q10 -2 3 -5Z" fill="#E0484D" strokeWidth={1.2} {...ln} />
        </>
      )}
      {species === "cat" && !hasHat && (
        <g transform="translate(9 -11)" fill="#fff" stroke={LINE} strokeWidth={0.8}>
          <circle cx={-2.6} cy={1} r={2.4} />
          <circle cx={0} cy={-1} r={3} />
          <circle cx={2.8} cy={1} r={2.4} />
        </g>
      )}
    </g>
  );
}

function Tail({ species, skin }: { species: Species; skin: string }) {
  if (species === "penguin") return null;
  if (species === "bear" || species === "bunny")
    return <circle cx={-8} cy={-13} r={species === "bunny" ? 3.4 : 2.8} fill={species === "bunny" ? "#fff" : skin} strokeWidth={1} {...ln} />;
  const d = species === "shiba" ? "M-5 -14Q-15 -14 -12 -23" : "M-5 -14Q-19 -12 -16 -26";
  return (
    <>
      <path d={d} fill="none" stroke={LINE} strokeWidth={6} strokeLinecap="round" />
      <path d={d} fill="none" stroke={skin} strokeWidth={4} strokeLinecap="round" />
      {species === "fox" && <circle cx={-16} cy={-26} r={2.3} fill="#fff" />}
    </>
  );
}

const limb = (skin: string, w = 3.4) => ({ stroke: skin, strokeWidth: w, strokeLinecap: "round" as const, fill: "none" });

export function Mascot(props: MascotProps) {
  const { pose = "stand", skin = "#FFE0C7", top, bottom, ring = "#FF5A5F" } = props;
  const head = <Head species={props.species} hairColor={props.hairColor} skin={skin} eye={props.eye} accessory={props.accessory} />;
  const species = props.species ?? "cat";
  const tail = <Tail species={species} skin={skin} />;
  const torso = <path d="M-7 -27Q0 -30 7 -27L6 -13Q0 -11 -6 -13Z" fill={top} strokeWidth={1} {...ln} />;

  if (pose === "swim" || pose === "float") {
    return (
      <g>
        <g transform="translate(0 -30)">{head}</g>
        <ellipse cx={0} cy={-19} rx={8} ry={4.5} fill={top} strokeWidth={1} {...ln} />
        {pose === "swim" ? (
          <>
            <g className="swim-arm"><path d="M-6 -20Q-15 -30 -23 -22" {...limb(skin, 3.2)} /></g>
            <g className="swim-arm-r" style={{ animationDelay: "-0.45s" }}><path d="M6 -20Q15 -30 23 -22" {...limb(skin, 3.2)} /></g>
          </>
        ) : (
          <>
            <path d="M-6 -19L-14 -14M6 -19L14 -14" {...limb(skin, 3.2)} />
            <ellipse cx={0} cy={-13} rx={17} ry={5.5} fill="none" stroke={LINE} strokeWidth={7.5} />
            <ellipse cx={0} cy={-13} rx={17} ry={5.5} fill="none" stroke={ring} strokeWidth={5} />
            <ellipse cx={0} cy={-13} rx={17} ry={5.5} fill="none" stroke="#fff" strokeWidth={5} strokeDasharray="7 9" />
          </>
        )}
        <ellipse cx={0} cy={-9} rx={26} ry={5} fill="#35C2DB" opacity={0.85} />
        <ellipse cx={0} cy={-9} rx={24} ry={5} fill="none" stroke="#fff" strokeWidth={1.4} className="ripple" />
        <ellipse cx={0} cy={-9} rx={24} ry={5} fill="none" stroke="#fff" strokeWidth={1.4} className="ripple" style={{ animationDelay: "-1.2s" }} />
      </g>
    );
  }

  if (pose === "sit") {
    return (
      <g>
        {tail}
        <path d="M-3 -11L10 -10L11 -1M3 -11L16 -10L17 -1" {...limb(skin, 3.6)} />
        <rect x={-6.5} y={-14} width={13} height={5} rx={2} fill={bottom} />
        {torso}
        <path d="M-7 -25L-10 -14" {...limb(skin, 3)} />
        <path d="M7 -25L14 -20" {...limb(skin, 3)} />
        <rect x={13} y={-27} width={5} height={8} rx={1.5} fill="#FFF3A8" strokeWidth={0.9} {...ln} />
        <path d="M15.5 -27L17 -32" stroke="#FF6B6B" strokeWidth={1.2} />
        <g transform="translate(0 -40)">{head}</g>
      </g>
    );
  }

  const walking = pose === "walk";
  const legs = (
    <>
      <line x1={-3} y1={-11} x2={-3} y2={-1} {...limb(skin, 3.6)} className={walking ? "step-a" : undefined} />
      <line x1={3} y1={-11} x2={3} y2={-1} {...limb(skin, 3.6)} className={walking ? "step-b" : undefined} />
    </>
  );
  return (
    <g>
      {tail}
      {legs}
      <rect x={-6.5} y={-14} width={13} height={5} rx={2} fill={bottom} />
      {torso}
      <line x1={-7} y1={-25} x2={-10} y2={-14} {...limb(skin, 3)} className={walking ? "step-b" : undefined} />
      {pose === "wave" ? (
        <g className="wave-arm"><line x1={7} y1={-25} x2={16} y2={-40} {...limb(skin, 3)} /></g>
      ) : (
        <line x1={7} y1={-25} x2={10} y2={-14} {...limb(skin, 3)} className={walking ? "step-a" : undefined} />
      )}
      <g transform="translate(0 -40)">{head}</g>
    </g>
  );
}
