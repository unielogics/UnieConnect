import { useEffect, useState, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { TOKEN_KEY } from '../lib/api';
import { fetchCurrentUser, canManageUsers, getRoleFromToken, type CurrentUser } from '../lib/user';
import Navigation from './Navigation';
import { FiSun, FiMoon, FiLogOut, FiMenu, FiX } from 'react-icons/fi';

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {collapsed ? (
        <path d="M4 6h16M4 12h16M4 18h16" />
      ) : (
        <>
          <rect x="3" y="4" width="8" height="16" rx="1" />
          <rect x="14" y="4" width="7" height="16" rx="1" />
        </>
      )}
    </svg>
  );
}

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [adminMode, setAdminMode] = useState<'administrative' | 'regular'>('regular');
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    if (window.location.hostname === 'unieconnect.com') {
      window.location.href = `https://user.unieconnect.com${window.location.pathname}${window.location.search}`;
      return;
    }
    const saved = localStorage.getItem('unie-theme');
    const initial = saved === 'dark' || saved === 'light' ? saved : 'light';
    setTheme(initial as 'light' | 'dark');
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.body.classList.toggle('theme-dark', theme === 'dark');
    localStorage.setItem('unie-theme', theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedAdminMode = localStorage.getItem('unie-admin-mode') as 'administrative' | 'regular' | null;
    if (savedAdminMode === 'administrative' || savedAdminMode === 'regular') {
      setAdminMode(savedAdminMode);
    }
    if (savedToken) {
      setToken(savedToken);
      const roleFromToken = getRoleFromToken();
      if (roleFromToken) {
        setCurrentUser({ userId: '', email: '', role: roleFromToken });
      }
      void fetchCurrentUser().then((u) => u && setCurrentUser(u));
    } else {
      window.location.href = '/login';
    }
  }, [mounted]);

  const handleAdminModeChange = (mode: 'administrative' | 'regular') => {
    setAdminMode(mode);
    localStorage.setItem('unie-admin-mode', mode);
  };

  useEffect(() => {
    setDrawerOpen(false);
  }, [router.pathname]);

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/login';
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'collapsed' : ''} ${drawerOpen ? 'drawer-open' : ''}`}>
      <div
        className="drawer-backdrop"
        role="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setDrawerOpen(false)}
      />
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link href="/dashboard" onClick={() => setDrawerOpen(false)} className="brand">
            <img src="/logo.svg" alt="" className="brand-logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span className="brand-text">UnieConnect</span>
          </Link>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            <SidebarToggleIcon collapsed={sidebarCollapsed} />
          </button>
          <button
            className="sidebar-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <FiX size={18} />
          </button>
        </div>
        <div className="sidebar-nav-wrap">
          <Navigation
            onNavigate={() => setDrawerOpen(false)}
            canManageUsers={canManageUsers(currentUser?.role)}
            adminMode={adminMode}
            onAdminModeChange={handleAdminModeChange}
          />
        </div>
        <div className="sidebar-theme">
          <button
            type="button"
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {mounted && (theme === 'light' ? <FiMoon size={18} /> : <FiSun size={18} />)}
            <span className="nav-label">{sidebarCollapsed ? '' : (theme === 'light' ? 'Dark' : 'Light')}</span>
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="hamburger"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
            >
              <FiMenu size={22} />
            </button>
            <div className="topbar-title">
              {title && <div className="section-title">{title}</div>}
              {subtitle && <div className="muted">{subtitle}</div>}
            </div>
          </div>
          <div className="actions">
            {token ? (
              <>
                <Link href="/profile" className="profile-header-link" aria-label="Profile">
                  <div className="profile-avatar">P</div>
                  <div className="profile-header-text">
                    <span className="profile-label profile-label-full">Profile</span>
                    <span className="profile-sublabel profile-sublabel-full">Account settings</span>
                  </div>
                </Link>
                <button
                  className="icon-button"
                  onClick={handleLogout}
                  aria-label="Logout"
                >
                  <FiLogOut size={18} />
                </button>
              </>
            ) : (
              <Link href="/login" className="profile-header-link" aria-label="Sign in">
                <div className="profile-avatar">?</div>
                <span className="profile-label profile-label-full">Sign in</span>
              </Link>
            )}
          </div>
        </header>
        <div className="content">
          {children}
        </div>
      </div>
    </div>
  );
}
