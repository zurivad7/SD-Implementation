import PageShell from "../components/PageShell";
import Placeholder from "../components/Placeholder";

export default function Admin() {
  return (
    <PageShell title="Admin" synthetic>
      <Placeholder milestone="M4" what="triggers, SLA policies, escalation rules and macros" />
    </PageShell>
  );
}
