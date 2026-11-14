import type { SlaTimer } from "../engine/sla";
import { METRIC_LABEL } from "../engine/sla";
import { formatMinutes } from "../lib/format";

const STYLE = {
  ok: { icon: "✓", word: "On track", cls: "border-green-700 bg-green-50 text-green-900 dark:border-green-500 dark:bg-green-950 dark:text-green-100" },
  met: { icon: "✓", word: "Met", cls: "border-green-700 bg-green-50 text-green-900 dark:border-green-500 dark:bg-green-950 dark:text-green-100" },
  warning: { icon: "!", word: "Warning", cls: "border-amber-600 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100" },
  breached: { icon: "✕", word: "Breached", cls: "border-red-700 bg-red-50 text-red-900 dark:border-red-400 dark:bg-red-950 dark:text-red-100" },
} as const;

/** SLA timer badge. Colour plus icon plus words, never colour alone (SPEC.md section 9). */
export default function SlaBadge({ timer, compact = false }: { timer: SlaTimer; compact?: boolean }) {
  const s = STYLE[timer.state];
  const metric = METRIC_LABEL[timer.metric];
  const timeText = timer.state === "met"
    ? `in ${formatMinutes(timer.elapsedMins)}`
    : timer.remainingMins > 0
      ? `${formatMinutes(timer.remainingMins)} left`
      : `${formatMinutes(-timer.remainingMins)} over`;
  const pausedText = timer.paused ? ", paused" : "";
  const metricCap = `${metric[0]!.toUpperCase()}${metric.slice(1)}`;
  const label = `${metricCap}: ${s.word}, ${timeText}${pausedText}`;
  return (
    <span
      data-testid={`sla-${timer.metric}`}
      data-state={timer.state}
      title={`Target ${formatMinutes(timer.targetMins)} (business minutes)`}
      className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-sm font-medium ${s.cls}`}
    >
      <span aria-hidden="true" className="font-bold">{s.icon}</span>
      {compact ? <span aria-label={label}>{metricCap}: {s.word}{timer.paused ? " (paused)" : ""}</span> : <span>{label}</span>}
    </span>
  );
}
