import { useEffect, useState } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.unieconnect.com';
const TOKEN_KEY = 'unie-token';

type Item = { _id: string; sku: string; title: string; description?: string };
type ItemMapping = {
  _id: string;
  itemId: string;
  channelAccountId: string;
  channel: string;
  channelItemId: string;
  channelVariantId?: string;
  sku?: string;
  status?: string;
};
type ChannelAccount = { _id: string; channel: string; shopDomain?: string; status: string };

export default function ItemsPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [mappings, setMappings] = useState<ItemMapping[]>([]);
  const [accounts, setAccounts] = useState<ChannelAccount[]>([]);
  const [createSku, setCreateSku] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [mapItemId, setMapItemId] = useState('');
  const [mapChannelAccountId, setMapChannelAccountId] = useState('');
  const [mapChannelItemId, setMapChannelItemId] = useState('');
  const [mapChannelVariantId, setMapChannelVariantId] = useState('');
  const [mapSku, setMapSku] = useState('');
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
      const [itemsRes, mapsRes, acctRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/items`, { headers: authHeaders }),
        fetch(`${BACKEND_URL}/api/v1/mappings/items`, { headers: authHeaders }),
        fetch(`${BACKEND_URL}/api/v1/channel-accounts`, { headers: authHeaders }),
      ]);
      const [itemsJson, mapsJson, accountsJson] = await Promise.all([itemsRes.json(), mapsRes.json(), acctRes.json()]);
      setItems(Array.isArray(itemsJson) ? itemsJson : []);
      setMappings(Array.isArray(mapsJson?.mappings) ? mapsJson.mappings : []);
      setAccounts(Array.isArray(accountsJson) ? accountsJson : []);
    } catch (err: any) {
      setMessage(err?.message || 'Failed to load items');
    }
  };

  const handleCreateItem = async () => {
    if (!createSku || !createTitle) {
      setMessage('SKU and title are required');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/items`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ sku: createSku, title: createTitle, description: createDesc }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Create failed');
      }
      setCreateSku('');
      setCreateTitle('');
      setCreateDesc('');
      await loadData();
      setMessage('Item created');
    } catch (err: any) {
      setMessage(err?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const handleMap = async () => {
    if (!mapItemId || !mapChannelAccountId || !mapChannelItemId) {
      setMessage('Item, channel account, and channel item id are required');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/items/${mapItemId}/map`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          channelAccountId: mapChannelAccountId,
          channelItemId: mapChannelItemId,
          channelVariantId: mapChannelVariantId || undefined,
          sku: mapSku || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Map failed');
      }
      setMapChannelItemId('');
      setMapChannelVariantId('');
      setMapSku('');
      await loadData();
      setMessage('Mapping saved');
    } catch (err: any) {
      setMessage(err?.message || 'Map failed');
    } finally {
      setBusy(false);
    }
  };

  const mappingByItem = mappings.reduce<Record<string, ItemMapping[]>>((acc, m) => {
    if (!acc[m.itemId]) acc[m.itemId] = [];
    acc[m.itemId].push(m);
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
          <a className="active" href="/items">
            Items
          </a>
          <a href="/customers">Customers</a>
          <a href="/orders">Orders</a>
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <div className="section-title" style={{ margin: 0 }}>
              Items & Mappings
            </div>
            <div className="muted">Create SKUs and map them to marketplace listings/variants.</div>
          </div>
          <div className="actions" />
        </header>
        <div className="content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="title">Create item</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                placeholder="SKU"
                value={createSku}
                onChange={(e) => setCreateSku(e.target.value)}
                style={{ flex: '1 1 160px', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
              />
              <input
                placeholder="Title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                style={{ flex: '2 1 260px', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
              />
              <input
                placeholder="Description (optional)"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                style={{ flex: '3 1 320px', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
              />
              <button className="button-primary" onClick={handleCreateItem} disabled={busy}>
                {busy ? 'Working…' : 'Create'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="title">Map item to channel</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                value={mapItemId}
                onChange={(e) => setMapItemId(e.target.value)}
                style={{ flex: '1 1 200px', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
              >
                <option value="">Select item</option>
                {items.map((i) => (
                  <option key={i._id} value={i._id}>
                    {i.sku} — {i.title}
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
                placeholder="Channel item id"
                value={mapChannelItemId}
                onChange={(e) => setMapChannelItemId(e.target.value)}
                style={{ flex: '1 1 180px', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
              />
              <input
                placeholder="Channel variant id (optional)"
                value={mapChannelVariantId}
                onChange={(e) => setMapChannelVariantId(e.target.value)}
                style={{ flex: '1 1 180px', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
              />
              <input
                placeholder="SKU override (optional)"
                value={mapSku}
                onChange={(e) => setMapSku(e.target.value)}
                style={{ flex: '1 1 160px', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
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
            <div className="title">Items</div>
            <div className="muted">Mapped channels are listed by item.</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>SKU</th>
                    <th style={th}>Title</th>
                    <th style={th}>Mappings</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const links = mappingByItem[i._id] || [];
                    return (
                      <tr key={i._id}>
                        <td style={td}>{i.sku}</td>
                        <td style={td}>{i.title}</td>
                        <td style={td}>
                          {links.length === 0 ? (
                            <span className="muted">Unmapped</span>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {links.map((m) => (
                                <span key={m._id} className="badge">
                                  {m.channel} {m.channelItemId}
                                  {m.channelVariantId ? ` / ${m.channelVariantId}` : ''}
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


