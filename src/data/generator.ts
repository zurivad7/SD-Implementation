// Seeded synthetic data generator (SPEC.md section 5). Pure: no Node or React imports.
// The same seed and end date always give byte-identical output.
//
// Story: days 1 to 14 are "before go-live" (one shared queue, no triggers, no escalation rules).
// Days 15 to 30 are "after go-live" (section 6 triggers and escalation rules run).
// SLA targets apply in both periods: the "before" breaches are the baseline that the
// ticket audit measures against the new targets.
import seedrandom from "seedrandom";
import type {
  Agent, Category, Channel, Customer, Group, Priority, SlaPolicy, Status, Ticket, TicketEvent, Tier, Trigger,
} from "../types";
import { addBusinessMinutes, amsterdamParts, amsterdamToUtc, businessMinutesBetween, MINUTE_MS } from "../engine/businessTime";
import { AGENTS, GROUPS, SEED, SHIFTS, SLA_POLICIES, TRIGGERS } from "./config";
import { CSAT_COMMENTS, DEVICES, EMAIL_DOMAINS, NAMES, PRODUCTS, TEMPLATES, URGENT_SENTENCES } from "./templates";

export interface SeedMeta {
  seed: string;
  /** First and last Amsterdam calendar day, YYYY-MM-DD. */
  startDate: string;
  endDate: string;
  /** Day 15: the first day after go-live. */
  goLiveDate: string;
  /** Start of the day after endDate (Amsterdam). Nothing in the data happens at or after this instant. */
  dataEndsAt: string;
  ticketCount: number;
}

export interface SeedData {
  meta: SeedMeta;
  groups: Group[];
  agents: Agent[];
  customers: Customer[];
  tickets: Ticket[];
}

export interface GeneratorOptions {
  seed?: string;
  /** Last day of the period, YYYY-MM-DD. The CLI uses the day before the build date. */
  endDate: string;
}

export const DAYS = 30;
export const GO_LIVE_DAY_INDEX = 14; // zero-based: day 15
export const CUSTOMER_COUNT = 1800;
export const REPEAT_CUSTOMER_SHARE = 0.2;

const CHANNEL_WEIGHTS: Array<[Channel, number]> = [["email", 45], ["web_form", 30], ["chat", 20], ["phone", 5]];
const CATEGORY_WEIGHTS: Array<[Category, number]> = [
  ["license_activation", 30], ["download_install", 25], ["billing", 20], ["refund", 10], ["account_access", 10], ["other", 5],
];
const PRIORITY_WEIGHTS: Array<[Priority, number]> = [["low", 20], ["normal", 55], ["high", 20], ["urgent", 5]];
const TIER_WEIGHTS: Array<[Tier, number]> = [["standard", 70], ["business", 22], ["enterprise", 8]];
const LANGUAGE_WEIGHTS: Array<["en" | "nl" | "de", number]> = [["nl", 40], ["de", 30], ["en", 30]];
/** Amsterdam hour 0 to 23. Peaks 09:00 to 12:00 and 14:00 to 16:00. */
const HOUR_WEIGHTS = [0.3, 0.2, 0.15, 0.15, 0.2, 0.4, 0.8, 1.6, 3.5, 7, 7.5, 7, 4.5, 4.2, 6.8, 6.8, 4.2, 3.2, 2.4, 2, 1.6, 1.2, 0.8, 0.5];

const PRIORITY_RANK: Record<Priority, number> = { low: 0, normal: 1, high: 2, urgent: 3 };
const CHANNEL_LABEL: Record<Channel, string> = { email: "email", web_form: "web form", chat: "chat", phone: "phone" };
const STATUS_LABEL: Record<Status, string> = { new: "New", open: "Open", pending: "Pending", on_hold: "On-hold", solved: "Solved", closed: "Closed" };

type Rng = () => number;

function weighted<T>(rng: Rng, items: Array<[T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [item, w] of items) {
    r -= w;
    if (r < 0) return item;
  }
  return items[items.length - 1]![0];
}
const pick = <T,>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;
const intBetween = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
const iso = (ms: number) => new Date(Math.round(ms / 1000) * 1000).toISOString().replace(".000Z", "Z");

function shuffle<T>(rng: Rng, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

function parseDate(date: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid date "${date}". Use YYYY-MM-DD.`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}
function dateString(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- customers

function makeCustomers(rng: Rng): Customer[] {
  const used = new Set<string>();
  const customers: Customer[] = [];
  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const language = weighted(rng, LANGUAGE_WEIGHTS);
    let name = "";
    for (let tries = 0; tries < 50; tries++) {
      name = `${pick(rng, NAMES[language].first)} ${pick(rng, NAMES[language].last)}`;
      if (!used.has(name)) break;
    }
    // Duplicate names are allowed after 50 tries, like in real customer lists. Emails stay unique.
    used.add(name);
    const local = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z]+/g, ".");
    customers.push({
      id: `c${String(i + 1).padStart(4, "0")}`,
      name,
      email: `${local}.${i + 1}@${pick(rng, EMAIL_DOMAINS)}`,
      tier: weighted(rng, TIER_WEIGHTS),
      language,
    });
  }
  return customers;
}

/** One customer per ticket. Every customer has at least one ticket; about 20% have more than one. */
function customerSlots(rng: Rng, customers: Customer[], ticketCount: number): Customer[] {
  const slots = [...customers];
  const repeaters = shuffle(rng, [...customers]).slice(0, Math.round(customers.length * REPEAT_CUSTOMER_SHARE));
  for (const c of repeaters) if (slots.length < ticketCount) slots.push(c);
  while (slots.length < ticketCount) slots.push(pick(rng, repeaters));
  return shuffle(rng, slots.slice(0, ticketCount));
}

// ---------------------------------------------------------------- routing (after go-live)

/** Whole-word, case-insensitive match. "down" matches "is down" but not "download". */
export function containsPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

interface DraftTicket {
  body: string;
  category: Category;
  priority: Priority;
  groupId: string | null;
  tags: string[];
  tier: Tier;
  language: Customer["language"];
}

function fieldValue(t: DraftTicket, field: string): string {
  switch (field) {
    case "customer.tier": return t.tier;
    case "customer.language": return t.language;
    case "body": return t.body;
    case "category": return t.category;
    case "priority": return t.priority;
    case "groupId": return t.groupId ?? "";
    default: return "";
  }
}

function conditionMatches(t: DraftTicket, c: Trigger["all"][number]): boolean {
  const actual = fieldValue(t, c.field);
  const values = Array.isArray(c.value) ? c.value : [c.value];
  switch (c.op) {
    case "is": return actual === values[0];
    case "is_not": return actual !== values[0];
    case "in": return values.includes(actual);
    case "contains": return values.some((v) => containsPhrase(actual, v));
  }
}

const groupName = (id: string | null) => GROUPS.find((g) => g.id === id)?.name ?? "none";

/** Runs the section 6.2 triggers once, in order. Returns rule_fired details. */
function runTriggers(t: DraftTicket): Array<{ ruleId: string; detail: string }> {
  const fired: Array<{ ruleId: string; detail: string }> = [];
  let groupSet = false;
  for (const trigger of [...TRIGGERS].sort((a, b) => a.order - b.order)) {
    if (!trigger.active) continue;
    const allOk = trigger.all.every((c) => conditionMatches(t, c));
    const anyOk = trigger.any.length === 0 || trigger.any.some((c) => conditionMatches(t, c));
    if (!allOk || !anyOk) continue;
    const done: string[] = [];
    for (const a of trigger.actions) {
      if (a.type === "set_priority") {
        const target = a.value as Priority;
        if (PRIORITY_RANK[target] > PRIORITY_RANK[t.priority]) {
          done.push(`set priority to ${target}`);
          t.priority = target;
        }
      } else if (a.type === "set_group") {
        if (!groupSet) {
          t.groupId = a.value;
          groupSet = true;
          done.push(`set group to ${groupName(a.value)}`);
        }
      } else if (a.type === "add_tag") {
        if (!t.tags.includes(a.value)) t.tags.push(a.value);
        done.push(`added tag ${a.value}`);
      } else if (a.type === "notify_lead") {
        done.push("notified the lead");
      }
    }
    fired.push({ ruleId: trigger.id, detail: `Trigger "${trigger.name}" fired: ${done.length ? done.join(", ") : "no change needed"}.` });
  }
  return fired;
}

function slaPolicyFor(tier: Tier): SlaPolicy {
  return SLA_POLICIES.find((p) => p.match.every((c) => c.field === "customer.tier" && c.value === tier)) ?? SLA_POLICIES[SLA_POLICIES.length - 1]!;
}

// ---------------------------------------------------------------- assignment

function onShift(agent: Agent, ms: number): boolean {
  const { hour } = amsterdamParts(ms);
  const s = SHIFTS[agent.shift];
  return hour >= s.startHour && hour < s.endHour;
}

class RoundRobin {
  private counters = new Map<string, number>();
  next(key: string, candidates: Agent[], exclude?: string | null): Agent {
    const pool = candidates.filter((a) => a.id !== exclude);
    const list = pool.length ? pool : candidates;
    const n = this.counters.get(key) ?? 0;
    this.counters.set(key, n + 1);
    return list[n % list.length]!;
  }
}

function groupAgents(groupId: string | null, ms: number): Agent[] {
  const members = AGENTS.filter((a) => a.role === "agent" && (groupId === null || a.groupIds.includes(groupId)));
  const live = members.filter((a) => onShift(a, ms));
  return live.length ? live : members; // Out of hours: the on-call agent for the group picks it up.
}

function leadAt(ms: number): Agent {
  const leads = AGENTS.filter((a) => a.role === "lead");
  return leads.find((l) => onShift(l, ms)) ?? leads[0]!;
}

// ---------------------------------------------------------------- SLA instants

interface Segment { from: number; to: number } // intervals when the SLA clock runs

/** The instant when `minutes` business minutes have run across the active segments, or null. */
function instantAtActiveMinutes(segments: Segment[], minutes: number, policy: SlaPolicy): number | null {
  let left = minutes;
  for (const s of segments) {
    const end = addBusinessMinutes(s.from, left, policy.businessHours);
    if (end <= s.to) return end;
    left -= businessMinutesBetween(s.from, s.to, policy.businessHours);
  }
  return null;
}

function formatTarget(mins: number): string {
  return mins < 60 ? `${mins} min` : `${mins / 60} h`;
}

// ---------------------------------------------------------------- tickets

interface Ctx {
  rng: Rng;
  dataEndsAt: number;
  rr: RoundRobin;
}

function hex(rng: Rng): string {
  return Math.floor(rng() * 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function fill(rng: Rng, text: string): string {
  return text
    .replace(/\{product\}/g, () => pick(rng, PRODUCTS))
    .replace(/\{device\}/g, () => pick(rng, DEVICES))
    .replace(/\{key\}/g, () => `NW-${hex(rng)}-${hex(rng)}-${hex(rng)}`)
    .replace(/\{order\}/g, () => `NW-2026-${intBetween(rng, 100000, 999999)}`)
    .replace(/\{seats\}/g, () => String(pick(rng, [5, 10, 12, 20, 25, 40, 50])))
    .replace(/\{amount\}/g, () => `EUR ${intBetween(rng, 29, 899)}.${pick(rng, ["00", "95", "99"])}`);
}

/** Probability that a ticket breaches the first reply and the resolution target, by day index. */
function breachOdds(dayIndex: number): { first: number; resolution: number } {
  if (dayIndex < GO_LIVE_DAY_INDEX) return { first: 0.12, resolution: 0.075 };
  const t = Math.min(1, (dayIndex - GO_LIVE_DAY_INDEX) / 7); // falls over the first week, then holds
  return { first: 0.12 + (0.045 - 0.12) * t, resolution: 0.075 + (0.03 - 0.075) * t };
}

function reassignOdds(dayIndex: number): number {
  if (dayIndex < GO_LIVE_DAY_INDEX) return 0.12;
  const t = Math.min(1, (dayIndex - GO_LIVE_DAY_INDEX) / 5);
  return 0.12 + (0.03 - 0.12) * t;
}

/** What an event changes on the ticket. Fields are derived from the effects of the events that happened. */
interface Effects {
  status?: Status;
  assigneeId?: string;
  groupId?: string;
  tags?: string[];
}
interface RawEvent extends TicketEvent { ms: number; seq: number; fx?: Effects }
type Role = "owner" | "customer" | "system";
interface StatusStep { ms: number; to: Status; role: Role; detail?: (who: string) => string }

function buildTicket(ctx: Ctx, id: number, createdMs: number, dayIndex: number, customer: Customer): Ticket {
  const { rng } = ctx;
  const after = dayIndex >= GO_LIVE_DAY_INDEX;
  const channel = weighted(rng, CHANNEL_WEIGHTS);
  const category = weighted(rng, CATEGORY_WEIGHTS);
  const reported = weighted(rng, PRIORITY_WEIGHTS);
  const template = pick(rng, TEMPLATES[category]);
  const subject = fill(rng, template.subject);
  let body = fill(rng, template.body);
  if (rng() < (reported === "urgent" ? 0.4 : 0.02)) body += ` ${pick(rng, URGENT_SENTENCES)}`;

  const raw: RawEvent[] = [];
  const add = (ms: number, e: Omit<TicketEvent, "at">, fx?: Effects) =>
    raw.push({ ms, at: iso(ms), ...e, seq: raw.length, ...(fx ? { fx } : {}) });

  // ---- routing
  const draft: DraftTicket = { body, category, priority: reported, groupId: null, tags: [], tier: customer.tier, language: customer.language };
  if (after) {
    for (const f of runTriggers(draft)) {
      add(createdMs, { type: "rule_fired", actor: "system", detail: f.detail, ruleId: f.ruleId });
    }
  } else {
    draft.groupId = "tier1"; // Before go-live: one shared queue.
  }
  const routedGroup = draft.groupId ?? "tier1";
  // The created event carries the routing result, so the fields are right even before assignment.
  raw.unshift({
    ms: createdMs, at: iso(createdMs), seq: -1, type: "created", actor: "customer",
    detail: `Customer created the ticket by ${CHANNEL_LABEL[channel]}.`,
    fx: { status: "new", groupId: routedGroup, tags: [...draft.tags] },
  });

  const policy = slaPolicyFor(customer.tier);
  const target = policy.targets[draft.priority];
  const hours = policy.businessHours;
  const odds = breachOdds(dayIndex);
  const breachFirst = rng() < odds.first;
  const breachResolution = rng() < odds.resolution;

  // ---- first reply time
  const replyFraction = breachFirst
    ? between(rng, 1.05, 2.2)
    : after
      ? 0.04 + 0.7 * Math.pow(rng(), 1.4)
      : 0.18 + 0.8 * Math.pow(rng(), 0.8);
  const assignedMs = createdMs + intBetween(rng, 1, 12) * MINUTE_MS;
  let firstReplyMs = addBusinessMinutes(createdMs, Math.round(target.firstReplyMins * replyFraction), hours);
  if (firstReplyMs <= assignedMs + MINUTE_MS) firstReplyMs = assignedMs + intBetween(rng, 2, 10) * MINUTE_MS;

  const firstWarnMs = addBusinessMinutes(createdMs, target.firstReplyMins * 0.75, hours);
  const firstBreachMs = addBusinessMinutes(createdMs, target.firstReplyMins, hours);

  // ---- assignments: first owner, then reassignments before the first reply (and before any breach)
  const owners: Array<{ ms: number; agent: Agent; groupId: string }> = [];
  const queueKey = (g: string) => (after ? g : "shared");
  const poolFor = (g: string, ms: number) => (after ? groupAgents(g, ms) : groupAgents(null, ms));
  let owner = ctx.rr.next(queueKey(routedGroup), poolFor(routedGroup, assignedMs));
  owners.push({ ms: assignedMs, agent: owner, groupId: routedGroup });
  if (rng() < reassignOdds(dayIndex)) {
    const hops = rng() < 0.25 ? 2 : 1;
    const until = Math.min(firstReplyMs, firstBreachMs);
    let group = routedGroup;
    for (let i = 1; i <= hops; i++) {
      const hopMs = Math.round(assignedMs + ((until - assignedMs) * i) / (hops + 1));
      if (after && group !== "technical" && category !== "account_access" && rng() < 0.5) group = "technical";
      owner = ctx.rr.next(queueKey(group), poolFor(group, hopMs), owner.id);
      owners.push({ ms: hopMs, agent: owner, groupId: group });
    }
  }

  // ---- path from first reply to solved
  const segments: Segment[] = [];
  const steps: StatusStep[] = [];
  const oneTouch = !breachResolution && rng() < (after ? 0.4 : 0.3);
  const resolutionFraction = breachResolution
    ? between(rng, 1.05, 1.8)
    : after
      ? 0.04 + 0.55 * Math.pow(rng(), 2)
      : 0.08 + 0.7 * Math.pow(rng(), 1.5);
  let solveMs: number;
  if (oneTouch) {
    solveMs = firstReplyMs;
    segments.push({ from: createdMs, to: solveMs });
    steps.push({ ms: solveMs, to: "solved", role: "owner" });
  } else {
    segments.push({ from: createdMs, to: firstReplyMs });
    let cursor = firstReplyMs;
    if (rng() < 0.5) {
      steps.push({ ms: cursor, to: "pending", role: "owner" });
      cursor += (10 + Math.round(between(rng, 20, 30 * 60) * Math.pow(rng(), 0.6))) * MINUTE_MS;
      steps.push({ ms: cursor, to: "open", role: "customer", detail: () => "Customer replied. Status changed from Pending to Open." });
    } else {
      steps.push({ ms: cursor, to: "open", role: "owner" });
    }
    const holdOdds = category === "refund" ? 0.4 : category === "billing" ? 0.15 : 0.03;
    if (rng() < holdOdds) {
      steps.push({ ms: cursor, to: "on_hold", role: "owner", detail: (who) => `${who} put the ticket on hold until finance checks the payment. Status changed from Open to On-hold.` });
      cursor += Math.round(between(rng, 4 * 60, 3 * 24 * 60)) * MINUTE_MS;
      steps.push({ ms: cursor, to: "open", role: "owner", detail: () => "Finance replied. Status changed from On-hold to Open." });
    }
    const usedSoFar = target.firstReplyMins * replyFraction;
    const remaining = Math.max(5 + rng() * 40, target.resolutionMins * resolutionFraction - usedSoFar);
    solveMs = addBusinessMinutes(cursor, Math.round(remaining), hours);
    segments.push({ from: cursor, to: solveMs });
    steps.push({ ms: solveMs, to: "solved", role: "owner", detail: (who) => `${who} solved the ticket. Status changed from Open to Solved.` });
  }

  // ---- SLA warnings and breaches, derived from the planned timestamps
  type SlaHit = { ms: number; kind: "sla_warning" | "sla_breached"; which: "first reply" | "resolution" };
  const hits: SlaHit[] = [];
  if (firstReplyMs > firstWarnMs) hits.push({ ms: firstWarnMs, kind: "sla_warning", which: "first reply" });
  if (firstReplyMs > firstBreachMs) hits.push({ ms: firstBreachMs, kind: "sla_breached", which: "first reply" });
  const resWarnMs = instantAtActiveMinutes(segments, target.resolutionMins * 0.75, policy);
  const resBreachMs = instantAtActiveMinutes(segments, target.resolutionMins, policy);
  if (resWarnMs !== null && resWarnMs < solveMs) hits.push({ ms: resWarnMs, kind: "sla_warning", which: "resolution" });
  if (resBreachMs !== null && resBreachMs < solveMs) hits.push({ ms: resBreachMs, kind: "sla_breached", which: "resolution" });
  hits.sort((a, b) => a.ms - b.ms);

  let warned = false;
  let breached = false;
  for (const h of hits) {
    const mins = h.which === "first reply" ? target.firstReplyMins : target.resolutionMins;
    add(h.ms, {
      type: h.kind,
      actor: "system",
      ruleId: policy.id,
      detail: h.kind === "sla_warning"
        ? `${policy.name} SLA warning: 25% of the ${formatTarget(mins)} ${h.which} target is left.`
        : `${policy.name} SLA breached: the ${formatTarget(mins)} ${h.which} target has passed.`,
    });
    if (!after) continue; // No escalation rules before go-live.
    if (h.kind === "sla_warning" && !warned) {
      warned = true;
      add(h.ms, { type: "escalated", actor: "system", ruleId: "e1", detail: "Escalation rule \"SLA warning\" fired: notified the lead, added tag sla_risk." }, { tags: ["sla_risk"] });
    }
    if (h.kind === "sla_breached" && !breached) {
      breached = true;
      // Section 6.4: set group Escalations and notify the lead. The assignee stays, so the lead can coach.
      add(h.ms, { type: "escalated", actor: "system", ruleId: "e2", detail: `Escalation rule "SLA breached" fired: set group to Escalations, notified the lead (${leadAt(h.ms).name}).` }, { groupId: "escalations" });
    }
  }
  const anyBreach = hits.some((h) => h.kind === "sla_breached");

  // ---- reopens (after the first solve), CSAT, auto close
  let lastSolveMs = solveMs;
  const reopenRoll = rng();
  const reopens = reopenRoll < 0.012 ? 2 : reopenRoll < 0.06 ? 1 : 0;
  for (let i = 1; i <= reopens; i++) {
    const reopenMs = lastSolveMs + Math.round(between(rng, 3 * 60, 3 * 24 * 60)) * MINUTE_MS;
    steps.push({ ms: reopenMs, to: "open", role: "customer", detail: () => "Customer replied after the ticket was solved. Status changed from Solved to Open." });
    if (after && i === 2) {
      add(reopenMs, { type: "escalated", actor: "system", ruleId: "e3", detail: "Escalation rule \"Reopened twice\" fired: added tag repeat_contact, notified the lead." }, { tags: ["repeat_contact"] });
    }
    lastSolveMs = addBusinessMinutes(reopenMs, intBetween(rng, 20, 300), hours);
    steps.push({ ms: lastSolveMs, to: "solved", role: "owner", detail: (who) => `${who} solved the ticket again. Status changed from Open to Solved.` });
  }

  let csat: Ticket["csat"] = null;
  const csatMs = lastSolveMs + Math.round(between(rng, 60, 72 * 60)) * MINUTE_MS;
  const wantsCsat = rng() < 0.27;
  if (wantsCsat) {
    const goodOdds = (after ? 0.88 : 0.85) - (anyBreach ? 0.2 : 0) - (reopens > 0 ? 0.15 : 0);
    const score = rng() < goodOdds ? "good" : "bad";
    const comment = rng() < 0.5 ? pick(rng, CSAT_COMMENTS[score]) : undefined;
    csat = comment ? { score, comment } : { score };
    add(csatMs, { type: "csat_received", actor: "customer", detail: `Customer rated the support ${score}${comment ? `: "${comment}"` : "."}` });
    if (after && score === "bad") {
      add(csatMs, { type: "escalated", actor: "system", ruleId: "e4", detail: "Escalation rule \"Bad CSAT\" fired: added tag csat_followup." }, { tags: ["csat_followup"] });
      add(csatMs, { type: "internal_note", actor: "system", ruleId: "e4", detail: "Lead to review within 1 business day." });
    }
  }
  const closeMs = Math.max(lastSolveMs, wantsCsat ? csatMs : 0) + 4 * 24 * 60 * MINUTE_MS;
  steps.push({ ms: closeMs, to: "closed", role: "system", detail: () => "Ticket closed automatically 4 days after it was solved. Status changed from Solved to Closed." });

  // ---- write assignment, reply and status events, with the owner at each moment
  owners.sort((a, b) => a.ms - b.ms);
  const ownerAt = (ms: number) => [...owners].reverse().find((o) => o.ms <= ms)?.agent ?? owners[0]!.agent;
  owners.forEach((o, i) => {
    add(o.ms, {
      type: "assigned",
      actor: "system",
      detail: `${i === 0 ? "Assigned" : "Reassigned"} to ${o.agent.name} in ${groupName(o.groupId)}.`,
    }, { assigneeId: o.agent.id, groupId: o.groupId });
  });
  const replier = ownerAt(firstReplyMs);
  add(firstReplyMs, { type: "public_reply", actor: replier.id, detail: `${replier.name} sent a public reply.` });

  let status: Status = "new";
  for (const s of steps) {
    if (s.to === status) continue;
    const who = s.role === "owner" ? ownerAt(s.ms) : null;
    const actor = who ? who.id : s.role;
    if (s.role === "owner" && s.to === "solved" && s.ms !== firstReplyMs) {
      add(s.ms, { type: "public_reply", actor, detail: `${who!.name} sent a public reply.` });
    }
    add(s.ms, {
      type: "status_changed",
      actor,
      detail: s.detail ? s.detail(who?.name ?? "") : `Status changed from ${STATUS_LABEL[status]} to ${STATUS_LABEL[s.to]}.`,
    }, { status: s.to });
    status = s.to;
  }

  // ---- cut at the end of the period; derive fields from what happened
  const kept = raw
    .filter((e) => e.ms < ctx.dataEndsAt)
    .sort((a, b) => a.ms - b.ms || a.seq - b.seq);
  let finalStatus: Status = "new";
  let solvedAt: string | null = null;
  let assigneeId: string | null = null;
  let groupId: string | null = null;
  const tags: string[] = [];
  for (const e of kept) {
    if (e.fx?.status) {
      finalStatus = e.fx.status;
      if (finalStatus === "solved") solvedAt = e.at;
      else if (finalStatus !== "closed") solvedAt = null;
    }
    if (e.fx?.assigneeId) assigneeId = e.fx.assigneeId;
    if (e.fx?.groupId) groupId = e.fx.groupId;
    for (const t of e.fx?.tags ?? []) if (!tags.includes(t)) tags.push(t);
  }
  const events: TicketEvent[] = kept.map((e) => ({
    at: e.at, type: e.type, actor: e.actor, detail: e.detail, ...(e.ruleId ? { ruleId: e.ruleId } : {}),
  }));

  return {
    id,
    subject,
    body,
    channel,
    category,
    priority: draft.priority,
    status: finalStatus,
    customerId: customer.id,
    groupId,
    assigneeId,
    tags,
    createdAt: iso(createdMs),
    firstReplyAt: events.find((e) => e.type === "public_reply")?.at ?? null,
    solvedAt,
    slaPolicyId: policy.id,
    events,
    csat: events.some((e) => e.type === "csat_received") ? csat : null,
  };
}

// ---------------------------------------------------------------- main

export function generate(options: GeneratorOptions): SeedData {
  const seed = options.seed ?? SEED;
  const rng: Rng = seedrandom(seed);
  const end = parseDate(options.endDate);
  const days = Array.from({ length: DAYS }, (_, i) => {
    const dt = new Date(Date.UTC(end.y, end.m - 1, end.d - (DAYS - 1 - i)));
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), weekday: dt.getUTCDay() };
  });
  const first = days[0]!;
  const dataEndsAt = amsterdamToUtc(end.y, end.m, end.d + 1);

  const customers = makeCustomers(rng);

  // Creation times: volume per day and hourly shape (Amsterdam time).
  const created: Array<{ ms: number; dayIndex: number }> = [];
  days.forEach((day, dayIndex) => {
    const weekend = day.weekday === 0 || day.weekday === 6;
    const count = weekend ? intBetween(rng, 50, 80) : intBetween(rng, 120, 180);
    const hourItems = HOUR_WEIGHTS.map((w, h) => [h, weekend && h >= 9 && h <= 16 ? w * 0.8 : w] as [number, number]);
    for (let i = 0; i < count; i++) {
      const hour = weighted(rng, hourItems);
      const ms = amsterdamToUtc(day.y, day.m, day.d, hour, intBetween(rng, 0, 59)) + intBetween(rng, 0, 59) * 1000;
      created.push({ ms, dayIndex });
    }
  });
  created.sort((a, b) => a.ms - b.ms);

  const slots = customerSlots(rng, customers, created.length);
  const ctx: Ctx = { rng, dataEndsAt, rr: new RoundRobin() };
  const tickets = created.map((c, i) => buildTicket(ctx, 10001 + i, c.ms, c.dayIndex, slots[i]!));

  const goLive = days[GO_LIVE_DAY_INDEX]!;
  return {
    meta: {
      seed,
      startDate: dateString(first.y, first.m, first.d),
      endDate: dateString(end.y, end.m, end.d),
      goLiveDate: dateString(goLive.y, goLive.m, goLive.d),
      dataEndsAt: iso(dataEndsAt),
      ticketCount: tickets.length,
    },
    groups: GROUPS,
    agents: AGENTS,
    customers,
    tickets,
  };
}

/** Stable text form: one customer or ticket per line, so git diffs stay readable. */
export function serialize(data: SeedData): string {
  const lines = (items: unknown[]) => items.map((x) => `    ${JSON.stringify(x)}`).join(",\n");
  return [
    "{",
    `  "meta": ${JSON.stringify(data.meta)},`,
    `  "groups": ${JSON.stringify(data.groups)},`,
    `  "agents": ${JSON.stringify(data.agents)},`,
    `  "customers": [\n${lines(data.customers)}\n  ],`,
    `  "tickets": [\n${lines(data.tickets)}\n  ]`,
    "}",
    "",
  ].join("\n");
}

/** The day before a given date, YYYY-MM-DD. */
export function dayBefore(date: Date): string {
  const p = amsterdamParts(date.getTime());
  return dateString(p.year, p.month, p.day - 1);
}
