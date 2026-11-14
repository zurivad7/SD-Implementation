// Chapter 4 timeline (SPEC.md section 8): 5 phases over 10 weeks and 3 gates, as an accessible SVG.
import { useIsDark } from "../lib/useIsDark";

export const PHASES = [
  { name: "Discover", from: 1, to: 2 },
  { name: "Design", from: 3, to: 4 },
  { name: "Build and test", from: 5, to: 7 },
  { name: "Train and cut over", from: 8, to: 8 },
  { name: "Hypercare", from: 9, to: 10 },
] as const;

/** Gates sit at the end of a week (week 8 gate: go/no-go before cutover, mid-week). */
export const GATES = [
  { name: "Design sign-off", atWeek: 4 },
  { name: "UAT sign-off", atWeek: 7 },
  { name: "Go/no-go", atWeek: 7.6 },
] as const;

const W = 760, LEFT = 150, RIGHT = 20, TOP = 40, ROW = 34;

export default function PlanTimeline() {
  const dark = useIsDark();
  const c = dark
    ? { text: "#e2e8f0", muted: "#94a3b8", grid: "#334155", bar: "#3987e5", gate: "#e2e8f0", gateFill: "#0f172a" }
    : { text: "#0f172a", muted: "#475569", grid: "#e2e8f0", bar: "#2a78d6", gate: "#0f172a", gateFill: "#ffffff" };
  const weekW = (W - LEFT - RIGHT) / 10;
  const x = (week: number) => LEFT + week * weekW; // week boundary: end of week n
  const H = TOP + PHASES.length * ROW + 52;
  return (
    <figure className="my-6" data-testid="plan-timeline">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[40rem] max-w-full" role="img" aria-labelledby="plan-title" aria-describedby="plan-desc">
          <title id="plan-title">10-week rollout plan</title>
          <desc id="plan-desc">
            {PHASES.map((p) => `${p.name}: week${p.from === p.to ? ` ${p.from}` : `s ${p.from} to ${p.to}`}.`).join(" ")}{" "}
            Gates: {GATES.map((g) => g.name).join(", ")}.
          </desc>
          {Array.from({ length: 10 }, (_, i) => (
            <g key={i}>
              <line x1={x(i)} x2={x(i)} y1={TOP - 8} y2={TOP + PHASES.length * ROW} stroke={c.grid} />
              <text x={x(i) + weekW / 2} y={TOP - 14} textAnchor="middle" fontSize="12" fill={c.muted}>W{i + 1}</text>
            </g>
          ))}
          <line x1={x(10)} x2={x(10)} y1={TOP - 8} y2={TOP + PHASES.length * ROW} stroke={c.grid} />
          {PHASES.map((p, i) => {
            const y = TOP + i * ROW + 6;
            return (
              <g key={p.name}>
                <text x={LEFT - 10} y={y + 15} textAnchor="end" fontSize="13" fill={c.text}>{p.name}</text>
                <rect x={x(p.from - 1) + 2} y={y} width={(p.to - p.from + 1) * weekW - 4} height={ROW - 12} rx="4" fill={c.bar} />
              </g>
            );
          })}
          {GATES.map((g, i) => {
            const gx = x(g.atWeek);
            const gy = TOP + PHASES.length * ROW + 16;
            // Gates 1 and 2 label to the left of their line, gate 3 to the right, so no labels overlap.
            const anchor = i === 2 ? "start" : "end";
            const lx = i === 2 ? gx + 4 : gx - 4;
            return (
              <g key={g.name}>
                <line x1={gx} x2={gx} y1={TOP - 8} y2={gy} stroke={c.gate} strokeDasharray="3 3" />
                <rect x={gx - 7} y={gy - 7} width="14" height="14" transform={`rotate(45 ${gx} ${gy})`} fill={c.gateFill} stroke={c.gate} strokeWidth="2" />
                <text x={lx} y={gy + 26} textAnchor={anchor} fontSize="12" fontWeight="600" fill={c.text}>
                  Gate {i + 1}: {g.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="mt-2 text-sm text-slate-700 dark:text-slate-300">
        Five phases over 10 weeks. The diamonds mark the three gates: design sign-off (end of week 4), UAT sign-off (end of
        week 7) and go/no-go (week 8, before cutover).
      </figcaption>
    </figure>
  );
}
