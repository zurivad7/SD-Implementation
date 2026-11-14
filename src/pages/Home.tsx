import { Link } from "react-router-dom";
import { useTour } from "../store/useTour";

const PROOF_LINKS = [
  { to: "/sandbox", title: "Sandbox", text: "Create a ticket. Watch routing, SLA timers and escalations fire." },
  { to: "/dashboard", title: "Dashboard", text: "See the before and after go-live KPIs." },
  { to: "/case-study/1", title: "Case study", text: "Follow the rollout from client brief to retrospective." },
];

export default function Home() {
  const startTour = useTour((s) => s.start);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {/* Draft claim from SPEC.md section 9. Eric confirms the final text before M6. */}
      <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-4xl" data-tour="claim">
        I take customer service operations from messy inbox to measured go-live. This demo shows how.
      </h1>
      <ul className="mt-8 grid gap-4 sm:grid-cols-3">
        {PROOF_LINKS.map((card) => (
          <li key={card.to}>
            <Link
              to={card.to}
              className="block h-full rounded-lg border border-slate-200 p-5 hover:border-accent-600 dark:border-slate-700"
            >
              <span className="text-lg font-semibold text-accent-700 dark:text-accent-300">{card.title}</span>
              <span className="mt-2 block text-slate-700 dark:text-slate-300">{card.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button type="button" onClick={startTour} className="rounded-md bg-accent-600 px-5 py-2.5 font-semibold text-white hover:bg-accent-700">
          5-minute demo
        </button>
        <p className="text-slate-700 dark:text-slate-300">A guided tour in 6 steps. It adds one example ticket to your sandbox.</p>
      </div>
    </div>
  );
}
