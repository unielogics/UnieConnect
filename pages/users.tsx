import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../components/DashboardLayout';
import { TOKEN_KEY, apiUrl } from '../lib/api';
import { fetchCurrentUser, canManageUsers } from '../lib/user';
import type { UserRole } from '../lib/user';

type ApiUser = {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  lastLoginAt?: string;
  createdAt: string;
};

const ALL_ROLES: UserRole[] = ['super_admin', 'management', 'ecommerce_client', 'billing'];

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  management: 'Management',
  ecommerce_client: 'Ecommerce Client',
  billing: 'Billing',
};

function displayName(u: ApiUser): string {
  if (u.firstName || u.lastName) {
    return [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  }
  return u.email;
}

function initialsForUser(u: ApiUser): string {
  const parts = [u.firstName, u.lastName].filter(Boolean).map((value) => String(value).trim());
  if (parts.length > 0) {
    return parts
      .map((value) => value.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  }
  return u.email.slice(0, 2).toUpperCase();
}

function formatDate(value?: string, includeTime = false): string {
  if (!value) return 'Never';
  const date = new Date(value);
  return includeTime ? date.toLocaleString() : date.toLocaleDateString();
}

export default function UsersPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'create'>('active');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('ecommerce_client');
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createError, setCreateError] = useState(false);
  const [creating, setCreating] = useState(false);

  const [inviteRole, setInviteRole] = useState<UserRole>('ecommerce_client');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

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
    if (!mounted || !token) return;
    void (async () => {
      const user = await fetchCurrentUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      if (!canManageUsers(user.role)) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(apiUrl('/api/v1/users'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch users');
        const data = await res.json();
        setUsers(data.users || []);
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [mounted, token]);

  const loadUsers = async () => {
    if (!token) return;
    const res = await fetch(apiUrl('/api/v1/users'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users || []);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMsg(null);
    setCreateError(false);
    if (!email.trim() || !password) {
      setCreateMsg('Email and password are required');
      setCreateError(true);
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(apiUrl('/api/v1/users'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          role,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }
      setCreateMsg('User created successfully');
      setCreateError(false);
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setRole('ecommerce_client');
      void loadUsers();
    } catch (err) {
      setCreateMsg(err instanceof Error ? err.message : 'Failed to create user');
      setCreateError(true);
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateInvite = async () => {
    if (!token) return;
    setInviteLoading(true);
    setInviteLink(null);
    try {
      const res = await fetch(apiUrl('/api/v1/users/invites'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate invite');
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const link = data.inviteLink?.startsWith('http') ? data.inviteLink : `${base}${data.inviteLink || ''}`;
      setInviteLink(link);
    } catch {
      setInviteLink(null);
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInviteLink = () => {
    if (!inviteLink) return;
    void navigator.clipboard.writeText(inviteLink).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    });
  };

  if (!mounted || loading) {
    return (
      <DashboardLayout title="Users" subtitle="Manage users">
        <div className="card">
          <div className="muted">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (accessDenied) {
    return (
      <DashboardLayout title="Users" subtitle="Manage users">
        <div className="card">
          <div className="title">Access denied</div>
          <div className="muted">You do not have permission to manage users.</div>
          <button className="button-primary" onClick={() => router.push('/dashboard')}>
            Go to dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Users" subtitle="Create and manage users">
      <div
        className={`users-page-shell ${activeTab === 'active' ? 'users-page-shell-wide' : ''}`}
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'active'}
            className={activeTab === 'active' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('active')}
          >
            Active users
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'create'}
            className={activeTab === 'create' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('create')}
          >
            Create user
          </button>
        </div>

        {activeTab === 'active' && (
          <section className="card users-table-card">
            <div className="title">Active users</div>
            <div className="muted">A structured view of your active team members and their recent platform access.</div>
            {users.length === 0 ? (
              <div className="profile-dummy-block">
                <div className="muted">No users yet. Create one in the Create user tab.</div>
              </div>
            ) : (
              <div className="users-table-wrap">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Contact</th>
                      <th>Role</th>
                      <th>Activity</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="user-identity">
                            <div className="user-avatar">{initialsForUser(u)}</div>
                            <div className="user-copy">
                              <div className="user-primary">{displayName(u)}</div>
                              <div className="user-secondary">User ID: {u.id.slice(-8).toUpperCase()}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="user-meta-stack">
                            <div className="user-primary">{u.email}</div>
                            <div className="user-secondary">{u.phone || 'No phone number added'}</div>
                          </div>
                        </td>
                        <td>
                          <span className="badge user-role-badge">{ROLE_LABELS[u.role as UserRole] || u.role}</span>
                        </td>
                        <td>
                          <div className="user-meta-stack">
                            <div className="user-metric">
                              <span className="user-metric-label">Last login</span>
                              <span className="user-metric-value">{formatDate(u.lastLoginAt, true)}</span>
                            </div>
                            <div className="user-metric">
                              <span className="user-metric-label">Joined</span>
                              <span className="user-metric-value">{formatDate(u.createdAt)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="users-table-actions">
                          <Link href={`/users/${u.id}/activity`} className="button-secondary users-table-action">
                            View activity
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'create' && (
          <>
            <section className="card">
              <div className="title">Create user</div>
              <div className="muted">Add a new user directly. Name and phone are optional.</div>
              <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="muted" style={{ fontSize: 13 }}>First name</span>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First"
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="muted" style={{ fontSize: 13 }}>Last name</span>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last"
                    />
                  </label>
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted" style={{ fontSize: 13 }}>Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@company.com"
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted" style={{ fontSize: 13 }}>Phone</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 234 567 8900"
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted" style={{ fontSize: 13 }}>Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted" style={{ fontSize: 13 }}>Role</span>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="button-primary" disabled={creating}>
                  {creating ? 'Creating…' : 'Create user'}
                </button>
                {createMsg && (
                  <div
                    className="muted"
                    style={{
                      fontSize: 13,
                      color: createError ? 'var(--error, #b91c1c)' : 'var(--success, #15803d)',
                    }}
                  >
                    {createMsg}
                  </div>
                )}
              </form>
            </section>

          <section className="card">
            <div className="title">Invite link</div>
            <div className="muted">
              Generate a link for someone to sign up. They will choose their name, email, phone, and password; the role is fixed by the link.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480, marginTop: 16 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="muted" style={{ fontSize: 13 }}>Role for invited user</span>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button-primary"
                onClick={handleGenerateInvite}
                disabled={inviteLoading}
              >
                {inviteLoading ? 'Generating…' : 'Generate link'}
              </button>
              {inviteLink && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="muted" style={{ fontSize: 13 }}>Share this link (expires in 7 days)</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      readOnly
                      value={inviteLink}
                      style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
                    />
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={copyInviteLink}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {inviteCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
