// 5-minute demo mode (SPEC.md section 9): 6 steps, one highlighted element per step.
import { create } from "zustand";

export interface TourStep {
  id: string;
  title: string;
  text: string;
  /** data-tour value of the element to highlight. */
  target: string;
}

export const TOUR_STEPS: TourStep[] = [
  { id: "claim", target: "claim", title: "The claim", text: "This site makes one claim: I take customer service operations from a messy inbox to a measured go-live. The next steps show the proof." },
  { id: "create", target: "create", title: "Create a ticket", text: "A visitor can create a ticket here. The tour uses an example: an enterprise customer with an urgent license failure. Press Next to create it." },
  { id: "triggers", target: "timeline", title: "The routing triggers fire", text: "The ticket is in. The triggers ran in order: \"Enterprise fast lane\" sent it to Escalations, \"Urgent keywords\" notified a lead, and round-robin picked an on-shift agent. Each step is a line in the timeline." },
  { id: "sla", target: "sla", title: "The clock moves on 1 hour", text: "The tour pressed \"+1 h\". The 30-minute first reply target passed its SLA warning at 25% left, then breached. The escalation rules tagged the ticket and notified a lead. See the badges and the timeline." },
  { id: "dashboard", target: "kpis", title: "Before and after on the dashboard", text: "30 days of synthetic tickets, split at go-live. Each tile shows the value after go-live, the value before, and the change. Every number is calculated, not typed." },
  { id: "raid", target: "raid", title: "How the project was run: the RAID log", text: "The case study shows the delivery side: brief, discovery, design, plan, RAID log, cutover, results and retrospective. This is the RAID log, reviewed every week." },
];

interface TourState {
  step: number | null;
  ticketId: number | null;
  clockAdvanced: boolean;
  start: () => void;
  next: () => void;
  back: () => void;
  end: () => void;
  setTicket: (id: number) => void;
  markAdvanced: () => void;
}

export const useTour = create<TourState>()((set) => ({
  step: null,
  ticketId: null,
  clockAdvanced: false,
  start: () => set({ step: 0, ticketId: null, clockAdvanced: false }),
  next: () => set((s) => (s.step === null ? {} : s.step >= TOUR_STEPS.length - 1 ? { step: null } : { step: s.step + 1 })),
  back: () => set((s) => (s.step === null || s.step === 0 ? {} : { step: s.step - 1 })),
  end: () => set({ step: null }),
  setTicket: (id) => set({ ticketId: id }),
  markAdvanced: () => set({ clockAdvanced: true }),
}));
