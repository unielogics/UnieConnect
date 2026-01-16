import { useEffect, useState } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.unieconnect.com';
const TOKEN_KEY = 'unie-token';

type Account = { id: string; channel: string; shopDomain?: string; status: string };

export default function Home() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [shopifyStatus, setShopifyStatus] = useState<'not_connected' | 'connected' | 'paused'>('not_connected');
  const [shopifyShop, setShopifyShop] = useState<string | undefined>(undefined);
  const [shopifyAccountId, setShopifyAccountId] = useState<string | undefined>(undefined);
  const [ebayStatus, setEbayStatus] = useState<'not_connected' | 'connected' | 'paused'>('not_connected');
  const [ebayAccountId, setEbayAccountId] = useState<string | undefined>(undefined);
  const [amazonStatus, setAmazonStatus] = useState<'not_connected' | 'connected' | 'paused'>('not_connected');
  const [amazonAccountId, setAmazonAccountId] = useState<string | undefined>(undefined);
  const [amazonSeller, setAmazonSeller] = useState<string | undefined>(undefined);
  const [amazonMarketplaces, setAmazonMarketplaces] = useState<string[]>([]);
  const [amazonRegion, setAmazonRegion] = useState<string | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const [ebayRefreshMsg, setEbayRefreshMsg] = useState<string | null>(null);
  const [amazonMsg, setAmazonMsg] = useState<string | null>(null);

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
        const ebay = Array.isArray(accounts) ? accounts.find((a) => a.channel === 'ebay') : null;
        const amazon = Array.isArray(accounts) ? accounts.find((a) => a.channel === 'amazon') : null;
        if (shopify) {
          setShopifyStatus(shopify.status === 'active' ? 'connected' : 'paused');
          setShopifyShop(shopify.shopDomain);
          setShopifyAccountId(shopify.id);
        } else {
          setShopifyStatus('not_connected');
          setShopifyShop(undefined);
          setShopifyAccountId(undefined);
        }
        if (ebay) {
          setEbayStatus(ebay.status === 'active' ? 'connected' : 'paused');
          setEbayAccountId(ebay.id);
        } else {
          setEbayStatus('not_connected');
          setEbayAccountId(undefined);
        }
        if (amazon) {
          setAmazonStatus(amazon.status === 'active' ? 'connected' : 'paused');
          setAmazonAccountId(amazon.id);
          setAmazonSeller((amazon as any).sellingPartnerId);
          setAmazonMarketplaces(Array.isArray((amazon as any).marketplaceIds) ? (amazon as any).marketplaceIds : []);
          setAmazonRegion((amazon as any).region);
        } else {
          setAmazonStatus('not_connected');
          setAmazonAccountId(undefined);
          setAmazonSeller(undefined);
          setAmazonMarketplaces([]);
          setAmazonRegion(undefined);
        }
      })
      .catch(() => {
        setShopifyStatus('not_connected');
        setShopifyShop(undefined);
        setShopifyAccountId(undefined);
        setEbayStatus('not_connected');
        setEbayAccountId(undefined);
        setAmazonStatus('not_connected');
        setAmazonAccountId(undefined);
        setAmazonSeller(undefined);
        setAmazonMarketplaces([]);
        setAmazonRegion(undefined);
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
    const auth: HeadersInit = token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
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

  const handleConnectEbay = () => {
    const tenantId = 'demo-tenant'; // TODO: replace with real tenant/user context
    const url = `${BACKEND_URL}/api/v1/auth/ebay/start?tenantId=${encodeURIComponent(tenantId)}`;
    window.location.href = url;
  };

  const handleManualRefresh = async () => {
    if (!shopifyAccountId || !token) {
      setRefreshMsg('No connected Shopify account to refresh.');
      return;
    }
    setRefreshMsg('Refreshing…');
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/channel-accounts/${shopifyAccountId}/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Refresh failed');
      }
      setRefreshMsg('Manual refresh triggered.');
    } catch (err: any) {
      setRefreshMsg(err?.message || 'Refresh failed');
    }
  };

  const handleManualRefreshEbay = async () => {
    if (!ebayAccountId || !token) {
      setEbayRefreshMsg('No connected eBay account to refresh.');
      return;
    }
    setEbayRefreshMsg('Refreshing…');
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/channel-accounts/${ebayAccountId}/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Refresh failed');
      }
      setEbayRefreshMsg('Manual refresh triggered.');
    } catch (err: any) {
      setEbayRefreshMsg(err?.message || 'Refresh failed');
    }
  };

  const handleConnectAmazon = () => {
    const region = window.prompt('Enter Amazon region (na, eu, fe):', 'na') || 'na';
    const url = `${BACKEND_URL}/api/v1/auth/amazon/start?region=${encodeURIComponent(region)}`;
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
          <a className="active" href="/">
            Integrations
          </a>
          <a href="/items">Items</a>
          <a href="/customers">Customers</a>
          <a href="/orders">Orders</a>
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
                <button className="button-secondary" onClick={handleManualRefresh} disabled={!shopifyAccountId}>
                  Refresh now
                </button>
              </div>
              {refreshMsg ? (
                <div className="muted" style={{ marginTop: 6, color: refreshMsg.includes('fail') ? 'red' : 'inherit' }}>
                  {refreshMsg}
                </div>
              ) : null}
            </div>
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="title">eBay</div>
                <span className={`badge status ${ebayStatus.replace('_', '-')}`}>
                  {ebayStatus === 'not_connected' ? 'Not connected' : ebayStatus === 'connected' ? 'Connected' : 'Paused'}
                </span>
              </div>
              <div className="caps">
                {['Orders', 'Inventory'].map((cap) => (
                  <span key={cap} className="badge">
                    {cap}
                  </span>
                ))}
              </div>
              <div className="muted">Import orders and inventory from eBay into UnieConnect.</div>
              <div className="card-footer">
                <button className="button-primary" onClick={handleConnectEbay}>
                  {ebayStatus === 'connected' ? 'Manage' : 'Connect'}
                </button>
                <button className="button-secondary" onClick={handleManualRefreshEbay} disabled={!ebayAccountId}>
                  Refresh now
                </button>
              </div>
              {ebayRefreshMsg ? (
                <div className="muted" style={{ marginTop: 6, color: ebayRefreshMsg.includes('fail') ? 'red' : 'inherit' }}>
                  {ebayRefreshMsg}
                </div>
              ) : null}
            </div>
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="title">
                  Amazon {amazonSeller ? `(${amazonSeller})` : ''} {amazonRegion ? `• ${amazonRegion.toUpperCase()}` : ''}
                </div>
                <span className={`badge status ${amazonStatus.replace('_', '-')}`}>
                  {amazonStatus === 'not_connected' ? 'Not connected' : amazonStatus === 'connected' ? 'Connected' : 'Paused'}
                </span>
              </div>
              <div className="caps">
                {['Orders', 'Inventory', 'Fulfillment', 'FBA Inbound'].map((cap) => (
                  <span key={cap} className="badge">
                    {cap}
                  </span>
                ))}
              </div>
              <div className="muted">
                {amazonMarketplaces.length
                  ? `Marketplaces: ${amazonMarketplaces.join(', ')}`
                  : 'Connect to start syncing Amazon (SP-API).'}
              </div>
              <div className="card-footer">
                <button className="button-primary" onClick={handleConnectAmazon}>
                  {amazonStatus === 'connected' ? 'Manage' : 'Connect'}
                </button>
                <button className="button-secondary" disabled>
                  Refresh soon
                </button>
              </div>
              {amazonMsg ? (
                <div className="muted" style={{ marginTop: 6, color: amazonMsg.includes('fail') ? 'red' : 'inherit' }}>
                  {amazonMsg}
                </div>
              ) : null}
            </div>
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="title">More marketplaces</div>
                <span className="badge status paused">Coming soon</span>
              </div>
              <div className="muted">TikTok, Elsy, Wayfair will appear here once enabled.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

