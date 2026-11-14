// CSV export of the filtered tickets (SPEC.md section 7). Pure. Every computed column comes from engine/metrics.ts.
import { AGENTS, GROUPS, SLA_POLICIES } from "../data/config";
import { assignCount, firstReplyMins, isBreached, publicReplyCount, resolutionMins } from "../engine/metrics";
import type { Customer, Ticket } from "../types";

export const CSV_COLUMNS = [
  "ticket_id", "created_at_utc", "channel", "category", "priority", "status", "customer_tier", "group", "assignee",
  "first_reply_at_utc", "solved_at_utc", "first_reply_business_mins", "resolution_business_mins", "sla_policy",
  "sla_breached", "assigned_events", "public_replies", "csat", "tags", "sandbox",
] as const;

function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export function ticketsToCsv(tickets: Ticket[], customerOf: (id: string) => Customer | undefined, isSandbox: (t: Ticket) => boolean): string {
  const rows = tickets.map((t) => [
    t.id, t.createdAt, t.channel, t.category, t.priority, t.status, customerOf(t.customerId)?.tier,
    GROUPS.find((g) => g.id === t.groupId)?.name, AGENTS.find((a) => a.id === t.assigneeId)?.name,
    t.firstReplyAt, t.solvedAt, round1(firstReplyMins(t, SLA_POLICIES)), round1(resolutionMins(t, SLA_POLICIES)),
    SLA_POLICIES.find((p) => p.id === t.slaPolicyId)?.name, isBreached(t), assignCount(t), publicReplyCount(t),
    t.csat?.score, t.tags.join(" "), isSandbox(t),
  ].map(cell).join(","));
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
}

/** Saves text as a file in the browser. No network call. */
export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
