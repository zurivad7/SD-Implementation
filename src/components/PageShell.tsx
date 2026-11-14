import type { ReactNode } from "react";
import SyntheticBanner from "./SyntheticBanner";

interface Props {
  title: string;
  /** True on every page that shows tickets, customers or metrics. */
  synthetic?: boolean;
  children?: ReactNode;
}

export default function PageShell({ title, synthetic = false, children }: Props) {
  return (
    <>
      {synthetic && <SyntheticBanner />}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </>
  );
}
