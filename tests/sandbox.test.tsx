import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "../src/App";
import { ROUTER_FUTURE } from "../src/routerFuture";
import { STORAGE_KEY, useDesk } from "../src/store/useDesk";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

function createPreset(label: string) {
  fireEvent.change(screen.getByLabelText("Example scenario"), { target: { value: label } });
  click("Fill example");
  click("Create ticket");
}

beforeEach(() => {
  localStorage.clear();
  act(() => useDesk.getState().reset());
});

describe("sandbox", () => {
  it("opens on a weekday at 09:00 Amsterdam, after the seed data", () => {
    renderAt("/sandbox");
    expect(screen.getByTestId("sandbox-time")).toHaveTextContent("Mon, 16 Nov 2026, 09:00");
    expect(screen.getByText(/No sandbox tickets yet/)).toBeInTheDocument();
  });

  it("creates a preset enterprise ticket: the timeline shows Enterprise fast lane and an assignee", () => {
    renderAt("/sandbox");
    createPreset("enterprise-urgent");
    expect(screen.getByRole("heading", { level: 1, name: /Ticket #14551/ })).toBeInTheDocument();
    const timeline = screen.getByTestId("timeline");
    expect(within(timeline).getByText(/Trigger "Enterprise fast lane" fired/)).toBeInTheDocument();
    expect(within(timeline).getByText(/^Assigned to .+ in Escalations\.$/)).toBeInTheDocument();
    expect(screen.getByTestId("field-group")).toHaveTextContent("Escalations");
    expect(screen.getByTestId("field-priority")).toHaveTextContent("Urgent");
    expect(screen.getByTestId("field-tags")).toHaveTextContent("vip");
    expect(screen.getByRole("status")).toHaveTextContent(/Lead notified by trigger "Urgent keywords"/);
  });

  it("+1 h turns the resolution badge amber, then red, and writes the events", () => {
    renderAt("/sandbox");
    createPreset("enterprise-urgent");
    const states: string[] = [];
    for (let i = 0; i < 4; i++) {
      click("+1 h");
      states.push(screen.getByTestId("sla-resolution").getAttribute("data-state")!);
    }
    expect(states).toEqual(["ok", "ok", "warning", "breached"]); // 4 h target: 25% left after 3 h
    expect(screen.getByTestId("sla-first_reply")).toHaveAttribute("data-state", "breached");
    expect(screen.getByTestId("sla-resolution")).toHaveTextContent("Resolution: Breached");
    const timeline = screen.getByTestId("timeline");
    expect(within(timeline).getAllByText(/SLA warning: 25% of the/)).toHaveLength(2);
    expect(within(timeline).getByText(/Escalation rule "SLA warning" fired/)).toBeInTheDocument();
  });

  it("applies a macro: the reply fills in the name and the status goes to pending", () => {
    renderAt("/sandbox");
    createPreset("dutch-account");
    fireEvent.change(screen.getByLabelText("Macro"), { target: { value: "m6" } });
    click("Apply macro");
    expect(screen.getByTestId("field-status")).toHaveTextContent("Pending");
    expect(screen.getByText(/sent a public reply: "Hi Iris van den Berg/)).toBeInTheDocument();
    expect(screen.getByTestId("sla-first_reply")).toHaveAttribute("data-state", "met");
    expect(screen.getByTestId("sla-resolution")).toHaveTextContent("paused");
  });

  it("bad CSAT adds the follow-up tag and the lead note", () => {
    renderAt("/sandbox");
    createPreset("billing-double");
    fireEvent.change(screen.getByLabelText("Macro"), { target: { value: "m3" } });
    click("Apply macro");
    click("Rate bad");
    expect(screen.getByTestId("field-tags")).toHaveTextContent("csat_followup");
    expect(screen.getByText("Lead to review within 1 business day.")).toBeInTheDocument();
  });

  it("saves to localStorage and resets to the seed state", () => {
    renderAt("/sandbox");
    createPreset("install-low");
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"tickets":[{');
    click("+1 day");
    click("Reset sandbox");
    click("Yes, reset");
    expect(useDesk.getState().tickets).toEqual([]);
    expect(useDesk.getState().nextId).toBe(14551);
    expect(screen.getByTestId("sandbox-time")).toHaveTextContent("Mon, 16 Nov 2026, 09:00");
  });

  it("creates a ticket for a new customer", () => {
    renderAt("/sandbox");
    fireEvent.click(screen.getByLabelText("New customer"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Noor Visser" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "noor@example.com" } });
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "nl" } });
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Question" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "How do I export my files?" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "other" } });
    click("Create ticket");
    expect(screen.getByTestId("field-customer")).toHaveTextContent("Noor Visser (Standard, Dutch)");
    expect(screen.getByTestId("field-tags")).toHaveTextContent("lang_nl");
    expect(screen.getByTestId("field-group")).toHaveTextContent("Tier 1");
  });

  it("shows a validation message when the subject is missing", () => {
    renderAt("/sandbox");
    click("Create ticket");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a subject and a description.");
  });

  it("shows seeded tickets read-only", () => {
    renderAt("/sandbox/10001");
    expect(screen.getByText(/comes from the 30-day seed data/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply macro" })).not.toBeInTheDocument();
  });
});

describe("admin", () => {
  it("lists all rules and lets the visitor turn a trigger off and change its order", () => {
    renderAt("/admin");
    expect(screen.getAllByRole("row")).toHaveLength(1 + 8 + 1 + 3); // triggers + SLA table rows with headers
    expect(screen.getAllByText("customer tier is enterprise")).toHaveLength(2); // trigger 1 and the Enterprise SLA policy
    fireEvent.click(screen.getByLabelText("Billing active"));
    expect(useDesk.getState().triggers.find((t) => t.id === "t4")!.active).toBe(false);
    click("Move Refund requests up");
    const order = [...useDesk.getState().triggers].sort((a, b) => a.order - b.order).map((t) => t.id);
    expect(order.slice(0, 3)).toEqual(["t1", "t3", "t2"]);
  });

  it("a disabled trigger no longer routes new tickets", () => {
    act(() => useDesk.getState().toggleTrigger("t4"));
    renderAt("/sandbox");
    createPreset("billing-double");
    expect(screen.getByTestId("field-group")).toHaveTextContent("Tier 1");
    expect(screen.queryByText(/Trigger "Billing" fired/)).not.toBeInTheDocument();
  });
});
