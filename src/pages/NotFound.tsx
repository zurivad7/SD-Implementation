import { Link } from "react-router-dom";
import PageShell from "../components/PageShell";

export default function NotFound() {
  return (
    <PageShell title="Page not found">
      <p>
        This page does not exist. <Link to="/" className="text-accent-700 underline dark:text-accent-300">Go to the home page</Link>.
      </p>
    </PageShell>
  );
}
