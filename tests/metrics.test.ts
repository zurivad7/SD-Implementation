// Metrics on a 10-ticket fixture. Every expected value is worked out by hand in the comments.
import { GROUPS, SLA_POLICIES } from "../src/data/config";
import {
  backlogAt, byGroup, computeKpis, dailySeries, endOfDay, filterTickets, firstReplyMins, median, resolutionMins, splitByGoLive,
} from "../src/engine/metrics";
import type { Customer, Ticket, TicketEvent } from "../src/types";
import { ev, ticket } from "./fixtures";

// T1 to T9: Enterprise policy (24x7), created Monday 2 Nov 2026 at 10:00 UTC (11:00 Amsterdam).
const D = "2026-11-02T";
const at = (hhmm: string) => `${D}${hhmm}:00Z`;
const created = at("10:00");

function mk(id: number, extra: Partial<Ticket>, events: TicketEvent[]): Ticket {
  return ticket({
    id, createdAt: created, slaPolicyId: "sla_enterprise", groupId: "tier1",
    events: [{ at: created, type: "created", actor: "customer", detail: "Customer created the ticket by email." }, ...events],
    ...extra,
  });
}

const T: Ticket[] = [
  // T1: reply after 30 min, solved at 60 min with that one reply. CSAT good.
  mk(1, { status: "solved", firstReplyAt: at("10:30"), solvedAt: at("11:00"), csat: { score: "good" } },
    [ev.assigned(at("10:01")), ev.reply(at("10:30")), ev.status(at("10:30"), "new", "open"), ev.status(at("11:00"), "open", "solved"), ev.csat(at("12:00"), "good")]),
  // T2: reply at 60, pending 11:00 to 13:00, solved 14:00 with a 2nd reply. Resolution 60 + 60 = 120. Reassigned. Breached.
  mk(2, { status: "solved", firstReplyAt: at("11:00"), solvedAt: at("14:00") },
    [ev.assigned(at("10:01")), ev.assigned(at("10:20")), ev.breached(at("10:30")), ev.reply(at("11:00")), ev.status(at("11:00"), "new", "pending"),
      ev.status(at("13:00"), "pending", "open"), ev.reply(at("14:00")), ev.status(at("14:00"), "open", "solved")]),
  // T3: one-touch at 10 min. Resolution 10. CSAT bad.
  mk(3, { status: "solved", firstReplyAt: at("10:10"), solvedAt: at("10:10"), csat: { score: "bad" } },
    [ev.assigned(at("10:01")), ev.reply(at("10:10")), ev.status(at("10:10"), "new", "solved"), ev.csat(at("11:00"), "bad")]),
  // T4: reply at 120, breached, still open.
  mk(4, { status: "open", firstReplyAt: at("12:00") },
    [ev.assigned(at("10:01")), ev.breached(at("11:00")), ev.reply(at("12:00")), ev.status(at("12:00"), "new", "open")]),
  // T5: no SLA policy, no reply, still new, never assigned.
  mk(5, { slaPolicyId: null }, []),
  // T6: reply at 20, solved 12:20 with a 2nd reply. Resolution 140. CSAT good. Billing.
  mk(6, { groupId: "billing", status: "solved", firstReplyAt: at("10:20"), solvedAt: at("12:20"), csat: { score: "good" } },
    [ev.assigned(at("10:01")), ev.reply(at("10:20")), ev.status(at("10:20"), "new", "open"), ev.reply(at("12:20")), ev.status(at("12:20"), "open", "solved"), ev.csat(at("13:00"), "good")]),
  // T7: reply at 40, on-hold 10:40 to 12:40 (counts: only pending is excluded), solved 13:40. Resolution 220. CSAT good. Billing.
  mk(7, { groupId: "billing", status: "solved", firstReplyAt: at("10:40"), solvedAt: at("13:40"), csat: { score: "good" } },
    [ev.assigned(at("10:01")), ev.reply(at("10:40")), ev.status(at("10:40"), "new", "on_hold"), ev.status(at("12:40"), "on_hold", "open"),
      ev.reply(at("13:40")), ev.status(at("13:40"), "open", "solved"), ev.csat(at("14:00"), "good")]),
  // T8: chat, one-touch at 5 min, later closed. Resolution 5. Assigned 3 times. Billing.
  mk(8, { channel: "chat", groupId: "billing", status: "closed", firstReplyAt: at("10:05"), solvedAt: at("10:05") },
    [ev.assigned(at("10:01")), ev.assigned(at("10:02")), ev.assigned(at("10:03")), ev.reply(at("10:05")), ev.status(at("10:05"), "new", "solved"), ev.status(at("20:00"), "solved", "closed")]),
  // T9: reply at 50, pending 10:50 to 11:50, solved from pending with a 2nd reply. Resolution 50. Billing.
  mk(9, { groupId: "billing", status: "solved", firstReplyAt: at("10:50"), solvedAt: at("11:50") },
    [ev.assigned(at("10:01")), ev.reply(at("10:50")), ev.status(at("10:50"), "new", "pending"), ev.reply(at("11:50")), ev.status(at("11:50"), "pending", "solved")]),
  // T10: Standard policy (Mon to Fri, 08:00 to 20:00 Amsterdam). Created Fri 6 Nov 19:00 Amsterdam,
  // reply Mon 9 Nov 08:30 Amsterdam: 60 + 30 = 90 business minutes. Open. Technical.
  ticket({
    id: 10, createdAt: "2026-11-06T18:00:00Z", slaPolicyId: "sla_standard", groupId: "technical", status: "open", firstReplyAt: "2026-11-09T07:30:00Z",
    events: [
      { at: "2026-11-06T18:00:00Z", type: "created", actor: "customer", detail: "Customer created the ticket by email." },
      ev.assigned("2026-11-06T18:01:00Z"), ev.reply("2026-11-09T07:30:00Z"), ev.status("2026-11-09T07:30:00Z", "new", "open"),
    ],
  }),
];

describe("metrics on a 10-ticket fixture", () => {
  it("per-ticket first reply and resolution times", () => {
    expect(T.map((t) => firstReplyMins(t, SLA_POLICIES))).toEqual([30, 60, 10, 120, null, 20, 40, 5, 50, 90]);
    expect(T.map((t) => resolutionMins(t, SLA_POLICIES))).toEqual([60, 120, 10, null, null, 140, 220, 5, 50, null]);
  });

  it("each KPI matches the hand-computed value", () => {
    expect(computeKpis(T, SLA_POLICIES)).toEqual({
      ticketsCreated: 10,
      // first replies sorted: 5 10 20 30 40 50 60 90 120, middle value 40
      medianFirstReplyMins: 40,
      // resolutions sorted: 5 10 50 60 120 140 220, middle value 60
      medianResolutionMins: 60,
      // breached T2, T4 / 9 tickets with a policy (T5 has none)
      slaBreachRate: 2 / 9,
      // good T1, T6, T7 / rated T1, T3, T6, T7
      csat: 3 / 4,
      // more than 1 assigned event: T2, T8 / 10
      reassignmentRate: 2 / 10,
      // solved T1 T2 T3 T6 T7 T8 T9; exactly 1 public reply: T1, T3, T8
      oneTouchRate: 3 / 7,
    });
  });

  it("backlog at the end of each day", () => {
    expect(backlogAt(T, endOfDay("2026-11-02"))).toBe(2); // T4 open, T5 new
    expect(backlogAt(T, endOfDay("2026-11-06"))).toBe(3); // plus T10
    expect(backlogAt(T, Date.parse(at("10:30")))).toBe(7); // T1 to T9 exist; T3 and T8 are already solved
  });

  it("median of an even list is the mean of the two middle values", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("returns null rates for empty sets instead of dividing by zero", () => {
    expect(computeKpis([], SLA_POLICIES)).toMatchObject({ ticketsCreated: 0, slaBreachRate: null, csat: null, oneTouchRate: null });
  });

  it("table by group", () => {
    expect(byGroup(T, GROUPS, SLA_POLICIES)).toEqual([
      // T1 to T5: replies 30 60 10 120 -> median 45; breaches T2, T4 / 4 with policy
      { groupId: "tier1", name: "Tier 1", volume: 5, medianFirstReplyMins: 45, breachRate: 0.5 },
      // T6 to T9: replies 20 40 5 50 -> median 30
      { groupId: "billing", name: "Billing", volume: 4, medianFirstReplyMins: 30, breachRate: 0 },
      { groupId: "technical", name: "Technical", volume: 1, medianFirstReplyMins: 90, breachRate: 0 },
      { groupId: "escalations", name: "Escalations", volume: 0, medianFirstReplyMins: null, breachRate: null },
    ]);
  });

  it("daily series", () => {
    const days = dailySeries(T, ["2026-11-02", "2026-11-06"], SLA_POLICIES);
    expect(days[0]).toMatchObject({ day: "2026-11-02", created: 9, breachRate: 2 / 8, medianFirstReplyMins: 35, backlog: 2, byChannel: { email: 8, chat: 1, web_form: 0, phone: 0 } });
    expect(days[1]).toMatchObject({ day: "2026-11-06", created: 1, breachRate: 0, medianFirstReplyMins: 90, backlog: 3 });
  });

  it("filters by channel, group, tier and date, and splits at go-live", () => {
    const customers: Record<string, Customer> = { c1: { id: "c1", name: "A", email: "a@example.com", tier: "standard", language: "en" } };
    expect(filterTickets(T, { channels: ["chat"] }, customers).map((t) => t.id)).toEqual([8]);
    expect(filterTickets(T, { groupIds: ["billing"] }, customers).map((t) => t.id)).toEqual([6, 7, 8, 9]);
    expect(filterTickets(T, { tiers: ["enterprise"] }, customers)).toEqual([]);
    expect(filterTickets(T, { from: "2026-11-03" }, customers).map((t) => t.id)).toEqual([10]);
    expect(filterTickets(T, {}, customers)).toHaveLength(10);
    const split = splitByGoLive(T, "2026-11-05");
    expect([split.before.length, split.after.length]).toEqual([9, 1]);
  });
});
