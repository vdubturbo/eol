import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-bg-primary bg-pcb-grid">
      <Header />
      <div className="flex">
        {isAdminRoute && <Sidebar />}
        <main
          className={`flex-1 min-h-[calc(100vh-64px)] ${
            isAdminRoute ? 'ml-64' : ''
          }`}
        >
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
