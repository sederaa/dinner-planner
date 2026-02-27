import { Link, Outlet, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

export function Layout() {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Planner", icon: "📅" },
    { path: "/dishes", label: "Dishes", icon: "🍽️" },
    { path: "/rules", label: "Rules", icon: "⚙️" },
    { path: "/settings", label: "Settings", icon: "🔧" },
  ];

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-container app-header-inner">
          <div className="app-brand-row">
            <div className="app-brand">
              <span className="app-brand-icon">🍽️</span>
              <div>
                <h1 className="app-title">Dinner Planner</h1>
                <p className="app-subtitle">Weekly planning workspace</p>
              </div>
            </div>

            <nav className="app-nav-wrap">
              <div className="app-nav">
                {navItems.map((item) => (
                  <Button
                    key={item.path}
                    asChild
                    size="sm"
                    variant={isActive(item.path) ? "secondary" : "ghost"}
                    className={cn("app-nav-button", isActive(item.path) && "app-nav-button-active")}
                  >
                    <Link to={item.path}>
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  </Button>
                ))}
              </div>
            </nav>
          </div>
        </div>
      </header>

      <main className="app-container app-main">
        <Outlet />
      </main>
    </div>
  );
}
