import { useParams } from "react-router-dom";
import PageShell from "../components/PageShell";
import Placeholder from "../components/Placeholder";

export default function TicketDetail() {
  const { id } = useParams();
  return (
    <PageShell title={`Ticket #${id ?? ""}`} synthetic>
      <Placeholder milestone="M4" what="ticket fields, SLA badges, the timeline and the macro picker" />
    </PageShell>
  );
}
