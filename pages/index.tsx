import { useEffect, useState } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4001';
const TOKEN_KEY = 'unie-token';

type Account = { id: string; channel: string; shopDomain?: string; status: string };

export default function Home() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [shopifyStatus, setShopifyStatus] = useState<'not_connected' | 'connected' | 'paused'>('not_connected');
  const [shopifyShop, setShopifyShop] = useState<string | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

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
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.body.classList.toggle('theme-dark', theme === 'dark');
    localStorage.setItem('unie-theme', theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
    } else {
      window.location.href = '/login';
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !token) return;
    const auth = { Authorization: `Bearer ${token}` };
    fetch(`${BACKEND_URL}/api/v1/channel-accounts`, { headers: auth })
      .then((res) => res.json())
      .then((accounts: Account[]) => {
        const shopify = Array.isArray(accounts)
          ? accounts.find((a) => a.channel === 'shopify')
          : null;
        if (shopify) {
          setShopifyStatus(shopify.status === 'active' ? 'connected' : 'paused');
          setShopifyShop(shopify.shopDomain);
        } else {
          setShopifyStatus('not_connected');
          setShopifyShop(undefined);
        }
      })
      .catch(() => {
        setShopifyStatus('not_connected');
        setShopifyShop(undefined);
      });
  }, [mounted, token]);

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    setShopifyStatus('not_connected');
    setShopifyShop(undefined);
    setShowChangePwd(false);
    window.location.href = '/login';
  };

  const handleChangePassword = () => {
    setPwdMsg(null);
    const auth: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    fetch(`${BACKEND_URL}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Change password failed');
        }
        setPwdMsg('Password updated');
        setOldPwd('');
        setNewPwd('');
      })
      .catch((err: any) => setPwdMsg(err?.message || 'Change password failed'));
  };

  const handleConnectShopify = () => {
    const shop = window.prompt('Enter your shop domain (e.g., myshop.myshopify.com):', 'myshop.myshopify.com');
    const tenantId = 'demo-tenant'; // TODO: replace with real tenant/user context
    if (!shop) return;
    const url = `${BACKEND_URL}/api/v1/auth/shopify/start?shop=${encodeURIComponent(shop)}&tenantId=${encodeURIComponent(tenantId)}`;
    window.location.href = url;
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span>UnieConnect</span>
        </div>
        <button className="collapse" onClick={() => setSidebarCollapsed((v) => !v)}>
          {sidebarCollapsed ? '›' : '‹'}
        </button>
        <nav className="nav">
          <a className="active" href="#">
            Integrations
          </a>
          <a href="#">Items / Inventory</a>
          <a href="#">Orders</a>
          <a href="#">Customers</a>
          <a href="#">Activity</a>
          <a href="#">Settings</a>
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <div className="section-title" style={{ margin: 0 }}>
              Integrations
            </div>
            <div className="muted">Connect and manage marketplaces</div>
          </div>
          <div className="actions">
            <button className="icon-button" onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>
              <span suppressHydrationWarning>{mounted ? (theme === 'light' ? '🌙' : '☀️') : ' '}</span>
            </button>
            {token ? (
              <>
                <button className="icon-button" onClick={() => setShowChangePwd((v) => !v)}>🔒</button>
                <button className="icon-button" onClick={handleLogout}>🚪</button>
              </>
            ) : (
              <button className="icon-button" onClick={() => setShowChangePwd(false)}>👤</button>
            )}
          </div>
        </header>
        <div className="content">
          {showChangePwd && token ? (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="title">Change Password</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  type="password"
                  value={oldPwd}
                  onChange={(e) => setOldPwd(e.target.value)}
                  placeholder="Old password"
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="New password"
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <button className="button-primary" onClick={handleChangePassword}>
                  Update
                </button>
              </div>
              {pwdMsg ? (
                <div className="muted" style={{ color: pwdMsg.includes('failed') ? 'red' : 'green', marginTop: 6 }}>
                  {pwdMsg}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="card">
            <div className="title">Available Integrations</div>
            <div className="muted">Minimal, modern grid of marketplaces.</div>
          </div>
          <div className="card-grid" style={{ marginTop: 12 }}>
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="title">Shopify {shopifyShop ? `(${shopifyShop})` : ''}</div>
                <span className={`badge status ${shopifyStatus.replace('_', '-')}`}>
                  {shopifyStatus === 'not_connected' ? 'Not connected' : shopifyStatus === 'connected' ? 'Connected' : 'Paused'}
                </span>
              </div>
              <div className="caps">
                {['Orders', 'Inventory', 'Fulfillment', 'Labels'].map((cap) => (
                  <span key={cap} className="badge">
                    {cap}
                  </span>
                ))}
              </div>
              <div className="muted">Sync Orders, Inventory, Fulfillment, and Labels (when available).</div>
              <div className="card-footer">
                <button className="button-primary" onClick={handleConnectShopify}>
                  {shopifyStatus === 'connected' ? 'Manage' : 'Connect'}
                </button>
                <button className="button-secondary" disabled>
                  Details
                </button>
              </div>
            </div>
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="title">More marketplaces</div>
                <span className="badge status paused">Coming soon</span>
              </div>
              <div className="muted">Amazon, eBay, TikTok, Elsy, Wayfair will appear here once enabled.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

