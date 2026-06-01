import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, Sparkline, Loading, ErrorState, EmptyState } from '../ui';
import { useCtxMenu } from '../ContextMenu';
import { OptimizationImpact } from '../OptimizationImpact';
import { fetchOmsSkus, refreshAmazonItem, syncAmazonItems, OmsSku } from '../../../lib/oms';
import { docTone, riskLabel } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';
import { AmazonListingModal } from '../modals/AmazonListingModal';

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

const AmazonBadges = ({ sku }: { sku: OmsSku }) => {
  const amazon = sku.amazon;
  if (!amazon) return <Chip tone="amber">Needs listing</Chip>;
  const statusTone = amazon.listingStatus === 'sync_error'
    ? 'red'
    : amazon.listingStatus === 'needs_listing'
      ? 'amber'
      : 'green';
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <Chip tone={statusTone}>{amazon.listingStatus === 'needs_listing' ? 'Needs listing' : amazon.listingStatus}</Chip>
      {amazon.fulfillmentChannel === 'AMAZON' || amazon.fulfillmentChannel === 'FBA' ? <Chip tone="purple">FBA</Chip> : null}
      {amazon.fulfillmentChannel === 'MERCHANT' || amazon.fulfillmentChannel === 'FBM' ? <Chip tone="blue">FBM</Chip> : null}
      {amazon.syncStatus === 'sync_error' ? <Chip tone="red">Sync error</Chip> : null}
    </div>
  );
};

export const InventoryNetwork = ({ onNavigate, toggleSelect, isSelected, onNewProduct, onImportCsv }: ScreenProps) => {
  const [view, setView] = useState<'table' | 'heatmap' | 'treemap'>('table');
  const [search, setSearch] = useState('');
  const [amazonFilter, setAmazonFilter] = useState<'all' | 'listed' | 'fba' | 'needs_listing' | 'sync_error'>('all');
  const [skus, setSkus] = useState<OmsSku[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingAmazon, setSyncingAmazon] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [listingItem, setListingItem] = useState<OmsSku | null>(null);
  const ctx = useCtxMenu();

  const load = () => {
    setLoading(true);
    setErr(null);
    fetchOmsSkus()
      .then((d) => setSkus(d.skus || []))
      .catch((e) => setErr(e.message || 'Failed to load SKUs'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(
    () =>
      skus.filter((s) => {
        const matchesSearch =
          !search ||
          s.sku?.toLowerCase().includes(search.toLowerCase()) ||
          (s.title || '').toLowerCase().includes(search.toLowerCase()) ||
          (s.amazon?.asin || '').toLowerCase().includes(search.toLowerCase()) ||
          (s.amazon?.sellerSku || '').toLowerCase().includes(search.toLowerCase());
        const matchesAmazon =
          amazonFilter === 'all' ||
          (amazonFilter === 'listed' && Boolean(s.amazon?.asin)) ||
          (amazonFilter === 'fba' && Boolean(s.amazon?.fbaEligible || s.amazon?.fulfillmentChannel === 'AMAZON' || s.amazon?.fulfillmentChannel === 'FBA')) ||
          (amazonFilter === 'needs_listing' && (!s.amazon || s.amazon.listingStatus === 'needs_listing')) ||
          (amazonFilter === 'sync_error' && s.amazon?.syncStatus === 'sync_error');
        return matchesSearch && matchesAmazon;
      }),
    [skus, search, amazonFilter]
  );

  const atRisk = skus.filter((s) => s.daysOfCover < 14).length;
  const amazonMapped = skus.filter((s) => s.amazon?.asin).length;
  const fbaEligible = skus.filter((s) => s.amazon?.fbaEligible).length;
  const avgDoc = skus.length ? Math.round(skus.reduce((a, s) => a + (s.daysOfCover || 0), 0) / skus.length) : 0;
  const avgFill = skus.length ? Math.round(skus.reduce((a, s) => a + (s.fillPercent || 0), 0) / skus.length) : 0;

  const syncAmazon = async () => {
    setSyncingAmazon(true);
    setErr(null);
    try {
      await syncAmazonItems();
      load();
    } catch (e: any) {
      setErr(e.message || 'Failed to sync Amazon items');
    } finally {
      setSyncingAmazon(false);
    }
  };

  const refreshAmazon = async (sku: OmsSku) => {
    try {
      await refreshAmazonItem(sku.id);
      load();
    } catch (e: any) {
      setErr(e.message || 'Failed to refresh Amazon item');
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">SKUs</h1>
          <p className="page-subtitle">
            Every product, every warehouse. Click any SKU to drill into its history, billing, and shipments. Right-click for actions.
          </p>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
              <Icon name="list" size={12} /> Table
            </button>
            <button className={view === 'heatmap' ? 'active' : ''} onClick={() => setView('heatmap')}>
              <Icon name="grid" size={12} /> Heatmap
            </button>
            <button className={view === 'treemap' ? 'active' : ''} onClick={() => setView('treemap')}>
              <Icon name="layers" size={12} /> Margin
            </button>
          </div>
          <button className="btn" onClick={() => onImportCsv?.('skus')}>
            <Icon name="download" size={13} style={{ transform: 'rotate(180deg)' }} /> Import CSV
          </button>
          <button className="btn" onClick={syncAmazon} disabled={syncingAmazon}>
            <Icon name="refresh" size={13} /> {syncingAmazon ? 'Syncing' : 'Sync Amazon'}
          </button>
          <button className="btn"><Icon name="download" size={13} /> Export</button>
          <button className="btn primary" onClick={onNewProduct}><Icon name="plus" size={13} /> New product</button>
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
        <div className="stat">
          <div className="stat-label">Avg days of cover</div>
          <div className="stat-value">{avgDoc}d</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>network-wide</div>
        </div>
        <div className="stat ai">
          <div className="stat-label">Amazon mapped</div>
          <div className="stat-value">{amazonMapped}</div>
          <div className="stat-delta up"><span className="arrow">▲</span> {fbaEligible} FBA-ready</div>
        </div>
      </div>

      <OptimizationImpact screen="skus" title="SKU placement optimization" onNavigate={onNavigate} />

      {err ? (
        <div className="card"><ErrorState message={err} onRetry={load} /></div>
      ) : loading ? (
        <div className="card"><Loading rows={6} /></div>
      ) : view === 'table' ? (
        <div className="table-wrap">
          <div className="table-toolbar">
            <div style={{ position: 'relative', flex: '0 1 280px' }}>
              <Icon name="search" size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search SKU or product"
                style={{ width: '100%', height: 28, padding: '0 10px 0 28px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 12 }}
              />
            </div>
            <select
              className="filter-chip"
              value={amazonFilter}
              onChange={(e) => setAmazonFilter(e.target.value as any)}
              style={{ height: 28 }}
            >
              <option value="all">Amazon: All</option>
              <option value="listed">Listed</option>
              <option value="fba">FBA eligible</option>
              <option value="needs_listing">Needs listing</option>
              <option value="sync_error">Sync error</option>
            </select>
            <button className="filter-chip applied"><Icon name="filter" size={11} /> Warehouse: All <Icon name="x" size={10} /></button>
            <button className="filter-chip"><Icon name="filter" size={11} /> DOC range</button>
            <button className="filter-chip"><Icon name="filter" size={11} /> Risk</button>
            <div className="spacer" />
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{filtered.length} SKUs · WMS truth</span>
            <button className="btn ghost sm"><Icon name="columns" size={12} /> Columns</button>
          </div>
          {filtered.length === 0 ? (
            <EmptyState>No SKUs match your search.</EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 28 }} />
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Amazon</th>
                  <th className="num">Available</th>
                  <th className="num">Inbound</th>
                  <th className="num">Velocity / 30d</th>
                  <th>Days of cover</th>
                  <th className="num">Proposed units</th>
                  <th>Pallet fill</th>
                  <th>Service tier</th>
                  <th>Amazon actions</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const sel = isSelected(s.id);
                  const rl = riskLabel(s.risk);
                  return (
                    <tr
                      key={s.id}
                      className="clickable"
                      style={{ background: sel ? 'var(--accent-soft)' : undefined }}
                      onClick={(e) => {
                        if ((e.target as HTMLInputElement).type === 'checkbox') return;
                        onNavigate('sku-detail', s.id);
                      }}
                      onContextMenu={(e) =>
                        ctx.open(e, [
                          { label: 'SKU' },
                          { icon: 'eye', title: 'Open SKU page', onClick: () => onNavigate('sku-detail', s.id) },
                          { icon: 'studio', title: 'View in Inventory Plan', onClick: () => onNavigate('plan', s.id) },
                          { divider: true },
                          {
                            icon: 'plus',
                            title: sel ? 'Remove from shipment' : 'Add to shipment plan',
                            onClick: () => toggleSelect({ id: s.id, name: s.title || s.sku, ...(s as any) }),
                          },
                          {
                            icon: 'box',
                            title: s.amazon?.fbaEligible ? 'Create FBA shipment' : 'FBA blocked until Amazon profile is eligible',
                            onClick: () => s.amazon?.fbaEligible && toggleSelect({ id: s.id, name: s.title || s.sku, ...(s as any), fbaIntent: true }),
                          },
                          {
                            icon: 'arrowRight',
                            title: s.amazon?.asin ? 'Update Amazon listing' : 'List on Amazon',
                            onClick: () => setListingItem(s),
                          },
                          { icon: 'refresh', title: 'Refresh Amazon item', onClick: () => refreshAmazon(s) },
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
                      <td className="mono strong">{s.sku}</td>
                      <td>
                        <span style={{ color: 'var(--text)' }}>{s.title || '—'}</span>
                      </td>
                      <td>
                        <AmazonBadges sku={s} />
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
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn ghost sm" onClick={() => setListingItem(s)}>
                            {s.amazon?.asin ? 'Update' : 'List'}
                          </button>
                          <button
                            className="btn ghost sm"
                            disabled={!s.amazon?.fbaEligible}
                            onClick={() => toggleSelect({ id: s.id, name: s.title || s.sku, ...(s as any), fbaIntent: true })}
                            title={s.amazon?.fbaEligible ? 'Create Amazon FBA shipment' : 'Complete Amazon listing/FBA readiness first'}
                          >
                            FBA
                          </button>
                        </div>
                      </td>
                      <td>
                        <Chip tone={rl.tone}>{rl.label}</Chip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <EmptyState>
              {view === 'heatmap' ? 'Warehouse × region coverage' : 'Margin treemap'} is rendered on the dedicated screen.
              <div style={{ marginTop: 12 }}>
                <button className="btn sm" onClick={() => onNavigate('heatmap')}>
                  <Icon name="map" size={12} /> Open US Heatmap
                </button>
              </div>
            </EmptyState>
          </div>
        </div>
      )}
      {listingItem ? (
        <AmazonListingModal
          item={listingItem}
          onClose={() => setListingItem(null)}
          onSaved={() => {
            setListingItem(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
};
