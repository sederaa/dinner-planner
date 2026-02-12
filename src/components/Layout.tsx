import { Link, Outlet, useLocation } from "react-router-dom";

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🍽️</span>
              <h1 className="text-xl font-bold text-gray-900">Dinner Planner</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors
                  ${isActive(item.path) ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}
                `}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
