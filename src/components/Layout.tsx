import { NavLink, Outlet } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/sandbox", label: "Sandbox", end: false },
  { to: "/admin", label: "Admin", end: false },
  { to: "/dashboard", label: "Dashboard", end: false },
  { to: "/case-study/1", label: "Case study", end: false },
  { to: "/about", label: "About Eric", end: false },
];

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-slate-900"
      >
        Skip to content
      </a>
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="font-semibold text-accent-700 dark:text-accent-300">
            Northwind Support Go-Live
          </NavLink>
          <ThemeToggle />
        </div>
        <nav aria-label="Main" className="mx-auto max-w-6xl px-4 pb-2">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-block py-1 underline-offset-4 hover:underline ${
                      isActive
                        ? "font-semibold text-accent-700 underline dark:text-accent-300"
                        : "text-slate-700 dark:text-slate-300"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 px-4 py-4 text-center text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
        Northwind Software is a fictional client. This is a portfolio case study.
      </footer>
    </div>
  );
}
