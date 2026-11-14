import { useEffect } from "react";
import { useDesk, type Toast } from "../store/useDesk";

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useDesk((s) => s.dismissToast);
  useEffect(() => {
    const id = window.setTimeout(() => dismiss(toast.key), 6000);
    return () => window.clearTimeout(id);
  }, [toast.key, dismiss]);
  return (
    <li className="flex items-start gap-3 rounded-lg border border-slate-300 bg-white p-3 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800">
      <span aria-hidden="true">🔔</span>
      <span className="flex-1">{toast.message} <span className="text-slate-600 dark:text-slate-300">Demo only: nothing is sent.</span></span>
      <button type="button" onClick={() => dismiss(toast.key)} className="rounded px-1 font-semibold" aria-label="Dismiss notification">
        ✕
      </button>
    </li>
  );
}

/** "Notify lead" toasts (SPEC.md section 6.4). */
export default function Toasts() {
  const toasts = useDesk((s) => s.toasts);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-40 w-[min(24rem,calc(100vw-2rem))]">
      <ul className="pointer-events-auto flex flex-col gap-2">
        {toasts.slice(-3).map((t) => <ToastItem key={t.key} toast={t} />)}
      </ul>
    </div>
  );
}
