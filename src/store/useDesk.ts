// Sandbox state: Zustand, saved to localStorage, with a reset (SPEC.md sections 3 and 6).
// The store holds only what the visitor changes. Seed data stays read-only in SEED_DATA.
// All rules run in the pure engine functions; this file only wires them to state.
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { AGENTS, ESCALATION_RULES, GROUPS, MACROS, SHIFTS, SLA_POLICIES, TRIGGERS } from "../data/config";
import { SEED_DATA } from "../data/seed";
import { amsterdamParts, amsterdamToUtc, MINUTE_MS } from "../engine/businessTime";
import {
  addPublicReply, afterUpdate, changeStatus, createTicket, receiveCsat, runMacro, tick, type DeskConfig, type NewTicketInput,
} from "../engine/desk";
import type { Notification } from "../engine/events";
import type { RoundRobinState } from "../engine/routing";
import type { Agent, Customer, Status, Ticket, Trigger } from "../types";

export const STORAGE_KEY = "northwind-sandbox-v1";
/** Play speed: one simulated minute per real second. */
export const PLAY_MINUTES_PER_SECOND = 1;

/** The sandbox opens at 09:00 Amsterdam on the first weekday after the seed data ends. */
export function initialNow(): number {
  let t = Date.parse(SEED_DATA.meta.dataEndsAt) + 12 * 60 * MINUTE_MS;
  for (let i = 0; i < 7; i++) {
    const p = amsterdamParts(t);
    if (p.weekday >= 1 && p.weekday <= 5) return amsterdamToUtc(p.year, p.month, p.day, 9, 0);
    t += 24 * 60 * MINUTE_MS;
  }
  return t;
}

const FIRST_SANDBOX_ID = SEED_DATA.tickets[SEED_DATA.tickets.length - 1]!.id + 1;
const seedCustomers = new Map(SEED_DATA.customers.map((c) => [c.id, c]));
const seedTickets = new Map(SEED_DATA.tickets.map((t) => [t.id, t]));

export interface Toast extends Notification {
  key: number;
}

interface PersistedState {
  now: number;
  tickets: Ticket[];
  customers: Customer[];
  rr: RoundRobinState;
  triggers: Trigger[];
  nextId: number;
}

export interface DeskState extends PersistedState {
  playing: boolean;
  toasts: Toast[];
  createTicket: (input: NewTicketInput, customer: Customer) => number;
  advance: (minutes: number) => void;
  setPlaying: (playing: boolean) => void;
  reset: () => void;
  setStatus: (ticketId: number, status: Status) => void;
  reply: (ticketId: number) => void;
  applyMacro: (ticketId: number, macroId: string) => void;
  customerReplies: (ticketId: number) => void;
  rate: (ticketId: number, score: "good" | "bad") => void;
  toggleTrigger: (triggerId: string) => void;
  moveTrigger: (triggerId: string, direction: -1 | 1) => void;
  dismissToast: (key: number) => void;
}

function initialState(): PersistedState {
  return {
    now: initialNow(),
    tickets: [],
    customers: [],
    rr: {},
    triggers: TRIGGERS.map((t) => ({ ...t })),
    nextId: FIRST_SANDBOX_ID,
  };
}

export function deskConfig(triggers: Trigger[]): DeskConfig {
  return { triggers, slaPolicies: SLA_POLICIES, escalationRules: ESCALATION_RULES, macros: MACROS, agents: AGENTS, groups: GROUPS, shifts: SHIFTS };
}

/** localStorage can be blocked (private windows, previews). The sandbox still works for the visit. */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try { return localStorage.getItem(name); } catch { return null; }
  },
  setItem: (name, value) => {
    try { localStorage.setItem(name, value); } catch { /* not saved */ }
  },
  removeItem: (name) => {
    try { localStorage.removeItem(name); } catch { /* nothing to remove */ }
  },
};

let toastKey = 0;
const toToasts = (ns: Notification[]): Toast[] => ns.map((n) => ({ ...n, key: ++toastKey }));

export const useDesk = create<DeskState>()(
  persist(
    (set, get) => {
      /** Replaces one sandbox ticket after an agent or customer change, then runs the update pass. */
      const update = (ticketId: number, change: (t: Ticket, s: DeskState) => { ticket: Ticket; notifications?: Notification[] }) => {
        const s = get();
        const current = s.tickets.find((t) => t.id === ticketId);
        if (!current) return;
        const changed = change(current, s);
        const customer = customerById(changed.ticket.customerId, s.customers);
        const r = afterUpdate(changed.ticket, customer, deskConfig(s.triggers), s.rr, s.now);
        set({
          tickets: s.tickets.map((t) => (t.id === ticketId ? r.ticket : t)),
          rr: r.rr,
          toasts: [...s.toasts, ...toToasts([...(changed.notifications ?? []), ...r.notifications])],
        });
      };

      const agentFor = (t: Ticket): Agent => AGENTS.find((a) => a.id === t.assigneeId) ?? AGENTS.find((a) => a.role === "lead")!;

      return {
        ...initialState(),
        playing: false,
        toasts: [],

        createTicket: (input, customer) => {
          const s = get();
          const isNew = !seedCustomers.has(customer.id) && !s.customers.some((c) => c.id === customer.id);
          const r = createTicket(s.nextId, input, customer, deskConfig(s.triggers), s.rr, s.now);
          set({
            tickets: [r.ticket, ...s.tickets],
            customers: isNew ? [...s.customers, customer] : s.customers,
            rr: r.rr,
            nextId: s.nextId + 1,
            toasts: [...s.toasts, ...toToasts(r.notifications)],
          });
          return r.ticket.id;
        },

        advance: (minutes) => {
          const s = get();
          const now = s.now + minutes * MINUTE_MS;
          const config = deskConfig(s.triggers);
          const notifications: Notification[] = [];
          const tickets = s.tickets.map((t) => {
            if (t.status === "closed") return t;
            const r = tick(t, config, now);
            notifications.push(...r.notifications);
            return r.ticket;
          });
          set({ now, tickets, toasts: [...s.toasts, ...toToasts(notifications)] });
        },

        setPlaying: (playing) => set({ playing }),

        reset: () => {
          safeStorage.removeItem(STORAGE_KEY);
          set({ ...initialState(), playing: false, toasts: [] });
        },

        setStatus: (ticketId, status) =>
          update(ticketId, (t, s) => ({ ticket: changeStatus(t, status, agentFor(t).id, s.now) })),

        reply: (ticketId) =>
          update(ticketId, (t, s) => {
            const replied = addPublicReply(t, agentFor(t), s.now);
            return { ticket: replied.status === "new" ? changeStatus(replied, "open", agentFor(t).id, s.now) : replied };
          }),

        applyMacro: (ticketId, macroId) =>
          update(ticketId, (t, s) => {
            const macro = MACROS.find((m) => m.id === macroId);
            if (!macro) return { ticket: t };
            return runMacro(t, macro, customerById(t.customerId, s.customers), agentFor(t), deskConfig(s.triggers), s.now);
          }),

        customerReplies: (ticketId) =>
          update(ticketId, (t, s) => ({
            ticket: t.status === "open" || t.status === "new" ? t : changeStatus(t, "open", "customer", s.now),
          })),

        rate: (ticketId, score) => update(ticketId, (t, s) => ({ ticket: receiveCsat(t, score, s.now) })),

        toggleTrigger: (triggerId) =>
          set((s) => ({ triggers: s.triggers.map((t) => (t.id === triggerId ? { ...t, active: !t.active } : t)) })),

        moveTrigger: (triggerId, direction) =>
          set((s) => {
            const sorted = [...s.triggers].sort((a, b) => a.order - b.order);
            const i = sorted.findIndex((t) => t.id === triggerId);
            const j = i + direction;
            if (i < 0 || j < 0 || j >= sorted.length) return {};
            [sorted[i], sorted[j]] = [sorted[j]!, sorted[i]!];
            return { triggers: sorted.map((t, k) => ({ ...t, order: k + 1 })) };
          }),

        dismissToast: (key) => set((s) => ({ toasts: s.toasts.filter((t) => t.key !== key) })),
      };
    },
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s): PersistedState => ({ now: s.now, tickets: s.tickets, customers: s.customers, rr: s.rr, triggers: s.triggers, nextId: s.nextId }),
    },
  ),
);

export function customerById(id: string, sandboxCustomers: Customer[]): Customer | undefined {
  return seedCustomers.get(id) ?? sandboxCustomers.find((c) => c.id === id);
}

/** A sandbox ticket, or a read-only seeded ticket. */
export function findTicket(id: number, sandboxTickets: Ticket[]): { ticket: Ticket; sandbox: boolean } | null {
  const own = sandboxTickets.find((t) => t.id === id);
  if (own) return { ticket: own, sandbox: true };
  const seeded = seedTickets.get(id);
  return seeded ? { ticket: seeded, sandbox: false } : null;
}
