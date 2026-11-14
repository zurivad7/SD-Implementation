import { afterUpdate, changeStatus, createTicket, tick } from "../src/engine/desk";
import { slaTimer } from "../src/engine/sla";
import { config, customer, MIN } from "./fixtures";

const NOW = Date.parse("2026-11-09T10:00:00Z"); // Monday 11:00 Amsterdam

describe("ticket pipeline", () => {
  const preset = { subject: "License server failure", body: "Activation fails for everyone. Our whole team cannot work.", channel: "phone" as const, category: "license_activation" as const };

  it("creates, routes, picks the SLA and assigns an enterprise urgent ticket", () => {
    const r = createTicket(30001, preset, customer("enterprise"), config, {}, NOW);
    const t = r.ticket;
    expect(t.priority).toBe("urgent");
    expect(t.groupId).toBe("escalations");
    expect(t.slaPolicyId).toBe("sla_enterprise");
    expect(["a09", "a10"]).toContain(t.assigneeId);
    expect(t.events.map((e) => e.detail)).toEqual([
      "Customer created the ticket by phone.",
      'Trigger "Enterprise fast lane" fired: set priority to high, added tag vip, set group to Escalations.',
      'Trigger "Urgent keywords" fired: set priority to urgent, notified the lead.',
      'Trigger "Activation and install" fired: no change needed.',
      "Assigned to Mila Brouwer in Escalations.",
    ]);
    expect(r.notifications).toHaveLength(1);
    expect(r.rr).toEqual({ escalations: 1 });
  });

  it("moves through warning and breach as the clock advances", () => {
    let t = createTicket(30001, preset, customer("enterprise"), config, {}, NOW).ticket;
    const policy = config.slaPolicies[0]!;
    const states: string[] = [];
    for (const m of [0, 15, 23, 30, 45]) {
      t = tick(t, config, NOW + m * MIN).ticket;
      states.push(slaTimer(t, policy, "first_reply", NOW + m * MIN).state);
    }
    expect(states).toEqual(["ok", "ok", "warning", "breached", "breached"]);
  });

  it("reassigns when an update moves the ticket to a group the assignee is not in", () => {
    const created = createTicket(30002, { ...preset, body: "Please help.", category: "billing" }, customer(), config, {}, NOW);
    expect(created.ticket.groupId).toBe("billing");
    const changed = { ...changeStatus(created.ticket, "open", "a05", NOW + MIN), category: "license_activation" as const };
    const r = afterUpdate(changed, customer(), config, created.rr, NOW + 2 * MIN);
    expect(r.ticket.groupId).toBe("technical");
    expect(r.ticket.events.at(-1)?.detail).toMatch(/^Reassigned to .+ in Technical\.$/);
  });
});
