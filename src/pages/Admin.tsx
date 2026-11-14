import PageShell from "../components/PageShell";
import { ESCALATION_RULES, MACROS, SLA_POLICIES } from "../data/config";
import { formatTarget } from "../engine/sla";
import { describeActions, describeConditions, sentence } from "../lib/describe";
import { useDesk } from "../store/useDesk";
import type { Priority, SlaPolicy } from "../types";

const th = "py-2 pr-3 font-semibold";
const td = "py-2 pr-3 align-top";
const btn = "rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800";
const PRIORITIES: Priority[] = ["urgent", "high", "normal", "low"];
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hoursText(p: SlaPolicy): string {
  if (p.businessHours === "24x7") return "24x7";
  const d = p.businessHours.days;
  return `${p.businessHours.start} to ${p.businessHours.end}, ${DAY[d[0]!]} to ${DAY[d[d.length - 1]!]}`;
}

const WHEN_TEXT = { sla_warning: "On SLA warning", sla_breached: "On SLA breach", reopened_twice: "When a ticket reopens twice", bad_csat: "On bad CSAT" } as const;

export default function Admin() {
  const triggers = useDesk((s) => s.triggers);
  const toggleTrigger = useDesk((s) => s.toggleTrigger);
  const moveTrigger = useDesk((s) => s.moveTrigger);
  const sorted = [...triggers].sort((a, b) => a.order - b.order);

  return (
    <PageShell title="Admin" synthetic>
      <p className="max-w-3xl text-slate-700 dark:text-slate-300">
        The desk configuration: routing triggers, SLA policies, escalation rules and macros. You can turn a trigger on or off and
        change its order. Changes apply to new sandbox tickets and are saved in this browser.
      </p>

      <section aria-labelledby="triggers-heading" className="mt-8">
        <h2 id="triggers-heading" className="text-xl font-semibold">Triggers</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Triggers run in order on create and on every update. The first matching "set group" wins. Each trigger fires once per ticket.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">Routing triggers in run order</caption>
            <thead className="border-b border-slate-300 dark:border-slate-600">
              <tr><th scope="col" className={th}>Order</th><th scope="col" className={th}>Name</th><th scope="col" className={th}>Conditions</th><th scope="col" className={th}>Actions</th><th scope="col" className={th}>Active</th><th scope="col" className={th}>Move</th></tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => (
                <tr key={t.id} className={`border-b border-slate-200 dark:border-slate-800 ${t.active ? "" : "text-slate-500 dark:text-slate-400"}`}>
                  <td className={td}>{t.order}</td>
                  <td className={`${td} font-medium`}>{t.name}</td>
                  <td className={td}>{describeConditions(t)}</td>
                  <td className={td}>{describeActions(t.actions)}</td>
                  <td className={td}>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={t.active} onChange={() => toggleTrigger(t.id)} aria-label={`${t.name} active`} />
                      {t.active ? "On" : "Off"}
                    </label>
                  </td>
                  <td className={td}>
                    <span className="flex gap-1">
                      <button type="button" className={btn} disabled={i === 0} onClick={() => moveTrigger(t.id, -1)} aria-label={`Move ${t.name} up`}>↑</button>
                      <button type="button" className={btn} disabled={i === sorted.length - 1} onClick={() => moveTrigger(t.id, 1)} aria-label={`Move ${t.name} down`}>↓</button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="sla-heading" className="mt-10">
        <h2 id="sla-heading" className="text-xl font-semibold">SLA policies</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          The first matching policy applies. Each cell shows first reply / resolution, in business time. The clock pauses in
          pending and on-hold, stops when solved, and continues from its saved total if the ticket reopens.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">SLA targets by policy and priority</caption>
            <thead className="border-b border-slate-300 dark:border-slate-600">
              <tr><th scope="col" className={th}>Policy</th><th scope="col" className={th}>Applies to</th>{PRIORITIES.map((p) => <th key={p} scope="col" className={`${th} capitalize`}>{p}</th>)}<th scope="col" className={th}>Hours</th></tr>
            </thead>
            <tbody>
              {SLA_POLICIES.map((p) => (
                <tr key={p.id} className="border-b border-slate-200 dark:border-slate-800">
                  <th scope="row" className={`${td} font-medium`}>{p.name}</th>
                  <td className={td}>{p.match.length ? describeConditions({ all: p.match, any: [] }) : "all others"}</td>
                  {PRIORITIES.map((pr) => <td key={pr} className={td}>{formatTarget(p.targets[pr].firstReplyMins)} / {formatTarget(p.targets[pr].resolutionMins)}</td>)}
                  <td className={td}>{hoursText(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="esc-heading" className="mt-10">
        <h2 id="esc-heading" className="text-xl font-semibold">Escalation rules</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Each rule fires once per ticket. "Notify lead" writes an event and shows a notification. It sends nothing.</p>
        <ul className="mt-3 space-y-2">
          {ESCALATION_RULES.map((r) => (
            <li key={r.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
              <span className="font-medium">{WHEN_TEXT[r.when]}:</span> {sentence(describeActions(r.actions))}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="macros-heading" className="mt-10">
        <h2 id="macros-heading" className="text-xl font-semibold">Macros</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {MACROS.map((m) => (
            <li key={m.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
              <p className="font-medium">{m.name}</p>
              <p className="mt-1 text-sm">{m.reply}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Then: {sentence(describeActions(m.actions))}</p>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
