// Trigger evaluation, actions and round-robin assignment (SPEC.md section 6.2). Pure functions, no React.
//
// Rules:
// - Triggers run in `order` on create and on every update. Inactive triggers are skipped.
// - Each trigger fires at most once per ticket, like a Zendesk trigger with a "not yet fired" guard.
//   This stops repeat timeline lines and stops routing from undoing an escalation on a later update.
// - In one pass, the first set_group wins. Later set_group actions in the same pass are ignored.
// - set_priority only raises priority. It never lowers it ("set priority high (if lower)").
// - "contains" on text is a case-insensitive whole-word match, so "down" does not match "download".
import type { Action, Agent, Condition, Customer, Group, Priority, Status, Ticket, TicketEvent, Trigger } from "../types";
import { amsterdamParts } from "./businessTime";
import { iso, statusSentence, withEvents, type Notification } from "./events";

export const PRIORITY_RANK: Record<Priority, number> = { low: 0, normal: 1, high: 2, urgent: 3 };

/** Whole-word, case-insensitive match. */
export function containsPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function fieldValue(ticket: Ticket, customer: Customer | undefined, field: Condition["field"]): string | string[] {
  if (field === "customer.tier") return customer?.tier ?? "";
  if (field === "customer.language") return customer?.language ?? "";
  const v = ticket[field as keyof Ticket];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (v === null || v === undefined) return "";
  return typeof v === "object" ? "" : String(v);
}

export function matchCondition(ticket: Ticket, customer: Customer | undefined, c: Condition): boolean {
  const actual = fieldValue(ticket, customer, c.field);
  const values = Array.isArray(c.value) ? c.value : [c.value];
  if (Array.isArray(actual)) {
    // List fields (tags): "is" and "contains" mean "has", "in" means "has any of".
    const has = values.some((v) => actual.includes(v));
    return c.op === "is_not" ? !has : has;
  }
  switch (c.op) {
    case "is": return actual === values[0];
    case "is_not": return actual !== values[0];
    case "in": return values.includes(actual);
    case "contains": return values.some((v) => containsPhrase(actual, v));
  }
}

export function triggerMatches(trigger: Trigger, ticket: Ticket, customer: Customer | undefined): boolean {
  return trigger.all.every((c) => matchCondition(ticket, customer, c)) &&
    (trigger.any.length === 0 || trigger.any.some((c) => matchCondition(ticket, customer, c)));
}

export interface ActionContext {
  groups: Group[];
  /** Who the events are written as. */
  actor: string;
  /** In a trigger pass, set_group is ignored once a group was set (first set_group wins). */
  groupLocked?: boolean;
  ruleId?: string;
}

export interface ActionResult {
  ticket: Ticket;
  /** Plain-English list of what changed, for the timeline line. */
  done: string[];
  /** Extra events the actions wrote (status changes, internal notes). */
  events: TicketEvent[];
  notifications: Notification[];
  groupSet: boolean;
}

export const groupName = (groups: Group[], id: string | null) => groups.find((g) => g.id === id)?.name ?? "none";

/** Applies actions in order at time `now`. The returned ticket does not yet contain `events`. */
export function applyActions(ticket: Ticket, actions: Action[], ctx: ActionContext, now: number): ActionResult {
  let t: Ticket = { ...ticket, tags: [...ticket.tags] };
  const done: string[] = [];
  const events: TicketEvent[] = [];
  const notifications: Notification[] = [];
  let groupSet = false;
  const at = iso(now);
  for (const a of actions) {
    switch (a.type) {
      case "set_priority": {
        const target = a.value as Priority;
        if (PRIORITY_RANK[target] > PRIORITY_RANK[t.priority]) {
          t.priority = target;
          done.push(`set priority to ${target}`);
        }
        break;
      }
      case "set_group":
        if (!ctx.groupLocked && !groupSet) {
          groupSet = true;
          if (t.groupId !== a.value) {
            t.groupId = a.value;
            done.push(`set group to ${groupName(ctx.groups, a.value)}`);
          }
        }
        break;
      case "add_tag":
        if (!t.tags.includes(a.value)) {
          t.tags.push(a.value);
          done.push(`added tag ${a.value}`);
        }
        break;
      case "set_status": {
        const to = a.value as Status;
        if (t.status !== to) {
          events.push({ at, type: "status_changed", actor: ctx.actor, detail: statusSentence(t.status, to), ...(ctx.ruleId ? { ruleId: ctx.ruleId } : {}) });
          t = setStatusFields(t, to, at);
          done.push(`set status to ${to.replace("_", "-")}`);
        }
        break;
      }
      case "notify_lead":
        done.push("notified the lead");
        notifications.push({ ticketId: t.id, at, message: `Lead notified about ticket #${t.id}.`, ...(ctx.ruleId ? { ruleId: ctx.ruleId } : {}) });
        break;
      case "add_internal_note":
        events.push({ at, type: "internal_note", actor: ctx.actor, detail: a.value, ...(ctx.ruleId ? { ruleId: ctx.ruleId } : {}) });
        done.push("added an internal note");
        break;
    }
  }
  return { ticket: t, done, events, notifications, groupSet };
}

/** Status field side effects: solvedAt is set on solve and cleared when the ticket reopens. */
export function setStatusFields(t: Ticket, to: Status, at: string): Ticket {
  const solvedAt = to === "solved" ? at : to === "closed" ? t.solvedAt ?? at : null;
  return { ...t, status: to, solvedAt };
}

export function triggerDetail(trigger: Trigger, done: string[]): string {
  return `Trigger "${trigger.name}" fired: ${done.length ? done.join(", ") : "no change needed"}.`;
}

export interface TriggerRun {
  ticket: Ticket;
  fired: Array<{ ruleId: string; detail: string }>;
  notifications: Notification[];
}

/** Runs all active triggers once, in order. Writes one rule_fired event per trigger that fires. */
export function runTriggers(ticket: Ticket, customer: Customer | undefined, triggers: Trigger[], groups: Group[], now: number): TriggerRun {
  let t = ticket;
  const fired: TriggerRun["fired"] = [];
  const notifications: Notification[] = [];
  const newEvents: TicketEvent[] = [];
  const alreadyFired = new Set(ticket.events.filter((e) => e.type === "rule_fired" && e.ruleId).map((e) => e.ruleId!));
  let groupLocked = false;
  for (const trigger of [...triggers].sort((a, b) => a.order - b.order)) {
    if (!trigger.active || alreadyFired.has(trigger.id)) continue;
    if (!triggerMatches(trigger, t, customer)) continue;
    const r = applyActions(t, trigger.actions, { groups, actor: "system", groupLocked, ruleId: trigger.id }, now);
    t = r.ticket;
    groupLocked ||= r.groupSet;
    const detail = triggerDetail(trigger, r.done);
    fired.push({ ruleId: trigger.id, detail });
    newEvents.push({ at: iso(now), type: "rule_fired", actor: "system", detail, ruleId: trigger.id }, ...r.events);
    notifications.push(...r.notifications.map((n) => ({ ...n, message: `Lead notified by trigger "${trigger.name}" on ticket #${t.id}.` })));
  }
  return { ticket: withEvents(t, newEvents), fired, notifications };
}

// ---------------------------------------------------------------- assignment

export type ShiftHours = Record<Agent["shift"], { startHour: number; endHour: number }>;
/** Round-robin position per group. */
export type RoundRobinState = Record<string, number>;

export function isOnShift(agent: Agent, shifts: ShiftHours, now: number): boolean {
  const { hour } = amsterdamParts(now);
  const s = shifts[agent.shift];
  return hour >= s.startHour && hour < s.endHour;
}

/**
 * Picks the next agent in the group: on-shift agents first, then the group's on-call agents
 * (out of hours), then the group's leads if the group has no agents.
 */
export function pickAgent(groupId: string, agents: Agent[], shifts: ShiftHours, rr: RoundRobinState, now: number): { agent: Agent | null; rr: RoundRobinState } {
  const members = agents.filter((a) => a.groupIds.includes(groupId));
  const staff = members.filter((a) => a.role === "agent");
  const live = staff.filter((a) => isOnShift(a, shifts, now));
  const pool = live.length ? live : staff.length ? staff : members;
  if (pool.length === 0) return { agent: null, rr };
  const n = rr[groupId] ?? 0;
  return { agent: pool[n % pool.length]!, rr: { ...rr, [groupId]: n + 1 } };
}

/** Assigns the ticket round-robin in its group and writes an "assigned" event. */
export function assignRoundRobin(ticket: Ticket, agents: Agent[], groups: Group[], shifts: ShiftHours, rr: RoundRobinState, now: number): { ticket: Ticket; rr: RoundRobinState } {
  if (!ticket.groupId) return { ticket, rr };
  const pick = pickAgent(ticket.groupId, agents, shifts, rr, now);
  if (!pick.agent) return { ticket, rr };
  const verb = ticket.assigneeId ? "Reassigned" : "Assigned";
  const event: TicketEvent = { at: iso(now), type: "assigned", actor: "system", detail: `${verb} to ${pick.agent.name} in ${groupName(groups, ticket.groupId)}.` };
  return { ticket: withEvents({ ...ticket, assigneeId: pick.agent.id }, [event]), rr: pick.rr };
}
