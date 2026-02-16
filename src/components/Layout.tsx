import { Link, Outlet, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header>
        <Card className="rounded-none border-x-0 border-t-0 border-b border-gray-200 shadow-none bg-white">
          <CardContent className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-0">
            <div className="flex items-center h-16 gap-3">
              <span className="text-2xl">🍽️</span>
              <h1 className="text-xl font-semibold text-gray-900">Dinner Planner</h1>
            </div>
          </CardContent>
        </Card>
      </header>

      {/* Navigation Tabs */}
      <nav>
        <Card className="rounded-none border-x-0 border-t-0 border-b border-gray-200 shadow-none bg-white">
          <CardContent className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-0">
            <div className="flex gap-4">
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  asChild
                  variant="ghost"
                  className={cn(
                    "rounded-none h-auto px-6 py-4 text-[14px] font-normal transition-colors relative border-b-2",
                    "hover:bg-transparent",
                    isActive(item.path) ? "text-gray-900 font-semibold border-blue-600" : "text-gray-600 hover:text-gray-900 border-transparent"
                  )}
                >
                  <Link to={item.path}>
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </nav>

      {/* Main Content */}
      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
