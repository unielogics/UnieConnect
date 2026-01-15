import { useEffect, useState } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4001';
const TOKEN_KEY = 'unie-token';

type Customer = { _id: string; email?: string; phone?: string; name?: { first?: string; last?: string } };
type CustomerMapping = {
  _id: string;
  customerId: string;
  channelAccountId: string;
  channel: string;
  externalId: string;
  syncedAt?: string;
};
type ChannelAccount = { _id: string; channel: string; shopDomain?: string; status: string };

export default function CustomersPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [mappings, setMappings] = useState<CustomerMapping[]>([]);
  const [accounts, setAccounts] = useState<ChannelAccount[]>([]);
  const [createEmail, setCreateEmail] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createName, setCreateName] = useState('');
  const [mapCustomerId, setMapCustomerId] = useState('');
  const [mapChannelAccountId, setMapChannelAccountId] = useState('');
  const [mapExternalId, setMapExternalId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('unie-theme');
    const initial =
      saved === 'dark' || saved === 'light'
        ? saved
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    setTheme(initial as 'light' | 'dark');
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (!savedToken) {
      window.location.href = '/login';
      return;
    }
    setToken(savedToken);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.body.classList.toggle('theme-dark', theme === 'dark');
    localStorage.setItem('unie-theme', theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!token) return;
    void loadData();
  }, [token]);

  const authHeaders: HeadersInit | undefined = token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : undefined;

  const loadData = async () => {
    setMessage(null);
    try {
      const [custRes, mapRes, acctRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/customers`, { headers: authHeaders }),
        fetch(`${BACKEND_URL}/api/v1/mappings/customers`, { headers: authHeaders }),
        fetch(`${BACKEND_URL}/api/v1/channel-accounts`, { headers: authHeaders }),
      ]);
      const [custJson, mapJson, acctJson] = await Promise.all([custRes.json(), mapRes.json(), acctRes.json()]);
      setCustomers(Array.isArray(custJson) ? custJson : []);
      setMappings(Array.isArray(mapJson?.mappings) ? mapJson.mappings : []);
      setAccounts(Array.isArray(acctJson) ? acctJson : []);
    } catch (err: any) {
      setMessage(err?.message || 'Failed to load customers');
    }
  };

  const handleCreate = async () => {
    if (!createEmail && !createPhone) {
      setMessage('Email or phone required');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const [first, last] = (createName || '').split(' ');
      const res = await fetch(`${BACKEND_URL}/api/v1/customers`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email: createEmail, phone: createPhone, name: { first, last } }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Create failed');
      }
      setCreateEmail('');
      setCreatePhone('');
      setCreateName('');
      await loadData();
      setMessage('Customer created');
    } catch (err: any) {
      setMessage(err?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const handleMap = async () => {
    if (!mapCustomerId || !mapChannelAccountId || !mapExternalId) {
      setMessage('Customer, channel account, and external id are required');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/customers/${mapCustomerId}/map`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          channelAccountId: mapChannelAccountId,
          externalId: mapExternalId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Map failed');
      }
      setMapExternalId('');
      await loadData();
      setMessage('Mapping saved');
    } catch (err: any) {
      setMessage(err?.message || 'Map failed');
    } finally {
      setBusy(false);
    }
  };

  const mappingByCustomer = mappings.reduce<Record<string, CustomerMapping[]>>((acc, m) => {
    if (!acc[m.customerId]) acc[m.customerId] = [];
    acc[m.customerId].push(m);
    return acc;
  }, {});

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>UnieConnect</span>
        </div>
        <button className="collapse" onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <nav className="nav">
          <a href="/">Integrations</a>
          <a href="/items">Items</a>
          <a className="active" href="/customers">
            Customers
          </a>
          <a href="/orders">Orders</a>
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <div className="section-title" style={{ margin: 0 }}>
              Customers & Mappings
            </div>
            <div className="muted">Create customers and map to marketplace identities.</div>
          </div>
          <div className="actions" />
        </header>
        <div className="content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="title">Create customer</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                placeholder="Email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                style={{ flex: '1 1 200px', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
              />
              <input
                placeholder="Phone"
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                style={{ flex: '1 1 200px', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
              />
              <input
                placeholder="Name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                style={{ flex: '2 1 260px', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
              />
              <button className="button-primary" onClick={handleCreate} disabled={busy}>
                {busy ? 'Working…' : 'Create'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="title">Map customer to channel</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                value={mapCustomerId}
                onChange={(e) => setMapCustomerId(e.target.value)}
                style={{ flex: '1 1 200px', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.email || c.phone || c._id}
                  </option>
                ))}
              </select>
              <select
                value={mapChannelAccountId}
                onChange={(e) => setMapChannelAccountId(e.target.value)}
                style={{ flex: '1 1 200px', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
              >
                <option value="">Channel account</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.channel} {a.shopDomain ? `(${a.shopDomain})` : ''}
                  </option>
                ))}
              </select>
              <input
                placeholder="External customer id"
                value={mapExternalId}
                onChange={(e) => setMapExternalId(e.target.value)}
                style={{ flex: '1 1 240px', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
              />
              <button className="button-primary" onClick={handleMap} disabled={busy}>
                {busy ? 'Working…' : 'Save mapping'}
              </button>
            </div>
          </div>

          {message ? (
            <div className="card" style={{ color: message.toLowerCase().includes('fail') ? 'red' : 'green' }}>
              {message}
            </div>
          ) : null}

          <div className="card">
            <div className="title">Customers</div>
            <div className="muted">Mapped channels are listed per customer.</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Identity</th>
                    <th style={th}>Mappings</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const links = mappingByCustomer[c._id] || [];
                    const name = c.name?.first || c.name?.last ? `${c.name?.first || ''} ${c.name?.last || ''}`.trim() : '';
                    const identity = name || c.email || c.phone || c._id;
                    return (
                      <tr key={c._id}>
                        <td style={td}>{identity}</td>
                        <td style={td}>
                          {links.length === 0 ? (
                            <span className="muted">Unmapped</span>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {links.map((m) => (
                                <span key={m._id} className="badge">
                                  {m.channel} {m.externalId}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' };
const td: React.CSSProperties = { padding: '8px 6px', borderBottom: '1px solid var(--border)' };


