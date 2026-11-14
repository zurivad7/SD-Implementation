// Ticket lifecycle: composes routing, assignment, SLA and escalations (SPEC.md section 6).
// Pure functions, no React. The UI store calls these; tests call them directly. `now` is epoch ms.
import type {
  Agent, Category, Channel, Customer, EscalationRule, Group, Macro, Priority, SlaPolicy, Status, Ticket, Trigger,
} from "../types";
import { iso, statusSentence, withEvents, type Notification } from "./events";
import { runEscalations } from "./escalation";
import { applyMacro } from "./macros";
import { assignRoundRobin, runTriggers, setStatusFields, type RoundRobinState, type ShiftHours } from "./routing";
import { selectPolicy, slaEventsDue } from "./sla";

export interface DeskConfig {
  triggers: Trigger[];
  slaPolicies: SlaPolicy[];
  escalationRules: EscalationRule[];
  macros: Macro[];
  agents: Agent[];
  groups: Group[];
  shifts: ShiftHours;
}

export interface DeskResult {
  ticket: Ticket;
  rr: RoundRobinState;
  notifications: Notification[];
}

export interface NewTicketInput {
  subject: string;
  body: string;
  channel: Channel;
  category: Category;
  /** Optional on the form. Defaults to normal. */
  priority?: Priority;
}

/** Writes SLA warnings and breaches that are due, then fires due escalation rules. */
export function tick(ticket: Ticket, config: DeskConfig, now: number): { ticket: Ticket; notifications: Notification[] } {
  const policy = config.slaPolicies.find((p) => p.id === ticket.slaPolicyId) ?? null;
  let t = ticket;
  if (policy) t = withEvents(t, slaEventsDue(t, policy, now));
  const esc = runEscalations(t, config.escalationRules, config.groups);
  return { ticket: esc.ticket, notifications: esc.notifications };
}

/** Runs triggers (update pass), reassigns if the group changed to one the assignee is not in, then ticks. */
export function afterUpdate(ticket: Ticket, customer: Customer | undefined, config: DeskConfig, rr: RoundRobinState, now: number): DeskResult {
  const before = ticket.groupId;
  const run = runTriggers(ticket, customer, config.triggers, config.groups, now);
  let t = run.ticket;
  let nextRr = rr;
  const assignee = config.agents.find((a) => a.id === t.assigneeId);
  if (t.groupId && t.groupId !== before && (!assignee || !assignee.groupIds.includes(t.groupId))) {
    const a = assignRoundRobin(t, config.agents, config.groups, config.shifts, rr, now);
    t = a.ticket;
    nextRr = a.rr;
  }
  const ticked = tick(t, config, now);
  return { ticket: ticked.ticket, rr: nextRr, notifications: [...run.notifications, ...ticked.notifications] };
}

/** Section 6.1 and 6.2: create, route, pick the SLA policy, assign round-robin, then tick. */
export function createTicket(id: number, input: NewTicketInput, customer: Customer, config: DeskConfig, rr: RoundRobinState, now: number): DeskResult {
  const at = iso(now);
  const base: Ticket = {
    id,
    subject: input.subject,
    body: input.body,
    channel: input.channel,
    category: input.category,
    priority: input.priority ?? "normal",
    status: "new",
    customerId: customer.id,
    groupId: null,
    assigneeId: null,
    tags: [],
    createdAt: at,
    firstReplyAt: null,
    solvedAt: null,
    slaPolicyId: null,
    events: [{ at, type: "created", actor: "customer", detail: `Customer created the ticket by ${input.channel.replace("_", " ")}.` }],
    csat: null,
  };
  const run = runTriggers(base, customer, config.triggers, config.groups, now);
  const policy = selectPolicy(run.ticket, customer, config.slaPolicies);
  const withPolicy = { ...run.ticket, slaPolicyId: policy?.id ?? null };
  const assigned = assignRoundRobin(withPolicy, config.agents, config.groups, config.shifts, rr, now);
  const ticked = tick(assigned.ticket, config, now);
  return { ticket: ticked.ticket, rr: assigned.rr, notifications: [...run.notifications, ...ticked.notifications] };
}

// ---------------------------------------------------------------- agent and customer actions
// Each returns the changed ticket. The caller then runs afterUpdate().

export function changeStatus(ticket: Ticket, to: Status, actor: string, now: number): Ticket {
  if (ticket.status === to) return ticket;
  const at = iso(now);
  return withEvents(setStatusFields(ticket, to, at), [{ at, type: "status_changed", actor, detail: statusSentence(ticket.status, to) }]);
}

export function addPublicReply(ticket: Ticket, agent: Agent, now: number): Ticket {
  const at = iso(now);
  return withEvents({ ...ticket, firstReplyAt: ticket.firstReplyAt ?? at }, [{ at, type: "public_reply", actor: agent.id, detail: `${agent.name} sent a public reply.` }]);
}

export function addInternalNote(ticket: Ticket, actor: string, text: string, now: number): Ticket {
  return withEvents(ticket, [{ at: iso(now), type: "internal_note", actor, detail: text }]);
}

export function receiveCsat(ticket: Ticket, score: "good" | "bad", now: number, comment?: string): Ticket {
  const detail = `Customer rated the support ${score}${comment ? `: "${comment}"` : "."}`;
  return withEvents({ ...ticket, csat: comment ? { score, comment } : { score } }, [{ at: iso(now), type: "csat_received", actor: "customer", detail }]);
}

export function runMacro(ticket: Ticket, macro: Macro, customer: Customer | undefined, agent: Agent, config: DeskConfig, now: number): { ticket: Ticket; notifications: Notification[] } {
  const r = applyMacro(ticket, macro, customer, agent, config.groups, now);
  return { ticket: r.ticket, notifications: r.notifications };
}
