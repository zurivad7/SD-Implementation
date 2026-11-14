import ClockBar from "../components/ClockBar";
import CreateTicketForm from "../components/CreateTicketForm";
import PageShell from "../components/PageShell";
import TicketTable from "../components/TicketTable";
import { useDesk } from "../store/useDesk";

export default function Sandbox() {
  const tickets = useDesk((s) => s.tickets);
  return (
    <PageShell title="Ticket sandbox" synthetic>
      <p className="max-w-3xl text-slate-700 dark:text-slate-300">
        Create a ticket and watch the rules act on it. Routing triggers pick the group and priority, the SLA policy starts its
        timers, and escalation rules fire when a timer runs low. Use the clock to move time forward.
      </p>
      <div className="mt-4"><ClockBar /></div>
      <div className="mt-6 space-y-8">
        <div className="max-w-3xl"><CreateTicketForm /></div>
        <section aria-labelledby="list-heading">
          <h2 id="list-heading" className="text-lg font-semibold">Sandbox tickets ({tickets.length})</h2>
          <div className="mt-3"><TicketTable tickets={tickets} /></div>
        </section>
      </div>
    </PageShell>
  );
}
