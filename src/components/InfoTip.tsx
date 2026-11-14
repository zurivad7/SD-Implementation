import { useId, useState } from "react";

/** A small "i" button that shows a definition on hover, focus or click. */
export default function InfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={`How ${label} is measured`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-400 text-xs font-semibold text-slate-700 dark:border-slate-500 dark:text-slate-200"
      >
        i
      </button>
      {open && (
        <span id={id} role="tooltip" className="absolute right-0 top-8 z-20 w-64 rounded-md border border-slate-300 bg-white p-2 text-sm font-normal text-slate-900 shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
          {text}
        </span>
      )}
    </span>
  );
}
