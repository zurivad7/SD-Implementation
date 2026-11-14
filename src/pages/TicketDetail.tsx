import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import ClockBar from "../components/ClockBar";
import PageShell from "../components/PageShell";
import SlaBadge from "../components/SlaBadge";
import Timeline from "../components/Timeline";
import { AGENTS, GROUPS, MACROS, SLA_POLICIES } from "../data/config";
import { SEED_DATA } from "../data/seed";
import { STATUS_LABEL } from "../engine/events";
import { slaTimers } from "../engine/sla";
import { CATEGORY_LABEL, CHANNEL_LABEL, LANGUAGE_LABEL, PRIORITY_LABEL, TIER_LABEL } from "../lib/format";
import { customerById, findTicket, useDesk } from "../store/useDesk";
import type { Status } from "../types";

const btn = "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800";
const select = "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900";
const STATUSES: Status[] = ["open", "pending", "on_hold", "solved", "closed"];

export default function TicketDetail() {
  const { id } = useParams();
  const tickets = useDesk((s) => s.tickets);
  const customers = useDesk((s) => s.customers);
  const now = useDesk((s) => s.now);
  const { setStatus, reply, applyMacro, customerReplies, rate } = useDesk.getState();
  const [macroId, setMacroId] = useState(MACROS[0]!.id);
  const [status, setStatusChoice] = useState<Status>("pending");

  const found = findTicket(Number(id), tickets);
  if (!found) {
    return (
      <PageShell title={`Ticket #${id ?? ""}`} synthetic>
        <p>This ticket does not exist. It may have been removed by "Reset sandbox". <Link to="/sandbox" className="text-accent-700 underline dark:text-accent-300">Back to the sandbox</Link>.</p>
      </PageShell>
    );
  }
  const { ticket: t, sandbox } = found;
  const customer = customerById(t.customerId, customers);
  const policy = SLA_POLICIES.find((p) => p.id === t.slaPolicyId);
  const clockNow = sandbox ? now : Date.parse(SEED_DATA.meta.dataEndsAt);
  const timers = policy ? slaTimers(t, policy, clockNow) : [];

  const facts: Array<[string, string]> = [
    ["Status", STATUS_LABEL[t.status]],
    ["Priority", PRIORITY_LABEL[t.priority]],
    ["Channel", CHANNEL_LABEL[t.channel]],
    ["Category", CATEGORY_LABEL[t.category]],
    ["Customer", customer ? `${customer.name} (${TIER_LABEL[customer.tier]}, ${LANGUAGE_LABEL[customer.language]})` : t.customerId],
    ["Group", GROUPS.find((g) => g.id === t.groupId)?.name ?? "None"],
    ["Assignee", AGENTS.find((a) => a.id === t.assigneeId)?.name ?? "Unassigned"],
    ["SLA policy", policy?.name ?? "None"],
    ["Tags", t.tags.length ? t.tags.join(", ") : "None"],
  ];

  return (
    <PageShell title={`Ticket #${t.id}`} synthetic>
      <p className="text-lg">{t.subject}</p>
      <p className="mt-1"><Link to="/sandbox" className="text-accent-700 underline dark:text-accent-300">Back to the sandbox</Link></p>
      {sandbox ? (
        <div className="mt-4"><ClockBar /></div>
      ) : (
        <p className="mt-4 rounded-md border border-slate-300 p-3 text-sm dark:border-slate-600">
          This ticket comes from the 30-day seed data. It is read-only. SLA timers show the state at the end of the data period.
        </p>
      )}

      <section aria-labelledby="sla-heading" className="mt-6">
        <h2 id="sla-heading" className="text-lg font-semibold">SLA timers</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {timers.length ? timers.map((timer) => <SlaBadge key={timer.metric} timer={timer} />) : <p>No SLA policy applies.</p>}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,22rem),minmax(0,1fr)]">
        <div className="space-y-6">
          <section aria-labelledby="fields-heading">
            <h2 id="fields-heading" className="text-lg font-semibold">Fields</h2>
            <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
              {facts.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-medium text-slate-700 dark:text-slate-300">{k}</dt>
                  <dd data-testid={`field-${k.toLowerCase().replace(" ", "-")}`}>{v}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-4 font-medium">Description</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm">{t.body}</p>
          </section>

          {sandbox && (
            <section aria-labelledby="actions-heading" className="space-y-4">
              <h2 id="actions-heading" className="text-lg font-semibold">Agent actions</h2>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label htmlFor="macro" className="block text-sm font-medium">Macro</label>
                  <select id="macro" className={select} value={macroId} onChange={(e) => setMacroId(e.target.value)}>
                    {MACROS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <button type="button" className={btn} onClick={() => applyMacro(t.id, macroId)}>Apply macro</button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <button type="button" className={btn} onClick={() => reply(t.id)}>Send public reply</button>
                <div>
                  <label htmlFor="status" className="block text-sm font-medium">Status</label>
                  <select id="status" className={select} value={status} onChange={(e) => setStatusChoice(e.target.value as Status)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
                <button type="button" className={btn} onClick={() => setStatus(t.id, status)}>Set status</button>
              </div>
              <h3 className="font-medium">Customer actions</h3>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={() => customerReplies(t.id)}>Customer replies</button>
                <button type="button" className={btn} onClick={() => rate(t.id, "good")} disabled={t.status !== "solved"}>Rate good</button>
                <button type="button" className={btn} onClick={() => rate(t.id, "bad")} disabled={t.status !== "solved"}>Rate bad</button>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">Customers can rate a ticket once it is solved. A customer reply reopens a pending or solved ticket.</p>
            </section>
          )}
        </div>

        <section aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="text-lg font-semibold">Timeline</h2>
          <div className="mt-3"><Timeline events={t.events} /></div>
        </section>
      </div>
    </PageShell>
  );
}
