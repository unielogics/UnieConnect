import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/DashboardLayout';
import { TOKEN_KEY, apiUrl } from '../../../lib/api';
import { fetchCurrentUser, canManageUsers } from '../../../lib/user';

type ActivityEvent = {
  action: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  password_change: 'Password changed',
  invite_signup: 'Signed up via invite',
  user_created: 'Account created by admin',
};

export default function UserActivityPage() {
  const router = useRouter();
  const { id: userId } = router.query;
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (!savedToken) {
      window.location.href = '/login';
      return;
    }
    setToken(savedToken);
  }, []);

  useEffect(() => {
    if (!mounted || !token || typeof userId !== 'string') return;
    let cancelled = false;
    (async () => {
      const user = await fetchCurrentUser();
      if (!user) {
        if (!cancelled) window.location.href = '/login';
        return;
      }
      if (!canManageUsers(user.role)) {
        if (!cancelled) setAccessDenied(true);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(apiUrl(`/api/v1/users/${userId}/activity`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load activity');
        const data = await res.json();
        if (!cancelled) setEvents(data.events || []);
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, token, userId]);

  if (!mounted || loading) {
    return (
      <DashboardLayout title="User activity" subtitle="Loading…">
        <div className="card">
          <div className="muted">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (accessDenied) {
    return (
      <DashboardLayout title="User activity" subtitle="Access denied">
        <div className="card">
          <div className="title">Access denied</div>
          <div className="muted">You do not have permission to view user activity.</div>
          <button className="button-primary" onClick={() => router.push('/dashboard')}>
            Go to dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="User activity" subtitle="Activity log for this user">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
        <div>
          <Link href="/users" className="muted" style={{ fontSize: 14, textDecoration: 'none' }}>
            ← Back to Users
          </Link>
        </div>
        <section className="card">
          <div className="title">Activity</div>
          <div className="muted">Recent events for this user (newest first).</div>
          {events.length === 0 ? (
            <div className="profile-dummy-block">
              <div className="muted">No activity recorded yet.</div>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginTop: 16 }}>
              {events.map((e, i) => (
                <li
                  key={i}
                  style={{
                    padding: '12px 0',
                    borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 16,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>
                    {ACTION_LABELS[e.action] || e.action}
                  </span>
                  <span className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                    {e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
