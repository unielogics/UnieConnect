import { useEffect, useState } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4001';
const TOKEN_KEY = 'unie-token';

type Order = {
  _id: string;
  channel: string;
  externalOrderId: string;
  status: string;
  currency?: string;
  totals?: { total?: number };
  placedAt?: string;
  createdAt?: string;
};

export default function OrdersPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
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
    void loadOrders();
  }, [token]);

  const authHeaders: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;

  const loadOrders = async () => {
    setMessage(null);
    try {
    const res = await fetch(`${BACKEND_URL}/api/v1/orders`, { headers: authHeaders });
      const json = await res.json();
      setOrders(Array.isArray(json) ? json : []);
    } catch (err: any) {
      setMessage(err?.message || 'Failed to load orders');
    }
  };

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
          <a href="/customers">Customers</a>
          <a className="active" href="/orders">
            Orders
          </a>
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <div className="section-title" style={{ margin: 0 }}>
              Orders
            </div>
            <div className="muted">Read-only view of channel orders.</div>
          </div>
          <div className="actions" />
        </header>
        <div className="content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {message ? (
            <div className="card" style={{ color: message.toLowerCase().includes('fail') ? 'red' : 'green' }}>
              {message}
            </div>
          ) : null}

          <div className="card">
            <div className="title">Recent orders</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Channel</th>
                    <th style={th}>External ID</th>
                    <th style={th}>Status</th>
                    <th style={th}>Total</th>
                    <th style={th}>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o._id}>
                      <td style={td}>{o.channel}</td>
                      <td style={td}>{o.externalOrderId}</td>
                      <td style={td}>{o.status}</td>
                      <td style={td}>
                        {o.totals?.total != null ? `${o.currency || ''} ${o.totals.total}` : '—'}
                      </td>
                      <td style={td}>{o.placedAt ? new Date(o.placedAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
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


