import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import ChartCard from "../components/ChartCard";
import KpiTile from "../components/KpiTile";
import PageShell from "../components/PageShell";
import { GROUPS } from "../data/config";
import { SEED_DATA } from "../data/seed";
import { CHANNELS, type Filters } from "../engine/metrics";
import type { Category, Channel, Tier } from "../types";
import { chartTheme } from "../lib/chartTheme";
import { ticketsToCsv, downloadText } from "../lib/csv";
import { buildDashboard, lastDay, mins, pct, TILES } from "../lib/dashboardData";
import { CATEGORY_LABEL, CHANNEL_LABEL, TIER_LABEL } from "../lib/format";
import { useIsDark } from "../lib/useIsDark";
import { useDesk } from "../store/useDesk";

const { meta } = SEED_DATA;
const seedCustomers = SEED_DATA.customers;
const field = "mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900";
const shortDay = (day: string) => `${Number(day.slice(8))} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(day.slice(5, 7)) - 1]}`;

export default function Dashboard() {
  const sandboxTickets = useDesk((s) => s.tickets);
  const sandboxCustomers = useDesk((s) => s.customers);
  // Links can open the dashboard with filters set, for example #/dashboard?from=2026-10-15&to=2026-10-28.
  const [params] = useSearchParams();
  const param = <T extends string>(key: string, allowed: readonly T[]): T | "" => {
    const v = params.get(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : "";
  };
  const isDay = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const [from, setFrom] = useState(isDay(params.get("from")) ?? meta.startDate);
  const [to, setTo] = useState(isDay(params.get("to")) ?? "");
  const [channel, setChannel] = useState<Channel | "">(param("channel", CHANNELS));
  const [category, setCategory] = useState<Category | "">(param("category", Object.keys(CATEGORY_LABEL) as Category[]));
  const [tier, setTier] = useState<Tier | "">(param("tier", Object.keys(TIER_LABEL) as Tier[]));
  const [groupId, setGroupId] = useState(param("group", GROUPS.map((g) => g.id)));
  const [includeSandbox, setIncludeSandbox] = useState(false);
  const dark = useIsDark();
  const theme = chartTheme(dark);

  const customers = useMemo(() => new Map([...seedCustomers, ...sandboxCustomers].map((c) => [c.id, c])), [sandboxCustomers]);
  const maxDay = lastDay({ sandboxTickets, includeSandbox, endDate: meta.endDate });
  const toDay = to || maxDay;

  const data = useMemo(() => {
    const filters: Filters = {
      from,
      to: toDay,
      ...(channel ? { channels: [channel] } : {}),
      ...(category ? { categories: [category] } : {}),
      ...(tier ? { tiers: [tier] } : {}),
      ...(groupId ? { groupIds: [groupId] } : {}),
    };
    return buildDashboard({
      seedTickets: SEED_DATA.tickets, sandboxTickets, includeSandbox, filters, customers,
      goLiveDate: meta.goLiveDate, startDate: meta.startDate, endDate: meta.endDate,
    });
  }, [from, toDay, channel, category, tier, groupId, includeSandbox, sandboxTickets, customers]);

  const chartDays = data.days.map((d) => ({
    day: d.day,
    breachRate: d.breachRate === null ? null : Math.round(d.breachRate * 1000) / 10,
    firstReplyHours: d.medianFirstReplyMins === null ? null : Math.round(d.medianFirstReplyMins / 6) / 10,
    backlog: d.backlog,
    ...d.byChannel,
  }));
  const showGoLive = meta.goLiveDate >= data.from && meta.goLiveDate <= data.to;
  const goLive = showGoLive ? (
    <ReferenceLine x={meta.goLiveDate} stroke={theme.goLive} strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "Go-live", position: "insideTopLeft", fill: theme.text, fontSize: 12 }} />
  ) : null;
  const axisProps = { stroke: theme.axis, tick: { fill: theme.axis, fontSize: 12 }, tickLine: false };
  const xAxis = <XAxis dataKey="day" tickFormatter={shortDay} minTickGap={24} {...axisProps} />;
  const grid = <CartesianGrid stroke={theme.grid} vertical={false} />;
  const tooltip = (unit = "") => (
    <Tooltip
      labelFormatter={(d) => shortDay(String(d))}
      formatter={(v) => `${String(v)}${unit}`}
      contentStyle={{ background: theme.surface, borderColor: theme.grid, color: theme.text, borderRadius: 6 }}
      labelStyle={{ color: theme.text, fontWeight: 600 }}
      cursor={{ stroke: theme.axis, fill: dark ? "rgba(148,163,184,0.15)" : "rgba(15,23,42,0.06)" }}
    />
  );

  function resetFilters() {
    setFrom(meta.startDate); setTo(""); setChannel(""); setCategory(""); setTier(""); setGroupId("");
  }

  function exportCsv() {
    const sandboxIds = new Set(sandboxTickets.map((t) => t.id));
    const csv = ticketsToCsv(data.tickets, (id) => customers.get(id), (t) => sandboxIds.has(t.id));
    downloadText(`northwind-synthetic-tickets-${data.from}-to-${data.to}.csv`, csv);
  }

  return (
    <PageShell title="KPI dashboard" synthetic>
      <p className="max-w-3xl text-slate-700 dark:text-slate-300">
        Before and after go-live on {meta.goLiveDate}. Tiles compare tickets created before go-live with tickets created on or
        after it. Times are business minutes in each ticket's SLA hours.
      </p>

      <section aria-labelledby="filters-heading" className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 id="filters-heading" className="sr-only">Filters</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div>
            <label htmlFor="f-from" className="text-sm font-medium">From</label>
            <input id="f-from" type="date" className={field} value={from} min={meta.startDate} max={toDay} onChange={(e) => setFrom(e.target.value || meta.startDate)} />
          </div>
          <div>
            <label htmlFor="f-to" className="text-sm font-medium">To</label>
            <input id="f-to" type="date" className={field} value={toDay} min={from} max={maxDay} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label htmlFor="f-channel" className="text-sm font-medium">Channel</label>
            <select id="f-channel" className={field} value={channel} onChange={(e) => setChannel(e.target.value as Channel | "")}>
              <option value="">All channels</option>
              {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-category" className="text-sm font-medium">Category</label>
            <select id="f-category" className={field} value={category} onChange={(e) => setCategory(e.target.value as Category | "")}>
              <option value="">All categories</option>
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-tier" className="text-sm font-medium">Tier</label>
            <select id="f-tier" className={field} value={tier} onChange={(e) => setTier(e.target.value as Tier | "")}>
              <option value="">All tiers</option>
              {(Object.keys(TIER_LABEL) as Tier[]).map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-group" className="text-sm font-medium">Group</label>
            <select id="f-group" className={field} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">All groups</option>
              {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeSandbox} onChange={(e) => setIncludeSandbox(e.target.checked)} />
            Sandbox tickets ({sandboxTickets.length})
          </label>
          <button type="button" onClick={resetFilters} className="text-sm font-medium text-accent-700 underline dark:text-accent-300">Clear filters</button>
          <p className="text-sm text-slate-700 dark:text-slate-300" aria-live="polite" data-testid="match-count">
            {data.tickets.length.toLocaleString("en-GB")} tickets match.
          </p>
          <button type="button" onClick={exportCsv} className="ml-auto rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700">
            Download CSV
          </button>
        </div>
      </section>

      <section aria-labelledby="kpi-heading" className="mt-6" data-tour="kpis">
        <h2 id="kpi-heading" className="text-lg font-semibold">KPIs: after go-live compared with before</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((spec) => <KpiTile key={spec.key} spec={spec} before={data.before[spec.key]} after={data.after[spec.key]} />)}
        </div>
      </section>

      <section aria-labelledby="charts-heading" className="mt-8">
        <h2 id="charts-heading" className="text-lg font-semibold">Daily trends</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <ChartCard id="chart-breach" title="SLA breach rate by day created" summary={data.summaries.breach}
            columns={["Day", "Tickets", "Breach rate"]} rows={data.days.map((d) => [d.day, d.created, pct(d.breachRate)])}>
            <ResponsiveContainer>
              <LineChart data={chartDays} accessibilityLayer={false} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                {grid}{xAxis}
                <YAxis {...axisProps} width={44} unit="%" />
                {tooltip("%")}
                {goLive}
                <Line type="linear" dataKey="breachRate" name="Breach rate" stroke={theme.single} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard id="chart-first-reply" title="Median first reply time by day (business hours)" summary={data.summaries.firstReply}
            columns={["Day", "Median first reply"]} rows={data.days.map((d) => [d.day, mins(d.medianFirstReplyMins)])}>
            <ResponsiveContainer>
              <LineChart data={chartDays} accessibilityLayer={false} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                {grid}{xAxis}
                <YAxis {...axisProps} width={44} unit=" h" />
                {tooltip(" h")}
                {goLive}
                <Line type="linear" dataKey="firstReplyHours" name="Median first reply" stroke={theme.single} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard id="chart-channels" title="Tickets created by day and channel" summary={data.summaries.channels}
            columns={["Day", ...CHANNELS.map((c) => CHANNEL_LABEL[c]), "Total"]}
            rows={data.days.map((d) => [d.day, ...CHANNELS.map((c) => d.byChannel[c]), d.created])}>
            <ResponsiveContainer>
              <BarChart data={chartDays} accessibilityLayer={false} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                {grid}{xAxis}
                <YAxis {...axisProps} width={44} allowDecimals={false} />
                {tooltip()}
                <Legend itemSorter={null} wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span style={{ color: theme.text }}>{value}</span>} />
                {CHANNELS.map((c) => (
                  <Bar key={c} dataKey={c} name={CHANNEL_LABEL[c]} stackId="channels" fill={theme.series[c]} stroke={theme.surface} strokeWidth={1} isAnimationActive={false} />
                ))}
                {goLive}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard id="chart-backlog" title="Backlog at end of day (not solved or closed)" summary={data.summaries.backlog}
            columns={["Day", "Open tickets"]} rows={data.days.map((d) => [d.day, d.backlog])}>
            <ResponsiveContainer>
              <BarChart data={chartDays} accessibilityLayer={false} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                {grid}{xAxis}
                <YAxis {...axisProps} width={44} allowDecimals={false} />
                {tooltip()}
                <Bar dataKey="backlog" name="Backlog" fill={theme.single} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                {goLive}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      <section aria-labelledby="groups-heading" className="mt-8">
        <h2 id="groups-heading" className="text-lg font-semibold">Tickets by group</h2>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Group at the end of the period. Before go-live, every ticket sat in one shared queue (Tier 1). After go-live, an SLA breach moves a ticket to Escalations, so breaches show there.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm" data-testid="group-table">
            <caption className="sr-only">Volume, median first reply and SLA breach rate by group</caption>
            <thead className="border-b border-slate-300 dark:border-slate-600">
              <tr>{["Group", "Volume", "Median first reply", "SLA breach rate"].map((h) => <th key={h} scope="col" className="py-2 pr-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.groups.map((g) => (
                <tr key={g.name} className="border-b border-slate-200 dark:border-slate-800">
                  <th scope="row" className="py-2 pr-3 font-medium">{g.name}</th>
                  <td className="py-2 pr-3">{g.volume.toLocaleString("en-GB")}</td>
                  <td className="py-2 pr-3">{mins(g.medianFirstReplyMins)}</td>
                  <td className="py-2 pr-3">{pct(g.breachRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
