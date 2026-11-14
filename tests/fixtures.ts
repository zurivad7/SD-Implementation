// Test helpers. Times are UTC ISO strings unless a helper says Amsterdam.
import { AGENTS, ESCALATION_RULES, GROUPS, MACROS, SHIFTS, SLA_POLICIES, TRIGGERS } from "../src/data/config";
import { amsterdamToUtc } from "../src/engine/businessTime";
import type { DeskConfig } from "../src/engine/desk";
import { statusSentence } from "../src/engine/events";
import type { Customer, Status, Ticket, TicketEvent } from "../src/types";

export const config: DeskConfig = {
  triggers: TRIGGERS, slaPolicies: SLA_POLICIES, escalationRules: ESCALATION_RULES, macros: MACROS,
  agents: AGENTS, groups: GROUPS, shifts: SHIFTS,
};

export const MIN = 60_000;

/** Epoch ms for an Amsterdam wall-clock time, "2026-11-09 10:00". */
export function ams(text: string): number {
  const [d, t] = text.split(" ") as [string, string];
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  const [hh, mm] = t.split(":").map(Number) as [number, number];
  return amsterdamToUtc(y, m, day, hh, mm);
}

export function customer(tier: Customer["tier"] = "standard", language: Customer["language"] = "en", id = "c1"): Customer {
  return { id, name: "Anna Jansen", email: "anna@example.com", tier, language };
}

export function ticket(fields: Partial<Ticket> = {}): Ticket {
  const createdAt = fields.createdAt ?? "2026-11-09T09:00:00Z";
  return {
    id: 20001, subject: "Help", body: "I need help with my order.", channel: "email", category: "other",
    priority: "normal", status: "new", customerId: "c1", groupId: null, assigneeId: null, tags: [],
    createdAt, firstReplyAt: null, solvedAt: null, slaPolicyId: null,
    events: [{ at: createdAt, type: "created", actor: "customer", detail: "Customer created the ticket by email." }],
    csat: null,
    ...fields,
  };
}

export const ev = {
  status: (at: string, from: Status, to: Status): TicketEvent => ({ at, type: "status_changed", actor: "a01", detail: statusSentence(from, to) }),
  reply: (at: string): TicketEvent => ({ at, type: "public_reply", actor: "a01", detail: "Sanne Visser sent a public reply." }),
  assigned: (at: string): TicketEvent => ({ at, type: "assigned", actor: "system", detail: "Assigned to Sanne Visser in Tier 1." }),
  breached: (at: string): TicketEvent => ({ at, type: "sla_breached", actor: "system", detail: "SLA breached: the 1 h first reply target has passed." }),
  csat: (at: string, score: "good" | "bad"): TicketEvent => ({ at, type: "csat_received", actor: "customer", detail: `Customer rated the support ${score}.` }),
};
