// Builds every number on the dashboard from engine/metrics.ts. Pure: no React. No number is typed by hand.
import { GROUPS, SLA_POLICIES } from "../data/config";
import {
  amsterdamDay, byGroup, CHANNELS, computeKpis, dailySeries, dayRange, filterTickets, slaBreachRate, medianFirstReply,
  splitByGoLive, type DayPoint, type Filters, type GroupRow, type Kpis,
} from "../engine/metrics";
import type { Customer, Ticket } from "../types";
import { CHANNEL_LABEL, formatMinutes } from "./format";

export interface DashboardInput {
  seedTickets: Ticket[];
  sandboxTickets: Ticket[];
  includeSandbox: boolean;
  filters: Filters;
  customers: Map<string, Customer>;
  goLiveDate: string;
  startDate: string;
  endDate: string;
}

export interface DashboardData {
  tickets: Ticket[];
  before: Kpis;
  after: Kpis;
  days: DayPoint[];
  groups: GroupRow[];
  from: string;
  to: string;
  summaries: { breach: string; firstReply: string; channels: string; backlog: string };
}

export const pct = (v: number | null, digits = 1) => (v === null ? "no data" : `${(v * 100).toFixed(digits)}%`);
export const mins = (v: number | null) => (v === null ? "no data" : formatMinutes(v));
const count = (n: number) => n.toLocaleString("en-GB");

/** The last day with data: the seed end date, or the latest sandbox ticket when sandbox tickets are included. */
export function lastDay(input: Pick<DashboardInput, "sandboxTickets" | "includeSandbox" | "endDate">): string {
  if (!input.includeSandbox || input.sandboxTickets.length === 0) return input.endDate;
  const latest = input.sandboxTickets.map((t) => amsterdamDay(t.createdAt)).sort().at(-1)!;
  return latest > input.endDate ? latest : input.endDate;
}

export function buildDashboard(input: DashboardInput): DashboardData {
  const all = input.includeSandbox ? [...input.seedTickets, ...input.sandboxTickets] : input.seedTickets;
  const from = input.filters.from ?? input.startDate;
  const to = input.filters.to ?? lastDay(input);
  const tickets = filterTickets(all, { ...input.filters, from, to }, input.customers);
  const { before, after } = splitByGoLive(tickets, input.goLiveDate);
  const days = dailySeries(tickets, dayRange(from, to), SLA_POLICIES);
  const last7 = tickets.filter((t) => amsterdamDay(t.createdAt) >= (dayRange(from, to).slice(-7)[0] ?? from));

  const totals = CHANNELS.map((c) => ({ c, n: days.reduce((s, d) => s + d.byChannel[c], 0) }));
  const busiest = days.reduce<DayPoint | null>((best, d) => (!best || d.created > best.created ? d : best), null);
  const backlogs = days.map((d) => d.backlog);

  return {
    tickets,
    before: computeKpis(before, SLA_POLICIES),
    after: computeKpis(after, SLA_POLICIES),
    days,
    groups: byGroup(tickets, GROUPS, SLA_POLICIES),
    from,
    to,
    summaries: {
      breach: `Before go-live, ${pct(slaBreachRate(before))} of tickets breached an SLA target. After go-live, ${pct(slaBreachRate(after))} did. In the last 7 days shown, ${pct(slaBreachRate(last7))} did.`,
      firstReply: `Median first reply before go-live: ${mins(medianFirstReply(before, SLA_POLICIES))} of business time. After go-live: ${mins(medianFirstReply(after, SLA_POLICIES))}.`,
      channels: tickets.length
        ? `${count(tickets.length)} tickets in total: ${totals.map(({ c, n }) => `${CHANNEL_LABEL[c]} ${count(n)} (${pct(n / tickets.length, 0)})`).join(", ")}. The busiest day was ${busiest!.day} with ${count(busiest!.created)} tickets.`
        : "No tickets match the filters.",
      backlog: backlogs.length
        ? `Open tickets at the end of each day ranged from ${count(Math.min(...backlogs))} to ${count(Math.max(...backlogs))}. On ${days.at(-1)!.day} the backlog was ${count(backlogs.at(-1)!)}. The first days are lower only because the data starts on ${input.startDate}.`
        : "No days in the selected range.",
    },
  };
}

export interface TileSpec {
  key: Exclude<keyof Kpis, "ticketsCreated">;
  title: string;
  kind: "minutes" | "rate";
}

/** The 6 KPI tiles (section 7). Tickets created and backlog are shown as charts. */
export const TILES: TileSpec[] = [
  { key: "medianFirstReplyMins", title: "First reply time (median)", kind: "minutes" },
  { key: "medianResolutionMins", title: "Resolution time (median)", kind: "minutes" },
  { key: "slaBreachRate", title: "SLA breach rate", kind: "rate" },
  { key: "csat", title: "CSAT", kind: "rate" },
  { key: "reassignmentRate", title: "Reassignment rate", kind: "rate" },
  { key: "oneTouchRate", title: "One-touch resolution", kind: "rate" },
];

export const formatKpi = (v: number | null, kind: TileSpec["kind"]) => (kind === "minutes" ? mins(v) : pct(v));

/** Change from before to after: percent for times, percentage points for rates. */
export function formatChange(before: number | null, after: number | null, kind: TileSpec["kind"]): string | null {
  if (before === null || after === null) return null;
  if (kind === "rate") {
    const pts = (after - before) * 100;
    return `${pts > 0 ? "+" : pts < 0 ? "−" : ""}${Math.abs(pts).toFixed(1)} pts`;
  }
  if (before === 0) return null;
  const change = ((after - before) / before) * 100;
  return `${change > 0 ? "+" : change < 0 ? "−" : ""}${Math.abs(change).toFixed(0)}%`;
}
