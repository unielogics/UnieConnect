import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { Icon } from '../icons';
import { Chip, Loading, ErrorState, EmptyState, Modal } from '../ui';
import { fetchMarketplaceFeatures, enableFeature, Feature } from '../../../lib/features';
import type { ScreenProps } from '../UnieConnectApp';
import { AppStudioModal } from './AppStudioModal';
import { useCtxMenu } from '../ContextMenu';

const COLORS = ['#6d28d9', '#3157f6', '#0d9488', '#f59e0b', '#b42318', '#db2777', '#10b981', '#0369a1'];
const colorFor = (id: string) => COLORS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length];
const iconFor = (f: Feature): string => {
  const c = (f.category || '').toLowerCase();
  if (c.includes('account') || c.includes('billing')) return 'billing';
  if (c.includes('analytic')) return 'layers';
  if (c.includes('workflow') || c.includes('automation')) return 'bolt';
  if (c.includes('customer')) return 'support';
  if (c.includes('ai') || c.includes('bot')) return 'sparkle';
  return 'grid';
};
const priceLabel = (f: Feature) => {
  const p = f.pricing;
  if (!p || p.type === 'free') return 'Free';
  if (p.type === 'one-time') return p.amount ? `$${p.amount} once` : 'One-time';
  return p.amount ? `$${p.amount}/mo` : 'Subscription';
};

const unlockedScreens = (f: Feature) => f.unlockedScreens || f.metadata?.unlockedScreens || [];
const requiredConnections = (f: Feature) => f.requiredConnections || f.metadata?.requiredConnections || [];

const SdkDocsModal = ({ onClose, onOpenBuilder }: { onClose: () => void; onOpenBuilder: () => void }) => (
  <Modal
    title="Cortex OMS SDK"
    subtitle="Use scoped API keys and idempotent events to add custom apps, workflows, and external systems."
    onClose={onClose}
    width={920}
    footer={
      <>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>API keys are created in App Studio and shown once.</div>
        <button className="btn primary" onClick={onOpenBuilder}>
          <Icon name="studio" size={13} /> Open App Studio
        </button>
      </>
    }
  >
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {[
          ['1. Create key', 'Generate a scoped key in App Studio with oms:read, workflows:run, events:write, or apps:manage.'],
          ['2. Send events', 'POST events from WMS, ERP, store apps, or custom tools with an Idempotency-Key header.'],
          ['3. Run workflows', 'Workflows can draft recommendations automatically and pause risky WMS/TMS actions for approval.'],
        ].map(([title, body]) => (
          <div key={title} className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{body}</div>
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Endpoint</th><th>Purpose</th><th>Scope</th></tr>
          </thead>
          <tbody>
            <tr><td className="mono">GET /api/v1/oms/apps</td><td>List private account apps</td><td>oms:read</td></tr>
            <tr><td className="mono">POST /api/v1/oms/apps</td><td>Create a private app</td><td>apps:manage</td></tr>
            <tr><td className="mono">POST /api/v1/oms/workflows/:id/run</td><td>Run a workflow manually or from an API</td><td>workflows:run</td></tr>
            <tr><td className="mono">POST /api/v1/oms/events</td><td>Push external OMS/WMS events into workflow matching</td><td>events:write</td></tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Event example</div>
          <pre style={{ margin: 0, padding: 12, overflow: 'auto', borderRadius: 8, background: 'var(--bg-sunken)', fontSize: 11.5 }}>{`POST /api/v1/oms/events
Authorization: Bearer uc_xxxxxxxxxx
Idempotency-Key: wms-inventory-123

{
  "eventType": "inventory.updated",
  "sourceSystem": "custom_wms",
  "payload": {
    "sku": "SKU-100",
    "available": 240,
    "warehouseCode": "NJ-01"
  }
}`}</pre>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Guardrail rules</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.6 }}>
            Custom apps can read OMS facts, create tickets, write ledger events, draft shipment plans, and request Cortex recommendations. WMS work changes, driver dispatch, carrier purchases, billing claims, and inventory placement execution pause for approval.
          </div>
        </div>
      </div>
    </div>
  </Modal>
);

export const Marketplace = (props: ScreenProps) => {
  const router = useRouter();
  const ctx = useCtxMenu();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState<'all' | 'installed' | 'available'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [selected, setSelected] = useState<Feature | null>(null);

  const load = () => {
    setLoading(true);
    setErr(null);
    fetchMarketplaceFeatures({ limit: 60 })
      .then((r) => {
        setFeatures(r.features || []);
        setCategories(r.categories || Array.from(new Set((r.features || []).map((f) => f.category).filter(Boolean))));
      })
      .catch((e) => setErr(e.message || 'Failed to load marketplace'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggle = async (f: Feature) => {
    if (f.isEnabled) return;
    setBusy(f.id);
    try {
      await enableFeature(f.id);
      setFeatures((prev) => prev.map((x) => (x.id === f.id ? { ...x, isEnabled: true, userStatus: 'enabled' } : x)));
      props.onFeaturesChanged?.();
    } catch (e) {
      /* surfaced via reload */
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return features.filter((f) => {
      if (cat !== 'all' && f.category !== cat) return false;
      if (status === 'installed' && !f.isEnabled) return false;
      if (status === 'available' && f.isEnabled) return false;
      if (q && !`${f.name} ${f.description} ${f.category} ${(f.tags || []).join(' ')}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cat, features, search, status]);
  const installFocus = typeof router.query.install === 'string' ? router.query.install : '';
  const installedCount = features.filter((f) => f.isEnabled).length;

  const catTabs = [{ id: 'all', label: 'All' }, ...categories.map((c) => ({ id: c, label: c }))];

  useEffect(() => {
    if (!installFocus || selected) return;
    const target = features.find((f) => f.id === installFocus || f.slug === installFocus);
    if (target) setSelected(target);
  }, [features, installFocus, selected]);

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Marketplace</h1>
          <p className="page-subtitle">Apps, automations, and connectors for this account.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => setStatus('installed')}>
            <Icon name="settings" size={13} /> Manage installed ({installedCount})
          </button>
          <button className="btn primary" onClick={() => setStudioOpen(true)}><Icon name="studio" size={13} /> Open App Studio</button>
        </div>
      </div>

      {err ? (
        <div className="card"><ErrorState message={err} onRetry={load} /></div>
      ) : loading ? (
        <div className="card"><Loading rows={5} /></div>
      ) : features.length === 0 ? (
        <div className="card"><EmptyState>No marketplace apps available yet.</EmptyState></div>
      ) : (
        <>
          <div className="table-wrap">
            <div className="table-toolbar">
              <div style={{ position: 'relative', flex: '0 1 320px' }}>
                <Icon name="search" size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search apps"
                  style={{ width: '100%', height: 28, padding: '0 10px 0 28px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 12 }}
                />
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={{ height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }}>
                <option value="all">All statuses</option>
                <option value="installed">Installed</option>
                <option value="available">Available</option>
              </select>
              <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, textTransform: 'capitalize' }}>
                {catTabs.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <div className="spacer" />
              <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{filtered.length} apps</span>
            </div>
            {filtered.length === 0 ? (
              <EmptyState>No marketplace apps match these filters.</EmptyState>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>App</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Unlocks</th>
                    <th>Price</th>
                    <th className="num">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((app) => (
                    <tr
                      key={app.id}
                      className="clickable"
                      onClick={() => setSelected(app)}
                      onContextMenu={(e) =>
                        ctx.open(e, [
                          { label: app.name },
                          { icon: 'eye', title: 'Open details', onClick: () => setSelected(app) },
                          ...(app.isEnabled ? [] : [{ icon: 'plus', title: 'Install app', onClick: () => toggle(app) }]),
                          { icon: 'studio', title: 'Open App Studio', onClick: () => setStudioOpen(true) },
                        ])
                      }
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 7, background: colorFor(app.id), color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            <Icon name={iconFor(app)} size={15} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</div>
                            <div className="muted" style={{ maxWidth: 460, overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.description}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{app.category}</td>
                      <td><Chip tone={app.isEnabled ? 'green' : 'default'} dot={false}>{app.isEnabled ? 'Installed' : 'Available'}</Chip></td>
                      <td className="muted">{unlockedScreens(app).length ? unlockedScreens(app).map((s) => s.replace(/-/g, ' ')).join(', ') : '—'}</td>
                      <td>{priceLabel(app)}</td>
                      <td className="num" onClick={(e) => e.stopPropagation()}>
                        <button className={`btn sm ${app.isEnabled ? '' : 'primary'}`} onClick={() => (app.isEnabled ? setSelected(app) : toggle(app))} disabled={busy === app.id}>
                          {app.isEnabled ? 'Details' : busy === app.id ? 'Installing...' : 'Install'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ marginTop: 18, background: 'var(--bg-sunken)' }}>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 22 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Build your own bot or widget</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Use the Cortex SDK to ship custom AI agents that read OMS facts, call Cortex, and publish actions to the ledger.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => setDocsOpen(true)}>Read SDK docs</button>
                <button className="btn primary" onClick={() => setStudioOpen(true)}>Open builder</button>
              </div>
            </div>
          </div>
        </>
      )}
      {studioOpen && <AppStudioModal onClose={() => setStudioOpen(false)} />}
      {selected && (
        <Modal
          title={selected.name}
          subtitle={selected.category}
          onClose={() => setSelected(null)}
          width="min(460px, calc(100vw - 96px))"
          footer={
            <>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{priceLabel(selected)}</div>
              <button className={`btn ${selected.isEnabled ? '' : 'primary'}`} onClick={() => (selected.isEnabled ? setSelected(null) : toggle(selected))} disabled={selected.isEnabled || busy === selected.id}>
                {selected.isEnabled ? 'Installed' : 'Install'}
              </button>
            </>
          }
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: colorFor(selected.id), color: 'white', display: 'grid', placeItems: 'center' }}>
                <Icon name={iconFor(selected)} size={20} />
              </div>
              <div>
                <Chip tone={selected.isEnabled ? 'green' : 'default'} dot={false}>{selected.isEnabled ? 'Installed' : 'Available'}</Chip>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{selected.longDescription || selected.description}</div>
            <div className="kv"><div className="kv-label">Unlocks</div><div className="kv-value" style={{ fontSize: 13 }}>{unlockedScreens(selected).length ? unlockedScreens(selected).map((s) => s.replace(/-/g, ' ')).join(', ') : 'No dedicated screen'}</div></div>
            <div className="kv"><div className="kv-label">Required connections</div><div className="kv-value" style={{ fontSize: 13 }}>{requiredConnections(selected).length ? requiredConnections(selected).join(', ') : 'None'}</div></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(selected.tags || []).map((tag) => <Chip key={tag} tone="outline" dot={false}>{tag}</Chip>)}
            </div>
          </div>
        </Modal>
      )}
      {docsOpen && (
        <SdkDocsModal
          onClose={() => setDocsOpen(false)}
          onOpenBuilder={() => {
            setDocsOpen(false);
            setStudioOpen(true);
          }}
        />
      )}
    </div>
  );
};
