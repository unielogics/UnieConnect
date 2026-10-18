import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Icon } from '../icons';
import { Chip, Loading, EmptyState, Modal } from '../ui';
import { apiFetch, fetchCortexChatHealth, fetchLabelAudit } from '../../../lib/oms';
import { apiUrl, authFetch, oauthApiUrl, TOKEN_KEY } from '../../../lib/api';
import { timeAgo } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';

type Owner = 'marketplace' | 'wms' | 'intelligence' | 'carrier';
type CapabilityState = 'healthy' | 'degraded' | 'pending' | 'idle';
type ConnectionCapability = {
  label: string;
  status: CapabilityState;
  count?: number;
};
type Conn = {
  id: string;
  name: string;
  region: string;
  status: string;
  lastSync: string;
  entities: ConnectionCapability[];
  owner: Owner;
  issue?: string;
  needsRepair?: boolean;
  raw?: Record<string, any>;
};
type ChannelSyncState = {
  status?: string;
  count?: number;
  error?: string;
  metadata?: { warning?: string; degraded?: boolean; [key: string]: unknown };
  lastSyncedAt?: string;
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
  metadata?: Record<string, any>;
  sync?: Record<string, ChannelSyncState>;
};

const channelEntities: Record<string, string[]> = {
  shopify: ['Orders', 'Customers', 'Products', 'Inventory'],
  amazon: ['Orders', 'Listings', 'FBA/FBW'],
  ebay: ['Orders', 'Listings', 'Inventory'],
};

const statusTone = (status: string) =>
  status === 'healthy' || status === 'live' || status === 'connected'
    ? 'green'
    : status === 'warn' || status === 'degraded' || status === 'needs_configuration' || status === 'needs_authorization'
      ? 'amber'
      : status === 'idle'
        ? 'default'
        : 'blue';

const statusLabel = (status: string) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'healthy' || normalized === 'live' || normalized === 'connected') return 'Connected';
  if (normalized === 'degraded' || normalized === 'warn') return 'Needs attention';
  if (normalized === 'needs_authorization') return 'Authorization required';
  if (normalized === 'needs_configuration') return 'Setup required';
  if (normalized === 'idle') return 'Not configured';
  return normalized.replace(/_/g, ' ');
};

const capabilityLabel = (label: string) =>
  String(label || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

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
  onRepair,
  onRemove,
  busy,
  focused,
}: {
  c: Conn;
  onRefresh: (c: Conn) => void;
  onRepair: (c: Conn) => void;
  onRemove: (c: Conn) => void;
  busy?: boolean;
  focused?: boolean;
}) => (
  <tr id={`connection-${c.id}`} className={focused ? 'connection-row-focused' : undefined}>
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
        {c.issue && <div style={{ marginTop: 4, maxWidth: 420, fontSize: 11.5, lineHeight: 1.35, color: 'var(--amber-text)' }}>{c.issue}</div>}
      </div>
    </td>
    <td><Chip tone={statusTone(c.status) as any}>{statusLabel(c.status)}</Chip></td>
    <td>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {c.entities.map((e) => (
          <Chip
            key={e.label}
            tone={e.status === 'healthy' ? 'green' : e.status === 'degraded' ? 'amber' : 'default'}
            dot={e.status !== 'idle'}
          >
            {capabilityLabel(e.label)}{e.count == null ? '' : ` ${e.count}`}
          </Chip>
        ))}
      </div>
    </td>
    <td className="mono muted">{c.lastSync}</td>
    <td className="muted">
      {c.owner === 'intelligence' || c.owner === 'carrier' ? 'Managed service' : c.owner === 'wms' ? 'User warehouse' : 'User connection'}
    </td>
    <td className="num">
      <div style={{ display: 'inline-flex', gap: 4 }}>
        {c.needsRepair && (
          <button className="btn ghost sm" onClick={() => onRepair(c)} disabled={busy} data-hint="Open provider authorization">
            <Icon name="plug" size={11} />
            {String(c.raw?.channel || '').toLowerCase() === 'shopify'
              ? 'Repair Shopify access'
              : ['needs_authorization', 'needs_configuration'].includes(String(c.raw?.status || '')) ? 'Authorize' : 'Repair'}
          </button>
        )}
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
  initialKind = 'shopify',
}: {
  onClose: () => void;
  onConnected: () => void;
  initialKind?: 'shopify' | 'amazon' | 'ebay' | 'wms';
}) => {
  const [kind, setKind] = useState<'shopify' | 'amazon' | 'ebay' | 'wms'>(initialKind);
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
      <div className="connection-setup-layout" style={{ maxWidth: 920, margin: '0 auto', gap: 16 }}>
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
  const router = useRouter();
  const [conns, setConns] = useState<Conn[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadErrors, setLoadErrors] = useState<Partial<Record<Owner, string>>>({});
  const handledRouteAction = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErrors({});
    const [cortexResult, labelResult, accountResult, warehouseResult] = await Promise.allSettled([
      fetchCortexChatHealth('connections'),
      fetchLabelAudit(),
      apiFetch<ChannelAccount[]>('/channel-accounts'),
      apiFetch<{ warehouses: any[] }>('/oms/warehouses'),
    ]);
    const errors: Partial<Record<Owner, string>> = {};
    if (accountResult.status === 'rejected') errors.marketplace = 'Marketplace connection status could not be loaded.';
    if (warehouseResult.status === 'rejected') errors.wms = 'Warehouse connection status could not be loaded.';
    if (cortexResult.status === 'rejected' || !cortexResult.value.ok) errors.intelligence = 'Cortex health could not be verified.';
    if (labelResult.status === 'rejected') errors.carrier = 'Carrier and rate feed status could not be loaded.';

    setConns((current) => {
        const out: Conn[] = [];
        const accounts = accountResult.status === 'fulfilled' ? accountResult.value : null;
        if (!accounts) out.push(...current.filter((connection) => connection.owner === 'marketplace'));
        (accounts || []).forEach((a) => {
          const syncEntries = Object.entries(a.sync || {});
          const syncIssue = syncEntries
            .map(([entity, state]) => state?.error || state?.metadata?.warning
              ? `${entity.replace(/_/g, ' ')}: ${state.error || state.metadata?.warning}`
              : null)
            .filter(Boolean)
            .join('; ');
          const missingLocationScope = a.channel === 'shopify'
            && !(a.scopes || []).some((scope) => scope === 'read_locations' || scope === 'write_locations');
          const degraded = Boolean(missingLocationScope || syncIssue || syncEntries.some(([, state]) => state?.metadata?.degraded));
          const entities: ConnectionCapability[] = syncEntries.length
            ? syncEntries.map(([entity, state]) => {
                const hasIssue = Boolean(state?.error || state?.metadata?.warning || state?.metadata?.degraded);
                const isCurrent = ['synced', 'complete', 'completed', 'healthy'].includes(String(state?.status || '').toLowerCase());
                const isShopifyInventoryBlocked = a.channel === 'shopify' && missingLocationScope && entity === 'inventory';
                return {
                  label: entity.replace(/_/g, ' '),
                  count: state?.count,
                  status: hasIssue || isShopifyInventoryBlocked ? 'degraded' : isCurrent ? 'healthy' : 'pending',
                };
              })
            : (channelEntities[a.channel] || ['Orders', 'Inventory']).map((label) => ({
                label,
                status: a.status === 'connected' ? 'pending' : 'degraded',
              }));
          out.push({
            id: `marketplace-${a.id}`,
            name: a.label || a.displayName || a.shopDomain || a.channel.toUpperCase(),
            region: a.shopDomain || a.marketplaceId || a.channel,
            status: degraded ? 'degraded' : a.status || 'connected',
            lastSync: a.lastSyncAt ? timeAgo(a.lastSyncAt) : 'pending',
            entities,
            owner: 'marketplace',
            issue: syncIssue || (missingLocationScope ? 'Shopify location inventory is unavailable. Reconnect and approve location access to restore warehouse-level quantities.' : undefined),
            needsRepair: a.status === 'needs_authorization' || a.status === 'needs_configuration' || missingLocationScope,
            raw: a,
          });
        });

        const warehouseData = warehouseResult.status === 'fulfilled' ? warehouseResult.value : null;
        if (!warehouseData) out.push(...current.filter((connection) => connection.owner === 'wms'));
        (warehouseData?.warehouses || []).forEach((w) =>
          out.push({
            id: `wms-${w.warehouseCode || w.code || w.id}`,
            name: `WMS - ${w.name || w.warehouseCode || w.code}`,
            region: w.region || w.state || w.warehouseCode || 'warehouse',
            status: w.status || 'connected',
            lastSync: w.connectedAt ? timeAgo(w.connectedAt) : 'live',
            entities: ['Inventory', 'ASNs', 'Billing', 'Tasks'].map((label) => ({ label, status: 'healthy' as const })),
            owner: 'wms',
            raw: w,
          }),
        );

        const cortexHealthy = cortexResult.status === 'fulfilled' && cortexResult.value.ok;
        out.push({
          id: 'cortex',
          name: 'Cortex Intelligence',
          region: 'account-scoped intelligence',
          status: cortexHealthy ? 'healthy' : 'degraded',
          lastSync: cortexHealthy ? 'continuous' : 'health check failed',
          entities: ['Demand', 'Net-Opt', 'Audit'].map((label) => ({ label, status: cortexHealthy ? 'healthy' as const : 'degraded' as const })),
          owner: 'intelligence',
          issue: cortexHealthy ? undefined : 'Cortex could not be verified. Account data remains isolated and operational views remain available.',
        });

        const la = labelResult.status === 'fulfilled' ? labelResult.value : null;
        const carriers = Array.from(new Set((la?.findings || []).map((f) => f.carrier).filter(Boolean))) as string[];
        if (!la) {
          const knownCarriers = current.filter((connection) => connection.owner === 'carrier');
          out.push(...(knownCarriers.length ? knownCarriers : [{
            id: 'carrier-health',
            name: 'Carrier audit/rates',
            region: 'status unavailable',
            lastSync: 'health check failed',
            entities: ['Labels', 'Rates', 'Tracking'].map((label) => ({ label, status: 'degraded' as const })),
            owner: 'carrier' as Owner,
          }]).map((connection) => ({
            ...connection,
            status: 'degraded',
            issue: errors.carrier,
          })));
        } else (carriers.length ? carriers : ['Carrier audit/rates']).forEach((c, i) =>
          out.push({
            id: `carrier-${i}`,
            name: c,
            region: carriers.length ? 'active audit feed' : 'not connected',
            status: carriers.length ? 'healthy' : 'idle',
            lastSync: carriers.length ? 'live' : 'pending',
            entities: ['Labels', 'Rates', 'Tracking'].map((label) => ({ label, status: carriers.length ? 'healthy' as const : 'idle' as const })),
            owner: 'carrier',
          }),
        );
        return out;
      });
    setLoadErrors(errors);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!router.isReady || router.query.connect !== 'wms') return;
    setConnectOpen(true);
  }, [router.isReady, router.query.connect]);

  const focusedConnectionId = typeof router.query.connection === 'string' ? router.query.connection : '';

  useEffect(() => {
    if (loading || !focusedConnectionId) return;
    const connection = conns.find((item) => String(item.raw?.id || '') === focusedConnectionId);
    if (!connection) return;
    document.getElementById(`connection-${connection.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [conns, focusedConnectionId, loading]);

  const refreshConnection = async (c: Conn) => {
    setBusy(c.id);
    setNotice(null);
    try {
      if (c.owner === 'marketplace' && c.raw?.id) {
        const result = await apiFetch<any>(`/channel-accounts/${encodeURIComponent(c.raw.id)}/refresh`, { method: 'POST' });
        setNotice(result?.syncStatus === 'partial'
          ? `${c.name} refreshed with provider issues. Review the connection warning and reconnect if authorization is missing.`
          : `${c.name} refreshed successfully.`);
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

  const repairConnection = useCallback(async (c: Conn) => {
    const channel = String(c.raw?.channel || '').toLowerCase();
    if (c.owner !== 'marketplace' || !['shopify', 'amazon', 'ebay'].includes(channel)) {
      setNotice('This connection does not expose a self-service repair flow yet.');
      return;
    }
    if (channel === 'shopify' && !c.raw?.shopDomain) {
      setNotice('This Shopify connection is missing its store domain. Remove it and reconnect the store.');
      return;
    }
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setNotice('Session expired. Please sign in again.');
      return;
    }
    setBusy(c.id);
    setNotice(null);
    try {
      const url = new URL(oauthApiUrl(`/api/v1/auth/${channel}/start`));
      url.searchParams.set('format', 'json');
      if (channel === 'shopify') url.searchParams.set('shop', normalizeShop(String(c.raw?.shopDomain || '')));
      url.searchParams.set('redirectTo', `${window.location.origin}/oms?view=connections`);
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || payload?.error || `Authorization failed (${response.status})`);
      if (payload?.url) {
        window.location.href = String(payload.url);
        return;
      }
      setNotice(payload?.message || `${c.name} authorization is ready for provider configuration.`);
      setBusy(null);
      load();
    } catch (error: any) {
      setNotice(error?.message || `${c.name} authorization failed.`);
      setBusy(null);
    }
  }, [load]);

  useEffect(() => {
    if (loading || router.query.action !== 'repair' || !focusedConnectionId) return;
    const actionKey = `repair:${focusedConnectionId}`;
    if (handledRouteAction.current === actionKey) return;
    const connection = conns.find((item) => String(item.raw?.id || '') === focusedConnectionId);
    if (!connection) return;
    handledRouteAction.current = actionKey;
    void repairConnection(connection);
  }, [conns, focusedConnectionId, loading, repairConnection, router.query.action]);

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
      if (actionable.length === 0) {
        setNotice('No external connections to check yet.');
        return;
      }

      const checks = await Promise.allSettled(actionable.map(async (c) => {
        if (c.owner === 'marketplace') {
          const result = await apiFetch<any>(`/channel-accounts/${encodeURIComponent(c.raw!.id)}/refresh`, { method: 'POST' });
          return { name: c.name, healthy: result?.syncStatus !== 'partial' };
        }
        await apiFetch(`/oms/warehouses/${encodeURIComponent(c.raw!.warehouseCode)}/test`, { method: 'POST' });
        return { name: c.name, healthy: true };
      }));
      const failed = checks.filter((result) => result.status === 'rejected').length;
      const degraded = checks.filter((result) => result.status === 'fulfilled' && !result.value.healthy).length;
      const healthy = checks.length - failed - degraded;
      const attention = failed + degraded;
      setNotice(attention
        ? `${healthy} connection${healthy === 1 ? '' : 's'} checked successfully; ${attention} need${attention === 1 ? 's' : ''} attention. Review the highlighted rows for repair actions.`
        : `${healthy} connection${healthy === 1 ? '' : 's'} checked successfully.`);
      await load();
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

      {Object.keys(loadErrors).length > 0 && (
        <div className="inline-banner danger" role="alert" style={{ marginBottom: 14 }}>
          <Icon name="warning" size={13} />
          <span style={{ flex: 1 }}>{Object.values(loadErrors).filter(Boolean).join(' ')} Last-known connections are preserved.</span>
          <button className="btn ghost sm" onClick={() => load()}><Icon name="refresh" size={12} /> Retry status</button>
        </div>
      )}

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
                  <EmptyState>{loadErrors[g.filter] ? `${g.label} status is unavailable. Retry before adding or removing a connection.` : `No ${g.label.toLowerCase()} connected. Use Connect new to add one.`}</EmptyState>
                ) : (
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Connection</th>
                        <th>Status</th>
                        <th>Capabilities</th>
                        <th>Last sync</th>
                        <th>Control</th>
                        <th className="num">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((c) => (
                        <ConnectionCard
                          key={c.id}
                          c={c}
                          onRefresh={refreshConnection}
                          onRepair={repairConnection}
                          onRemove={removeConnection}
                          busy={busy === c.id || busy === 'all'}
                          focused={String(c.raw?.id || '') === focusedConnectionId}
                        />
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
          initialKind={router.query.connect === 'wms' ? 'wms' : 'shopify'}
          onClose={() => setConnectOpen(false)}
          onConnected={() => {
            load();
          }}
        />
      )}
    </div>
  );
};
