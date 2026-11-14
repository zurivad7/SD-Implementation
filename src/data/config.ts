// Seed configuration: groups, agents, SLA policies and routing triggers (SPEC.md sections 5 and 6).
// Escalation rules and macros arrive with the engines in M3.
import type { Agent, BusinessHours, Group, SlaPolicy, Trigger } from "../types";

export const SEED = "northwind-2026";

export const GROUPS: Group[] = [
  { id: "tier1", name: "Tier 1" },
  { id: "billing", name: "Billing" },
  { id: "technical", name: "Technical" },
  { id: "escalations", name: "Escalations" },
];

/** Shift hours, Amsterdam time. Early and late overlap over the midday peak. */
export const SHIFTS = {
  early: { startHour: 8, endHour: 16 },
  late: { startHour: 12, endHour: 20 },
} as const;

/** 10 agents and 2 leads in 4 groups. All names are fictional. */
export const AGENTS: Agent[] = [
  { id: "a01", name: "Sanne Visser", groupIds: ["tier1"], role: "agent", shift: "early" },
  { id: "a02", name: "Tom Hartley", groupIds: ["tier1"], role: "agent", shift: "early" },
  { id: "a03", name: "Jonas Keller", groupIds: ["tier1"], role: "agent", shift: "late" },
  { id: "a04", name: "Fleur Dekker", groupIds: ["tier1"], role: "agent", shift: "late" },
  { id: "a05", name: "Priya Shah", groupIds: ["billing"], role: "agent", shift: "early" },
  { id: "a06", name: "Lena Vogel", groupIds: ["billing"], role: "agent", shift: "late" },
  { id: "a07", name: "Daan Smit", groupIds: ["technical"], role: "agent", shift: "early" },
  { id: "a08", name: "Oliver Grant", groupIds: ["technical"], role: "agent", shift: "late" },
  { id: "a09", name: "Mila Brouwer", groupIds: ["technical", "escalations"], role: "agent", shift: "early" },
  { id: "a10", name: "Felix Neumann", groupIds: ["technical", "escalations"], role: "agent", shift: "late" },
  { id: "a11", name: "Esther Bakker", groupIds: ["escalations", "tier1", "billing"], role: "lead", shift: "early" },
  { id: "a12", name: "Marcus Reid", groupIds: ["escalations", "technical"], role: "lead", shift: "late" },
];

const BUSINESS_MON_SAT: BusinessHours = { tz: "Europe/Amsterdam", start: "08:00", end: "20:00", days: [1, 2, 3, 4, 5, 6] };
const BUSINESS_MON_FRI: BusinessHours = { tz: "Europe/Amsterdam", start: "08:00", end: "20:00", days: [1, 2, 3, 4, 5] };

const h = (hours: number) => hours * 60;

/** Section 6.3. The first policy that matches wins, so order matters. */
export const SLA_POLICIES: SlaPolicy[] = [
  {
    id: "sla_enterprise",
    name: "Enterprise",
    match: [{ field: "customer.tier", op: "is", value: "enterprise" }],
    targets: {
      urgent: { firstReplyMins: 30, resolutionMins: h(4) },
      high: { firstReplyMins: h(1), resolutionMins: h(8) },
      normal: { firstReplyMins: h(4), resolutionMins: h(24) },
      low: { firstReplyMins: h(8), resolutionMins: h(48) },
    },
    businessHours: "24x7",
  },
  {
    id: "sla_business",
    name: "Business",
    match: [{ field: "customer.tier", op: "is", value: "business" }],
    targets: {
      urgent: { firstReplyMins: h(1), resolutionMins: h(8) },
      high: { firstReplyMins: h(2), resolutionMins: h(16) },
      normal: { firstReplyMins: h(8), resolutionMins: h(40) },
      low: { firstReplyMins: h(16), resolutionMins: h(72) },
    },
    businessHours: BUSINESS_MON_SAT,
  },
  {
    id: "sla_standard",
    name: "Standard",
    match: [],
    targets: {
      urgent: { firstReplyMins: h(2), resolutionMins: h(16) },
      high: { firstReplyMins: h(4), resolutionMins: h(24) },
      normal: { firstReplyMins: h(12), resolutionMins: h(48) },
      low: { firstReplyMins: h(24), resolutionMins: h(96) },
    },
    businessHours: BUSINESS_MON_FRI,
  },
];

/** Section 6.2. Triggers run in `order`. The first matching set_group wins. */
export const TRIGGERS: Trigger[] = [
  {
    id: "t1", name: "Enterprise fast lane", order: 1, active: true,
    all: [{ field: "customer.tier", op: "is", value: "enterprise" }], any: [],
    actions: [{ type: "set_priority", value: "high" }, { type: "add_tag", value: "vip" }, { type: "set_group", value: "escalations" }],
  },
  {
    id: "t2", name: "Urgent keywords", order: 2, active: true,
    all: [],
    any: [
      { field: "body", op: "contains", value: "down" },
      { field: "body", op: "contains", value: "outage" },
      { field: "body", op: "contains", value: "cannot work" },
    ],
    actions: [{ type: "set_priority", value: "urgent" }, { type: "notify_lead", value: "lead" }],
  },
  {
    id: "t3", name: "Refund requests", order: 3, active: true,
    all: [{ field: "category", op: "is", value: "refund" }], any: [],
    actions: [{ type: "set_group", value: "billing" }, { type: "add_tag", value: "refund" }],
  },
  {
    id: "t4", name: "Billing", order: 4, active: true,
    all: [{ field: "category", op: "is", value: "billing" }], any: [],
    actions: [{ type: "set_group", value: "billing" }],
  },
  {
    id: "t5", name: "Activation and install", order: 5, active: true,
    all: [{ field: "category", op: "in", value: ["license_activation", "download_install"] }], any: [],
    actions: [{ type: "set_group", value: "technical" }],
  },
  {
    id: "t6", name: "Account access", order: 6, active: true,
    all: [{ field: "category", op: "is", value: "account_access" }], any: [],
    actions: [{ type: "set_group", value: "tier1" }, { type: "add_tag", value: "security_check" }],
  },
  {
    id: "t7", name: "Dutch language", order: 7, active: true,
    all: [{ field: "customer.language", op: "is", value: "nl" }], any: [],
    actions: [{ type: "add_tag", value: "lang_nl" }],
  },
  {
    id: "t8", name: "Catch-all", order: 8, active: true,
    all: [{ field: "groupId", op: "is", value: "" }], any: [],
    actions: [{ type: "set_group", value: "tier1" }],
  },
];
