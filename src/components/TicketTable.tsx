import { Link } from "react-router-dom";
import { AGENTS, GROUPS, SLA_POLICIES } from "../data/config";
import { slaTimers } from "../engine/sla";
import { STATUS_LABEL } from "../engine/events";
import { PRIORITY_LABEL } from "../lib/format";
import { customerById, useDesk } from "../store/useDesk";
import type { Ticket } from "../types";
import SlaBadge from "./SlaBadge";

/** Sandbox ticket list. */
export default function TicketTable({ tickets }: { tickets: Ticket[] }) {
  const now = useDesk((s) => s.now);
  const customers = useDesk((s) => s.customers);
  if (tickets.length === 0) {
    return <p className="rounded-md border border-dashed border-slate-300 p-4 text-slate-700 dark:border-slate-600 dark:text-slate-300">No sandbox tickets yet. Use "Fill example" above, then "Create ticket".</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <caption className="sr-only">Tickets you created in the sandbox, newest first</caption>
        <thead className="border-b border-slate-300 dark:border-slate-600">
          <tr>
            {["Ticket", "Customer", "Priority", "Status", "Group", "Assignee", "SLA"].map((h) => <th key={h} scope="col" className="py-2 pr-3 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => {
            const policy = SLA_POLICIES.find((p) => p.id === t.slaPolicyId);
            return (
              <tr key={t.id} className="border-b border-slate-200 align-top dark:border-slate-800">
                <td className="py-2 pr-3">
                  <Link to={`/sandbox/${t.id}`} className="font-medium text-accent-700 underline dark:text-accent-300">#{t.id}</Link>
                  <span className="block">{t.subject}</span>
                </td>
                <td className="py-2 pr-3">{customerById(t.customerId, customers)?.name ?? t.customerId}</td>
                <td className="py-2 pr-3">{PRIORITY_LABEL[t.priority]}</td>
                <td className="py-2 pr-3">{STATUS_LABEL[t.status]}</td>
                <td className="py-2 pr-3">{GROUPS.find((g) => g.id === t.groupId)?.name ?? "None"}</td>
                <td className="py-2 pr-3">{AGENTS.find((a) => a.id === t.assigneeId)?.name ?? "Unassigned"}</td>
                <td className="py-2 pr-3">
                  <span className="flex flex-col gap-1">
                    {policy ? slaTimers(t, policy, now).map((timer) => <SlaBadge key={timer.metric} timer={timer} compact />) : "None"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
