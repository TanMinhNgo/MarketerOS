import { anim, hor, rng } from "./shared";

const rand = rng(23);
const STREAKS = Array.from({ length: 6 }, (_, i) => ({
  y: 70 + i * 48 + rand() * 20,
  sc: 0.7 + rand() * 0.9,
  dur: 16 + rand() * 20,
  delay: rand() * 30,
  op: 0.28 + rand() * 0.25,
}));
const PETALS = Array.from({ length: 9 }, () => ({
  y: 120 + rand() * (hor - 100),
  dur: 22 + rand() * 26,
  delay: rand() * 40,
  color: ["#FFB3C7", "#FFE28A", "#C4F1B0"][Math.floor(rand() * 3)],
  bob: 3 + rand() * 3,
  spin: 3 + rand() * 4,
}));

/** Gió: vệt gió cong trôi ngang bầu trời + cánh hoa, lá bay theo. */
export function Wind() {
  return (
    <g aria-hidden="true">
      {STREAKS.map((s, i) => (
        <g key={i} transform={`translate(0 ${s.y})`}>
          <g className="walk-r" style={anim(s.dur, s.delay)}>
            <path
              className="wind-flow"
              d="M0 0Q30 -24 60 0T120 0T180 0T240 0T300 0T360 0"
              pathLength={400}
              strokeDasharray="120 280"
              style={{ animationDuration: `${3.5 + (i % 3) * 1.2}s`, animationDelay: `-${i * 0.8}s` }}
              transform={`scale(${s.sc})`}
              fill="none"
              stroke="#fff"
              strokeWidth={2.4}
              strokeLinecap="round"
              opacity={s.op}
            />
          </g>
        </g>
      ))}
      {PETALS.map((p, i) => (
        <g key={i} transform={`translate(0 ${p.y})`}>
          <g className="walk-r" style={anim(p.dur, p.delay)}>
            <g className="wind-wave" style={{ animationDuration: `${p.bob * 1.5}s`, animationDelay: `-${i}s` }}>
              <ellipse rx={5} ry={2.6} fill={p.color} className="spin-slow" style={{ animationDuration: `${p.spin}s` }} />
            </g>
          </g>
        </g>
      ))}
    </g>
  );
}
