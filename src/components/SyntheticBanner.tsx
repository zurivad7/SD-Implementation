/** Exact banner text required by hard rule 1 (SPEC.md section 2). */
export const SYNTHETIC_BANNER_TEXT =
  "All tickets, customers and metrics in this demo are synthetic.";

/** Fixed banner shown on every data page. */
export default function SyntheticBanner() {
  return (
    <div
      role="note"
      aria-label="Synthetic data notice"
      data-testid="synthetic-banner"
      className="sticky top-0 z-30 border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <span aria-hidden="true">ⓘ </span>
      {SYNTHETIC_BANNER_TEXT}
    </div>
  );
}
