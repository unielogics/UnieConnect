import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../components/DashboardLayout';
import { apiUrl, TOKEN_KEY } from '../lib/api';
import { fetchCurrentUser, canManageUsers } from '../lib/user';

type OmsAccount = { id: string; companyName: string; email: string; status: string; createdAt: string };
type Facility = { id: string; name: string; code: string; userId: string };

export default function OmsAdminPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accounts, setAccounts] = useState<OmsAccount[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);

  const [createCompany, setCreateCompany] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createError, setCreateError] = useState(false);
  const [creating, setCreating] = useState(false);

  const [linkAccountId, setLinkAccountId] = useState('');
  const [linkFacilityId, setLinkFacilityId] = useState('');
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [linkError, setLinkError] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);

  const [apiKeyAccountId, setApiKeyAccountId] = useState('');
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyRaw, setApiKeyRaw] = useState<string | null>(null);
  const [apiKeyMsg, setApiKeyMsg] = useState<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) {
      window.location.href = '/login';
      return;
    }
    setToken(saved);
  }, []);

  useEffect(() => {
    if (!mounted || !token) return;
    (async () => {
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
        const [accRes, facRes] = await Promise.all([
          fetch(apiUrl('/api/v1/oms/accounts'), { headers: { Authorization: `Bearer ${token}` } }),
          fetch(apiUrl('/api/v1/oms/facilities'), { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (accRes.ok) {
          const d = await accRes.json();
          setAccounts(d.accounts || []);
        }
        if (facRes.ok) {
          const d = await facRes.json();
          setFacilities(d.facilities || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [mounted, token]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !createCompany.trim() || !createEmail.trim()) return;
    setCreating(true);
    setCreateMsg(null);
    setCreateError(false);
    try {
      const res = await fetch(apiUrl('/api/v1/oms/accounts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyName: createCompany.trim(), email: createEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreateMsg('OMS account created.');
        setCreateCompany('');
        setCreateEmail('');
        setAccounts((prev) => [
          { id: data.id, companyName: data.companyName, email: data.email, status: data.status, createdAt: data.createdAt || new Date().toISOString() },
          ...prev,
        ]);
      } else {
        setCreateMsg(data.error || 'Failed to create account');
        setCreateError(true);
      }
    } catch (err) {
      setCreateMsg(err instanceof Error ? err.message : 'Failed');
      setCreateError(true);
    } finally {
      setCreating(false);
    }
  };

  const handleLinkWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !linkAccountId || !linkFacilityId) return;
    setLinkLoading(true);
    setLinkMsg(null);
    setLinkError(false);
    try {
      const res = await fetch(apiUrl(`/api/v1/oms/accounts/${linkAccountId}/link-warehouse`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ facilityId: linkFacilityId }),
      });
      const data = await res.json();
      if (res.ok) {
        setLinkMsg(data.message || 'Linked.');
        setLinkAccountId('');
        setLinkFacilityId('');
      } else {
        setLinkMsg(data.error || 'Failed');
        setLinkError(true);
      }
    } catch (err) {
      setLinkMsg(err instanceof Error ? err.message : 'Failed');
      setLinkError(true);
    } finally {
      setLinkLoading(false);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !apiKeyAccountId) return;
    setApiKeyLoading(true);
    setApiKeyRaw(null);
    setApiKeyMsg(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/oms/accounts/${apiKeyAccountId}/api-keys`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: apiKeyName.trim() || 'OMS API Key' }),
      });
      const data = await res.json();
      if (res.ok) {
        setApiKeyRaw(data.apiKey);
        setApiKeyMsg(data.warning || 'Save this key now. You cannot see it again.');
      } else {
        setApiKeyMsg(data.error || 'Failed');
      }
    } catch (err) {
      setApiKeyMsg(err instanceof Error ? err.message : 'Failed');
    } finally {
      setApiKeyLoading(false);
    }
  };

  if (!mounted || loading) {
    return (
      <DashboardLayout title="OMS administration" subtitle="Loading...">
        <div className="card">
          <div className="muted">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (accessDenied) {
    return (
      <DashboardLayout title="OMS administration" subtitle="Access denied">
        <div className="card">
          <div className="title">Access denied</div>
          <div className="muted">You need management or super admin role.</div>
          <button className="button-primary" style={{ marginTop: 16 }} onClick={() => router.push('/dashboard')}>
            Go to dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="OMS administration" subtitle="Manage OMS accounts and warehouse links">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <>
            <section className="card">
              <div className="title">Create OMS account</div>
              <div className="muted" style={{ marginBottom: 16 }}>
                OMS accounts can connect to warehouses via connection codes or direct links.
              </div>
              <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted" style={{ fontSize: 13 }}>Company name</span>
                  <input
                    type="text"
                    value={createCompany}
                    onChange={(e) => setCreateCompany(e.target.value)}
                    placeholder="Acme Inc"
                    required
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted" style={{ fontSize: 13 }}>Email</span>
                  <input
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="contact@acme.com"
                    required
                  />
                </label>
                <button type="submit" className="button-primary" disabled={creating}>
                  {creating ? 'Creating…' : 'Create account'}
                </button>
                {createMsg && (
                  <div className="muted" style={{ color: createError ? 'var(--error)' : 'var(--success)' }}>
                    {createMsg}
                  </div>
                )}
              </form>
            </section>

            <section className="card">
              <div className="title">Link OMS account to warehouse</div>
              <form onSubmit={handleLinkWarehouse} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted" style={{ fontSize: 13 }}>OMS account</span>
                  <select
                    value={linkAccountId}
                    onChange={(e) => setLinkAccountId(e.target.value)}
                    required
                    style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                  >
                    <option value="">Select account</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.companyName} ({a.email})
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted" style={{ fontSize: 13 }}>Facility (warehouse)</span>
                  <select
                    value={linkFacilityId}
                    onChange={(e) => setLinkFacilityId(e.target.value)}
                    required
                    style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                  >
                    <option value="">Select facility</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.code})
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="button-secondary" disabled={linkLoading}>
                  {linkLoading ? 'Linking…' : 'Link'}
                </button>
                {linkMsg && (
                  <div className="muted" style={{ color: linkError ? 'var(--error)' : 'var(--success)' }}>
                    {linkMsg}
                  </div>
                )}
              </form>
            </section>

            <section className="card">
              <div className="title">Create API key for OMS account</div>
              <form onSubmit={handleCreateApiKey} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted" style={{ fontSize: 13 }}>OMS account</span>
                  <select
                    value={apiKeyAccountId}
                    onChange={(e) => setApiKeyAccountId(e.target.value)}
                    required
                    style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                  >
                    <option value="">Select account</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.companyName} ({a.email})
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted" style={{ fontSize: 13 }}>Key name (optional)</span>
                  <input
                    type="text"
                    value={apiKeyName}
                    onChange={(e) => setApiKeyName(e.target.value)}
                    placeholder="Production key"
                  />
                </label>
                <button type="submit" className="button-secondary" disabled={apiKeyLoading}>
                  {apiKeyLoading ? 'Creating…' : 'Create API key'}
                </button>
                {apiKeyRaw && (
                  <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 13, wordBreak: 'break-all' }}>
                    <strong>API key (save now):</strong>
                    <pre style={{ marginTop: 8 }}>{apiKeyRaw}</pre>
                  </div>
                )}
                {apiKeyMsg && !apiKeyRaw && (
                  <div className="muted">{apiKeyMsg}</div>
                )}
              </form>
            </section>

            <section className="card">
              <div className="title">OMS accounts</div>
              {accounts.length === 0 ? (
                <div className="muted">No OMS accounts yet.</div>
              ) : (
                <table className="users-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.id}>
                        <td>{a.companyName}</td>
                        <td>{a.email}</td>
                        <td><span className="badge">{a.status}</span></td>
                        <td><code style={{ fontSize: 12 }}>{a.id.slice(-8)}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
        </>
      </div>
    </DashboardLayout>
  );
}
