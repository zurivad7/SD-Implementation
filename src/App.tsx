import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Sandbox from "./pages/Sandbox";
import TicketDetail from "./pages/TicketDetail";
import Admin from "./pages/Admin";
import Dashboard from "./pages/Dashboard";
import CaseStudyChapter from "./pages/CaseStudy/Chapter";
import About from "./pages/About";
import NotFound from "./pages/NotFound";

/** Routes from SPEC.md section 9. HashRouter (in main.tsx) works on any static host. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="sandbox" element={<Sandbox />} />
        <Route path="sandbox/:id" element={<TicketDetail />} />
        <Route path="admin" element={<Admin />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="case-study" element={<Navigate to="/case-study/1" replace />} />
        <Route path="case-study/:chapter" element={<CaseStudyChapter />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
