import { FormEvent, useEffect, useState } from 'react';
import { apiUrl, getApiOrigin, TOKEN_KEY } from '../lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
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
    const initial =
      saved === 'dark' || saved === 'light'
        ? saved
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
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
      window.location.href = '/';
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
      // Front-end level logging for quick traceability
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
      window.location.href = '/';
    } catch (err: any) {
      const message = err?.message || 'Login failed';
      console.warn('[unieconnect][login] failed', { email, message });
      setLoginError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-hero">
          <div className="pill">
            <span>UnieConnect</span>
            <span className="status-dot online" aria-hidden />
            <span>Modern flow intact</span>
          </div>
          <h1>Unified integrations, ready to go.</h1>
          <p className="muted">
            Sign in to continue configuring Shopify, inventory, and order flows without breaking the current experience.
          </p>
          <div className="auth-highlights">
            <div className="pill subtle">Reliable sessions</div>
            <div className="pill subtle">Traceable actions</div>
            <div className="pill subtle">Dark / Light ready</div>
          </div>
        </div>
      </div>

      <div className="auth-main">
        <div className="auth-card">
          <div className="auth-card-head">
            <div>
              <div className="eyebrow">Welcome back</div>
              <div className="title">Sign in</div>
              <div className="muted">Use your Unie credentials to access the console.</div>
            </div>
            <div className="actions">
              <button className="icon-button" onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>
                <span suppressHydrationWarning>{mounted ? (theme === 'light' ? '🌙' : '☀️') : ' '}</span>
              </button>
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
                  className="icon-button"
                  onClick={() => setShowPwd((v) => !v)}
                  title={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="login-actions">
              <button className="button-primary" type="submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Login'}
              </button>
              <div className="helper-text">
                Access issues? Reach out to your Unie admin. We keep the current flow intact while improving traceability.
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

