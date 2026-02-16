import { useEffect, useState } from 'react';
import { apiUrl, getApiOrigin, TOKEN_KEY } from '../lib/api';

type Account = { id: string; channel: string; shopDomain?: string; status: string };
type Channel = 'shopify' | 'amazon' | 'ebay';

function normalizeShopifyShopInput(raw: string): { shop: string | null; error?: string } {
  const input = String(raw || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim()
    .toLowerCase();

  if (!input) return { shop: null, error: 'Shop domain is required' };

  const fromAdminPath = (pathname: string) => {
    const parts = pathname.split('/').filter(Boolean);
    // admin.shopify.com/store/<store-handle>/...
    const storeIdx = parts.findIndex((p) => p === 'store');
    const handle = storeIdx >= 0 ? parts[storeIdx + 1] : undefined;
    return handle || '';
  };

  const coerceToHostOrHandle = () => {
    // If user pasted a full URL without protocol, try to help
    const maybeUrl = input.includes('://') ? input : input.startsWith('//') ? `https:${input}` : '';
    if (maybeUrl) {
      try {
        const u = new URL(maybeUrl);
        const host = u.hostname.toLowerCase().replace(/^www\./, '');
        if (host === 'admin.shopify.com') {
          const handle = fromAdminPath(u.pathname);
          return handle || host;
        }
        return host;
      } catch {
        // fall through
      }
    }

    // Try parsing if it looks like a URL without protocol (e.g. myshop.myshopify.com/admin)
    if (input.includes('/') || input.includes('?')) {
      try {
        const u = new URL(`https://${input.replace(/^\/+/, '')}`);
        const host = u.hostname.toLowerCase().replace(/^www\./, '');
        if (host === 'admin.shopify.com') {
          const handle = fromAdminPath(u.pathname);
          return handle || host;
        }
        return host;
      } catch {
        // fall through
      }
    }

    return input.replace(/^www\./, '');
  };

  let hostOrHandle = coerceToHostOrHandle()
    .replace(/\/+$/, '')
    .replace(/\.+$/, '')
    .trim();

  // If a full host was pasted, drop everything except the first label (shop name) if it's already myshopify.com
  if (hostOrHandle.endsWith('.myshopify.com')) {
    // ok
  } else if (!hostOrHandle.includes('.')) {
    // user typed "myshop" or extracted handle from admin.shopify.com
    hostOrHandle = `${hostOrHandle}.myshopify.com`;
  }

  const shop = hostOrHandle;
  const ok = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
  if (!ok) return { shop: null, error: 'Enter a valid Shopify shop domain (e.g. myshop.myshopify.com)' };
  return { shop };
}

export default function Home() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [shopifyStatus, setShopifyStatus] = useState<'not_connected' | 'connected' | 'paused'>('not_connected');
  const [shopifyShop, setShopifyShop] = useState<string | undefined>(undefined);
  const [amazonStatus, setAmazonStatus] = useState<'not_connected' | 'connected' | 'paused'>('not_connected');
  const [ebayStatus, setEbayStatus] = useState<'not_connected' | 'connected' | 'paused'>('not_connected');
  const [token, setToken] = useState<string | null>(null);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [integrationMsg, setIntegrationMsg] = useState<string | null>(null);
  const [integrationMsgType, setIntegrationMsgType] = useState<'success' | 'error' | null>(null);
  const [accountsByChannel, setAccountsByChannel] = useState<Partial<Record<Channel, Account>>>({});
  const [manageChannel, setManageChannel] = useState<Channel | null>(null);
  const [manageBusy, setManageBusy] = useState<null | 'refresh' | 'disconnect'>(null);
  const [shopifyConnectOpen, setShopifyConnectOpen] = useState(false);
  const [shopifyShopInput, setShopifyShopInput] = useState('');
  const [shopifyShopError, setShopifyShopError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    if (window.location.hostname === 'unieconnect.com') {
      window.location.href = `https://user.unieconnect.com${window.location.pathname}${window.location.search}`;
      return;
    }
    console.info('[unieconnect][config]', { apiOrigin: getApiOrigin(), host: window.location.host });
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
    void loadAccounts(token);
  }, [mounted, token]);

  // Handle post-OAuth redirect: ?success=shopify|amazon or ?error=...&message=...
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    const message = params.get('message');
    if (success === 'shopify' || success === 'amazon') {
      setIntegrationMsgType('success');
      setIntegrationMsg(`${success === 'shopify' ? 'Shopify' : 'Amazon'} connected successfully.`);
      if (token) void loadAccounts(token);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error && message) {
      setIntegrationMsgType('error');
      setIntegrationMsg(`Connection failed: ${decodeURIComponent(message)}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [mounted, token]);

  const loadAccounts = async (authToken: string) => {
    const auth = { Authorization: `Bearer ${authToken}` };
    fetch(apiUrl('/api/v1/channel-accounts'), { headers: auth })
      .then((res) => res.json())
      .then((accounts: Account[]) => {
        const list = Array.isArray(accounts) ? accounts : [];
        const shopify = list.find((a) => a.channel === 'shopify');
        const amazon = list.find((a) => a.channel === 'amazon');
        const ebay = list.find((a) => a.channel === 'ebay');
        setAccountsByChannel({
          shopify: shopify as any,
          amazon: amazon as any,
          ebay: ebay as any,
        });
        if (shopify) {
          setShopifyStatus(shopify.status === 'active' ? 'connected' : 'paused');
          setShopifyShop(shopify.shopDomain);
        } else {
          setShopifyStatus('not_connected');
          setShopifyShop(undefined);
        }
        if (amazon) {
          setAmazonStatus(amazon.status === 'active' ? 'connected' : 'paused');
        } else {
          setAmazonStatus('not_connected');
        }
        if (ebay) {
          setEbayStatus(ebay.status === 'active' ? 'connected' : 'paused');
        } else {
          setEbayStatus('not_connected');
        }
      })
      .catch(() => {
        setAccountsByChannel({});
        setShopifyStatus('not_connected');
        setShopifyShop(undefined);
        setAmazonStatus('not_connected');
        setEbayStatus('not_connected');
      });
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    setShopifyStatus('not_connected');
    setShopifyShop(undefined);
    setAccountsByChannel({});
    setManageChannel(null);
    setShowChangePwd(false);
    window.location.href = '/login';
  };

  const handleChangePassword = () => {
    setPwdMsg(null);
    const auth: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    fetch(apiUrl('/api/v1/auth/change-password'), {
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

  const startOAuth = async (path: string, params: Record<string, string>) => {
    if (!token) {
      setIntegrationMsgType('error');
      setIntegrationMsg('Please sign in again to connect channels.');
      return;
    }
    setIntegrationMsg(null);
    setIntegrationMsgType(null);
    try {
      const url = new URL(apiUrl(path));
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
      url.searchParams.set('format', 'json');

      // Always fetch JSON first, then redirect the browser to the provider's OAuth URL.
      // This avoids navigating the browser to our API endpoint and accidentally showing JSON.
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Connect failed (HTTP ${res.status})`);
      }
      const data = await res.json().catch(() => ({}));
      if (!data?.url) throw new Error('Connect failed: missing redirect URL');
      window.location.href = String(data.url);
    } catch (err: any) {
      setIntegrationMsgType('error');
      setIntegrationMsg(err?.message || 'Connect failed');
    }
  };

  const handleConnectShopify = () => {
    setIntegrationMsg(null);
    setIntegrationMsgType(null);
    setShopifyShopError(null);
    setShopifyShopInput(shopifyShop || '');
    setShopifyConnectOpen(true);
  };

  const submitShopifyConnect = () => {
    const { shop, error } = normalizeShopifyShopInput(shopifyShopInput);
    if (!shop) {
      setShopifyShopError(error || 'Enter a valid shop domain');
      return;
    }
    const tenantId = 'demo-tenant'; // TODO: replace with real tenant/user context
    setShopifyConnectOpen(false);
    setShopifyShopError(null);
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : '';
    void startOAuth('/api/v1/auth/shopify/start', { shop, tenantId, ...(redirectTo ? { redirectTo } : {}) });
  };

  const openManage = (channel: Channel) => {
    setIntegrationMsg(null);
    setIntegrationMsgType(null);
    setManageChannel((current) => (current === channel ? null : channel));
  };

  const refreshChannel = async (channel: Channel) => {
    if (!token) return;
    const acc = accountsByChannel[channel];
    if (!acc?.id) {
      await loadAccounts(token);
      return;
    }
    setManageBusy('refresh');
    setIntegrationMsg(null);
    setIntegrationMsgType(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/channel-accounts/${acc.id}/refresh`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Refresh failed');
      }
      await loadAccounts(token);
      setIntegrationMsgType('success');
      setIntegrationMsg('Connection refreshed.');
    } catch (err: any) {
      setIntegrationMsgType('error');
      setIntegrationMsg(err?.message || 'Refresh failed');
    } finally {
      setManageBusy(null);
    }
  };

  const disconnectChannel = async (channel: Channel) => {
    if (!token) return;
    const acc = accountsByChannel[channel];
    if (!acc?.id) return;
    const label = channel === 'shopify' ? 'Shopify' : channel === 'amazon' ? 'Amazon' : 'eBay';
    if (!window.confirm(`Disconnect ${label}? This removes the integration from this account.`)) return;

    setManageBusy('disconnect');
    setIntegrationMsg(null);
    setIntegrationMsgType(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/channel-accounts/${acc.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Disconnect failed');
      }
      setManageChannel(null);
      await loadAccounts(token);
      setIntegrationMsgType('success');
      setIntegrationMsg('Disconnected.');
    } catch (err: any) {
      setIntegrationMsgType('error');
      setIntegrationMsg(err?.message || 'Disconnect failed');
    } finally {
      setManageBusy(null);
    }
  };

  const handleConnectAmazon = () => {
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : '';
    void startOAuth('/api/v1/auth/amazon/start', redirectTo ? { redirectTo } : {});
  };

  const handleConnectEbay = () => {
    const tenantId = 'demo-tenant'; // TODO: replace with real tenant/user context
    void startOAuth('/api/v1/auth/ebay/start', { tenantId });
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
          {shopifyConnectOpen ? (
            <div
              className="panel-backdrop"
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setShopifyConnectOpen(false);
              }}
            >
              <div className="side-panel" role="document">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div className="title">Connect Shopify</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Paste your shop domain or any Shopify URL—we’ll clean it for you.
                    </div>
                  </div>
                  <button className="icon-button" onClick={() => setShopifyConnectOpen(false)} aria-label="Close">
                    ✕
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  <label style={{ fontWeight: 600 }}>Shop domain</label>
                  <input
                    value={shopifyShopInput}
                    onChange={(e) => {
                      setShopifyShopInput(e.target.value);
                      setShopifyShopError(null);
                    }}
                    placeholder="myshop.myshopify.com or https://myshop.myshopify.com/admin"
                    style={{ padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitShopifyConnect();
                      if (e.key === 'Escape') setShopifyConnectOpen(false);
                    }}
                  />

                  {(() => {
                    const normalized = normalizeShopifyShopInput(shopifyShopInput);
                    return normalized.shop ? (
                      <div className="muted" style={{ fontSize: 13 }}>
                        Will use: <span style={{ fontWeight: 700, color: 'var(--text)' }}>{normalized.shop}</span>
                      </div>
                    ) : (
                      <div className="muted" style={{ fontSize: 13 }}>
                        Example: <span style={{ fontWeight: 700, color: 'var(--text)' }}>myshop.myshopify.com</span>
                      </div>
                    );
                  })()}

                  {shopifyShopError ? <div className="alert error">{shopifyShopError}</div> : null}
                </div>

                <div className="panel-actions">
                  <button className="button-secondary" onClick={() => setShopifyConnectOpen(false)}>
                    Cancel
                  </button>
                  <button className="button-primary" onClick={submitShopifyConnect}>
                    Continue
                  </button>
                </div>
              </div>
            </div>
          ) : null}

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
          {integrationMsg ? (
            <div
              className={`alert ${integrationMsgType === 'success' ? '' : 'error'}`}
              style={{
                marginBottom: 12,
                ...(integrationMsgType === 'success'
                  ? { backgroundColor: 'var(--success-bg, #d1fae5)', color: 'var(--success-fg, #065f46)', borderColor: 'var(--success-border, #10b981)' }
                  : {}),
              }}
            >
              {integrationMsg}
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
                <button
                  className="button-primary"
                  onClick={shopifyStatus === 'not_connected' ? handleConnectShopify : () => openManage('shopify')}
                >
                  {shopifyStatus === 'not_connected' ? 'Connect' : 'Manage'}
                </button>
                <button className="button-secondary" disabled>
                  Details
                </button>
              </div>
              {manageChannel === 'shopify' ? (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="button-secondary" disabled={manageBusy !== null} onClick={() => void refreshChannel('shopify')}>
                    {manageBusy === 'refresh' ? 'Refreshing…' : 'Refresh'}
                  </button>
                  <button className="button-secondary" disabled={manageBusy !== null} onClick={() => void disconnectChannel('shopify')}>
                    {manageBusy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>
              ) : null}
            </div>
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="title">Amazon</div>
                <span className={`badge status ${amazonStatus.replace('_', '-')}`}>
                  {amazonStatus === 'not_connected' ? 'Not connected' : amazonStatus === 'connected' ? 'Connected' : 'Paused'}
                </span>
              </div>
              <div className="caps">
                {['Orders', 'Inventory', 'Fulfillment'].map((cap) => (
                  <span key={cap} className="badge">
                    {cap}
                  </span>
                ))}
              </div>
              <div className="muted">Connect Amazon SP-API to sync orders and inventory.</div>
              <div className="card-footer">
                <button
                  className="button-primary"
                  onClick={amazonStatus === 'not_connected' ? handleConnectAmazon : () => openManage('amazon')}
                >
                  {amazonStatus === 'not_connected' ? 'Connect' : 'Manage'}
                </button>
                <button className="button-secondary" disabled>
                  Details
                </button>
              </div>
              {manageChannel === 'amazon' ? (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="button-secondary" disabled={manageBusy !== null} onClick={() => void refreshChannel('amazon')}>
                    {manageBusy === 'refresh' ? 'Refreshing…' : 'Refresh'}
                  </button>
                  <button className="button-secondary" disabled={manageBusy !== null} onClick={() => void disconnectChannel('amazon')}>
                    {manageBusy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
                  </button>
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
              <div className="muted">Connect eBay to pull orders and update inventory.</div>
              <div className="card-footer">
                <button
                  className="button-primary"
                  onClick={ebayStatus === 'not_connected' ? handleConnectEbay : () => openManage('ebay')}
                >
                  {ebayStatus === 'not_connected' ? 'Connect' : 'Manage'}
                </button>
                <button className="button-secondary" disabled>
                  Details
                </button>
              </div>
              {manageChannel === 'ebay' ? (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="button-secondary" disabled={manageBusy !== null} onClick={() => void refreshChannel('ebay')}>
                    {manageBusy === 'refresh' ? 'Refreshing…' : 'Refresh'}
                  </button>
                  <button className="button-secondary" disabled={manageBusy !== null} onClick={() => void disconnectChannel('ebay')}>
                    {manageBusy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>
              ) : null}
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

