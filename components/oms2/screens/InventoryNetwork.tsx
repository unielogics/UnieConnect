import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, Sparkline, Loading, ErrorState, EmptyState, Thumb, useCloseOnOmsNavigation } from '../ui';
import { DecisionComparison } from '../DecisionComparison';
import { CortexPlanApprovals } from '../CortexPlanApprovals';
import { useCtxMenu } from '../ContextMenu';
import {
  approveRecommendation,
  createAmazonListingDraft,
  fetchOmsSkus,
  fetchRecommendations,
  OmsRecommendation,
  OmsSku,
  publishAmazonListingDraft,
  rejectRecommendation,
  validateAmazonListingDraft,
} from '../../../lib/oms';
import { docTone, riskLabel } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';
import { MarketplaceFilter, MarketplaceFilterValue } from '../MarketplaceFilter';

const DocCell = ({ days }: { days: number }) => {
  const tone = docTone(days);
  const pct = Math.min(100, (days / 60) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110 }}>
      <div className="bar" style={{ flex: 1, height: 5 }}>
        <div className={`bar-fill ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="mono num" style={{ fontSize: 11.5, color: `var(--${tone}-text)`, fontWeight: 600, minWidth: 28 }}>
        {Math.round(days)}d
      </span>
    </div>
  );
};

const FillScore = ({ value }: { value: number }) => {
  const tone = value > 80 ? 'green' : value > 60 ? 'amber' : 'red';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 28, height: 24, borderRadius: 4, background: `var(--${tone}-soft)`, color: `var(--${tone}-text)`, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700 }}>
        {Math.round(value)}
      </div>
      <Sparkline data={[60, 65, value - 5, value - 2, value]} color={`var(--${tone})`} width={32} height={14} />
    </div>
  );
};

const KeepaMarker = ({ sku }: { sku: Pick<OmsSku, 'keepaUnavailable' | 'enrichmentMarker' | 'enrichmentState'> }) => {
  const state = String(sku.enrichmentState || '').toLowerCase();
  if (!sku.keepaUnavailable && sku.enrichmentMarker !== '*' && !['keepa_unavailable', 'missing_asin'].includes(state)) return null;
  return (
    <span
      title="Keepa enrichment unavailable; Cortex will use manual/marketplace data."
      style={{ color: 'var(--amber)', fontWeight: 900, marginLeft: 4 }}
    >
      *
    </span>
  );
};

export const InventoryNetwork = ({ onNavigate, toggleSelect, isSelected, onNewProduct, onImportCsv }: ScreenProps) => {
  const [view, setView] = useState<'table' | 'heatmap' | 'treemap'>('table');
  const [search, setSearch] = useState('');
  const [skus, setSkus] = useState<OmsSku[]>([]);
  const [recommendations, setRecommendations] = useState<OmsRecommendation[]>([]);
  const [selectedRec, setSelectedRec] = useState<OmsRecommendation | null>(null);
  const [amazonSku, setAmazonSku] = useState<OmsSku | null>(null);
  const [marketplaceFilter, setMarketplaceFilter] = useState<MarketplaceFilterValue>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const ctx = useCtxMenu();

  const load = () => {
    setLoading(true);
    setErr(null);
    Promise.all([
      fetchOmsSkus(marketplaceFilter),
      fetchRecommendations({ screen: 'skus', status: 'open', entityType: 'sku', limit: 100 }).catch(() => ({ recommendations: [] })),
    ])
      .then(([d, recs]) => {
        setSkus(d.skus || []);
        setRecommendations(recs.recommendations || []);
      })
      .catch((e) => setErr(e.message || 'Failed to load SKUs'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [marketplaceFilter.channel, marketplaceFilter.channelAccountId]);

  const filtered = useMemo(
    () =>
      skus.filter(
        (s) =>
          !search ||
          s.sku?.toLowerCase().includes(search.toLowerCase()) ||
          (s.title || '').toLowerCase().includes(search.toLowerCase())
      ),
    [skus, search]
  );

  const atRisk = skus.filter((s) => s.daysOfCover < 14).length;
  const reorderCount = skus.filter((s) => s.reorderNeeded).length;
  const avgDoc = skus.length ? Math.round(skus.reduce((a, s) => a + (s.daysOfCover || 0), 0) / skus.length) : 0;
  const avgFill = skus.length ? Math.round(skus.reduce((a, s) => a + (s.fillPercent || 0), 0) / skus.length) : 0;
  const recBySku = useMemo(() => {
    const map = new Map<string, OmsRecommendation>();
    recommendations.forEach((rec) => {
      if (rec.entityId && !map.has(String(rec.entityId))) map.set(String(rec.entityId), rec);
    });
    return map;
  }, [recommendations]);

  return (
    <div className="page fade-in">
      <CortexPlanApprovals />
      <div className="page-header">
        <div>
          <h1 className="page-title">SKUs</h1>
          <p className="page-subtitle">
            Every product, every warehouse. Click any SKU to drill into its history, billing, and shipments. Right-click for actions.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => onImportCsv?.('skus')}>
            <Icon name="download" size={13} style={{ transform: 'rotate(180deg)' }} /> Import CSV
          </button>
          <button className="btn"><Icon name="download" size={13} /> Export</button>
          <button className="btn primary" onClick={onNewProduct}><Icon name="plus" size={13} /> New product</button>
        </div>
      </div>

      <div className="inventory-view-toolbar">
        <div className="view-mode-tabs" aria-label="SKU view mode">
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
            <Icon name="list" size={13} /> Table
          </button>
          <button className={view === 'heatmap' ? 'active' : ''} onClick={() => setView('heatmap')}>
            <Icon name="grid" size={13} /> Demand heatmap
          </button>
          <button className={view === 'treemap' ? 'active' : ''} onClick={() => setView('treemap')}>
            <Icon name="layers" size={13} /> Margin
          </button>
        </div>
        <div className="inventory-filter-row">
          <div className="inventory-search">
            <Icon name="search" size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU or product"
            />
          </div>
          <MarketplaceFilter value={marketplaceFilter} onChange={setMarketplaceFilter} includeUnmapped />
          <button className="filter-chip applied"><Icon name="filter" size={11} /> Warehouse: All <Icon name="x" size={10} /></button>
          <button className="filter-chip"><Icon name="filter" size={11} /> DOC range</button>
          <button className="filter-chip"><Icon name="filter" size={11} /> Risk</button>
          <div className="spacer" />
          <span className="inventory-count">{filtered.length} SKUs</span>
          <button className="btn ghost sm"><Icon name="columns" size={12} /> Columns</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">SKUs tracked</div>
          <div className="stat-value">{skus.length}</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>across the catalog</div>
        </div>
        <div className="stat warn">
          <div className="stat-label">SKUs at risk &lt; 14 DOC</div>
          <div className="stat-value">{atRisk}</div>
          <div className="stat-delta down"><span className="arrow">▼</span> stockout watch</div>
        </div>
        <div className="stat warn">
          <div className="stat-label">Need reorder</div>
          <div className="stat-value">{reorderCount}</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>within supplier lead time</div>
        </div>
        <div className="stat">
          <div className="stat-label">Avg days of cover</div>
          <div className="stat-value">{avgDoc}d</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>network-wide</div>
        </div>
        <div className="stat ai">
          <div className="stat-label">Avg pallet fill</div>
          <div className="stat-value">{avgFill}%</div>
          <div className="stat-delta up"><span className="arrow">▲</span> with plan applied</div>
        </div>
      </div>

      {err ? (
        <div className="card"><ErrorState message={err} onRetry={load} /></div>
      ) : loading ? (
        <div className="card"><Loading rows={6} /></div>
      ) : view === 'table' ? (
        <div className="table-wrap">
          <div className="table-toolbar">
            <span style={{ fontSize: 12, fontWeight: 800 }}>SKU table</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>List view for inventory, replenishment, and row actions.</span>
          </div>
          {filtered.length === 0 ? (
            <EmptyState>No SKUs match your search.</EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 28 }} />
                  <th style={{ width: 44 }} />
                  <th>SKU</th>
                  <th>Product</th>
                  <th className="num">Available</th>
                  <th className="num">Inbound</th>
                  <th className="num">Velocity / 30d</th>
                  <th>Days of cover</th>
                  <th className="num">Proposed units</th>
                  <th>Pallet fill</th>
                  <th>Service tier</th>
                  <th>Status</th>
                  <th className="num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const sel = isSelected(s.id);
                  const rl = riskLabel(s.risk);
                  const rec = recBySku.get(s.id) || recBySku.get(s.sku);
                  return (
                    <tr
                      key={s.id}
                      className="clickable"
                      style={{
                        // Reorder-needed gets an amber left-bar + soft tint (distinct from the
                        // purple Cortex-recommendation highlight). Selection tint wins visually.
                        background: sel ? 'var(--accent-soft)' : rec ? 'var(--purple-soft)' : s.reorderNeeded ? 'var(--amber-soft, rgba(245,158,11,0.08))' : undefined,
                        boxShadow: rec ? 'inset 3px 0 0 var(--purple)' : s.reorderNeeded ? 'inset 3px 0 0 var(--amber, #f59e0b)' : undefined,
                      }}
                      onClick={(e) => {
                        if ((e.target as HTMLInputElement).type === 'checkbox') return;
                        onNavigate('sku-detail', s.id);
                      }}
                      onContextMenu={(e) =>
                        ctx.open(e, [
                          { label: 'SKU' },
                          { icon: 'eye', title: 'Open SKU page', onClick: () => onNavigate('sku-detail', s.id) },
                          { icon: 'studio', title: 'View in Inventory Plan', onClick: () => onNavigate('plan', s.id) },
                          ...(rec ? [{ icon: 'sparkle', title: 'Review Cortex optimization', onClick: () => setSelectedRec(rec) }] : []),
                          { icon: 'amazon', title: 'Amazon listing draft', onClick: () => setAmazonSku(s) },
                          { divider: true },
                          {
                            icon: 'plus',
                            title: sel ? 'Remove from shipment' : 'Add to shipment plan',
                            onClick: () => toggleSelect({ id: s.id, name: s.title || s.sku, ...(s as any) }),
                          },
                          { icon: 'tag', title: 'View supplier', onClick: () => onNavigate('suppliers') },
                          { divider: true },
                          { icon: 'refresh', title: 'Re-sync from WMS', shortcut: '⌘R', onClick: load },
                          { icon: 'download', title: 'Export CSV row' },
                        ])
                      }
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="row-check"
                          checked={sel}
                          onChange={() => toggleSelect({ id: s.id, name: s.title || s.sku, ...(s as any) })}
                        />
                      </td>
                      <td><Thumb image={s.image} size={34} /></td>
                      <td className="mono strong">
                        {s.sku}
                        <KeepaMarker sku={s} />
                      </td>
                      <td>
                        <span style={{ color: 'var(--text)' }}>
                          {s.title || '—'}
                          <KeepaMarker sku={s} />
                        </span>
                      </td>
                      <td className="num mono strong">{(s.available ?? 0).toLocaleString()}</td>
                      <td className="num mono muted">{s.inbound > 0 ? s.inbound.toLocaleString() : '—'}</td>
                      <td className="num mono">{(s.velocity30d ?? 0).toLocaleString()}</td>
                      <td>
                        <DocCell days={s.daysOfCover ?? 0} />
                      </td>
                      <td className="num mono">{(s.proposedUnits ?? 0).toLocaleString()}</td>
                      <td>
                        <FillScore value={s.fillPercent ?? 0} />
                      </td>
                      <td className="mono muted" style={{ textTransform: 'capitalize' }}>{s.serviceTier}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <Chip tone={rl.tone}>{rl.label}</Chip>
                          {s.reorderNeeded && (
                            <Chip tone="amber" dot={false} className="" >
                              <span title={s.reorderReason || ''}>Reorder</span>
                            </Chip>
                          )}
                        </div>
                      </td>
                      <td className="num" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          {rec && (
                            <button className="btn ghost sm" onClick={() => setSelectedRec(rec)} data-hint="Review Cortex optimization">
                              <Icon name="sparkle" size={12} style={{ color: 'var(--purple)' }} />
                            </button>
                          )}
                          <button className="btn ghost sm" onClick={() => setAmazonSku(s)} data-hint="Amazon listing draft">
                            <Icon name="amazon" size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : view === 'heatmap' ? (
        <SkuHeatmapView skus={filtered} recommendations={recBySku} onOpenSku={(id) => onNavigate('sku-detail', id)} />
      ) : (
        <SkuMarginView skus={filtered} onOpenSku={(id) => onNavigate('sku-detail', id)} />
      )}
      {selectedRec && (
        <RecommendationDrawer
          rec={selectedRec}
          onClose={() => setSelectedRec(null)}
          onChanged={load}
          onResolveMissingData={(_, rec) => {
            const target = rec.entityId || selectedRec.entityId;
            setSelectedRec(null);
            if (target) onNavigate('sku-detail', String(target));
          }}
          resolveMissingLabel="Open SKU cleanup"
        />
      )}
      {amazonSku && <AmazonListingDrawer sku={amazonSku} onClose={() => setAmazonSku(null)} />}
    </div>
  );
};

const DrawerShell = ({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) => {
  useCloseOnOmsNavigation(onClose);

  return (
    <div className="modal-overlay" style={{ placeItems: 'stretch end' }} onClick={onClose}>
      <div
        className="modal"
        style={{ width: 'min(33vw, 480px)', minWidth: 380, maxHeight: '100vh', height: '100vh', borderRadius: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
};

const recommendationMissingFields = (rec: OmsRecommendation) =>
  Array.from(new Set([
    ...(Array.isArray((rec.currentValue as any)?.missingFields) ? (rec.currentValue as any).missingFields : []),
    ...(Array.isArray((rec.optimizedValue as any)?.requiredFields) ? (rec.optimizedValue as any).requiredFields : []),
  ].map((field) => String(field || '').trim()).filter(Boolean)));

export const RecommendationDrawer = ({
  rec,
  onClose,
  onChanged,
  onResolveMissingData,
  resolveMissingLabel,
}: {
  rec: OmsRecommendation;
  onClose: () => void;
  onChanged: () => void;
  onResolveMissingData?: (missingFields: string[], rec: OmsRecommendation) => void;
  resolveMissingLabel?: string;
}) => {
  const [busy, setBusy] = useState('');
  const [edit, setEdit] = useState(false);
  const [current, setCurrent] = useState(JSON.stringify(rec.currentValue || {}, null, 2));
  const [optimized, setOptimized] = useState(JSON.stringify(rec.optimizedValue || {}, null, 2));
  const missingFields = recommendationMissingFields(rec);
  const isMissingDataBlocker =
    String(rec.approvalState || '').toLowerCase() === 'blocked' ||
    String(rec.requiredAction || '').toLowerCase().includes('missing') ||
    missingFields.length > 0;
  const act = async (action: 'approve' | 'reject') => {
    setBusy(action);
    try {
      if (action === 'approve') await approveRecommendation(rec.id, { source: 'sku_table' });
      else await rejectRecommendation(rec.id, 'Denied from SKU optimization drawer');
      onChanged();
      onClose();
    } finally {
      setBusy('');
    }
  };
  return (
    <DrawerShell
      title="Cortex optimization"
      subtitle="Review current state, suggested action, impact, and decision status."
      onClose={onClose}
      footer={<button className="btn" onClick={() => setEdit((v) => !v)}><Icon name="save" size={12} /> {edit ? 'Preview' : 'Edit JSON'}</button>}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{rec.summary}</div>
        {isMissingDataBlocker && (
          <div
            style={{
              border: '1px solid var(--amber-border)',
              background: 'var(--amber-soft)',
              borderRadius: 10,
              padding: 12,
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--amber-text)', fontWeight: 850 }}>
              <Icon name="warning" size={14} />
              Cortex is waiting on baseline data
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              This is not an approval decision yet. Cortex can create a stronger optimization only after the SKU has the required operating fields.
            </div>
            {missingFields.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {missingFields.map((field) => (
                  <Chip key={field} tone="amber" dot={false}>{field.replace(/_/g, ' ')}</Chip>
                ))}
              </div>
            )}
            {onResolveMissingData && (
              <button className="btn primary sm" onClick={() => onResolveMissingData(missingFields, rec)}>
                <Icon name="settings" size={12} /> {resolveMissingLabel || 'Fix missing data'}
              </button>
            )}
          </div>
        )}
        <DecisionComparison rec={rec} busy={!!busy} onApprove={() => act('approve')} onDeny={() => act('reject')} />
        {edit && (
          <>
            <CompareBlock label="Current JSON" value={current} edit={edit} onChange={setCurrent} />
            <CompareBlock label="Suggested JSON" value={optimized} edit={edit} onChange={setOptimized} tone="purple" />
            <CompareBlock label="Impact details" value={JSON.stringify(rec.estimatedImpact || {}, null, 2)} edit={false} tone="green" />
          </>
        )}
      </div>
    </DrawerShell>
  );
};

const CompareBlock = ({ label, value, edit, onChange, tone }: { label: string; value: string; edit: boolean; onChange?: (v: string) => void; tone?: string }) => (
  <div>
    <div style={{ fontSize: 11, fontWeight: 800, color: tone ? `var(--${tone}-text)` : 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
    {edit ? (
      <textarea value={value} onChange={(e) => onChange?.(e.target.value)} style={{ width: '100%', minHeight: 140, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 11.5, padding: 10 }} />
    ) : (
      <pre style={{ margin: 0, padding: 12, borderRadius: 8, background: 'var(--bg-sunken)', overflow: 'auto', fontSize: 11.5 }}>{value}</pre>
    )}
  </div>
);

const skuNumber = (sku: OmsSku, ...keys: string[]) => {
  for (const key of keys) {
    const value = (sku as any)[key] ?? (sku as any).attributes?.[key] ?? (sku as any).metadata?.[key];
    const n = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
};

const heatTone = (value: number) => (value >= 75 ? 'hot' : value >= 45 ? 'warm' : value > 0 ? 'cool' : 'empty');

const SkuHeatmapView = ({
  skus,
  recommendations,
  onOpenSku,
}: {
  skus: OmsSku[];
  recommendations: Map<string, OmsRecommendation>;
  onOpenSku: (id: string) => void;
}) => {
  const maxVelocity = Math.max(1, ...skus.map((sku) => sku.velocity30d || 0));
  const hotSkus = skus.filter((sku) => (sku.velocity30d || 0) > 0).length;
  const avgDemand = skus.length ? Math.round(skus.reduce((sum, sku) => sum + ((sku.velocity30d || 0) / maxVelocity) * 100, 0) / skus.length) : 0;
  return (
    <div className="card sku-heatmap-card">
      <div className="card-header">
        <div>
          <div className="card-title"><Icon name="grid" size={15} /> SKU demand heatmap</div>
          <div className="card-subtitle">Each tile is one SKU. Color intensity is 30-day demand; border warns when cover is low.</div>
        </div>
        <div className="heatmap-legend">
          <span>Low</span>
          <span className="legend-gradient" />
          <span>High</span>
        </div>
      </div>
      {skus.length === 0 ? (
        <EmptyState>No SKUs match this view.</EmptyState>
      ) : (
        <>
          <div className="sku-heatmap-summary">
            <div><span>{hotSkus}</span><small>SKUs with demand</small></div>
            <div><span>{avgDemand}%</span><small>avg demand intensity</small></div>
            <div><span>{skus.filter((sku) => (sku.daysOfCover || 0) < 14).length}</span><small>low-cover demand tiles</small></div>
          </div>
          <div className="sku-heatmap-grid">
            {skus.map((sku) => {
              const velocityScore = Math.min(100, Math.max(0, ((sku.velocity30d || 0) / maxVelocity) * 100));
              const rec = recommendations.get(sku.id) || recommendations.get(sku.sku);
              const lowCover = (sku.daysOfCover || 0) < 14;
              return (
                <button
                  key={sku.id}
                  className={`sku-heat-tile ${heatTone(velocityScore)} ${lowCover ? 'low-cover' : ''}`}
                  onClick={() => onOpenSku(sku.id)}
                  title={`${sku.sku}: ${Math.round(sku.velocity30d || 0)} units / 30d`}
                >
                  <div className="sku-heat-top">
                    <span className="mono">
                      {sku.sku}
                      <KeepaMarker sku={sku} />
                    </span>
                    {rec && <Icon name="sparkle" size={12} />}
                  </div>
                  <div className="sku-heat-title">
                    {sku.title || sku.sku}
                    <KeepaMarker sku={sku} />
                  </div>
                  <div className="sku-heat-metrics">
                    <span>{Math.round(sku.velocity30d || 0)}u / 30d</span>
                    <span>{Math.round(sku.daysOfCover || 0)}d cover</span>
                    <span>{Math.round(sku.fillPercent || 0)}% fill</span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

const SkuMarginView = ({ skus, onOpenSku }: { skus: OmsSku[]; onOpenSku: (id: string) => void }) => {
  const rows = skus.map((sku) => {
    const price = skuNumber(sku, 'price', 'unitPrice', 'sellingPrice');
    const cost = skuNumber(sku, 'cost', 'unitCost');
    const margin = price > 0 && cost > 0 ? (price - cost) / price : null;
    return { sku, price, cost, margin };
  });
  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <span style={{ fontSize: 12, fontWeight: 800 }}>SKU margin</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Margin stays inside the SKU tab. Missing cost/price is shown as enrichment needed.</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState>No SKUs match this view.</EmptyState>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th className="num">Price</th>
              <th className="num">Cost</th>
              <th>Margin</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ sku, price, cost, margin }) => {
              const tone = margin == null ? 'amber' : margin >= 0.3 ? 'green' : margin >= 0.18 ? 'amber' : 'red';
              return (
                <tr key={sku.id} className="clickable" onClick={() => onOpenSku(sku.id)}>
                  <td className="mono strong">{sku.sku}</td>
                  <td>{sku.title || sku.sku}</td>
                  <td className="num mono">{price ? `$${price.toFixed(2)}` : '—'}</td>
                  <td className="num mono">{cost ? `$${cost.toFixed(2)}` : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="bar" style={{ width: 120, height: 7 }}>
                        <div className={`bar-fill ${tone}`} style={{ width: `${Math.max(4, Math.min(100, (margin ?? 0) * 100))}%` }} />
                      </div>
                      <span className="mono strong">{margin == null ? '—' : `${Math.round(margin * 100)}%`}</span>
                    </div>
                  </td>
                  <td><Chip tone={tone} dot={false}>{margin == null ? 'Needs enrichment' : margin >= 0.3 ? 'Healthy' : margin >= 0.18 ? 'Thin' : 'At risk'}</Chip></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export const AmazonListingDrawer = ({ sku, onClose }: { sku: Pick<OmsSku, 'id' | 'sku' | 'title'>; onClose: () => void }) => {
  const [form, setForm] = useState({
    sellerSku: sku.sku || '',
    title: sku.title || '',
    description: '',
    brand: '',
    price: '',
    weight: '',
    length: '',
    width: '',
    height: '',
    asin: '',
    upc: '',
    ean: '',
    fulfillmentChannel: 'AMAZON',
  });
  const [draftId, setDraftId] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const payload = () => ({
    itemId: sku.id,
    sellerSku: form.sellerSku,
    title: form.title,
    description: form.description,
    brand: form.brand,
    price: form.price ? Number(form.price) : null,
    weight: form.weight ? Number(form.weight) : 0,
    length: form.length ? Number(form.length) : 0,
    width: form.width ? Number(form.width) : 0,
    height: form.height ? Number(form.height) : 0,
    asin: form.asin || null,
    upc: form.upc || null,
    ean: form.ean || null,
    fulfillmentChannel: form.fulfillmentChannel,
  });
  const missing = [
    ['title', 'Title'],
    ['description', 'Description'],
    ['brand', 'Brand'],
    ['price', 'Price'],
    ['weight', 'Weight'],
    ['length', 'Length'],
    ['width', 'Width'],
    ['height', 'Height'],
  ].filter(([key]) => !(form as any)[key]).map(([, label]) => label);
  if (!form.asin && !form.upc && !form.ean) missing.push('UPC/EAN/ASIN');

  const saveDraft = async () => {
    setBusy('draft');
    setMessage('');
    try {
      const res = await createAmazonListingDraft(payload());
      setDraftId(String((res.draft as any)?.id || ''));
      setErrors(res.validation.errors || []);
      setWarnings(res.validation.warnings || []);
      setMessage((res.validation.errors || []).length ? 'Draft saved. Complete required fields before publish.' : 'Draft validated and ready for pending provider submission.');
    } catch (e: any) {
      setMessage(e.message || 'Draft failed');
    } finally {
      setBusy('');
    }
  };
  const validateDraft = async () => {
    if (!draftId) return saveDraft();
    setBusy('validate');
    try {
      const res = await validateAmazonListingDraft(draftId, payload());
      setErrors(res.validation.errors || []);
      setWarnings(res.validation.warnings || []);
      setMessage((res.validation.errors || []).length ? 'Still missing Amazon-required fields.' : 'Ready for pending provider submission.');
    } finally {
      setBusy('');
    }
  };
  const publishDraft = async () => {
    if (!draftId) {
      await saveDraft();
      return;
    }
    setBusy('publish');
    try {
      const res = await publishAmazonListingDraft(draftId, payload());
      setMessage(String((res.submissionResult as any)?.message || 'Listing draft marked pending provider integration.'));
    } catch (e: any) {
      setMessage(e.message || 'Publish failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <DrawerShell
      title="Amazon listing"
      subtitle={sku.sku}
      onClose={onClose}
      footer={
        <>
          <button className="btn" disabled={!!busy} onClick={validateDraft}>Validate</button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" disabled={!!busy} onClick={saveDraft}>Save draft</button>
            <button className="btn primary" disabled={!!busy} onClick={publishDraft}><Icon name="amazon" size={13} /> Publish pending</button>
          </div>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Amazon listing is a draft-and-enrich workflow. Valid drafts are marked pending provider integration until live Listings Items submission is enabled.
        </div>
        {missing.length > 0 && <Chip tone="amber" dot={false}>Needs {missing.join(', ')}</Chip>}
        {message && <div className="card" style={{ padding: 10, color: 'var(--text-secondary)' }}>{message}</div>}
        {[...errors, ...warnings].map((m, i) => (
          <div key={i} style={{ fontSize: 12, color: i < errors.length ? 'var(--red-text)' : 'var(--amber-text)' }}>{m}</div>
        ))}
        <div style={{ display: 'grid', gap: 8 }}>
          {Object.entries(form).map(([key, value]) => (
            <label key={key} style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              {key.replace(/([A-Z])/g, ' $1')}
              {key === 'fulfillmentChannel' ? (
                <select value={value} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} style={{ height: 32, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                  <option value="AMAZON">FBA</option>
                  <option value="MERCHANT">FBM</option>
                </select>
              ) : (
                <input value={value} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} style={{ height: 32, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', padding: '0 9px' }} />
              )}
            </label>
          ))}
        </div>
      </div>
    </DrawerShell>
  );
};
