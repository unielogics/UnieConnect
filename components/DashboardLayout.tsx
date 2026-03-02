import { useEffect, useState, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { TOKEN_KEY } from '../lib/api';
import Navigation from './Navigation';
import { FiSun, FiMoon, FiLock, FiLogOut, FiUser, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    if (window.location.hostname === 'unieconnect.com') {
      window.location.href = `https://user.unieconnect.com${window.location.pathname}${window.location.search}`;
      return;
    }
    const saved = localStorage.getItem('unie-theme');
    const initial = saved === 'dark' || saved === 'light' ? saved : 'dark';
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
    if (savedToken) {
      setToken(savedToken);
    } else {
      window.location.href = '/login';
    }
  }, [mounted]);

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/login';
  };

  const handleChangePassword = () => {
    setPwdMsg(null);
    const auth: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    fetch(`/api/v1/auth/change-password`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Change password failed');
        }
        setPwdMsg('Password updated');
        setOldPwd('');
        setNewPwd('');
        setShowChangePwd(false);
      })
      .catch((err: any) => setPwdMsg(err?.message || 'Change password failed'));
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <Link href="/dashboard">UnieConnect</Link>
        </div>
        <button className="collapse" onClick={() => setSidebarCollapsed((v) => !v)} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {sidebarCollapsed ? <FiChevronRight size={16} /> : <FiChevronLeft size={16} />}
        </button>
        <Navigation />
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            {title && <div className="section-title" style={{ margin: 0 }}>{title}</div>}
            {subtitle && <div className="muted">{subtitle}</div>}
          </div>
          <div className="actions">
            <button 
              className="icon-button" 
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {mounted && (theme === 'light' ? <FiMoon size={18} /> : <FiSun size={18} />)}
            </button>
            {token ? (
              <>
                <button 
                  className="icon-button" 
                  onClick={() => setShowChangePwd((v) => !v)}
                  aria-label="Change password"
                >
                  <FiLock size={18} />
                </button>
                <button 
                  className="icon-button" 
                  onClick={handleLogout}
                  aria-label="Logout"
                >
                  <FiLogOut size={18} />
                </button>
              </>
            ) : (
              <button 
                className="icon-button" 
                onClick={() => setShowChangePwd(false)}
                aria-label="User menu"
              >
                <FiUser size={18} />
              </button>
            )}
          </div>
        </header>
        <div className="content">
          {showChangePwd && token ? (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="title">Change Password</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  type="password"
                  value={oldPwd}
                  onChange={(e) => setOldPwd(e.target.value)}
                  placeholder="Old password"
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="New password"
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <button className="button-primary" onClick={handleChangePassword}>
                  Update
                </button>
              </div>
              {pwdMsg ? (
                <div className="muted" style={{ color: pwdMsg.includes('failed') ? 'red' : 'green', marginTop: 6 }}>
                  {pwdMsg}
                </div>
              ) : null}
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
