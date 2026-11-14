import { KPI_DEFINITIONS, LOWER_IS_BETTER } from "../engine/metrics";
import { formatChange, formatKpi, type TileSpec } from "../lib/dashboardData";
import InfoTip from "./InfoTip";

/** After value, before value and the change. Good or bad shows as colour plus icon plus word. */
export default function KpiTile({ spec, before, after }: { spec: TileSpec; before: number | null; after: number | null }) {
  const change = formatChange(before, after, spec.kind);
  const delta = before !== null && after !== null ? after - before : 0;
  const good = LOWER_IS_BETTER[spec.key] ? delta < 0 : delta > 0;
  const tone = change === null || Math.abs(delta) < 1e-9
    ? { cls: "text-slate-700 dark:text-slate-200", icon: "=", word: "no change" }
    : good
      ? { cls: "text-green-800 dark:text-green-300", icon: delta < 0 ? "▼" : "▲", word: "better" }
      : { cls: "text-red-800 dark:text-red-300", icon: delta < 0 ? "▼" : "▲", word: "worse" };
  return (
    <article className="flex flex-col rounded-lg border border-slate-200 p-4 dark:border-slate-700" data-testid={`tile-${spec.key}`}>
      <header className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{spec.title}</h3>
        <InfoTip label={spec.title} text={KPI_DEFINITIONS[spec.key]} />
      </header>
      <p className="mt-2 text-2xl font-bold" data-testid="tile-after">
        {formatKpi(after, spec.kind)} <span className="text-sm font-medium text-slate-600 dark:text-slate-300">after go-live</span>
      </p>
      <p className="text-sm text-slate-700 dark:text-slate-300" data-testid="tile-before">Before: {formatKpi(before, spec.kind)}</p>
      <p className={`mt-2 text-sm font-semibold ${tone.cls}`} data-testid="tile-change">
        {change === null ? "Change: not available" : <><span aria-hidden="true">{tone.icon} </span>{change}, {tone.word}</>}
      </p>
    </article>
  );
}
