import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, Loading, EmptyState, Modal } from '../ui';
import { apiFetch, fetchCommandCenter, fetchHeatmap, fetchLabelAudit } from '../../../lib/oms';
import { apiUrl, authFetch, oauthApiUrl, TOKEN_KEY } from '../../../lib/api';
import { timeAgo } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';

type Owner = 'marketplace' | 'wms' | 'intelligence' | 'carrier';
type Conn = {
  id: string;
  name: string;
  region: string;
  status: string;
  lastSync: string;
  entities: string[];
  owner: Owner;
  raw?: Record<string, any>;
};
type ChannelAccount = {
  id: string;
  channel: string;
  status: string;
  label?: string;
  displayName?: string;
  shopDomain?: string;
  marketplaceId?: string;
  lastSyncAt?: string;
  scopes?: string[];
};

const channelEntities: Record<string, string[]> = {
  shopify: ['Orders', 'Customers', 'Products', 'Inventory'],
  amazon: ['Orders', 'Listings', 'FBA/FBW'],
  ebay: ['Orders', 'Listings', 'Inventory'],
};

const statusTone = (status: string) =>
  status === 'healthy' || status === 'live' || status === 'connected'
    ? 'green'
    : status === 'warn' || status === 'needs_configuration' || status === 'needs_authorization'
      ? 'amber'
      : status === 'idle'
        ? 'default'
        : 'blue';

const normalizeShop = (value: string) =>
  value
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
    .toLowerCase();

const missingFieldLabels: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  phone: 'Phone',
  llcName: 'LLC / legal name',
  billingAddressLine1: 'Billing address line 1',
  billingCity: 'Billing city',
  billingState: 'Billing state',
  billingZipCode: 'Billing ZIP',
  billingCountry: 'Billing country',
};

const ConnectionCard = ({
  c,
  onRefresh,
  onRemove,
  busy,
}: {
  c: Conn;
  onRefresh: (c: Conn) => void;
  onRemove: (c: Conn) => void;
  busy?: boolean;
}) => (
  <tr>
    <td>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{c.name}</span>
          {(c.owner === 'intelligence' || c.owner === 'carrier') && (
            <span data-hint="Managed by UnieConnect. Admin-only disable." style={{ color: 'var(--text-tertiary)', display: 'inline-flex' }}>
              <Icon name="lock" size={12} />
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{c.region}</div>
      </div>
    </td>
    <td><Chip tone={statusTone(c.status) as any}>{c.status.replace(/_/g, ' ')}</Chip></td>
    <td>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {c.entities.map((e) => (
          <span key={e} className="chip outline" style={{ fontSize: 10.5 }}>{e}</span>
        ))}
      </div>
    </td>
    <td className="mono muted">{c.lastSync}</td>
    <td className="muted">
      {c.owner === 'intelligence' || c.owner === 'carrier' ? 'Managed service' : c.owner === 'wms' ? 'User warehouse' : 'User connection'}
    </td>
    <td className="num">
      <div style={{ display: 'inline-flex', gap: 4 }}>
        <button className="btn ghost sm" onClick={() => onRefresh(c)} disabled={busy} data-hint={c.owner === 'wms' ? 'Test connection' : 'Refresh'}>
          <Icon name="refresh" size={11} />
        </button>
        {(c.owner === 'marketplace' || c.owner === 'wms') ? (
          <button className="btn ghost sm" onClick={() => onRemove(c)} disabled={busy} data-hint="Remove connection">
            <Icon name="x" size={11} />
          </button>
        ) : (
          <button className="btn ghost sm" disabled data-hint="Managed by UnieConnect. Admin-only disable.">
            <Icon name="lock" size={11} />
          </button>
        )}
      </div>
    </td>
  </tr>
);

const ConnectNewModal = ({
  onClose,
  onConnected,
}: {
  onClose: () => void;
  onConnected: () => void;
}) => {
  const [kind, setKind] = useState<'shopify' | 'amazon' | 'ebay' | 'wms'>('shopify');
  const [shop, setShop] = useState('');
  const [wmsCode, setWmsCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const startMarketplace = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setError('Session expired. Please sign in again.');
      return;
    }
    setBusy(true);
    setError(null);
    setMissingFields([]);
    setMessage(null);
    try {
      const url = new URL(oauthApiUrl(`/api/v1/auth/${kind}/start`));
      url.searchParams.set('format', 'json');
      if (kind === 'shopify') {
        const normalized = normalizeShop(shop);
        if (!normalized || !normalized.includes('.myshopify.com')) {
          throw new Error('Enter a Shopify domain like myshop.myshopify.com');
        }
        url.searchParams.set('shop', normalized);
      }
      if (typeof window !== 'undefined') url.searchParams.set('redirectTo', `${window.location.origin}/oms?view=connections`);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `Connection failed (${res.status})`);
      if (data?.url) {
        window.location.href = String(data.url);
        return;
      }
      setMessage(data?.message || `${kind.toUpperCase()} connection was staged. Complete provider configuration to finish authorization.`);
      onConnected();
    } catch (err: any) {
      setError(err?.message || 'Connection failed');
    } finally {
      setBusy(false);
    }
  };

  const connectWms = async () => {
    const code = wmsCode.trim();
    if (!code) {
      setError('Enter the WMS connection code.');
      return;
    }
    setBusy(true);
    setError(null);
    setMissingFields([]);
    setMessage(null);
    try {
      const res = await authFetch(apiUrl('/api/v1/oms/connect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ connectionCode: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const nextError: any = new Error(data?.message || data?.error || `WMS connection failed (${res.status})`);
        nextError.status = res.status;
        nextError.payload = data;
        throw nextError;
      }
      setMessage(data?.message || `Warehouse ${data?.warehouseCode || code} connected.`);
      onConnected();
    } catch (err: any) {
      const payload = err?.payload || {};
      const fields = Array.isArray(payload?.missingFields) ? payload.missingFields.map(String) : [];
      setMissingFields(fields);
      if (payload?.error === 'profile_incomplete') {
        setError(payload?.message || 'Complete your OMS profile before connecting a warehouse.');
      } else if (err?.status === 404 && String(err?.message || '').includes('integration-credentials')) {
        setError('The warehouse accepted the connection, but its WMS credential route is not active yet. UnieLogics needs to finish the warehouse bridge setup.');
      } else {
        setError(err?.message || 'WMS connection failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (kind === 'wms') void connectWms();
    else void startMarketplace();
  };

  const options = [
    { id: 'shopify', label: 'Shopify', desc: 'Orders, customers, products, and inventory sync' },
    { id: 'amazon', label: 'Amazon', desc: 'SP-API authorization staging' },
    { id: 'ebay', label: 'eBay', desc: 'OAuth authorization and marketplace sync' },
    { id: 'wms', label: 'WMS warehouse', desc: 'Connect WMS execution truth with a one-time warehouse code' },
  ] as const;

  return (
    <Modal
      title="Connect new"
      subtitle="Add a marketplace feed or link this OMS account to WMS warehouse truth."
      onClose={onClose}
      fullscreen
      footer={
        <>
          <div style={{ fontSize: 12, color: error ? 'var(--red-text)' : 'var(--text-tertiary)' }}>{error || message || 'Connections are stored in Aurora and audited in the ledger.'}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn primary" onClick={submit} disabled={busy}>
              <Icon name="plug" size={13} />
              {busy ? 'Connecting...' : kind === 'wms' ? 'Connect warehouse' : 'Start authorization'}
            </button>
          </div>
        </>
      }
    >
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 10 }}>
          {options.map((o) => (
            <button
              key={o.id}
              className={`sb-panel-item ${kind === o.id ? 'active' : ''}`}
              onClick={() => {
                setKind(o.id);
                setError(null);
                setMissingFields([]);
                setMessage(null);
              }}
              style={{ width: '100%', marginBottom: 6 }}
            >
              <Icon name={o.id === 'wms' ? 'box' : 'plug'} size={14} className="sb-panel-item-icon" />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div className="sb-panel-item-label">{o.label}</div>
                <div className="sb-panel-item-desc">{o.desc}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{options.find((o) => o.id === kind)?.label}</div>
              <div className="card-subtitle">Credential and authorization setup</div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 12 }}>
            {kind === 'shopify' && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Shop domain</label>
                <input
                  value={shop}
                  onChange={(e) => setShop(e.target.value)}
                  placeholder="myshop.myshopify.com"
                  style={{ width: '100%', height: 36, marginTop: 6, padding: '0 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                  }}
                />
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>We redirect the owner to Shopify authorization and store the resulting connection in Aurora.</div>
              </div>
            )}
            {kind === 'wms' && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>WMS connection code</label>
                <input
                  value={wmsCode}
                  onChange={(e) => setWmsCode(e.target.value)}
                  placeholder="Paste code generated by WMS"
                  style={{ width: '100%', height: 36, marginTop: 6, padding: '0 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                  }}
                />
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>This creates the OMS-WMS bridge, stores scoped client credentials, and starts WMS event syncing for this account.</div>
                {(error || message) && (
                  <div
                    role={error ? 'alert' : 'status'}
                    style={{
                      marginTop: 14,
                      padding: 14,
                      borderRadius: 8,
                      border: `1px solid ${error ? 'rgba(220, 38, 38, 0.35)' : 'rgba(22, 163, 74, 0.38)'}`,
                      background: error ? 'rgba(220, 38, 38, 0.08)' : 'rgba(22, 163, 74, 0.1)',
                      color: error ? 'var(--red-text)' : 'var(--green-text)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900 }}>
                      <Icon name={error ? 'warning' : 'check'} size={15} />
                      {error ? 'Warehouse connection blocked' : 'Warehouse connection saved'}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12.5, color: error ? 'var(--red-text)' : 'var(--green-text)' }}>
                      {error || message}
                    </div>
                    {missingFields.length > 0 && (
                      <>
                        <div style={{ marginTop: 12, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Complete these profile fields
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {missingFields.map((field) => (
                            <span key={field} className="chip outline" style={{ fontSize: 11, borderColor: 'rgba(220, 38, 38, 0.35)' }}>
                              {missingFieldLabels[field] || field}
                            </span>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="btn primary"
                          style={{ marginTop: 12 }}
                          onClick={() => {
                            onClose();
                            if (typeof window !== 'undefined') window.location.href = '/oms?view=profile';
                          }}
                        >
                          <Icon name="settings" size={13} />
                          Open Profile Settings
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            {(kind === 'amazon' || kind === 'ebay') && (
              <div className="empty" style={{ textAlign: 'left' }}>
                {kind === 'ebay'
                  ? 'eBay starts an OAuth authorization request. If provider keys are missing, Cortex will stage the connection as needing configuration.'
                  : 'Amazon SP-API authorization is staged here until Seller Central app credentials are fully configured.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export const Connections = (_: ScreenProps) => {
  const [conns, setConns] = useState<Conn[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchCommandCenter('7d').catch(() => null),
      fetchHeatmap().catch(() => null),
      fetchLabelAudit().catch(() => null),
      apiFetch<ChannelAccount[]>('/channel-accounts').catch(() => []),
      apiFetch<{ warehouses: any[] }>('/oms/warehouses').catch(() => ({ warehouses: [] })),
    ])
      .then(([cc, _hm, la, accounts, warehouseData]) => {
        const out: Conn[] = [];
        (accounts || []).forEach((a) => {
          out.push({
            id: `marketplace-${a.id}`,
            name: a.label || a.displayName || a.shopDomain || a.channel.toUpperCase(),
            region: a.shopDomain || a.marketplaceId || a.channel,
            status: a.status || 'connected',
            lastSync: a.lastSyncAt ? timeAgo(a.lastSyncAt) : 'pending',
            entities: channelEntities[a.channel] || ['Orders', 'Inventory'],
            owner: 'marketplace',
            raw: a,
          });
        });

        (warehouseData?.warehouses || []).forEach((w) =>
          out.push({
            id: `wms-${w.warehouseCode || w.code || w.id}`,
            name: `WMS - ${w.name || w.warehouseCode || w.code}`,
            region: w.region || w.state || w.warehouseCode || 'warehouse',
            status: w.status || 'connected',
            lastSync: w.connectedAt ? timeAgo(w.connectedAt) : 'live',
            entities: ['Inventory', 'ASNs', 'Billing', 'Tasks'],
            owner: 'wms',
            raw: w,
          }),
        );

        out.push({
          id: 'cortex',
          name: 'Cortex Intelligence',
          region: String(cc?.source?.inventory || 'cortex'),
          status: 'live',
          lastSync: 'continuous',
          entities: ['Demand', 'Net-Opt', 'Audit'],
          owner: 'intelligence',
        });

        const carriers = Array.from(new Set((la?.findings || []).map((f) => f.carrier).filter(Boolean))) as string[];
        (carriers.length ? carriers : ['Carrier audit/rates']).forEach((c, i) =>
          out.push({
            id: `carrier-${i}`,
            name: c,
            region: carriers.length ? 'active audit feed' : 'not connected',
            status: carriers.length ? 'healthy' : 'idle',
            lastSync: carriers.length ? 'live' : 'pending',
            entities: ['Labels', 'Rates', 'Tracking'],
            owner: 'carrier',
          }),
        );
        setConns(out);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  const refreshConnection = async (c: Conn) => {
    setBusy(c.id);
    setNotice(null);
    try {
      if (c.owner === 'marketplace' && c.raw?.id) {
        await apiFetch(`/channel-accounts/${encodeURIComponent(c.raw.id)}/refresh`, { method: 'POST' });
        setNotice(`${c.name} refresh queued.`);
      } else if (c.owner === 'wms' && c.raw?.warehouseCode) {
        await apiFetch(`/oms/warehouses/${encodeURIComponent(c.raw.warehouseCode)}/test`, { method: 'POST' });
        setNotice(`${c.name} connection is reachable.`);
      } else {
        setNotice(`${c.name} is monitored continuously.`);
      }
      load();
    } catch (err: any) {
      setNotice(err?.message || 'Connection action failed');
    } finally {
      setBusy(null);
    }
  };

  const removeConnection = async (c: Conn) => {
    if (!window.confirm(`Remove ${c.name}? This disconnects it from this OMS account.`)) return;
    setBusy(c.id);
    setNotice(null);
    try {
      if (c.owner === 'marketplace' && c.raw?.id) {
        await apiFetch(`/channel-accounts/${encodeURIComponent(c.raw.id)}`, { method: 'DELETE' });
      } else if (c.owner === 'wms' && c.raw?.warehouseCode) {
        await apiFetch(`/oms/warehouses/${encodeURIComponent(c.raw.warehouseCode)}`, { method: 'DELETE' });
      } else {
        throw new Error('This connection type cannot be removed here.');
      }
      setNotice(`${c.name} removed.`);
      load();
    } catch (err: any) {
      setNotice(err?.message || 'Remove connection failed');
    } finally {
      setBusy(null);
    }
  };

  const syncAll = async () => {
    setBusy('all');
    setNotice(null);
    try {
      const actionable = conns.filter((c) => (c.owner === 'marketplace' && c.raw?.id) || (c.owner === 'wms' && c.raw?.warehouseCode));
      for (const c of actionable) {
        if (c.owner === 'marketplace') {
          await apiFetch(`/channel-accounts/${encodeURIComponent(c.raw!.id)}/refresh`, { method: 'POST' });
        } else {
          await apiFetch(`/oms/warehouses/${encodeURIComponent(c.raw!.warehouseCode)}/test`, { method: 'POST' });
        }
      }
      setNotice(actionable.length ? `${actionable.length} connection checks queued.` : 'No external connections to sync yet.');
      load();
    } catch (err: any) {
      setNotice(err?.message || 'Sync all failed');
    } finally {
      setBusy(null);
    }
  };

  const groups = useMemo(
    () => [
      { label: 'Marketplaces', filter: 'marketplace' as Owner, icon: 'tag' },
      { label: 'WMS warehouses', filter: 'wms' as Owner, icon: 'box' },
      { label: 'Intelligence', filter: 'intelligence' as Owner, icon: 'sparkle' },
      { label: 'Carriers & rates', filter: 'carrier' as Owner, icon: 'shipments' },
    ],
    [],
  );

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Connections</h1>
          <p className="page-subtitle">External connections and managed UnieConnect services.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={syncAll} disabled={busy === 'all'}><Icon name="refresh" size={13} /> {busy === 'all' ? 'Syncing...' : 'Sync all'}</button>
          <button className="btn primary" onClick={() => setConnectOpen(true)}><Icon name="plus" size={13} /> Connect new</button>
        </div>
      </div>

      {notice && (
        <div className="card" style={{ padding: '10px 12px', marginBottom: 14, color: 'var(--text-secondary)' }}>
          {notice}
        </div>
      )}

      {loading ? (
        <div className="card"><Loading rows={6} /></div>
      ) : (
        groups.map((g) => {
          const items = conns.filter((c) => c.owner === g.filter);
          return (
            <div key={g.filter} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Icon name={g.icon} size={14} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{g.label}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
              </div>
              <div className="table-wrap">
                {items.length === 0 ? (
                  <EmptyState>No {g.label.toLowerCase()} connected. Use Connect new to add one.</EmptyState>
                ) : (
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Connection</th>
                        <th>Status</th>
                        <th>Scope</th>
                        <th>Last sync</th>
                        <th>Control</th>
                        <th className="num">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((c) => (
                        <ConnectionCard key={c.id} c={c} onRefresh={refreshConnection} onRemove={removeConnection} busy={busy === c.id || busy === 'all'} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })
      )}

      {connectOpen && (
        <ConnectNewModal
          onClose={() => setConnectOpen(false)}
          onConnected={() => {
            load();
          }}
        />
      )}
    </div>
  );
};
