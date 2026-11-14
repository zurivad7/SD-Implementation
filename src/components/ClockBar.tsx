import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatDateTime } from "../lib/format";
import { PLAY_MINUTES_PER_SECOND, useDesk } from "../store/useDesk";

const STEPS = [
  { label: "+15 min", minutes: 15 },
  { label: "+1 h", minutes: 60 },
  { label: "+1 day", minutes: 24 * 60 },
];

const btn = "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800";

/** Sandbox clock (SPEC.md section 6.6): Play, Pause, jumps and Reset. */
export default function ClockBar() {
  const now = useDesk((s) => s.now);
  const playing = useDesk((s) => s.playing);
  const setPlaying = useDesk((s) => s.setPlaying);
  const advance = useDesk((s) => s.advance);
  const reset = useDesk((s) => s.reset);
  const [confirming, setConfirming] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => advance(PLAY_MINUTES_PER_SECOND), 1000);
    return () => window.clearInterval(id);
  }, [playing, advance]);

  return (
    <section aria-label="Sandbox clock" className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="mr-2 text-sm">
        <span className="font-semibold">Sandbox time:</span>{" "}
        <time data-testid="sandbox-time" dateTime={new Date(now).toISOString()}>{formatDateTime(now, true)}</time>{" "}
        <span className="text-slate-600 dark:text-slate-300">(Amsterdam)</span>
      </p>
      <button type="button" className={btn} aria-pressed={playing} onClick={() => setPlaying(!playing)}>
        {playing ? "Pause" : "Play"}
      </button>
      {STEPS.map((s) => (
        <button key={s.label} type="button" className={btn} onClick={() => advance(s.minutes)}>
          {s.label}
        </button>
      ))}
      <span className="ml-auto flex gap-2">
        {confirming ? (
          <>
            <button type="button" className={`${btn} border-red-700 text-red-800 dark:border-red-400 dark:text-red-200`} onClick={() => { reset(); setConfirming(false); if (pathname !== "/sandbox") navigate("/sandbox"); }}>
              Yes, reset
            </button>
            <button type="button" className={btn} onClick={() => setConfirming(false)}>Cancel</button>
          </>
        ) : (
          <button type="button" className={btn} onClick={() => setConfirming(true)}>Reset sandbox</button>
        )}
      </span>
      {playing && <p className="w-full text-sm text-slate-600 dark:text-slate-300">Playing: 1 second is {PLAY_MINUTES_PER_SECOND} sandbox minute.</p>}
    </section>
  );
}
