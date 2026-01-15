import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Download,
  Database,
  BarChart3,
  Settings,
} from 'lucide-react';

const navItems = [
  {
    to: '/admin',
    icon: LayoutDashboard,
    label: 'Dashboard',
    end: true,
  },
  {
    to: '/admin/ingestion',
    icon: Download,
    label: 'Data Ingestion',
  },
  {
    to: '/admin/data',
    icon: Database,
    label: 'Data Browser',
  },
  {
    to: '/admin/api-usage',
    icon: BarChart3,
    label: 'API Usage',
  },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-bg-secondary border-r border-gray-800 overflow-y-auto">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/30'
                  : 'text-gray-400 hover:text-white hover:bg-bg-tertiary'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>Version</span>
            <span className="font-mono">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span>Environment</span>
            <span className="font-mono text-emerald-400">dev</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
