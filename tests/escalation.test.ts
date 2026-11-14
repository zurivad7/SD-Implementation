import { changeStatus, createTicket, receiveCsat, tick } from "../src/engine/desk";
import type { Ticket } from "../src/types";
import { config, customer, MIN } from "./fixtures";

const NOW = Date.parse("2026-11-09T10:00:00Z"); // Monday 11:00 Amsterdam
const fires = (t: Ticket, id: string) => t.events.filter((e) => e.type === "escalated" && e.ruleId === id).length;

function enterpriseUrgent(): Ticket {
  return createTicket(30001, { subject: "Activation fails", body: "Our team cannot work.", channel: "email", category: "license_activation" }, customer("enterprise"), config, {}, NOW).ticket;
}

describe("escalation rules fire once, not on every tick", () => {
  it("SLA warning: notify lead and add tag sla_risk, once", () => {
    let t = enterpriseUrgent();
    const notes: string[] = [];
    for (const m of [10, 23, 24, 25, 26]) {
      const r = tick(t, config, NOW + m * MIN);
      t = r.ticket;
      notes.push(...r.notifications.map((n) => n.message));
    }
    expect(fires(t, "e1")).toBe(1);
    expect(t.tags).toContain("sla_risk");
    expect(notes.filter((n) => n.includes("SLA warning"))).toHaveLength(1);
  });

  it("SLA breached: set group Escalations and notify lead, once", () => {
    let t: Ticket = { ...enterpriseUrgent(), groupId: "technical" };
    for (const m of [31, 40, 90, 200]) t = tick(t, config, NOW + m * MIN).ticket;
    expect(fires(t, "e2")).toBe(1);
    expect(t.groupId).toBe("escalations");
    const e2 = t.events.find((e) => e.ruleId === "e2")!;
    expect(e2.at).toBe("2026-11-09T10:30:00Z"); // stamped at the breach, not at the tick
  });

  it("Reopened twice: add tag repeat_contact and notify lead, once", () => {
    let t = enterpriseUrgent();
    const steps: Array<[Ticket["status"], number]> = [["solved", 5], ["open", 10], ["solved", 15], ["open", 20], ["solved", 25], ["open", 28]];
    const counts: number[] = [];
    for (const [to, m] of steps) {
      t = changeStatus(t, to, "a09", NOW + m * MIN);
      t = tick(t, config, NOW + m * MIN).ticket;
      counts.push(fires(t, "e3"));
    }
    expect(counts).toEqual([0, 0, 0, 1, 1, 1]);
    expect(t.tags).toContain("repeat_contact");
  });

  it("Bad CSAT: add tag csat_followup and an internal note, once", () => {
    let t = changeStatus(enterpriseUrgent(), "solved", "a09", NOW + 5 * MIN);
    t = receiveCsat(t, "bad", NOW + 60 * MIN);
    for (const m of [60, 61, 120]) t = tick(t, config, NOW + m * MIN).ticket;
    expect(fires(t, "e4")).toBe(1);
    expect(t.tags).toContain("csat_followup");
    expect(t.events.filter((e) => e.type === "internal_note").map((e) => e.detail)).toEqual(["Lead to review within 1 business day."]);
  });

  it("good CSAT does not escalate", () => {
    let t = receiveCsat(changeStatus(enterpriseUrgent(), "solved", "a09", NOW + 5 * MIN), "good", NOW + 60 * MIN);
    t = tick(t, config, NOW + 61 * MIN).ticket;
    expect(fires(t, "e4")).toBe(0);
  });
});
