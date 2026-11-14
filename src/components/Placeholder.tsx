/** Marks a page section that a later milestone fills in. */
export default function Placeholder({ milestone, what }: { milestone: string; what: string }) {
  return (
    <p className="rounded-md border border-dashed border-slate-300 p-4 text-slate-600 dark:border-slate-700 dark:text-slate-300">
      Coming in {milestone}: {what}.
    </p>
  );
}
