import { FormEvent, useEffect, useState } from 'react';
import { apiUrl, TOKEN_KEY } from '../lib/api';

/**
 * Public self-signup for direct UnieConnect sellers (no invite required). Posts to the
 * token-less /auth/signup, which creates a self-owned (origin='direct') account with the AI
 * suite enabled — Cortex optimizes their network autonomously. Warehouse-invited clients use
 * the invite flow (/signup?token=...) instead.
 */
export default function Register() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('unie-theme');
    setTheme(saved === 'dark' ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.body.classList.toggle('theme-dark', theme === 'dark');
    localStorage.setItem('unie-theme', theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (localStorage.getItem(TOKEN_KEY)) window.location.href = '/dashboard';
  }, [mounted]);

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);
    if (!email.trim() || !password) { setError('Email and password are required.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/auth/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          companyName: companyName.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || undefined,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        setStatusMessage('Account created. Redirecting…');
        window.location.href = '/dashboard';
        return;
      }
      setError('Unexpected response. Please try again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="auth-shell auth-shell-galaxy auth-single">
        <div className="auth-galaxy-bg" aria-hidden />
        <div className="auth-main" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="muted">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell auth-shell-galaxy">
      <div className="auth-galaxy-bg" aria-hidden />
      <div className="auth-panel auth-panel-scroll">
        <div className="auth-panel-inner">
          <a className="auth-brand" href="/" aria-label="UnieConnect home">
            <img src="/unieconnect-logo.png" alt="" />
            <span>UnieConnect</span>
          </a>
          <div className="auth-banner">
            <span className="auth-banner-dot" aria-hidden />
            <span>Get started free</span>
            <span className="auth-banner-sub">AI optimizes your fulfillment network from day one.</span>
          </div>
          <div className="auth-hero">
            <h1 className="auth-hero-title">The operating system for connected commerce.</h1>
            <p className="auth-hero-support">Create your account and Cortex starts rate-shopping your network, forecasting demand, and recommending optimal placement automatically.</p>
          </div>
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
              <img className="auth-card-logo" src="/unieconnect-logo.png" alt="UnieConnect" />
              <div className="eyebrow">Create your account</div>
              <div className="title">Start optimizing with AI</div>
              <div className="muted">No invite needed. You&apos;ll get AI network optimization enabled automatically.</div>
            </div>
          </div>

          <form className="auth-form" onSubmit={handleSignup}>
            <div className="field">
              <label htmlFor="firstName">First name</label>
              <input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" autoComplete="given-name" />
            </div>
            <div className="field">
              <label htmlFor="lastName">Last name</label>
              <input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" autoComplete="family-name" />
            </div>
            <div className="field">
              <label htmlFor="companyName">Company (optional)</label>
              <input id="companyName" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your company" autoComplete="organization" />
            </div>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone (optional)</label>
              <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 8900" autoComplete="tel" />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" required minLength={8} />
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" required />
            </div>

            <div className="login-actions">
              <button className="button-primary" type="submit" disabled={loading}>
                {loading ? 'Creating account…' : 'Create free account'}
              </button>
            </div>
            <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>
              Already have an account? <a href="/login">Sign in</a>
            </div>

            {error ? <div className="alert error">{error}</div> : null}
            {statusMessage ? <div className="alert success">{statusMessage}</div> : null}
          </form>
        </div>
      </div>
    </div>
  );
}
