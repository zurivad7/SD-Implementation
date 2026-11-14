import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { ROUTER_FUTURE } from "./routerFuture";
import { applyInitialTheme } from "./components/ThemeToggle";
import "./index.css";

applyInitialTheme();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <HashRouter future={ROUTER_FUTURE}>
      <App />
    </HashRouter>
  </StrictMode>,
);
