import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Settings, Search, User, LogOut, ChevronDown, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isAdmin, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdminRoute = location.pathname.startsWith('/admin');

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <header className="h-16 bg-bg-secondary border-b border-gray-800 sticky top-0 z-50">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/search" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src="/images/pinpal.png" alt="PinPal" className="h-10" />
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-2">
          <Link
            to="/search"
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              location.pathname.startsWith('/search') || location.pathname.startsWith('/component') || location.pathname.startsWith('/replacements') || location.pathname.startsWith('/compare')
                ? 'bg-bg-tertiary text-white'
                : 'text-gray-400 hover:text-white hover:bg-bg-tertiary'
            }`}
          >
            <Search className="h-4 w-4" />
            Search
          </Link>
          {isAdmin && (
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
          )}
        </nav>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-bg-tertiary transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-accent-primary/20 flex items-center justify-center">
              {isAdmin ? (
                <Shield className="h-4 w-4 text-amber-400" />
              ) : (
                <User className="h-4 w-4 text-accent-primary" />
              )}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium text-white">
                {profile?.full_name || profile?.email?.split('@')[0] || 'User'}
              </div>
              <div className="text-xs text-gray-500">
                {profile?.role || 'user'}
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-bg-secondary border border-gray-700 rounded-lg shadow-xl py-2 z-50">
              {/* User Info */}
              <div className="px-4 py-3 border-b border-gray-700">
                <div className="text-sm font-medium text-white">
                  {profile?.full_name || 'No name set'}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {profile?.email}
                </div>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                    isAdmin
                      ? 'bg-amber-900/30 text-amber-400 border border-amber-800'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}>
                    {profile?.role}
                  </span>
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-300 hover:bg-bg-tertiary hover:text-white transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
