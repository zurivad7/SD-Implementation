import { useMemo } from "react";
import { SLA_POLICIES } from "../data/config";
import { SEED_DATA } from "../data/seed";
import { computeKpis, splitByGoLive } from "../engine/metrics";
import { TILES } from "../lib/dashboardData";
import KpiTile from "./KpiTile";

/** Chapter 7: before and after tiles, computed from the seed data by engine/metrics.ts. */
export default function ResultsTiles() {
  const { before, after } = useMemo(() => {
    const split = splitByGoLive(SEED_DATA.tickets, SEED_DATA.meta.goLiveDate);
    return { before: computeKpis(split.before, SLA_POLICIES), after: computeKpis(split.after, SLA_POLICIES) };
  }, []);
  return (
    <div className="my-6">
      <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        Synthetic results from generated demo data. Not a real client outcome.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((spec) => <KpiTile key={spec.key} spec={spec} before={before[spec.key]} after={after[spec.key]} />)}
      </div>
    </div>
  );
}
