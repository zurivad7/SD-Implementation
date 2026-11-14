import { AGENTS } from "../data/config";
import type { TicketEvent } from "../types";
import { formatDateTime } from "../lib/format";

const TYPE_LABEL: Record<TicketEvent["type"], string> = {
  created: "Created", rule_fired: "Trigger", assigned: "Assigned", status_changed: "Status", public_reply: "Reply",
  internal_note: "Internal note", sla_warning: "SLA warning", sla_breached: "SLA breach", escalated: "Escalation",
  macro_applied: "Macro", csat_received: "CSAT",
};

const TYPE_STYLE: Partial<Record<TicketEvent["type"], string>> = {
  sla_warning: "border-amber-600 text-amber-900 dark:border-amber-400 dark:text-amber-100",
  sla_breached: "border-red-700 text-red-900 dark:border-red-400 dark:text-red-100",
  escalated: "border-red-700 text-red-900 dark:border-red-400 dark:text-red-100",
  rule_fired: "border-accent-600 text-accent-700 dark:border-accent-300 dark:text-accent-300",
};

function actorName(actor: string): string {
  if (actor === "system") return "System";
  if (actor === "customer") return "Customer";
  return AGENTS.find((a) => a.id === actor)?.name ?? actor;
}

/** The ticket's audit trail, newest last. */
export default function Timeline({ events }: { events: TicketEvent[] }) {
  return (
    <ol className="space-y-3" data-testid="timeline">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`} className="grid grid-cols-[auto,1fr] gap-x-3 border-l-2 border-slate-200 pl-3 dark:border-slate-700">
          <span className={`mt-0.5 h-fit whitespace-nowrap rounded border px-1.5 text-xs font-semibold ${TYPE_STYLE[e.type] ?? "border-slate-400 text-slate-700 dark:border-slate-500 dark:text-slate-200"}`}>
            {TYPE_LABEL[e.type]}
          </span>
          <div>
            <p>{e.detail}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <time dateTime={e.at}>{formatDateTime(e.at)}</time> · {actorName(e.actor)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
