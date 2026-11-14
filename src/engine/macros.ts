// Macro apply (SPEC.md section 6.5). Pure functions, no React.
// Applying a macro adds its reply as a public reply, writes a macro_applied event and runs its actions.
import type { Agent, Customer, Group, Macro, Ticket, TicketEvent } from "../types";
import { iso, withEvents, type Notification } from "./events";
import { applyActions } from "./routing";

/** Fills {{customer.name}} and {{ticket.id}}. Unknown placeholders stay as they are. */
export function fillPlaceholders(text: string, ticket: Pick<Ticket, "id">, customer: Pick<Customer, "name"> | undefined): string {
  return text.replace(/\{\{\s*([a-z_.]+)\s*\}\}/gi, (whole, key: string) => {
    if (key === "customer.name") return customer?.name ?? "there";
    if (key === "ticket.id") return String(ticket.id);
    return whole;
  });
}

export interface MacroRun {
  ticket: Ticket;
  /** The reply text with placeholders filled. */
  reply: string;
  notifications: Notification[];
}

export function applyMacro(ticket: Ticket, macro: Macro, customer: Customer | undefined, agent: Agent, groups: Group[], now: number): MacroRun {
  const reply = fillPlaceholders(macro.reply, ticket, customer);
  const at = iso(now);
  const events: TicketEvent[] = [
    { at, type: "macro_applied", actor: agent.id, detail: `${agent.name} applied the macro "${macro.name}".` },
    { at, type: "public_reply", actor: agent.id, detail: `${agent.name} sent a public reply: "${reply}"` },
  ];
  const r = applyActions(ticket, macro.actions, { groups, actor: agent.id }, now);
  const replied: Ticket = { ...r.ticket, firstReplyAt: r.ticket.firstReplyAt ?? at };
  return { ticket: withEvents(replied, [...events, ...r.events]), reply, notifications: r.notifications };
}
