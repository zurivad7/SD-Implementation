import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PRESETS } from "../data/presets";
import { SEED_DATA } from "../data/seed";
import { useDesk } from "../store/useDesk";
import { TOUR_STEPS, useTour } from "../store/useTour";

const btn = "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800";

/** Runs a step's action once, then returns the route to show. */
function enterStep(id: string): string {
  const tour = useTour.getState();
  const desk = useDesk.getState();
  if (id === "claim") return "/";
  if (id === "create") return "/sandbox";
  if (id === "triggers" || id === "sla") {
    let ticketId = tour.ticketId;
    if (ticketId === null || !desk.tickets.some((t) => t.id === ticketId)) {
      const p = PRESETS.find((x) => x.id === "enterprise-urgent")!;
      const customer = SEED_DATA.customers.find((c) => c.id === p.customerId)!;
      ticketId = desk.createTicket({ subject: p.subject, body: p.body, channel: p.channel, category: p.category, ...(p.priority ? { priority: p.priority } : {}) }, customer);
      tour.setTicket(ticketId);
    }
    if (id === "sla" && !useTour.getState().clockAdvanced) {
      useDesk.getState().advance(60);
      tour.markAdvanced();
    }
    return `/sandbox/${ticketId}`;
  }
  if (id === "dashboard") return "/dashboard";
  return "/case-study/5";
}

/** Guided tour panel. Highlights one element per step. */
export default function DemoTour() {
  const step = useTour((s) => s.step);
  const { next, back, end } = useTour.getState();
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (step === null) return;
    const current = TOUR_STEPS[step]!;
    navigate(enterStep(current.id));
    let el: Element | null = null;
    let tries = 0;
    let raf = 0;
    const find = () => {
      el = document.querySelector(`[data-tour="${current.target}"]`);
      if (el) {
        el.classList.add("tour-highlight");
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (tries++ < 120) raf = requestAnimationFrame(find);
    };
    raf = requestAnimationFrame(find);
    headingRef.current?.focus();
    return () => {
      cancelAnimationFrame(raf);
      (el as Element | null)?.classList.remove("tour-highlight");
    };
  }, [step, navigate]);

  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && end();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, end]);

  if (step === null) return null;
  const current = TOUR_STEPS[step]!;
  const last = step === TOUR_STEPS.length - 1;
  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      aria-describedby="tour-text"
      data-testid="demo-tour"
      className="fixed inset-x-2 bottom-2 z-50 rounded-lg border-2 border-accent-600 bg-white p-4 shadow-2xl sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[26rem] dark:border-accent-300 dark:bg-slate-900"
    >
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">5-minute demo · Step {step + 1} of {TOUR_STEPS.length}</p>
      <h2 id="tour-title" ref={headingRef} tabIndex={-1} className="mt-1 text-lg font-semibold focus:outline-none">{current.title}</h2>
      <p id="tour-text" className="mt-2 text-sm">{current.text}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={back} disabled={step === 0}>Back</button>
        <button type="button" className="rounded-md bg-accent-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-700" onClick={next}>
          {last ? "Finish" : "Next"}
        </button>
        <button type="button" className="ml-auto text-sm font-medium text-accent-700 underline dark:text-accent-300" onClick={end}>End tour</button>
      </div>
    </section>
  );
}
