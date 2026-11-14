import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SEED_DATA } from "../data/seed";
import { splitByGoLive } from "../engine/metrics";
import type { Category } from "../types";
import { chartTheme } from "../lib/chartTheme";
import { pct } from "../lib/dashboardData";
import { CATEGORY_LABEL } from "../lib/format";
import { useIsDark } from "../lib/useIsDark";
import ChartCard from "./ChartCard";

/** Chapter 2: the category mix found in the ticket audit (the 14 days before go-live). Computed, not typed. */
export default function CategoryMix() {
  const theme = chartTheme(useIsDark());
  const rows = useMemo(() => {
    const { before } = splitByGoLive(SEED_DATA.tickets, SEED_DATA.meta.goLiveDate);
    const counts = (Object.keys(CATEGORY_LABEL) as Category[]).map((c) => ({ category: CATEGORY_LABEL[c], count: before.filter((t) => t.category === c).length }));
    const total = before.length;
    return { total, data: counts.sort((a, b) => b.count - a.count).map((r) => ({ ...r, share: r.count / total })) };
  }, []);
  const top = rows.data[0]!;
  const second = rows.data[1]!;
  return (
    <div className="my-6">
      <ChartCard
        id="chart-category-mix"
        title="Ticket audit: tickets by category, 14 days before go-live"
        summary={`${rows.total.toLocaleString("en-GB")} tickets in the audit period. ${top.category} is the largest category with ${pct(top.share, 0)}, then ${second.category} with ${pct(second.share, 0)}. Together they make up ${pct(top.share + second.share, 0)} of the work, and both need product skills.`}
        columns={["Category", "Tickets", "Share"]}
        rows={rows.data.map((r) => [r.category, r.count, pct(r.share)])}
      >
        <ResponsiveContainer>
          <BarChart data={rows.data} layout="vertical" accessibilityLayer={false} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={theme.grid} horizontal={false} />
            <XAxis type="number" stroke={theme.axis} tick={{ fill: theme.axis, fontSize: 12 }} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="category" width={150} stroke={theme.axis} tick={{ fill: theme.axis, fontSize: 12 }} tickLine={false} />
            <Tooltip contentStyle={{ background: theme.surface, borderColor: theme.grid, color: theme.text }} labelStyle={{ color: theme.text, fontWeight: 600 }} cursor={{ fill: "rgba(148,163,184,0.15)" }} />
            <Bar dataKey="count" name="Tickets" fill={theme.single} radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Synthetic data, calculated from the demo's seed tickets.</p>
    </div>
  );
}
