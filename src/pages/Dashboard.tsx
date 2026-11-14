import PageShell from "../components/PageShell";
import Placeholder from "../components/Placeholder";

export default function Dashboard() {
  return (
    <PageShell title="KPI dashboard" synthetic>
      <Placeholder milestone="M5" what="KPI tiles, charts, filters and CSV export" />
    </PageShell>
  );
}
