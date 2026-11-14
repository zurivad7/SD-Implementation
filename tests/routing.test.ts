import { TRIGGERS } from "../src/data/config";
import { assignRoundRobin, containsPhrase, runTriggers } from "../src/engine/routing";
import type { Customer, Ticket } from "../src/types";
import { ams, config, customer, ticket } from "./fixtures";

const NOW = Date.parse("2026-11-09T09:00:00Z");
const fired = (t: Ticket, c: Customer, triggers = TRIGGERS) => runTriggers(t, c, triggers, config.groups, NOW).fired.map((f) => f.ruleId);

describe("routing: each trigger fires on a match and not on a non-match", () => {
  const cases: Array<[string, string, [Ticket, Customer], [Ticket, Customer]]> = [
    ["t1", "Enterprise fast lane", [ticket(), customer("enterprise")], [ticket(), customer("business")]],
    ["t2", "Urgent keywords", [ticket({ body: "Our license server is down." }), customer()], [ticket({ body: "The download link expired." }), customer()]],
    ["t2", "Urgent keywords (outage)", [ticket({ body: "We have an outage." }), customer()], [ticket({ body: "All good, just a question." }), customer()]],
    ["t2", "Urgent keywords (cannot work)", [ticket({ body: "My team cannot work today." }), customer()], [ticket({ body: "I cannot log in." }), customer()]],
    ["t3", "Refund requests", [ticket({ category: "refund" }), customer()], [ticket({ category: "billing" }), customer()]],
    ["t4", "Billing", [ticket({ category: "billing" }), customer()], [ticket({ category: "refund" }), customer()]],
    ["t5", "Activation and install (activation)", [ticket({ category: "license_activation" }), customer()], [ticket({ category: "other" }), customer()]],
    ["t5", "Activation and install (install)", [ticket({ category: "download_install" }), customer()], [ticket({ category: "account_access" }), customer()]],
    ["t6", "Account access", [ticket({ category: "account_access" }), customer()], [ticket({ category: "billing" }), customer()]],
    ["t7", "Dutch language", [ticket(), customer("standard", "nl")], [ticket(), customer("standard", "de")]],
    ["t8", "Catch-all", [ticket({ category: "other" }), customer()], [ticket({ category: "billing" }), customer()]],
  ];
  it.each(cases)("%s %s", (id, _name, [mt, mc], [nt, nc]) => {
    expect(fired(mt, mc)).toContain(id);
    expect(fired(nt, nc)).not.toContain(id);
  });
});

describe("routing: actions and order", () => {
  it("the first set_group wins: enterprise refund goes to Escalations, still tagged refund", () => {
    const r = runTriggers(ticket({ category: "refund" }), customer("enterprise"), TRIGGERS, config.groups, NOW);
    expect(r.ticket.groupId).toBe("escalations");
    expect(r.ticket.tags).toEqual(["vip", "refund"]);
    expect(r.fired.map((f) => f.ruleId)).toEqual(["t1", "t3"]);
    expect(r.fired[1]!.detail).toBe('Trigger "Refund requests" fired: added tag refund.');
  });

  it("respects a changed order", () => {
    const reordered = TRIGGERS.map((t) => (t.id === "t3" ? { ...t, order: 0 } : t));
    const r = runTriggers(ticket({ category: "refund" }), customer("enterprise"), reordered, config.groups, NOW);
    expect(r.ticket.groupId).toBe("billing");
    expect(r.fired.map((f) => f.ruleId)).toEqual(["t3", "t1"]);
  });

  it("skips inactive triggers", () => {
    const off = TRIGGERS.map((t) => (t.id === "t4" ? { ...t, active: false } : t));
    const r = runTriggers(ticket({ category: "billing" }), customer(), off, config.groups, NOW);
    expect(r.ticket.groupId).toBe("tier1"); // falls through to the catch-all
  });

  it("raises priority but never lowers it", () => {
    expect(runTriggers(ticket({ priority: "low" }), customer("enterprise"), TRIGGERS, config.groups, NOW).ticket.priority).toBe("high");
    expect(runTriggers(ticket({ priority: "urgent" }), customer("enterprise"), TRIGGERS, config.groups, NOW).ticket.priority).toBe("urgent");
  });

  it("writes plain-English timeline lines and a lead notification", () => {
    const r = runTriggers(ticket({ body: "Server is down." }), customer(), TRIGGERS, config.groups, NOW);
    expect(r.ticket.events.find((e) => e.ruleId === "t2")?.detail).toBe('Trigger "Urgent keywords" fired: set priority to urgent, notified the lead.');
    expect(r.notifications).toHaveLength(1);
  });

  it("fires each trigger once per ticket, even when it runs again on update", () => {
    const first = runTriggers(ticket({ category: "billing" }), customer("standard", "nl"), TRIGGERS, config.groups, NOW);
    const second = runTriggers(first.ticket, customer("standard", "nl"), TRIGGERS, config.groups, NOW + 60_000);
    expect(second.fired).toEqual([]);
    expect(second.ticket.events).toEqual(first.ticket.events);
  });

  it("matches keywords as whole words", () => {
    expect(containsPhrase("It is DOWN again", "down")).toBe(true);
    expect(containsPhrase("downloads are slow", "down")).toBe(false);
  });
});

describe("routing: round-robin assignment", () => {
  it("assigns to on-shift agents in the group, in turn", () => {
    const at = ams("2026-11-09 13:00"); // early and late Billing agents are both on shift
    let rr = {};
    const names: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = assignRoundRobin(ticket({ groupId: "billing" }), config.agents, config.groups, config.shifts, rr, at);
      rr = r.rr;
      names.push(r.ticket.assigneeId!);
      expect(r.ticket.events.at(-1)?.type).toBe("assigned");
    }
    expect(names).toEqual(["a05", "a06", "a05"]);
  });

  it("only picks agents whose shift is on", () => {
    const r = assignRoundRobin(ticket({ groupId: "billing", createdAt: "2026-11-09T07:30:00Z" }), config.agents, config.groups, config.shifts, { billing: 1 }, ams("2026-11-09 09:00"));
    expect(r.ticket.assigneeId).toBe("a05"); // the late agent starts at 12:00
    expect(r.ticket.events.at(-1)?.detail).toBe("Assigned to Priya Shah in Billing.");
  });

  it("falls back to the group's on-call agents out of hours", () => {
    const r = assignRoundRobin(ticket({ groupId: "escalations" }), config.agents, config.groups, config.shifts, {}, ams("2026-11-09 23:00"));
    expect(["a09", "a10"]).toContain(r.ticket.assigneeId);
  });
});
