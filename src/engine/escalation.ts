// Escalation rules (SPEC.md section 6.4). Pure functions, no React.
// Each rule fires at most once per ticket, at the moment its condition first became true.
// "Notify lead" only writes an event and returns a notification for a toast. It sends nothing.
import type { EscalationRule, Group, Ticket, TicketEvent } from "../types";
import { iso, parseStatusChange, withEvents, type Notification } from "./events";
import { applyActions } from "./routing";

/** When the rule's condition first became true, or null if it has not. */
export function escalationTriggerTime(ticket: Ticket, rule: EscalationRule): number | null {
  const first = (type: TicketEvent["type"]) => ticket.events.find((e) => e.type === type);
  switch (rule.when) {
    case "sla_warning": {
      const e = first("sla_warning");
      return e ? Date.parse(e.at) : null;
    }
    case "sla_breached": {
      const e = first("sla_breached");
      return e ? Date.parse(e.at) : null;
    }
    case "reopened_twice": {
      const reopens = ticket.events.filter((e) => {
        if (e.type !== "status_changed") return false;
        const c = parseStatusChange(e.detail);
        return c !== null && (c.from === "solved" || c.from === "closed") && c.to !== "solved" && c.to !== "closed";
      });
      return reopens[1] ? Date.parse(reopens[1].at) : null;
    }
    case "bad_csat": {
      if (ticket.csat?.score !== "bad") return null;
      const e = [...ticket.events].reverse().find((x) => x.type === "csat_received");
      return e ? Date.parse(e.at) : null;
    }
  }
}

export function hasEscalationFired(ticket: Ticket, rule: EscalationRule): boolean {
  return ticket.events.some((e) => e.type === "escalated" && e.ruleId === rule.id);
}

export interface EscalationRun {
  ticket: Ticket;
  notifications: Notification[];
}

/** Fires every escalation rule that is due and has not fired yet. */
export function runEscalations(ticket: Ticket, rules: EscalationRule[], groups: Group[]): EscalationRun {
  let t = ticket;
  const notifications: Notification[] = [];
  for (const rule of rules) {
    if (hasEscalationFired(t, rule)) continue;
    const at = escalationTriggerTime(t, rule);
    if (at === null) continue;
    const r = applyActions(t, rule.actions, { groups, actor: "system", ruleId: rule.id }, at);
    const event: TicketEvent = {
      at: iso(at),
      type: "escalated",
      actor: "system",
      ruleId: rule.id,
      detail: `Escalation rule "${rule.name}" fired: ${r.done.length ? r.done.join(", ") : "no change needed"}.`,
    };
    t = withEvents(r.ticket, [event, ...r.events]);
    notifications.push(...r.notifications.map((n) => ({ ...n, message: `Lead notified: escalation rule "${rule.name}" on ticket #${t.id}.` })));
  }
  return { ticket: t, notifications };
}
