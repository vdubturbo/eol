import { Link, useLocation } from 'react-router-dom';
import { Cpu, Settings, Search, BarChart3 } from 'lucide-react';

export function Header() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <header className="h-16 bg-bg-secondary border-b border-gray-800 sticky top-0 z-50">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-accent-primary/10 border border-accent-primary/30">
            <Cpu className="h-6 w-6 text-accent-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">ComponentDB</h1>
            <p className="text-xs text-gray-500">Drop-in Replacement Finder</p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-2">
          <Link
            to="/"
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              !isAdminRoute
                ? 'bg-bg-tertiary text-white'
                : 'text-gray-400 hover:text-white hover:bg-bg-tertiary'
            }`}
          >
            <Search className="h-4 w-4" />
            Search
          </Link>
          <Link
            to="/admin"
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isAdminRoute
                ? 'bg-bg-tertiary text-white'
                : 'text-gray-400 hover:text-white hover:bg-bg-tertiary'
            }`}
          >
            <Settings className="h-4 w-4" />
            Admin
          </Link>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="h-2 w-2 rounded-full bg-emerald-500 led-pulse" />
            <span>Connected</span>
          </div>
        </div>
      </div>
    </header>
  );
}
