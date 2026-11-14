// SLA clock and breach logic (SPEC.md section 6.3). Pure functions, no React.
//
// - The first matching policy applies.
// - The clock counts business minutes only, in the policy's business hours.
// - The clock runs while the status is new or open. It pauses in pending and on_hold,
//   and does not run while the ticket is solved or closed.
// - First reply clock: createdAt to the first public reply. Once met, it stays met.
// - Resolution clock: createdAt to solvedAt. When a ticket reopens, the clock continues from its
//   saved total. It does not restart.
// - clockMinutes() is the one business-minutes function. The SLA timers and the resolution KPI both use it.
// - Badge: ok (green) with more than 25% of the target left, warning (amber) at 25% or less,
//   breached (red) at 0% or less. A stopped clock within target is "met".
import type { Customer, SlaPolicy, Status, Ticket, TicketEvent } from "../types";
import { addBusinessMinutes, businessMinutesBetween } from "./businessTime";
import { iso, parseStatusChange } from "./events";
import { matchCondition } from "./routing";

export type SlaMetric = "first_reply" | "resolution";
export const SLA_METRICS: SlaMetric[] = ["first_reply", "resolution"];
export const METRIC_LABEL: Record<SlaMetric, string> = { first_reply: "first reply", resolution: "resolution" };
export const WARNING_FRACTION = 0.25;

const RUNNING: ReadonlySet<Status> = new Set<Status>(["new", "open"]);

export function selectPolicy(ticket: Ticket, customer: Customer | undefined, policies: SlaPolicy[]): SlaPolicy | null {
  return policies.find((p) => p.match.every((c) => matchCondition(ticket, customer, c))) ?? null;
}

export interface Segment { from: number; to: number }

/** Status intervals from the event trail, from createdAt up to `until`. */
export function statusIntervals(ticket: Ticket, until: number): Array<Segment & { status: Status }> {
  const out: Array<Segment & { status: Status }> = [];
  let status: Status = "new";
  let from = Date.parse(ticket.createdAt);
  for (const e of ticket.events) {
    if (e.type !== "status_changed") continue;
    const change = parseStatusChange(e.detail);
    if (!change) continue;
    const at = Math.min(Date.parse(e.at), until);
    if (at > from) out.push({ from, to: at, status });
    from = Math.max(from, at);
    status = change.to;
  }
  if (until > from) out.push({ from, to: until, status });
  return out;
}

/** When the clock for `metric` stopped, or null if it still runs. */
export function stopTime(ticket: Ticket, metric: SlaMetric): number | null {
  if (metric === "first_reply") return ticket.firstReplyAt ? Date.parse(ticket.firstReplyAt) : null;
  return (ticket.status === "solved" || ticket.status === "closed") && ticket.solvedAt ? Date.parse(ticket.solvedAt) : null;
}

/** Intervals in which the clock ran, up to the stop time or `now`. */
export function runningSegments(ticket: Ticket, metric: SlaMetric, now: number): Segment[] {
  const stop = stopTime(ticket, metric);
  const until = stop === null ? now : Math.min(stop, now);
  return statusIntervals(ticket, until).filter((s) => RUNNING.has(s.status)).map(({ from, to }) => ({ from, to }));
}

/** The instant at which `minutes` business minutes have run across the segments, or null if not reached. */
export function instantAtActiveMinutes(segments: Segment[], minutes: number, policy: SlaPolicy): number | null {
  let left = minutes;
  for (const s of segments) {
    const end = addBusinessMinutes(s.from, left, policy.businessHours);
    if (end <= s.to) return end;
    left -= businessMinutesBetween(s.from, s.to, policy.businessHours);
  }
  return null;
}

export type SlaState = "ok" | "warning" | "breached" | "met";

export interface SlaTimer {
  metric: SlaMetric;
  targetMins: number;
  elapsedMins: number;
  remainingMins: number;
  /** Share of the target left, 1 = untouched, 0 or less = breached. */
  fractionLeft: number;
  state: SlaState;
  /** The clock stopped (reply sent, or ticket solved). */
  stopped: boolean;
  /** The clock is paused (pending or on_hold). */
  paused: boolean;
  /** Projected breach time if the clock keeps running, as ISO. Null when stopped or paused. */
  dueAt: string | null;
}

/** Business minutes the clock for `metric` has run by `now`, in the given business hours. */
export function clockMinutes(ticket: Ticket, metric: SlaMetric, hours: SlaPolicy["businessHours"], now: number): number {
  return runningSegments(ticket, metric, now).reduce((sum, s) => sum + businessMinutesBetween(s.from, s.to, hours), 0);
}

export function slaTimer(ticket: Ticket, policy: SlaPolicy, metric: SlaMetric, now: number): SlaTimer {
  const target = policy.targets[ticket.priority];
  const targetMins = metric === "first_reply" ? target.firstReplyMins : target.resolutionMins;
  const elapsedMins = clockMinutes(ticket, metric, policy.businessHours, now);
  const remainingMins = targetMins - elapsedMins;
  const fractionLeft = remainingMins / targetMins;
  const stopped = stopTime(ticket, metric) !== null;
  const paused = !stopped && !RUNNING.has(ticket.status);
  const state: SlaState = stopped
    ? (remainingMins >= 0 ? "met" : "breached")
    : remainingMins <= 0 ? "breached" : fractionLeft <= WARNING_FRACTION ? "warning" : "ok";
  const dueAt = stopped || paused || remainingMins <= 0 ? null : iso(addBusinessMinutes(now, remainingMins, policy.businessHours));
  return { metric, targetMins, elapsedMins, remainingMins, fractionLeft, state, stopped, paused, dueAt };
}

export function slaTimers(ticket: Ticket, policy: SlaPolicy, now: number): SlaTimer[] {
  return SLA_METRICS.map((m) => slaTimer(ticket, policy, m, now));
}

export function formatTarget(mins: number): string {
  return mins < 60 ? `${mins} min` : `${mins / 60} h`;
}

export function slaEventDetail(policy: SlaPolicy, kind: "sla_warning" | "sla_breached", metric: SlaMetric, targetMins: number): string {
  return kind === "sla_warning"
    ? `${policy.name} SLA warning: 25% of the ${formatTarget(targetMins)} ${METRIC_LABEL[metric]} target is left.`
    : `${policy.name} SLA breached: the ${formatTarget(targetMins)} ${METRIC_LABEL[metric]} target has passed.`;
}

function hasSlaEvent(ticket: Ticket, kind: "sla_warning" | "sla_breached", metric: SlaMetric): boolean {
  return ticket.events.some((e) => e.type === kind && e.detail.includes(` ${METRIC_LABEL[metric]} target`));
}

/**
 * SLA warning and breach events that are due by `now` and not yet written.
 * Each event is stamped at the exact moment the threshold was crossed, and is written once.
 */
export function slaEventsDue(ticket: Ticket, policy: SlaPolicy, now: number): TicketEvent[] {
  const out: TicketEvent[] = [];
  for (const metric of SLA_METRICS) {
    const target = policy.targets[ticket.priority];
    const targetMins = metric === "first_reply" ? target.firstReplyMins : target.resolutionMins;
    const segments = runningSegments(ticket, metric, now);
    const stop = stopTime(ticket, metric);
    // A stopped clock crosses a threshold only if it got there before it stopped.
    const crossed = (at: number | null) => at !== null && (stop === null ? at <= now : at < stop);
    const thresholds: Array<["sla_warning" | "sla_breached", number]> = [
      ["sla_warning", targetMins * (1 - WARNING_FRACTION)],
      ["sla_breached", targetMins],
    ];
    for (const [kind, mins] of thresholds) {
      if (hasSlaEvent(ticket, kind, metric)) continue;
      const at = instantAtActiveMinutes(segments, mins, policy);
      if (!crossed(at)) continue;
      out.push({ at: iso(at!), type: kind, actor: "system", detail: slaEventDetail(policy, kind, metric, targetMins), ruleId: policy.id });
    }
  }
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
