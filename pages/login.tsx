import { FormEvent, useEffect, useState } from 'react';
import { apiUrl, getApiOrigin, TOKEN_KEY } from '../lib/api';

const LOGIN_FEATURES = [
  { title: 'Marketplace Automations', description: 'Integrations and management across every sales channel.' },
  { title: 'Warehouse Automations', description: 'Multi-warehouse intelligence, sync, and smart allocation.' },
  { title: 'Billing Automations', description: 'Streamline invoicing and payments across operations.' },
  { title: 'Custom Integrations', description: 'API and custom connectors for your stack.' },
  { title: 'Multi User', description: 'Team access and roles so everyone works in sync.' },
  { title: 'Product Finder', description: 'Discover and manage products across marketplaces.' },
  { title: 'Continuous Auditing', description: 'Optimal placement, storage, and routes to save money and increase profit.' },
] as const;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    if (window.location.hostname === 'unieconnect.com') {
      window.location.href = `https://user.unieconnect.com${window.location.pathname}${window.location.search}`;
      return;
    }
    console.info('[unieconnect][config]', { apiOrigin: getApiOrigin(), host: window.location.host });
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
    if (typeof window === 'undefined') return;
    const existing = localStorage.getItem(TOKEN_KEY);
    if (existing) {
      window.location.href = '/dashboard';
    }
  }, []);

  const handleLogin = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!email || !password) {
      setLoginError('Email and password are required');
      return;
    }
    setLoginError(null);
    setStatusMessage(null);
    setLoading(true);
    try {
      console.info('[unieconnect][login] attempting', { email });
      const res = await fetch(apiUrl('/api/v1/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = (() => {
          try {
            return text ? JSON.parse(text) : {};
          } catch {
            return {};
          }
        })();
        const message =
          err?.error ||
          (typeof err?.message === 'string' ? err.message : '') ||
          (text && text.length < 200 ? text : '') ||
          `Login failed (HTTP ${res.status})`;
        throw new Error(message);
      }
      const data = await res.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      setStatusMessage('Signed in. Redirecting…');
      console.info('[unieconnect][login] success', { email });
      window.location.href = '/dashboard';
    } catch (err: any) {
      const message = err?.message || 'Login failed';
      console.warn('[unieconnect][login] failed', { email, message });
      setLoginError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell auth-shell-galaxy">
      <div className="auth-galaxy-bg" aria-hidden />
      <div className="auth-panel auth-panel-scroll">
        <div className="auth-panel-inner">
          <div className="auth-banner">
            <span className="auth-banner-dot" aria-hidden />
            <span>Launching soon</span>
            <span className="auth-banner-sub">We&apos;re putting the finishing touches.</span>
          </div>

          <div className="auth-hero">
            <h1 className="auth-hero-title">Connect To The World</h1>
            <p className="auth-hero-support">All of your ecommerce operations in one place. One platform. Every channel.</p>
          </div>

          <section className="auth-features-wrap" aria-label="Features">
            <h2 className="auth-features-headline">One network, every capability</h2>
            <ul className="auth-features-list">
              {LOGIN_FEATURES.map((feature, i) => (
                <li key={i} className="auth-feature-item">
                  <span className="auth-feature-num">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="auth-feature-title">{feature.title}</h3>
                    <p className="auth-feature-desc">{feature.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className="auth-main">
        <button
          type="button"
          className="auth-theme-corner"
          onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
          aria-label="Toggle theme"
        >
          <span suppressHydrationWarning>{mounted ? (theme === 'light' ? 'Dark' : 'Light') : ' '}</span>
        </button>
        <div className="auth-card">
          <div className="auth-card-head">
            <div>
              <div className="eyebrow">Welcome back</div>
              <div className="title">Sign in</div>
              <div className="muted">Use your Unie credentials to access the console.</div>
            </div>
          </div>

          <form className="auth-form" onSubmit={handleLogin}>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="username"
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="field-with-action">
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPwd((v) => !v)}
                  title={showPwd ? 'Hide password' : 'Show password'}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="login-actions">
              <button className="button-primary" type="submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Login'}
              </button>
              <div className="helper-text">
                Access issues? Reach out to your Unie admin.
              </div>
            </div>

            {loginError ? <div className="alert error">{loginError}</div> : null}
            {statusMessage ? <div className="alert success">{statusMessage}</div> : null}
          </form>
        </div>
      </div>
    </div>
  );
}
