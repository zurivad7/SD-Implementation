// Shared helpers for ticket events. Pure functions, no React.
import type { Status, Ticket, TicketEvent } from "../types";

export const STATUS_LABEL: Record<Status, string> = {
  new: "New", open: "Open", pending: "Pending", on_hold: "On-hold", solved: "Solved", closed: "Closed",
};

/** Every status_changed event ends with this sentence. The SLA engine reads status history from it. */
export function statusSentence(from: Status, to: Status): string {
  return `Status changed from ${STATUS_LABEL[from]} to ${STATUS_LABEL[to]}.`;
}

const LABEL_TO_STATUS = Object.fromEntries(Object.entries(STATUS_LABEL).map(([k, v]) => [v, k])) as Record<string, Status>;

export function parseStatusChange(detail: string): { from: Status; to: Status } | null {
  const m = /Status changed from ([A-Za-z-]+) to ([A-Za-z-]+)\.$/.exec(detail);
  const from = m ? LABEL_TO_STATUS[m[1]!] : undefined;
  const to = m ? LABEL_TO_STATUS[m[2]!] : undefined;
  return from && to ? { from, to } : null;
}

export const iso = (ms: number) => new Date(Math.round(ms / 1000) * 1000).toISOString().replace(".000Z", "Z");

/** Adds events and keeps the trail in time order. Events at the same instant keep insertion order. */
export function withEvents(ticket: Ticket, events: TicketEvent[]): Ticket {
  if (events.length === 0) return ticket;
  const all = [...ticket.events.map((e, i) => ({ e, i })), ...events.map((e, i) => ({ e, i: ticket.events.length + i }))];
  all.sort((a, b) => (a.e.at < b.e.at ? -1 : a.e.at > b.e.at ? 1 : a.i - b.i));
  return { ...ticket, events: all.map((x) => x.e) };
}

/** A user-facing message for "notify lead" and similar. The demo sends nothing: it shows a toast. */
export interface Notification {
  ticketId: number;
  at: string;
  message: string;
  ruleId?: string;
}
