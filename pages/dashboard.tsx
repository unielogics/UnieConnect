import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiUrl, getApiOrigin, TOKEN_KEY } from '../lib/api';
import DashboardLayout from '../components/DashboardLayout';

type Account = { id: string; channel: string; shopDomain?: string; status: string };
type Channel = 'shopify' | 'amazon' | 'ebay';

type SyncEntityStatus = { status: string; lastSyncedAt?: string; count?: number; error?: string };
type ShopifySyncStatus = {
  channelAccountId: string;
  entities: Record<string, SyncEntityStatus>;
  fullSync: boolean;
};

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

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [shopifyStatus, setShopifyStatus] = useState<'not_connected' | 'connected' | 'paused'>('not_connected');
  const [shopifyShop, setShopifyShop] = useState<string | undefined>(undefined);
  const [amazonStatus, setAmazonStatus] = useState<'not_connected' | 'connected' | 'paused'>('not_connected');
  const [ebayStatus, setEbayStatus] = useState<'not_connected' | 'connected' | 'paused'>('not_connected');
  const [token, setToken] = useState<string | null>(null);
  const [integrationMsg, setIntegrationMsg] = useState<string | null>(null);
  const [integrationMsgType, setIntegrationMsgType] = useState<'success' | 'error' | null>(null);
  const [accountsByChannel, setAccountsByChannel] = useState<Partial<Record<Channel, Account>>>({});
  const [panelChannel, setPanelChannel] = useState<Channel | 'more' | null>(null);
  const [manageBusy, setManageBusy] = useState<null | 'refresh' | 'disconnect'>(null);
  const [shopifyConnectOpen, setShopifyConnectOpen] = useState(false);
  const [shopifyShopInput, setShopifyShopInput] = useState('');
  const [shopifyShopError, setShopifyShopError] = useState<string | null>(null);
  const [shopifySyncStatus, setShopifySyncStatus] = useState<ShopifySyncStatus | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    if (window.location.hostname === 'unieconnect.com') {
      window.location.href = `https://user.unieconnect.com${window.location.pathname}${window.location.search}`;
      return;
    }
    console.info('[unieconnect][config]', { apiOrigin: getApiOrigin(), host: window.location.host });
  }, []);

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

  // Load Shopify sync status when connected and panel open
  const shopifyAccountId = accountsByChannel.shopify?.id;
  useEffect(() => {
    if (!mounted || !token || !shopifyAccountId || panelChannel !== 'shopify') return;
    const loadSyncStatus = async () => {
      try {
        const res = await fetch(apiUrl(`/api/v1/channel-accounts/${shopifyAccountId}/sync-status`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setShopifySyncStatus(data);
        }
      } catch {
        setShopifySyncStatus(null);
      }
    };
    void loadSyncStatus();
    const interval = manageBusy === 'refresh' ? 1500 : 10000;
    const id = setInterval(loadSyncStatus, interval);
    return () => clearInterval(id);
  }, [mounted, token, shopifyAccountId, panelChannel, manageBusy]);

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
      window.history.replaceState({}, '', '/dashboard');
    } else if (error && message) {
      setIntegrationMsgType('error');
      setIntegrationMsg(`Connection failed: ${decodeURIComponent(message)}`);
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [mounted, token]);

  const loadAccounts = async (authToken: string) => {
    const auth = { Authorization: `Bearer ${authToken}` };
    fetch(apiUrl('/api/v1/channel-accounts'), { headers: auth, credentials: 'include' })
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

  const openPanel = (channel: Channel | 'more') => {
    setIntegrationMsg(null);
    setIntegrationMsgType(null);
    if (channel === 'shopify') {
      setShopifyShopError(null);
      setShopifyShopInput(shopifyShop || '');
    }
    setPanelChannel((current) => (current === channel ? null : channel));
  };

  const submitShopifyConnect = () => {
    const { shop, error } = normalizeShopifyShopInput(shopifyShopInput);
    if (!shop) {
      setShopifyShopError(error || 'Enter a valid shop domain');
      return;
    }
    const tenantId = 'demo-tenant'; // TODO: replace with real tenant/user context
    setShopifyShopError(null);
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : '';
    void startOAuth('/api/v1/auth/shopify/start', { shop, tenantId, ...(redirectTo ? { redirectTo } : {}) });
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
      const data = await res.json().catch(() => ({}));
      if (channel === 'shopify' && data?.syncResult && acc?.id) {
        const resStatus = await fetch(apiUrl(`/api/v1/channel-accounts/${acc.id}/sync-status`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resStatus.ok) setShopifySyncStatus(await resStatus.json());
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
      setPanelChannel(null);
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
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : '';
    void startOAuth('/api/v1/auth/amazon/start', redirectTo ? { redirectTo } : {});
  };

  const handleConnectEbay = () => {
    const tenantId = 'demo-tenant'; // TODO: replace with real tenant/user context
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : '';
    void startOAuth('/api/v1/auth/ebay/start', { tenantId, ...(redirectTo ? { redirectTo } : {}) });
  };

  const closePanel = () => setPanelChannel(null);

  const integrations = [
    {
      id: 'shopify' as Channel,
      title: 'Shopify',
      status: shopifyStatus,
      hint: shopifyShop ? shopifyShop : 'Orders · Inventory · Fulfillment',
      features: ['Orders', 'Inventory', 'Fulfillment', 'Labels'],
      description: 'Sync Orders, Inventory, Fulfillment, and Labels with your Shopify store.',
    },
    {
      id: 'amazon' as Channel,
      title: 'Amazon',
      status: amazonStatus,
      hint: 'Orders · Inventory · SP-API',
      features: ['Orders', 'Inventory', 'Fulfillment'],
      description: 'Connect Amazon SP-API to sync orders, inventory, and manage ship-from addresses. FBA/FBW flows are in Create Shipment Plan.',
    },
    {
      id: 'ebay' as Channel,
      title: 'eBay',
      status: ebayStatus,
      hint: 'Orders · Inventory',
      features: ['Orders', 'Inventory'],
      description: 'Connect eBay to pull orders and update inventory.',
    },
    {
      id: 'more' as const,
      title: 'More',
      status: 'paused' as const,
      hint: 'TikTok · Elsy · Wayfair',
      features: [] as string[],
      description: 'Additional marketplaces coming soon.',
    },
  ] as const;

  const renderPanelContent = () => {
    if (!panelChannel) return null;
    if (panelChannel === 'more') {
      return (
        <div className="integration-panel-scroll" style={{ padding: '0 4px' }}>
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
            Additional marketplaces—TikTok Shop, Elsy, Wayfair, and more—will appear here once enabled. Check back for updates.
          </div>
        </div>
      );
    }
    const ch = panelChannel;
    const label = ch === 'shopify' ? 'Shopify' : ch === 'amazon' ? 'Amazon' : 'eBay';
    const status = ch === 'shopify' ? shopifyStatus : ch === 'amazon' ? amazonStatus : ebayStatus;
    const connected = status !== 'not_connected';
    const cfg = integrations.find((i) => i.id === ch);

    return (
      <div className="integration-panel-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {!connected ? (
          <>
            <div>
              <div className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>{cfg?.description}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 10 }}>Features</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {cfg?.features?.map((f) => (
                  <span key={f} className="badge" style={{ background: 'var(--accent-weak)', color: 'var(--accent)', border: 'none' }}>{f}</span>
                ))}
              </div>
            </div>
            {ch === 'shopify' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontWeight: 600, fontSize: 14 }}>Shop domain</label>
                <input
                  value={shopifyShopInput}
                  onChange={(e) => { setShopifyShopInput(e.target.value); setShopifyShopError(null); }}
                  placeholder="myshop.myshopify.com"
                  style={{ padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitShopifyConnect(); if (e.key === 'Escape') closePanel(); }}
                />
                {normalizeShopifyShopInput(shopifyShopInput).shop ? (
                  <div className="muted" style={{ fontSize: 13 }}>Will use: <strong style={{ color: 'var(--text)' }}>{normalizeShopifyShopInput(shopifyShopInput).shop}</strong></div>
                ) : (
                  <div className="muted" style={{ fontSize: 13 }}>Example: myshop.myshopify.com</div>
                )}
                {shopifyShopError && <div className="alert error">{shopifyShopError}</div>}
              </div>
            )}
            <div className="panel-actions" style={{ marginTop: 'auto', paddingTop: 16 }}>
              <button className="button-secondary" onClick={closePanel}>Cancel</button>
              <button
                className="button-primary"
                onClick={ch === 'shopify' ? submitShopifyConnect : ch === 'amazon' ? handleConnectAmazon : handleConnectEbay}
              >
                Connect {label}
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="muted" style={{ fontSize: 14 }}>{cfg?.description}</div>
              {ch === 'shopify' && shopifyShop && (
                <div style={{ marginTop: 8, fontWeight: 600 }}>{shopifyShop}</div>
              )}
            </div>
            <div className="integration-monitor-section">
              <div className="integration-monitor-title">Monitor</div>
              {ch === 'shopify' && shopifySyncStatus ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(['products', 'orders', 'inventory', 'customers'] as const).map((entity) => {
                    const e = shopifySyncStatus.entities[entity];
                    const lbl = entity.charAt(0).toUpperCase() + entity.slice(1);
                    const st = e?.status === 'syncing' ? 'Fetching…' : e?.status === 'synced' ? 'Synced' : e?.status === 'error' ? 'Error' : 'Idle';
                    const clr = e?.status === 'synced' ? 'var(--success-fg)' : e?.status === 'error' ? '#dc2626' : 'var(--muted)';
                    return (
                      <div key={entity} className="integration-monitor-row">
                        <span className="muted">{lbl}{e?.count != null ? ` (${e.count})` : ''}</span>
                        <span style={{ color: clr, fontWeight: 600 }}>{st}{e?.error ? `: ${e.error}` : ''}</span>
                      </div>
                    );
                  })}
                  {shopifySyncStatus.fullSync && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Full sync complete</div>}
                </div>
              ) : (
                <div className="integration-monitor-row">
                  <span className="muted">Status</span>
                  <span style={{ fontWeight: 600, color: 'var(--success-fg)' }}>{status === 'connected' ? 'Active' : 'Paused'}</span>
                </div>
              )}
            </div>
            <div className="integration-monitor-section">
              <div className="integration-monitor-title">Activity</div>
              <div className="integration-activity-item">
                <span className="muted">Last sync</span>
                <span>{shopifySyncStatus?.entities?.orders?.lastSyncedAt ? new Date(shopifySyncStatus.entities.orders.lastSyncedAt).toLocaleString() : '—'}</span>
              </div>
              {ch === 'amazon' && (
                <Link href="/shipment-plans" className="integration-activity-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                  Shipment plans →
                </Link>
              )}
            </div>
            <div className="panel-actions" style={{ marginTop: 'auto', paddingTop: 16 }}>
              <button className="button-primary" disabled={manageBusy !== null} onClick={() => void refreshChannel(ch)}>
                {manageBusy === 'refresh' ? 'Syncing…' : 'Sync now'}
              </button>
              <button className="button-secondary" disabled={manageBusy !== null} onClick={() => void disconnectChannel(ch)}>
                {manageBusy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout title="Integrations" subtitle="Connect and manage marketplaces">
      {panelChannel && (
        <div
          className="panel-backdrop"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closePanel(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') closePanel(); }}
        >
          <div className={`side-panel integration-panel`} role="document" style={{ width: '50vw', maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div className="title" style={{ fontSize: 18 }}>
                  {panelChannel === 'shopify' ? 'Shopify' : panelChannel === 'amazon' ? 'Amazon' : panelChannel === 'ebay' ? 'eBay' : 'More'}
                </div>
                {panelChannel !== 'more' && (
                  <span className={`badge status ${integrations.find((i) => i.id === panelChannel)?.status?.replace('_', '-')}`} style={{ marginTop: 6, display: 'inline-block' }}>
                    {integrations.find((i) => i.id === panelChannel)?.status === 'not_connected' ? 'Not connected' : integrations.find((i) => i.id === panelChannel)?.status === 'connected' ? 'Connected' : 'Paused'}
                  </span>
                )}
              </div>
              <button className="icon-button" onClick={closePanel} aria-label="Close">✕</button>
            </div>
            {renderPanelContent()}
          </div>
        </div>
      )}

      {integrationMsg && (
        <div
          className={`alert ${integrationMsgType === 'success' ? '' : 'error'}`}
          style={{
            marginBottom: 12,
            ...(integrationMsgType === 'success' ? { backgroundColor: 'var(--success-bg, #d1fae5)', color: 'var(--success-fg, #065f46)', borderColor: 'var(--success-border, #10b981)' } : {}),
          }}
        >
          {integrationMsg}
        </div>
      )}

      <div className="integration-grid" style={{ marginTop: 12 }}>
        {integrations.map((int) => (
          <div
            key={int.id}
            className="integration-card"
            onClick={() => openPanel(int.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(int.id); } }}
          >
            <div className="integration-card-header">
              <span className="integration-card-title">{int.title}</span>
              <span className={`integration-card-status badge status ${int.id === 'more' ? 'paused' : int.status.replace('_', '-')}`}>
                {int.id === 'more' ? 'Coming soon' : int.status === 'not_connected' ? 'Not connected' : int.status === 'connected' ? 'Connected' : 'Paused'}
              </span>
            </div>
            <div className="integration-card-hint">{int.hint}</div>
            <div className="integration-card-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                {int.id === 'more' ? 'View' : int.status === 'not_connected' ? 'Connect' : 'Monitor'} →
              </span>
              {int.id !== 'more' && int.status !== 'not_connected' && (
                <button
                  className="button-primary"
                  style={{ padding: '6px 12px', fontSize: 12, minHeight: 32 }}
                  disabled={manageBusy !== null}
                  onClick={(e) => { e.stopPropagation(); void refreshChannel(int.id as Channel); }}
                >
                  {manageBusy === 'refresh' ? 'Syncing…' : 'Sync now'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
