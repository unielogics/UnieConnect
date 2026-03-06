import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiUrl, TOKEN_KEY } from '../lib/api';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  management: 'Management',
  ecommerce_client: 'Ecommerce Client',
  billing: 'Billing',
};

export default function Signup() {
  const router = useRouter();
  const { token: inviteToken } = router.query;
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState<boolean | null>(null);
  const [inviteRole, setInviteRole] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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
    const initial = saved === 'dark' || saved === 'light' ? saved : 'light';
    setTheme(initial as 'light' | 'dark');
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.body.classList.toggle('theme-dark', theme === 'dark');
    localStorage.setItem('unie-theme', theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (typeof inviteToken !== 'string' || !inviteToken) {
      setValidating(false);
      setValid(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/v1/auth/invite/validate?token=${encodeURIComponent(inviteToken)}`));
        const data = await res.json();
        if (cancelled) return;
        setValid(data.valid === true);
        setInviteRole(data.role || null);
      } catch {
        if (!cancelled) setValid(false);
      } finally {
        if (!cancelled) setValidating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  useEffect(() => {
    if (!mounted) return;
    const existing = localStorage.getItem(TOKEN_KEY);
    if (existing) {
      window.location.href = '/dashboard';
    }
  }, [mounted]);

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);
    if (typeof inviteToken !== 'string' || !inviteToken) {
      setError('Invalid or missing invite link.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/auth/invite/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: inviteToken,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || undefined,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Signup failed');
      }
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

  if (!mounted || validating) {
    return (
      <div className="auth-shell auth-shell-galaxy">
        <div className="auth-main" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="muted">Checking invite link…</div>
        </div>
      </div>
    );
  }

  if (valid === false) {
    return (
      <div className="auth-shell auth-shell-galaxy">
        <div className="auth-main" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="auth-card" style={{ maxWidth: 400 }}>
            <div className="auth-card-head">
              <div className="title">Invalid or expired link</div>
              <div className="muted">This invite link is missing, expired, or has already been used. Ask your admin for a new link.</div>
            </div>
            <a href="/login" className="button-primary" style={{ display: 'inline-block', marginTop: 16 }}>
              Go to login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell auth-shell-galaxy">
      <div className="auth-galaxy-bg" aria-hidden />
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
              <div className="eyebrow">You&apos;re invited</div>
              <div className="title">Create your account</div>
              <div className="muted">
                {inviteRole ? `You will be added as ${ROLE_LABELS[inviteRole] || inviteRole}.` : 'Complete the form below.'}
              </div>
            </div>
          </div>

          <form className="auth-form" onSubmit={handleSignup}>
            <div className="field">
              <label htmlFor="firstName">First name</label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                autoComplete="given-name"
              />
            </div>
            <div className="field">
              <label htmlFor="lastName">Last name</label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                autoComplete="family-name"
              />
            </div>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone (optional)</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900"
                autoComplete="tel"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="login-actions">
              <button className="button-primary" type="submit" disabled={loading}>
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </div>

            {error ? <div className="alert error">{error}</div> : null}
            {statusMessage ? <div className="alert success">{statusMessage}</div> : null}
          </form>
        </div>
      </div>
    </div>
  );
}
