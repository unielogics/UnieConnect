import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { Icon } from '../icons';
import { Chip, Loading, ErrorState, EmptyState, Modal } from '../ui';
import { fetchMarketplaceFeatures, enableFeature, disableFeature, Feature } from '../../../lib/features';
import type { ScreenProps } from '../UnieConnectApp';
import { AppStudioModal } from './AppStudioModal';

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
  const [features, setFeatures] = useState<Feature[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [cat, setCat] = useState('all');
  const [installView, setInstallView] = useState<'all' | 'installed' | 'available'>('all');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

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

  const install = async (f: Feature) => {
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

  const uninstall = async (f: Feature) => {
    if (!window.confirm(`Uninstall ${f.name}? Its screens will be removed from this account until installed again.`)) return;
    setBusy(f.id);
    try {
      await disableFeature(f.id);
      setFeatures((prev) => prev.map((x) => (x.id === f.id ? { ...x, isEnabled: false, userStatus: 'disabled' } : x)));
      props.onFeaturesChanged?.();
    } catch (e) {
      /* surfaced via reload */
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    return features.filter((f) => {
      if (cat !== 'all' && f.category !== cat) return false;
      if (installView === 'installed') return Boolean(f.isEnabled);
      if (installView === 'available') return !f.isEnabled;
      return true;
    });
  }, [features, cat, installView]);
  const installFocus = typeof router.query.install === 'string' ? router.query.install : '';
  const focused = installFocus ? features.find((f) => f.id === installFocus || f.slug === installFocus) : undefined;
  const featured = focused || features.find((f) => !f.isEnabled && (f.tags || []).includes('featured')) || features.find((f) => !f.isEnabled) || features[0];
  const installedCount = features.filter((f) => f.isEnabled).length;
  const availableCount = features.length - installedCount;

  const catTabs = [{ id: 'all', label: 'All' }, ...categories.map((c) => ({ id: c, label: c }))];

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Marketplace</h1>
          <p className="page-subtitle">
            Extend UnieConnect with AI bots, automations, accounting connectors, and analytics widgets — installed in one click.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => setInstallView('installed')}>
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
          {featured && (
            <div
              className="card"
              style={{
                marginBottom: 18,
                background: `linear-gradient(135deg, ${colorFor(featured.id)}15 0%, var(--bg-elev) 60%)`,
                border: `1px solid ${colorFor(featured.id)}40`,
              }}
            >
              <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: 16, background: colorFor(featured.id), color: 'white', display: 'grid', placeItems: 'center', boxShadow: `0 8px 24px ${colorFor(featured.id)}40` }}>
                  <Icon name={iconFor(featured)} size={32} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Chip tone="purple" dot={false}>FEATURED</Chip>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{featured.category}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 4 }}>{featured.name}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 10 }}>{featured.description}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(featured.tags || []).slice(0, 4).map((c) => (
                      <Chip key={c} dot={false} tone="outline">
                        {c}
                      </Chip>
                    ))}
                  </div>
                  {unlockedScreens(featured).length > 0 && (
                    <div className="app-unlocks">
                      Unlocks: {unlockedScreens(featured).map((screen) => screen.replace(/-/g, ' ')).join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>{priceLabel(featured)}</div>
                  <button
                    className={`btn lg ${featured.isEnabled ? '' : 'primary'}`}
                    onClick={() => (featured.isEnabled ? uninstall(featured) : install(featured))}
                    disabled={busy === featured.id}
                  >
                    {featured.isEnabled ? (
                      <>
                        <Icon name="x" size={13} /> Uninstall
                      </>
                    ) : (
                      'Install'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All apps', count: features.length },
              { id: 'installed', label: 'Installed', count: installedCount },
              { id: 'available', label: 'Available', count: availableCount },
            ].map((view) => {
              const active = installView === view.id;
              return (
                <button
                  key={view.id}
                  onClick={() => setInstallView(view.id as typeof installView)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'var(--accent-soft)' : 'var(--bg-elev)',
                    color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {view.label}
                  <span style={{ background: active ? 'var(--accent)' : 'var(--bg-active)', color: active ? 'white' : 'var(--text-tertiary)', padding: '0 6px', borderRadius: 999, fontSize: 10.5, fontWeight: 800 }}>
                    {view.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {catTabs.map((c) => {
              const count = c.id === 'all'
                ? filtered.length
                : features.filter((f) => f.category === c.id && (installView === 'all' || (installView === 'installed' ? f.isEnabled : !f.isEnabled))).length;
              const active = cat === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'var(--accent-soft)' : 'var(--bg-elev)',
                    color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {c.label}
                  <span style={{ background: active ? 'var(--accent)' : 'var(--bg-active)', color: active ? 'white' : 'var(--text-tertiary)', padding: '0 6px', borderRadius: 999, fontSize: 10.5, fontWeight: 700 }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="card">
              <EmptyState>{installView === 'installed' ? 'No marketplace apps installed for this account yet.' : 'No apps match this marketplace filter.'}</EmptyState>
            </div>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 14 }}>
            {filtered.map((app) => (
              <div key={app.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 230 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: colorFor(app.id), color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon name={iconFor(app)} size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {app.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{app.category}</div>
                    </div>
                  </div>
                  {app.isEnabled && (
                    <Chip tone="green" dot={false}>
                      Installed
                    </Chip>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>{app.description}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(app.tags || []).slice(0, 3).map((c) => (
                    <span key={c} style={{ fontSize: 10.5, color: 'var(--text-secondary)', background: 'var(--bg-sunken)', padding: '3px 7px', borderRadius: 4 }}>
                      {c}
                    </span>
                  ))}
                </div>
                {unlockedScreens(app).length > 0 && (
                  <div className="app-unlocks">
                    <Icon name="check" size={11} /> Unlocks {unlockedScreens(app).map((screen) => screen.replace(/-/g, ' ')).join(', ')}
                  </div>
                )}
                {requiredConnections(app).length > 0 && (
                  <div className="app-unlocks muted">
                    <Icon name="plug" size={11} /> Needs {requiredConnections(app).join(', ')}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{priceLabel(app)}</div>
                  <button
                    className={`btn ${app.isEnabled ? '' : 'primary'} sm`}
                    onClick={() => (app.isEnabled ? uninstall(app) : install(app))}
                    disabled={busy === app.id}
                  >
                    {app.isEnabled ? 'Uninstall' : 'Install'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          )}

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
