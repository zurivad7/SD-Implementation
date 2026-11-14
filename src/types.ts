// Data model from SPEC.md section 4. Single source of truth for all types.
// All times are ISO 8601 strings in UTC. The UI shows times in Europe/Amsterdam.

export type Channel = "email" | "web_form" | "chat" | "phone";
export type Priority = "low" | "normal" | "high" | "urgent";
export type Status = "new" | "open" | "pending" | "on_hold" | "solved" | "closed";
export type Category =
  | "billing"
  | "license_activation"
  | "download_install"
  | "refund"
  | "account_access"
  | "other";
export type Tier = "standard" | "business" | "enterprise";

export interface Customer {
  id: string;
  name: string;
  email: string;
  tier: Tier;
  language: "en" | "nl" | "de";
}

export interface Agent {
  id: string;
  name: string;
  groupIds: string[];
  role: "agent" | "lead";
  shift: "early" | "late";
}

/** Groups: Tier 1, Billing, Technical, Escalations. */
export interface Group {
  id: string;
  name: string;
}

export interface Ticket {
  /** Starts at 10001. */
  id: number;
  subject: string;
  body: string;
  channel: Channel;
  category: Category;
  priority: Priority;
  status: Status;
  customerId: string;
  groupId: string | null;
  assigneeId: string | null;
  tags: string[];
  createdAt: string;
  firstReplyAt: string | null;
  solvedAt: string | null;
  slaPolicyId: string | null;
  /** Full audit trail. */
  events: TicketEvent[];
  csat: { score: "good" | "bad"; comment?: string } | null;
}

export type TicketEventType =
  | "created"
  | "rule_fired"
  | "assigned"
  | "status_changed"
  | "public_reply"
  | "internal_note"
  | "sla_warning"
  | "sla_breached"
  | "escalated"
  | "macro_applied"
  | "csat_received";

export interface TicketEvent {
  at: string;
  type: TicketEventType;
  /** Agent id, "system" or "customer". */
  actor: string;
  /** Plain-English sentence for the timeline. */
  detail: string;
  ruleId?: string;
}

export interface BusinessHours {
  tz: "Europe/Amsterdam";
  start: "08:00";
  end: "20:00";
  /** Day numbers, 0 = Sunday to 6 = Saturday. */
  days: number[];
}

export interface SlaPolicy {
  id: string;
  name: string;
  /** For example: tier = enterprise. */
  match: Condition[];
  targets: Record<Priority, { firstReplyMins: number; resolutionMins: number }>;
  businessHours: BusinessHours | "24x7";
}

export interface Condition {
  /** "customer.language" is added to the spec union: trigger 7 (Dutch language) needs it. */
  field: keyof Ticket | "customer.tier" | "customer.language" | "body";
  op: "is" | "is_not" | "contains" | "in";
  value: string | string[];
}

export interface Action {
  type: "set_group" | "set_priority" | "add_tag" | "set_status" | "notify_lead";
  value: string;
}

export interface Trigger {
  id: string;
  name: string;
  order: number;
  active: boolean;
  all: Condition[];
  any: Condition[];
  actions: Action[];
}

export interface EscalationRule {
  id: string;
  name: string;
  when: "sla_warning" | "sla_breached" | "reopened_twice" | "bad_csat";
  actions: Action[];
}

/** Reply supports {{customer.name}} and {{ticket.id}}. */
export interface Macro {
  id: string;
  name: string;
  reply: string;
  actions: Action[];
}
