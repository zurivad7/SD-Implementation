// KPI calculations (SPEC.md section 7). Pure functions, no React.
// Rates are fractions from 0 to 1. Times are business minutes in the ticket's SLA policy hours
// (24x7 when a ticket has no policy). Days are Amsterdam calendar days, YYYY-MM-DD.
import type { BusinessHours, Channel, Category, Customer, Group, SlaPolicy, Status, Ticket, Tier } from "../types";
import { amsterdamParts, amsterdamToUtc, businessMinutesBetween } from "./businessTime";
import { parseStatusChange } from "./events";
import { statusIntervals } from "./sla";

export const CHANNELS: Channel[] = ["email", "web_form", "chat", "phone"];

/** Plain-English definitions for the info tooltips (section 7). */
export const KPI_DEFINITIONS = {
  ticketsCreated: "Count of tickets by createdAt.",
  medianFirstReplyMins: "Business minutes from createdAt to firstReplyAt, median.",
  medianResolutionMins: "Business minutes from createdAt to solvedAt, pending time excluded, median.",
  slaBreachRate: "Tickets with any sla_breached event / tickets with an SLA policy.",
  csat: "Good ratings / all ratings, as %.",
  reassignmentRate: "Tickets with more than 1 assigned event / all tickets.",
  oneTouchRate: "Solved tickets with exactly 1 public reply / solved tickets.",
  backlog: "Tickets not solved or closed at end of each day.",
} as const;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const ratio = (num: number, den: number): number | null => (den === 0 ? null : num / den);

function hoursFor(t: Ticket, policies: SlaPolicy[]): BusinessHours | "24x7" {
  return policies.find((p) => p.id === t.slaPolicyId)?.businessHours ?? "24x7";
}

export function amsterdamDay(isoOrMs: string | number): string {
  const p = amsterdamParts(typeof isoOrMs === "number" ? isoOrMs : Date.parse(isoOrMs));
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Start of the Amsterdam day after `day`. */
export function endOfDay(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return amsterdamToUtc(y, m, d + 1);
}

// ---------------------------------------------------------------- per ticket

export function firstReplyMins(t: Ticket, policies: SlaPolicy[]): number | null {
  if (!t.firstReplyAt) return null;
  return businessMinutesBetween(Date.parse(t.createdAt), Date.parse(t.firstReplyAt), hoursFor(t, policies));
}

/** Business minutes from createdAt to solvedAt, without the time spent in pending. */
export function resolutionMins(t: Ticket, policies: SlaPolicy[]): number | null {
  if (!t.solvedAt) return null;
  const hours = hoursFor(t, policies);
  return statusIntervals(t, Date.parse(t.solvedAt))
    .filter((s) => s.status !== "pending")
    .reduce((sum, s) => sum + businessMinutesBetween(s.from, s.to, hours), 0);
}

export const isBreached = (t: Ticket) => t.events.some((e) => e.type === "sla_breached");
export const assignCount = (t: Ticket) => t.events.filter((e) => e.type === "assigned").length;
export const publicReplyCount = (t: Ticket) => t.events.filter((e) => e.type === "public_reply").length;
export const isSolved = (t: Ticket) => t.solvedAt !== null && (t.status === "solved" || t.status === "closed");

/** The ticket's status at an instant, replayed from the trail. Null if it did not exist yet. */
export function statusAt(t: Ticket, instant: number): Status | null {
  if (Date.parse(t.createdAt) >= instant) return null;
  let status: Status = "new";
  for (const e of t.events) {
    if (Date.parse(e.at) >= instant) break;
    if (e.type !== "status_changed") continue;
    const c = parseStatusChange(e.detail);
    if (c) status = c.to;
  }
  return status;
}

// ---------------------------------------------------------------- KPIs

export const ticketsCreated = (ts: Ticket[]) => ts.length;
export const medianFirstReply = (ts: Ticket[], policies: SlaPolicy[]) =>
  median(ts.map((t) => firstReplyMins(t, policies)).filter((v): v is number => v !== null));
export const medianResolution = (ts: Ticket[], policies: SlaPolicy[]) =>
  median(ts.map((t) => resolutionMins(t, policies)).filter((v): v is number => v !== null));
export const slaBreachRate = (ts: Ticket[]) => {
  const withPolicy = ts.filter((t) => t.slaPolicyId !== null);
  return ratio(withPolicy.filter(isBreached).length, withPolicy.length);
};
export const csatRate = (ts: Ticket[]) => {
  const rated = ts.filter((t) => t.csat !== null);
  return ratio(rated.filter((t) => t.csat!.score === "good").length, rated.length);
};
export const reassignmentRate = (ts: Ticket[]) => ratio(ts.filter((t) => assignCount(t) > 1).length, ts.length);
export const oneTouchRate = (ts: Ticket[]) => {
  const solved = ts.filter(isSolved);
  return ratio(solved.filter((t) => publicReplyCount(t) === 1).length, solved.length);
};
export const backlogAt = (ts: Ticket[], instant: number) =>
  ts.filter((t) => {
    const s = statusAt(t, instant);
    return s !== null && s !== "solved" && s !== "closed";
  }).length;

export interface Kpis {
  ticketsCreated: number;
  medianFirstReplyMins: number | null;
  medianResolutionMins: number | null;
  slaBreachRate: number | null;
  csat: number | null;
  reassignmentRate: number | null;
  oneTouchRate: number | null;
}

export function computeKpis(ts: Ticket[], policies: SlaPolicy[]): Kpis {
  return {
    ticketsCreated: ticketsCreated(ts),
    medianFirstReplyMins: medianFirstReply(ts, policies),
    medianResolutionMins: medianResolution(ts, policies),
    slaBreachRate: slaBreachRate(ts),
    csat: csatRate(ts),
    reassignmentRate: reassignmentRate(ts),
    oneTouchRate: oneTouchRate(ts),
  };
}

/** Lower is better for these KPIs. The dashboard uses this to colour the change. */
export const LOWER_IS_BETTER: Record<keyof Kpis, boolean> = {
  ticketsCreated: true,
  medianFirstReplyMins: true,
  medianResolutionMins: true,
  slaBreachRate: true,
  csat: false,
  reassignmentRate: true,
  oneTouchRate: false,
};

// ---------------------------------------------------------------- slices

/** Tickets created before the go-live day, and on or after it. */
export function splitByGoLive(ts: Ticket[], goLiveDate: string): { before: Ticket[]; after: Ticket[] } {
  const before: Ticket[] = [];
  const after: Ticket[] = [];
  for (const t of ts) (amsterdamDay(t.createdAt) < goLiveDate ? before : after).push(t);
  return { before, after };
}

/** Every day from `from` to `to`, inclusive. */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  const [y, m, d] = from.split("-").map(Number) as [number, number, number];
  for (let i = 0; i < 400; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
    if (day > to) break;
    out.push(day);
  }
  return out;
}

export interface DayPoint {
  day: string;
  created: number;
  breachRate: number | null;
  medianFirstReplyMins: number | null;
  byChannel: Record<Channel, number>;
  /** Open tickets at the end of the day (tickets in `ts` only). */
  backlog: number;
}

export function dailySeries(ts: Ticket[], days: string[], policies: SlaPolicy[]): DayPoint[] {
  const byDay = new Map<string, Ticket[]>(days.map((d) => [d, []]));
  for (const t of ts) byDay.get(amsterdamDay(t.createdAt))?.push(t);
  return days.map((day) => {
    const list = byDay.get(day)!;
    const byChannel = Object.fromEntries(CHANNELS.map((c) => [c, list.filter((t) => t.channel === c).length])) as Record<Channel, number>;
    return {
      day,
      created: list.length,
      breachRate: slaBreachRate(list),
      medianFirstReplyMins: medianFirstReply(list, policies),
      byChannel,
      backlog: backlogAt(ts, endOfDay(day)),
    };
  });
}

export interface GroupRow {
  groupId: string | null;
  name: string;
  volume: number;
  medianFirstReplyMins: number | null;
  breachRate: number | null;
}

export function byGroup(ts: Ticket[], groups: Group[], policies: SlaPolicy[]): GroupRow[] {
  const rows: GroupRow[] = groups.map((g) => {
    const list = ts.filter((t) => t.groupId === g.id);
    return { groupId: g.id, name: g.name, volume: list.length, medianFirstReplyMins: medianFirstReply(list, policies), breachRate: slaBreachRate(list) };
  });
  const none = ts.filter((t) => !t.groupId || !groups.some((g) => g.id === t.groupId));
  if (none.length) rows.push({ groupId: null, name: "No group", volume: none.length, medianFirstReplyMins: medianFirstReply(none, policies), breachRate: slaBreachRate(none) });
  return rows;
}

// ---------------------------------------------------------------- filters

export interface Filters {
  /** Inclusive Amsterdam days, YYYY-MM-DD. */
  from?: string;
  to?: string;
  channels?: Channel[];
  categories?: Category[];
  tiers?: Tier[];
  groupIds?: string[];
}

/** Empty or missing lists mean "all". */
export function filterTickets(ts: Ticket[], filters: Filters, customers: Map<string, Customer> | Record<string, Customer>): Ticket[] {
  const tierOf = (id: string) => (customers instanceof Map ? customers.get(id) : customers[id])?.tier;
  const on = <T,>(list: T[] | undefined, v: T) => !list || list.length === 0 || list.includes(v);
  return ts.filter((t) => {
    const day = amsterdamDay(t.createdAt);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    if (!on(filters.channels, t.channel)) return false;
    if (!on(filters.categories, t.category)) return false;
    if (filters.tiers?.length) {
      const tier = tierOf(t.customerId);
      if (!tier || !filters.tiers.includes(tier)) return false;
    }
    if (!on(filters.groupIds, t.groupId ?? "")) return false;
    return true;
  });
}
