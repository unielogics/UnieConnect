import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, StatusChip, ProgressBar, fmt, Loading, ErrorState, EmptyState, type Tone } from '../ui';
import {
  fetchOmsSkuDetail,
  fetchOmsSkus,
  fetchProductResearchResult,
  fetchRecommendations,
  OmsRecommendation,
  OmsSkuEnrichmentUpdate,
  OmsSkuDetail,
  OmsSupplier,
  ProductResearchResult,
  fetchOmsSuppliers,
  uploadCatalogImage,
  updateOmsSkuEnrichment,
  fetchSkuFulfillmentEconomics,
  refreshSkuFulfillmentEconomics,
  type SkuFulfillmentEconomics,
  fetchSkuReplenishmentProfile,
  updateSkuReplenishmentProfile,
  type SkuReplenishmentProfile,
} from '../../../lib/oms';
import { num, docTone, riskLabel, channelColor } from '../../../lib/oms-adapters';
import { amazonCategoryNames, amazonSubcategoriesFor } from '../../../lib/amazon-category-tree';
import { fetchShipmentPricingPreview, type ShipmentPricingPreview } from '../../../lib/shipment-plan';
import type { ScreenProps } from '../UnieConnectApp';
import { AmazonListingDrawer, RecommendationDrawer } from './InventoryNetwork';

type Tab = 'overview' | 'heatmap' | 'warehouses' | 'history' | 'channels' | 'billing' | 'orders' | 'replenishment';

const skuBaseline = (sku: OmsSkuDetail, productIntel: ProductResearchResult | null) => {
  const result = productIntel?.result;
  const missing = new Set(result?.missingData || []);
  const hasDims = Boolean(sku.dimensions?.length && sku.dimensions?.width && sku.dimensions?.height);
  const hasWeight = num(sku.weight) > 0;
  const hasPrice = sku.price != null && num(sku.price) > 0;
  const hasCost = num((sku.metadata as any)?.cost ?? (sku.attributes as any)?.cost ?? sku.cost) > 0;
  if (hasDims && hasWeight) missing.delete('dimensions_weight');
  if (hasPrice) missing.delete('selling_price');
  if (hasCost) missing.delete('cost');
  const effectiveMissing = Array.from(missing);
  const requirements = [
    { label: 'Dimensions', met: hasDims || !effectiveMissing.includes('dimensions_weight') },
    { label: 'Weight', met: hasWeight || !effectiveMissing.includes('dimensions_weight') },
    { label: 'Cost', met: hasCost || !effectiveMissing.includes('cost') },
    { label: 'Selling price', met: hasPrice || !effectiveMissing.includes('selling_price') },
    { label: 'Demand source', met: !effectiveMissing.includes('marketplace_or_csv_demand') },
  ];
  return {
    requirements,
    effectiveMissing,
    score: result?.opportunityScore ?? '—',
    summary: effectiveMissing.length
      ? `Complete ${effectiveMissing.map((m) => m.replace(/_/g, ' ')).join(', ')} before high-confidence optimization.`
      : (result?.recommendedAction || 'SKU baseline is ready for Cortex optimization.'),
  };
};

const skuCleanupFieldFor = (missingFields: string[], sku: OmsSkuDetail) => {
  const normalized = missingFields.map((field) => String(field || '').toLowerCase().replace(/[_-]+/g, ' '));
  if (normalized.some((field) => field.includes('cost'))) return 'cost';
  if (normalized.some((field) => field.includes('dimension')) && !sku.dimensions?.length) return 'dimensions';
  if (normalized.some((field) => field.includes('dimension')) && !sku.dimensions?.width) return 'dimensions';
  if (normalized.some((field) => field.includes('dimension')) && !sku.dimensions?.height) return 'dimensions';
  if (normalized.some((field) => field.includes('weight'))) return 'weight';
  if (normalized.some((field) => field.includes('selling') || field.includes('price'))) return 'price';
  if (normalized.some((field) => field.includes('marketplace') || field.includes('demand'))) return 'channels';
  return 'cost';
};

const money = (value: unknown) => {
  const n = Number(value || 0);
  return `$${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
};

const optionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : null;
};

const moneyOrMissing = (value: unknown) => {
  const n = optionalNumber(value);
  return n == null ? 'Not calculated' : money(n);
};

const networkBlockedCopy = (reason?: unknown) => {
  const key = String(reason || '').trim();
  const labels: Record<string, string> = {
    network_expansion_not_allowed_by_warehouse: 'Network expansion is not allowed by the warehouse.',
    no_approved_second_node_configured: 'No approved second node is configured by the warehouse.',
    no_positive_savings_after_transfer: 'No positive savings after LTL transfer.',
    no_eligible_network_node_available: 'No eligible network node is available.',
    no_distinct_second_node_selected: 'Cortex did not find a distinct second node.',
    optimization_pricing_unavailable: 'Optimization pricing is not available yet.',
    ltl_transfer_rate_unavailable: 'LTL transfer rate is not available yet.',
  };
  return labels[key] || key.replace(/_/g, ' ') || 'Network expansion is blocked.';
};

const normalizedWarehouseCodes = (value: unknown) => {
  const rows = Array.isArray(value) ? value : [];
  return rows.map((entry) => String(entry || '').trim()).filter(Boolean);
};

const distinctWarehouseCodeCount = (value: unknown) =>
  new Set(normalizedWarehouseCodes(value).map((entry) => entry.toLowerCase())).size;

const warehousePerUnit = (warehouse: any, fallback?: unknown) =>
  Number(warehouse?.feePreview?.perUnit ?? warehouse?.totalEstimatedCostPerUnit ?? warehouse?.estimatedCostPerUnit ?? fallback ?? 0);

const skuPricingSummary = (preview?: ShipmentPricingPreview | null) => {
  if (!preview) return null;
  const warehouses = Array.isArray(preview.warehouses) ? preview.warehouses : [];
  const current = warehouses.find((warehouse: any) => warehouse.isAnchor || warehouse.scopeRole === 'anchor') || warehouses[0] || {};
  const optimized = warehouses.length
    ? warehouses.reduce((best: any, warehouse: any) => {
        const next = warehousePerUnit(warehouse, preview.totals?.estimatedPerUnit);
        const currentBest = warehousePerUnit(best, preview.totals?.estimatedPerUnit);
        return !best || (next > 0 && next < currentBest) ? warehouse : best;
      }, warehouses[0])
    : {};
  const perSkuRows = Array.isArray(preview.perSkuEconomics) ? preview.perSkuEconomics : [];
  const perSkuBlockedReasons = perSkuRows
    .map((row: any) => row?.pricingPayload?.networkComparison?.optimizedTwoNode)
    .filter((node: any) => node?.status === 'blocked' || node?.blockedReason || node?.distinctSecondNode === false)
    .map((node: any) => node?.blockedReason || 'no_distinct_second_node_selected');
  const currentPerUnit = warehousePerUnit(current, preview.totals?.estimatedPerUnit);
  const rawOptimizedPerUnit = warehousePerUnit(optimized, preview.totals?.estimatedPerUnit);
  const currentWarehouseCode = String((current as any)?.warehouseCode || (current as any)?.code || '').trim();
  const optimizedWarehouseCode = String((optimized as any)?.warehouseCode || (optimized as any)?.code || '').trim();
  const optimizedBlockedReason = perSkuBlockedReasons[0]
    || (optimizedWarehouseCode && currentWarehouseCode && optimizedWarehouseCode === currentWarehouseCode ? 'no_distinct_second_node_selected' : null)
    || (rawOptimizedPerUnit > 0 && currentPerUnit > 0 && rawOptimizedPerUnit >= currentPerUnit ? 'no_positive_savings_after_transfer' : null);
  return {
    current,
    optimized,
    currentPerUnit,
    optimizedPerUnit: optimizedBlockedReason ? null : rawOptimizedPerUnit,
    optimizedBlockedReason,
    labelAvg: Number(preview.totals?.labelWeightedAverage ?? (current as any)?.weightedLabelCostPerUnit ?? 0),
    storage: Number(preview.totals?.storageMonthlyEstimate ?? 0),
    fulfillment: Number(preview.feePreview?.fulfillmentFeePerUnit ?? warehousePerUnit(current, preview.totals?.estimatedPerUnit)),
    confidence: preview.confidence == null ? null : Math.round(Number(preview.confidence) * 100),
  };
};

const economicsNetworkComparison = (economics?: SkuFulfillmentEconomics | null) => {
  const comparison = economics?.pricingPayload?.networkComparison;
  if (comparison?.singleWarehouse || comparison?.optimizedTwoNode) return comparison;
  const costs = economics?.costs || {};
  const current = Number(costs.currentPerUnit ?? costs.totalPerUnit ?? 0);
  const optimized = Number(costs.optimizedPerUnit ?? current);
  return {
    basis: 'sku_level_48_state_rate_shop',
    heatmapStrategy: 'two_node_density_model',
    singleWarehouse: {
      strategy: 'single_warehouse_close_to_supplier',
      warehouseCodes: [economics?.anchorWarehouseCode || 'anchor warehouse'],
      executable: true,
      labelPerUnit: optionalNumber(costs.domesticLabelPerUnit),
      totalPerUnit: current,
      source: 'stored_sku_economics',
    },
    optimizedTwoNode: {
      strategy: 'optimized_two_node_heatmap',
      status: 'blocked',
      blockedReason: 'no_eligible_network_node_available',
      warehouseCodes: [economics?.anchorWarehouseCode || 'anchor warehouse'],
      selectedWarehouseCount: 1,
      distinctSecondNode: false,
      executable: false,
      modeledOnly: true,
      labelPerUnit: null,
      transferPerUnit: null,
      totalPerUnit: null,
      savingsPerUnit: null,
      source: 'stored_sku_economics',
    },
  };
};

const skuEconomicsRefreshPayload = (detail: OmsSkuDetail) => ({
  workflowType: 'DTC',
  serviceWorkflow: 'dtc_fbm',
  marketplaceType: 'DTC',
  quantity: Math.max(1, num(detail.intelligence?.velocity30d) || 1),
  item: {
    itemId: detail.id,
    sku: detail.sku,
    title: detail.title,
    quantity: Math.max(1, num(detail.intelligence?.velocity30d) || 1),
    unitWeightLb: num(detail.weight) || undefined,
    weight: num(detail.weight) || undefined,
    dimensions: detail.dimensions || undefined,
    cost: num(detail.cost || (detail.metadata as any)?.cost),
    sellingPrice: num(detail.price),
    asin: detail.asin || undefined,
    upc: detail.upc || undefined,
    ean: detail.ean || undefined,
    keepaState: detail.enrichmentState || undefined,
    salesVelocity30d: num(detail.intelligence?.velocity30d),
  },
});

export const SkuDetail = ({ skuId, onBack, onNavigate, toggleSelect, isSelected }: ScreenProps & { onBack?: () => void }) => {
  const [data, setData] = useState<OmsSkuDetail | null>(null);
  const [productIntel, setProductIntel] = useState<ProductResearchResult | null>(null);
  const [pricingPreview, setPricingPreview] = useState<ShipmentPricingPreview | null>(null);
  const [skuEconomics, setSkuEconomics] = useState<SkuFulfillmentEconomics | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<OmsRecommendation[]>([]);
  const [selectedRec, setSelectedRec] = useState<OmsRecommendation | null>(null);
  const [amazonOpen, setAmazonOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const load = () => {
    if (!skuId) {
      setErr('No SKU selected');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    fetchOmsSkuDetail(skuId)
      .then((detail) => {
        setData(detail);
        fetchProductResearchResult(detail.sku).then(setProductIntel).catch(() => setProductIntel(null));
        setPricingLoading(true);
        setPricingError(null);
        fetchSkuFulfillmentEconomics(detail.id, 'DTC')
          .then(async (response) => {
            if (response.economics) {
              setSkuEconomics(response.economics);
              return;
            }
            const refreshed = await refreshSkuFulfillmentEconomics(detail.id, skuEconomicsRefreshPayload(detail));
            setSkuEconomics(refreshed.economics || null);
          })
          .catch(() => setSkuEconomics(null));
        fetchShipmentPricingPreview({
          workflowType: 'DTC',
          serviceWorkflow: 'dtc_fbm',
          marketplaceType: 'DTC',
          items: [{
            itemId: detail.id,
            sku: detail.sku,
            title: detail.title,
            quantity: Math.max(1, num(detail.intelligence?.velocity30d) || 1),
            boxCount: 1,
            unitWeightLb: num(detail.weight) || undefined,
            weight: num(detail.weight) || undefined,
            dimensions: detail.dimensions || undefined,
            cost: num(detail.cost || (detail.metadata as any)?.cost),
            sellingPrice: num(detail.price),
            asin: detail.asin || undefined,
            keepaState: detail.enrichmentState || undefined,
          }],
        })
          .then(setPricingPreview)
          .catch((error) => {
            setPricingPreview(null);
            setPricingError(error?.message || 'Cortex pricing preview unavailable.');
          })
          .finally(() => setPricingLoading(false));
        fetchRecommendations({ entityType: 'sku', status: 'open', limit: 5 }).then((r) => {
          const seen = new Set<string>();
          const matching = (r.recommendations || []).filter((rec) => rec.entityId === detail.id || rec.entityId === detail.sku);
          setRecommendations(matching.filter((rec) => {
            const fields = [
              ...(Array.isArray((rec.currentValue as any)?.missingFields) ? (rec.currentValue as any).missingFields : []),
              ...(Array.isArray((rec.optimizedValue as any)?.requiredFields) ? (rec.optimizedValue as any).requiredFields : []),
            ].map((field) => String(field || '').toLowerCase()).sort();
            const isBaselineBlocker = String(rec.requiredAction || '').toLowerCase() === 'complete_missing_product_data';
            const key = [isBaselineBlocker ? 'sku_baseline_blocker' : rec.recommendationType || '', rec.requiredAction || '', rec.approvalState || '', fields.join(',')].join('|');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }));
        }).catch(() => setRecommendations([]));
      })
      .catch((e) => setErr(e.message || 'Failed to load SKU'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [skuId]);

  const back = () => (onBack ? onBack() : onNavigate('skus'));

  if (err) return <div className="page fade-in"><div className="card"><ErrorState message={err} onRetry={load} /></div></div>;
  if (loading || !data) return <div className="page fade-in"><div className="card"><Loading rows={6} /></div></div>;

  const intel = data.intelligence || {};
  const rl = riskLabel(intel.risk as string);
  const doc = num(intel.daysOfCover);
  const rev = num(intel.revenue30d);
  const gp = num(intel.grossProfit30d);
  const keepaUnavailable = data.keepaUnavailable || data.enrichmentMarker === '*' || ['keepa_unavailable', 'missing_asin'].includes(String(data.enrichmentState || '').toLowerCase());
  const baseline = skuBaseline(data, productIntel);
  const openMissingDataField = (missingFields: string[]) => {
    const field = skuCleanupFieldFor(missingFields.length ? missingFields : baseline.effectiveMissing, data);
    setSelectedRec(null);
    if (field === 'channels') {
      setTab('channels');
      return;
    }
    window.setTimeout(() => {
      const element = document.querySelector(`[data-sku-detail-field="${field}"]`) as HTMLElement | null;
      if (!element) return;
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.click();
      element.focus?.();
    }, 80);
  };

  return (
    <div className="page fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12.5 }}>
        <button className="btn ghost sm" onClick={back}>
          <Icon name="chevron" size={11} style={{ transform: 'rotate(180deg)' }} /> Back to SKUs
        </button>
        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
        <span style={{ color: 'var(--text-tertiary)' }}>SKU detail</span>
        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
        <span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>
          {data.sku}
          {keepaUnavailable && (
            <span title="Keepa enrichment unavailable; Cortex will use manual/marketplace data." style={{ color: 'var(--amber)', marginLeft: 4, fontWeight: 900 }}>*</span>
          )}
        </span>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 18, alignItems: 'center', padding: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              background: 'linear-gradient(135deg, var(--bg-sunken) 0%, var(--bg-active) 100%)',
              border: '1px solid var(--border)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-tertiary)',
              overflow: 'hidden',
            }}
          >
            {data.image ? <img src={data.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="box" size={36} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                {data.sku}
                {keepaUnavailable && (
                  <span title="Keepa enrichment unavailable; Cortex will use manual/marketplace data." style={{ color: 'var(--amber)', marginLeft: 4, fontWeight: 900 }}>*</span>
                )}
              </span>
              {data.asin && <Chip dot={false}>{data.asin}</Chip>}
              {keepaUnavailable && <Chip tone="amber" dot={false}>Keepa *</Chip>}
              <Chip tone={rl.tone}>{rl.label}</Chip>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {data.title || data.sku}
              {keepaUnavailable && (
                <span title="Keepa enrichment unavailable; Cortex will use manual/marketplace data." style={{ color: 'var(--amber)', marginLeft: 6 }}>*</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              {data.price != null && (
                <>
                  <span>Price <strong style={{ color: 'var(--text)' }}>${num(data.price).toFixed(2)}</strong></span>
                  <span>·</span>
                </>
              )}
              {data.margin != null && (
                <>
                  <span>Margin <strong style={{ color: 'var(--text)' }}>{(num(data.margin) * 100).toFixed(0)}%</strong></span>
                  <span>·</span>
                </>
              )}
              {data.weight != null && (
                <>
                  <span>Weight <strong style={{ color: 'var(--text)' }}>{num(data.weight)} lb</strong></span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 12 }}>
              {baseline.requirements.map((req) => (
                <span key={req.label} className={`requirement-pill ${req.met ? 'met' : 'missing'}`}>
                  {req.met ? <Icon name="check" size={10} /> : <Icon name="warning" size={10} />}
                  {req.label}
                </span>
              ))}
              <Chip tone={baseline.effectiveMissing.length ? 'amber' : 'green'} dot={false}>Score {baseline.score}</Chip>
              {recommendations.length > 0 && <Chip tone="purple" dot={false}>{recommendations.length} open rec{recommendations.length === 1 ? '' : 's'}</Chip>}
            </div>
            <div style={{ marginTop: 7, fontSize: 12, color: baseline.effectiveMissing.length ? 'var(--amber-text)' : 'var(--green-text)', fontWeight: 700 }}>
              {baseline.summary}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {recommendations[0] && (
              <button className="btn primary cortex-action" onClick={() => setSelectedRec(recommendations[0])} data-hint="Review Cortex optimization">
                <span className="icon-alert-wrap">
                  <Icon name="sparkle" size={13} />
                  <span className="icon-alert-dot" />
                </span>
                Review Cortex
              </button>
            )}
            <button className="btn ghost" onClick={() => setAmazonOpen(true)} data-hint="Amazon listing draft">
              <Icon name="amazon" size={14} /> Amazon
            </button>
            <button className="btn ghost" onClick={() => onNavigate('ledger')}><Icon name="ledger" size={13} /> Ledger</button>
            <button className="btn" onClick={() => onNavigate('plan', data.id)}><Icon name="eye" size={13} /> View in Plan</button>
            <button
              className={`btn ${isSelected(data.id) ? '' : 'primary'}`}
              onClick={() => toggleSelect({ id: data.id, name: data.title || data.sku, ...(data as any) })}
            >
              {isSelected(data.id) ? (
                <><Icon name="check" size={13} /> Selected</>
              ) : (
                <><Icon name="plus" size={13} /> Add to shipment</>
              )}
            </button>
          </div>
        </div>
      </div>

      <ItemDetailsPanel data={data} onSaved={setData} />

      <SkuCortexEconomicsCard
        skuId={data.id}
        sku={data}
        economics={skuEconomics}
        onEconomics={setSkuEconomics}
        preview={pricingPreview}
        loading={pricingLoading}
        error={pricingError}
      />

      <div className="stat-grid cols-5" style={{ marginBottom: 16 }}>
        <KpiTile label="On hand" value={num(intel.available).toLocaleString()} unit="u" sub={`across ${data.warehouses.length} WHs`} />
        <KpiTile label="Inbound" value={num(intel.inbound).toLocaleString()} unit="u" sub={num(intel.inbound) > 0 ? 'ASNs en route' : 'no inbound'} />
        <KpiTile label="Days of cover" value={Math.round(doc)} unit="d" tone={doc < 14 ? 'danger' : doc < 28 ? 'warn' : 'good'} />
        <KpiTile label="Velocity / 30d" value={num(intel.velocity30d).toLocaleString()} unit="u" />
        <KpiTile label="Revenue / 30d" value={fmt.money(rev, { compact: true })} sub={`${fmt.money(gp, { compact: true })} GP`} tone="good" />
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {([
          ['overview', 'Overview', undefined],
          ['heatmap', 'Heatmap', undefined],
          ['warehouses', 'Warehouses', data.warehouses.length],
          ['history', 'History', undefined],
          ['channels', 'Channels', data.channels?.length],
          ['replenishment', 'Replenishment', undefined],
          ['billing', 'Billing', undefined],
          ['orders', 'Orders', undefined],
        ] as [Tab, string, number | undefined][]).map(([id, label, count]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
            {count !== undefined && <span className="count">{count}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview data={data} />}
      {tab === 'heatmap' && <SkuDemandHeatmap data={data} />}
      {tab === 'warehouses' && <Warehouses data={data} />}
      {tab === 'history' && <History data={data} />}
      {tab === 'channels' && <Channels data={data} />}
      {tab === 'replenishment' && <ReplenishmentProfileTab skuId={data.id} sku={data.sku} warehouseCount={data.warehouses.length} />}
      {tab === 'billing' && <Billing data={data} />}
      {tab === 'orders' && (
        <div className="card">
          <div className="card-body">
            <EmptyState>
              SKU-level order history is shown on the Orders screen filtered by this SKU.
              <div style={{ marginTop: 12 }}>
                <button className="btn sm" onClick={() => onNavigate('orders')}>
                  <Icon name="orders" size={12} /> Open Orders
                </button>
              </div>
            </EmptyState>
          </div>
        </div>
      )}
      {selectedRec && (
        <RecommendationDrawer
          rec={selectedRec}
          onClose={() => setSelectedRec(null)}
          onChanged={load}
          onResolveMissingData={(missingFields) => openMissingDataField(missingFields)}
          resolveMissingLabel="Fix missing SKU field"
        />
      )}
      {amazonOpen && <AmazonListingDrawer sku={{ id: data.id, sku: data.sku, title: data.title }} onClose={() => setAmazonOpen(false)} />}
    </div>
  );
};


// Per-product replenishment (P3). The client sets ONLY demand intent — enable, supplier lead
// time, demand window — applied to this SKU in every connected warehouse. Everything physical
// (velocity, pick-face size, handling unit) is computed by the warehouse and shown read-only.
const ReplenishmentProfileTab = ({ skuId, sku, warehouseCount }: { skuId: string; sku: string; warehouseCount: number }) => {
  const [p, setP] = useState<SkuReplenishmentProfile | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [leadTime, setLeadTime] = useState('');
  const [windowDays, setWindowDays] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const apply = (prof: SkuReplenishmentProfile) => {
    setP(prof);
    setEnabled(!!prof.enabled);
    setLeadTime(prof.supplierLeadTimeDays != null ? String(prof.supplierLeadTimeDays) : '');
    setWindowDays(prof.demandWindowDays != null ? String(prof.demandWindowDays) : '');
  };

  const load = () => {
    setLoading(true); setErr(null); setSavedNote(null);
    fetchSkuReplenishmentProfile(skuId)
      .then(apply)
      .catch((e) => setErr(e.message || 'Failed to load replenishment profile'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [skuId]);

  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
  const save = () => {
    setSaving(true); setErr(null); setSavedNote(null);
    updateSkuReplenishmentProfile(skuId, { enabled, supplierLeadTimeDays: numOrNull(leadTime), demandWindowDays: numOrNull(windowDays) })
      .then((res) => {
        apply(res);
        const applied = (res.results || []).filter((r) => r.updated).length;
        const total = (res.results || []).length;
        setSavedNote(`Saved to ${applied}/${total} warehouse(s) where this SKU exists.`);
      })
      .catch((e) => setErr(e.message || 'Failed to save'))
      .finally(() => setSaving(false));
  };

  if (loading) return <div className="card"><div className="card-body"><Loading rows={4} /></div></div>;
  if (err && !p) return <div className="card"><div className="card-body"><ErrorState message={err} onRetry={load} /></div></div>;

  const d = p?.derived;
  const fmtN = (v: number | null | undefined, unit = '') => (v != null ? `${v}${unit}` : '—');

  return (
    <div className="row-2">
      <div className="card">
        <div className="card-header"><div className="card-title">Replenishment for {sku}</div></div>
        <div className="card-body" style={{ display: 'grid', gap: 12 }}>
          <p className="muted" style={{ fontSize: 12, marginTop: -2 }}>
            You set the demand intent; the warehouse computes the rest (velocity from your sales,
            pick-face size, handling). Applied to this product in every connected warehouse
            ({warehouseCount}).
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setSavedNote(null); }} />
            <span>Enable auto-replenishment for this product</span>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12.5 }}>
            <span className="muted">Supplier lead time (days)</span>
            <input type="number" min={0} step={1} value={leadTime} placeholder="optional"
              onChange={(e) => { setLeadTime(e.target.value); setSavedNote(null); }} className="input" />
            <span className="muted" style={{ fontSize: 11 }}>How long it takes YOU to restock this product from your supplier (reorder planning).</span>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12.5 }}>
            <span className="muted">Demand window (days)</span>
            <input type="number" min={1} step={1} value={windowDays} placeholder="default"
              onChange={(e) => { setWindowDays(e.target.value); setSavedNote(null); }} className="input" />
            <span className="muted" style={{ fontSize: 11 }}>How far back to look at your sales when estimating demand. Blank = warehouse default.</span>
          </label>
          {err ? <div style={{ color: 'var(--danger, #c0392b)', fontSize: 12 }}>{err}</div> : null}
          {savedNote ? <div style={{ color: 'var(--good, #2e7d32)', fontSize: 12 }}>{savedNote}</div> : null}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
            <button className="btn ghost" disabled={saving} onClick={load}>Reset</button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Computed by the warehouse</div></div>
        <div className="card-body" style={{ display: 'grid', gap: 8 }}>
          <Kv label="Sales velocity (ecommerce)" value={fmtN(p?.externalUnitsPerDay, '/day')} />
          <Kv label="Blended velocity" value={fmtN(d?.velocityPerDay, '/day')} />
          <Kv label="Pick-face min → max" value={d ? `${fmtN(d.minPickFaceEaches)} → ${fmtN(d.maxPickFaceEaches)}` : '—'} />
          <Kv label="Safety buffer" value={fmtN(d?.safetyBufferDays, ' day(s)')} />
          <Kv label="Handling unit" value={d?.handlingUnit || '—'} />
          <Kv label="Computed by" value={d?.computedBy || '—'} />
          <p className="muted" style={{ fontSize: 11.5 }}>
            These are derived from your sales demand and the warehouse&apos;s bin capacity, and
            refresh as the warehouse runs replenishment. You don&apos;t set them directly.
          </p>
        </div>
      </div>
    </div>
  );
};

const Kv = ({ label, value }: { label: string; value?: string | null }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
    <span className="muted">{label}</span>
    <span style={{ fontWeight: 700, textAlign: 'right' }}>{value || '—'}</span>
  </div>
);

const KpiTile = ({ label, value, unit, sub, tone }: { label: string; value: React.ReactNode; unit?: string; sub?: string; tone?: string }) => (
  <div className={`stat ${tone || ''}`}>
    <div className="stat-label">{label}</div>
    <div className="stat-value">
      {value}
      {unit && <span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: 3 }}>{unit}</span>}
    </div>
    {sub && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{sub}</div>}
  </div>
);

const SkuCortexEconomicsCard = ({
  skuId,
  sku,
  economics,
  onEconomics,
  preview,
  loading,
  error,
}: {
  skuId: string;
  sku: OmsSkuDetail;
  economics?: SkuFulfillmentEconomics | null;
  onEconomics: (next: SkuFulfillmentEconomics | null) => void;
  preview: ShipmentPricingPreview | null;
  loading: boolean;
  error?: string | null;
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      const workflowType = String(economics?.workflowType || 'DTC').toUpperCase();
      const payload = {
        ...skuEconomicsRefreshPayload(sku),
        workflowType,
        serviceWorkflow: workflowType === 'FBA' || workflowType === 'FBW' ? 'prep' : 'dtc_fbm',
        marketplaceType: workflowType,
        quantity: economics?.quantity || Math.max(1, skuEconomicsRefreshPayload(sku).quantity || 1),
      };
      const response = await refreshSkuFulfillmentEconomics(skuId, payload);
      onEconomics(response.economics || null);
    } catch {
      onEconomics(economics || null);
    } finally {
      setRefreshing(false);
    }
  };
  if (economics) {
    const costs = economics.costs || {};
    const blockers = economics.blockers || [];
    const workflow = String(economics.workflowType || 'Cortex');
    const networkRightsCopy = economics.networkPolicy?.policySource === 'wms_client'
      ? 'Network rights are managed by your warehouse.'
      : 'Cortex may optimize across the available network.';
    const confidence = Math.round(Number(economics.confidence || 0) * 100);
    const isPrep = workflow === 'FBA' || workflow === 'FBW';
    const comparison = economicsNetworkComparison(economics);
    const single = comparison?.singleWarehouse || {};
    const optimized = comparison?.optimizedTwoNode || {};
    const demandHeatmap = comparison?.demandHeatmap || {};
    const optimizedHubCount = Number(optimized.selectedWarehouseCount || 0);
    const singleWarehouses = normalizedWarehouseCodes(single.warehouseCodes);
    const optimizedWarehouses = normalizedWarehouseCodes(optimized.warehouseCodes);
    const optimizedDistinctNodeCount = distinctWarehouseCodeCount(optimized.warehouseCodes);
    const duplicateOptimizedNodes = optimizedWarehouses.length > 1 && optimizedDistinctNodeCount < 2;
    const optimizedBlockedReason = optimized.blockedReason || (duplicateOptimizedNodes ? 'no_distinct_second_node_selected' : undefined);
    const optimizedBlocked = optimized.status === 'blocked' || optimizedBlockedReason || optimized.distinctSecondNode === false || optimizedHubCount < 2 || optimizedDistinctNodeCount < 2;
    const singleTotal = Number(single.totalPerUnit ?? costs.currentPerUnit ?? costs.totalPerUnit ?? 0);
    const optimizedTotal = optimizedBlocked ? null : optionalNumber(optimized.totalPerUnit ?? costs.optimizedPerUnit);
    const savingsPerUnit = optimizedBlocked || optimizedTotal == null ? null : Number(optimized.savingsPerUnit ?? Math.max(0, singleTotal - optimizedTotal));
    const optimizedDisplayWarehouses = optimizedBlocked
      ? 'No distinct second node'
      : optimizedWarehouses.join(' + ') || 'Cortex heatmap pair';
    const metricRows = isPrep
      ? [
          ['Current / unit', costs.currentPerUnit ?? costs.totalPerUnit, economics.anchorWarehouseCode || 'stored'],
          ['Optimized / unit', optimizedBlocked ? null : costs.optimizedPerUnit, optimizedBlocked ? networkBlockedCopy(optimizedBlockedReason) : 'Cortex modeled'],
          ['Receiving / unit', costs.receivingPerUnit, costs.receivingTotal != null ? `${money(costs.receivingTotal)} total` : 'warehouse pricing'],
          ['Prep / LAB / unit', costs.prepLabPerUnit, costs.prepLabTotal != null ? `${money(costs.prepLabTotal)} total` : 'warehouse pricing'],
          ['Unit label', costs.unitLabelPerUnit, costs.unitLabelTotal != null ? `${money(costs.unitLabelTotal)} total` : 'marketplace prep'],
          ['Carton label', costs.cartonLabelPerCarton, costs.cartonLabelTotal != null ? `${money(costs.cartonLabelTotal)} total` : 'box labels'],
        ]
      : [
          ['Current / unit', costs.currentPerUnit ?? costs.totalPerUnit, economics.anchorWarehouseCode || 'stored'],
          ['Optimized / unit', optimizedBlocked ? null : costs.optimizedPerUnit, optimizedBlocked ? networkBlockedCopy(optimizedBlockedReason) : 'Cortex modeled'],
          ['Pick / unit', costs.pickPerUnit, costs.pickTotal != null ? `${money(costs.pickTotal)} total` : 'warehouse pricing'],
          ['Pack / unit', costs.packPerUnit, costs.packTotal != null ? `${money(costs.packTotal)} total` : 'warehouse pricing'],
          ['Materials / order', costs.materialsPerOrder, costs.materialBoxSize ? `${costs.materialBoxSize} box` : 'warehouse materials'],
          ['Label / unit', costs.domesticLabelPerUnit, costs.labelTotal != null ? `${money(costs.labelTotal)} total` : '48-state estimate'],
        ];
    const comparisonRows: Array<{
      key: 'single' | 'optimized';
      title: string;
      tone: Tone;
      badge: string;
      warehouses: string;
      label: number | null;
      transfer: number | null;
      total: number | null;
      blockedReason?: string;
      source: string;
    }> = [
      {
        key: 'single',
        title: 'Single warehouse near supplier',
        tone: 'green',
        badge: 'Executable',
        warehouses: singleWarehouses.length ? singleWarehouses.join(' + ') : economics.anchorWarehouseCode || 'Anchor warehouse',
        label: optionalNumber(single.labelPerUnit ?? costs.domesticLabelPerUnit),
        transfer: optionalNumber(single.transferPerUnit),
        total: singleTotal,
        source: String(single.source || 'anchor warehouse rate shop').replace(/_/g, ' '),
      },
      {
        key: 'optimized',
        title: optimizedHubCount > 1 ? 'Optimized 2-node heatmap' : 'Network expansion check',
        tone: optimizedBlocked ? 'amber' : optimized.modeledOnly ? 'amber' : 'purple',
        badge: optimizedBlocked ? 'Blocked' : optimized.modeledOnly ? 'Modeled only' : 'Executable',
        warehouses: optimizedDisplayWarehouses,
        label: optimizedBlocked ? null : optionalNumber(optimized.labelPerUnit ?? costs.optimizedNetworkLabelPerUnit),
        transfer: optimizedBlocked ? null : optionalNumber(optimized.transferPerUnit ?? costs.optimizedNetworkTransferPerUnit ?? costs.transferLtlPerUnit),
        total: optimizedTotal,
        blockedReason: optimizedBlockedReason,
        source: optimizedBlocked ? networkBlockedCopy(optimizedBlockedReason) : String(optimized.source || 'cortex heatmap rate shop').replace(/_/g, ' '),
      },
    ];
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <div className="card-title"><Icon name="sparkle" size={15} /> Cortex fulfillment economics</div>
            <div className="card-subtitle">
              Stored per-SKU {workflow} economics from Cortex. {networkRightsCopy} Shipment plans reuse this record unless it is missing or stale.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Chip tone={String(economics.rateShopScope || '').includes('full') ? 'purple' : 'green'} dot={false}>
              {String(economics.rateShopScope || 'pricing').replace(/_/g, ' ')}
            </Chip>
            <Chip tone={confidence >= 70 ? 'green' : 'amber'} dot={false}>{confidence}% confidence</Chip>
            <Chip tone={economics.cacheState === 'stale' ? 'amber' : 'green'} dot={false}>{economics.cacheState || 'cached'}</Chip>
            <button className="btn sm" onClick={refresh} disabled={refreshing}>
              <Icon name="refresh" size={12} /> {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {comparisonRows.map((row) => (
              <div
                key={row.key}
                style={{
                  padding: 14,
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  background: row.key === 'optimized' ? 'var(--purple-soft)' : 'var(--green-soft)',
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 850 }}>
                      48-state label model
                    </div>
                    <div style={{ fontWeight: 900, marginTop: 4 }}>{row.title}</div>
                  </div>
                  <Chip tone={row.tone} dot={false}>{row.badge}</Chip>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.warehouses}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 800, textTransform: 'uppercase' }}>Label/unit</div>
                    <div style={{ fontWeight: 900 }}>{moneyOrMissing(row.label)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 800, textTransform: 'uppercase' }}>Transfer</div>
                    <div style={{ fontWeight: 900 }}>{moneyOrMissing(row.transfer)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 800, textTransform: 'uppercase' }}>Total/unit</div>
                    <div style={{ fontWeight: 900 }}>{moneyOrMissing(row.total)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 800, textTransform: 'uppercase' }}>Savings</div>
                    <div style={{ fontWeight: 900 }}>{row.key === 'optimized' && savingsPerUnit != null ? money(savingsPerUnit) : '-'}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 10 }}>{row.source}</div>
              </div>
            ))}
          </div>
          {comparison?.note && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
              {comparison.note}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <Chip tone={Number(demandHeatmap.orderCount || 0) > 0 ? 'blue' : 'amber'} dot={false}>
              SKU heatmap: {Number(demandHeatmap.orderCount || 0).toLocaleString()} orders
            </Chip>
            <Chip tone={Number(demandHeatmap.stateCount || 0) >= 2 ? 'green' : 'default'} dot={false}>
              {Number(demandHeatmap.stateCount || 0).toLocaleString()} states
            </Chip>
            <Chip tone={single.rateShoppingTriggered ? 'green' : 'amber'} dot={false}>
              {single.rateShoppingTriggered ? 'Rate shop ready from size + weight' : 'Modeled product profile'}
            </Chip>
          </div>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10 }}>
          {metricRows.map(([label, value, sub]) => (
            <div key={String(label)} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-sunken)' }}>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 800 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 850, marginTop: 5 }}>{moneyOrMissing(value)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3 }}>{sub}</div>
            </div>
          ))}
        </div>
        <div className="card-body" style={{ paddingTop: 0, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip tone="blue" dot={false}>Updated {economics.generatedAt ? new Date(economics.generatedAt).toLocaleString() : 'unknown'}</Chip>
          {(economics.sourceLabels || []).slice(0, 3).map((label) => <Chip key={label} tone="purple" dot={false}>{label}</Chip>)}
          {blockers.slice(0, 4).map((blocker) => <Chip key={blocker} tone="amber" dot={false}>{String(blocker).replace(/_/g, ' ')}</Chip>)}
        </div>
      </div>
    );
  }
  const summary = skuPricingSummary(preview);
  if (loading) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: 16 }}>
          <div className="card-title"><Icon name="sparkle" size={15} /> Cortex fulfillment economics</div>
          <div className="card-subtitle">Modeling current vs optimized fulfillment and 48-state label exposure…</div>
        </div>
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="card" style={{ marginBottom: 16, borderColor: error ? 'var(--amber-border)' : 'var(--border)' }}>
        <div className="card-body" style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Icon name={error ? 'warning' : 'sparkle'} size={15} style={{ color: error ? 'var(--amber-text)' : 'var(--purple)' }} />
            <div>
              <div style={{ fontWeight: 850 }}>Cortex fulfillment economics</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>
                {error || 'Pricing intelligence will appear once Cortex has enough warehouse or network data.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  const savings = summary.currentPerUnit > 0 && summary.optimizedPerUnit != null && summary.optimizedPerUnit > 0
    ? Math.max(0, summary.currentPerUnit - summary.optimizedPerUnit)
    : 0;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div>
          <div className="card-title"><Icon name="sparkle" size={15} /> Cortex fulfillment economics</div>
          <div className="card-subtitle">Per-unit model for fulfillment cost, shipping label exposure, and optimized warehouse routing.</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Chip tone={String(preview?.rateShopScope || '').includes('full') ? 'purple' : 'green'} dot={false}>
            {String(preview?.rateShopScope || 'pricing').replace(/_/g, ' ')}
          </Chip>
          {summary.confidence != null && <Chip tone={summary.confidence >= 70 ? 'green' : 'amber'} dot={false}>{summary.confidence}% confidence</Chip>}
        </div>
      </div>
      <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
        {[
          ['Current / unit', money(summary.currentPerUnit), (summary.current as any)?.warehouseCode || 'modeled'],
          ['Optimized / unit', moneyOrMissing(summary.optimizedPerUnit), summary.optimizedBlockedReason ? networkBlockedCopy(summary.optimizedBlockedReason) : (summary.optimized as any)?.warehouseCode || 'modeled'],
          ['Potential savings', money(savings), savings > 0 ? 'per unit' : 'no better node yet'],
          ['48-state label avg', money(summary.labelAvg), 'parcel exposure'],
          ['Storage / month', money(summary.storage), 'estimated'],
        ].map(([label, value, sub]) => (
          <div key={String(label)} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-sunken)' }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 800 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 850, marginTop: 5 }}>{value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3 }}>{sub}</div>
          </div>
        ))}
      </div>
      {(preview?.blockers || []).length > 0 && (
        <div className="card-body" style={{ paddingTop: 0, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(preview?.blockers || []).slice(0, 4).map((blocker) => (
            <Chip key={blocker} tone="amber" dot={false}>{String(blocker).replace(/_/g, ' ')}</Chip>
          ))}
        </div>
      )}
    </div>
  );
};

const firstValue = (...values: unknown[]) => {
  const found = values.find((value) => value != null && String(value).trim() !== '');
  return found == null ? '' : String(found);
};

const dimText = (dimensions?: OmsSkuDetail['dimensions'] | null) => {
  const l = num(dimensions?.length);
  const w = num(dimensions?.width);
  const h = num(dimensions?.height);
  return l && w && h ? `${l} x ${w} x ${h} in` : '';
};

type DetailFieldKind = 'text' | 'textarea' | 'number' | 'dimensions' | 'identity' | 'images' | 'category' | 'supplier';
type DetailField = {
  key: string;
  label: string;
  value: string;
  supplierId?: string | null;
  missing: boolean;
  kind: DetailFieldKind;
  payload: (value: string) => OmsSkuEnrichmentUpdate;
};

const parseNumberOrNull = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const identityPart = (value: string) => value.replace(/[^a-z0-9]/gi, '').toUpperCase();

const splitIdentity = (value: string) => {
  const [upc = '', ean = '', asin = ''] = value.split(/[|/]/).map((part) => identityPart(part));
  return { upc, ean, asin };
};

const splitCategory = (value: string) => {
  const [category = '', subCategory = ''] = value.split('|').map((part) => part.trim());
  return { category, subCategory };
};

const cleanDimensionToken = (value: string) => {
  const cleaned = value.replace(/[^\d.]/g, '');
  const [whole = '', decimals = ''] = cleaned.split('.');
  return decimals ? `${whole || '0'}.${decimals.slice(0, 2)}` : whole;
};

const parseDimensionEntry = (raw: string) => {
  const value = String(raw || '').trim();
  if (/[x,]/i.test(value)) {
    const [length = '', width = '', height = ''] = value.split(/[x,]/i).map((part) => cleanDimensionToken(part));
    return { length, width, height };
  }
  const compact = value.replace(/[^\d.]/g, '');
  const dotIndex = compact.indexOf('.');
  if (dotIndex >= 0) {
    const beforeDot = compact.slice(0, dotIndex).replace(/\D/g, '');
    const decimals = compact.slice(dotIndex + 1).replace(/\D/g, '').slice(0, 2);
    const length = beforeDot.slice(0, 2);
    const width = beforeDot.slice(2, 4);
    const remainingHeight = beforeDot.slice(4);
    const decimalHeight = `0.${decimals}`;
    return {
      length,
      width,
      height: remainingHeight ? `${remainingHeight}.${decimals}` : decimalHeight,
    };
  }
  const digits = compact.replace(/\D/g, '');
  return {
    length: digits.slice(0, 2),
    width: digits.slice(2, 4),
    height: digits.slice(4, 6),
  };
};

const dimensionPayloadFromEntry = (entry: string) => {
  const parts = parseDimensionEntry(entry);
  return {
    length: parseNumberOrNull(parts.length),
    width: parseNumberOrNull(parts.width),
    height: parseNumberOrNull(parts.height),
  };
};

const dimensionEntryFromDimensions = (dimensions?: OmsSkuDetail['dimensions'] | null) => {
  const d = dimensions || {};
  return [d.length, d.width, d.height].map((v) => (v == null ? '' : String(v))).join(' x ');
};

const dimensionPreview = (entry: string) => {
  const parts = parseDimensionEntry(entry);
  const values = [parts.length, parts.width, parts.height].filter((part) => part !== '');
  return values.length ? `${parts.length || '-'} x ${parts.width || '-'} x ${parts.height || '-'} in` : 'Type compact dimensions, e.g. 1010.05';
};

const rememberCustomCategory = (categoryValue: string) => {
  if (typeof window === 'undefined') return;
  const { category, subCategory } = splitCategory(categoryValue);
  if (!category && !subCategory) return;
  const key = 'uc-oms-custom-amazon-categories';
  let existing: { category: string; subcategories: string[] }[] = [];
  try {
    existing = JSON.parse(window.localStorage.getItem(key) || '[]');
  } catch {
    existing = [];
  }
  const idx = existing.findIndex((node) => node.category.toLowerCase() === category.toLowerCase());
  if (idx >= 0) {
    if (subCategory && !existing[idx].subcategories.some((s) => s.toLowerCase() === subCategory.toLowerCase())) {
      existing[idx] = { ...existing[idx], subcategories: [...existing[idx].subcategories, subCategory] };
    }
  } else if (category) {
    existing.push({ category, subcategories: subCategory ? [subCategory] : [] });
  }
  window.localStorage.setItem(key, JSON.stringify(existing.slice(-80)));
};

const loadCustomCategories = () => {
  if (typeof window === 'undefined') return [] as { category: string; subcategories: string[] }[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem('uc-oms-custom-amazon-categories') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const ItemDetailsPanel = ({ data, onSaved }: { data: OmsSkuDetail; onSaved: (detail: OmsSkuDetail) => void }) => {
  const [suppliers, setSuppliers] = useState<OmsSupplier[]>([]);
  const [supplierLoadFailed, setSupplierLoadFailed] = useState(false);
  const attrs = data.attributes || {};
  const meta = data.metadata || {};
  const images = [data.image, ...(data.images || [])].filter(Boolean);
  const identityValue = [data.upc, data.ean, data.asin].filter(Boolean).join(' / ');
  const categoryValue = [data.category, data.subCategory].filter(Boolean).join(' / ');
  useEffect(() => {
    let alive = true;
    fetchOmsSuppliers()
      .then((result) => {
        if (!alive) return;
        setSuppliers(result.suppliers || []);
        setSupplierLoadFailed(false);
      })
      .catch(() => {
        if (!alive) return;
        setSuppliers([]);
        setSupplierLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  const supplierName = data.supplierId ? suppliers.find((supplier) => supplier.id === data.supplierId)?.name || data.supplierId : '';
  const costValue = num((data.metadata as any)?.cost ?? (data.attributes as any)?.cost ?? data.cost);
  const fields: DetailField[] = [
    { key: 'subtitle', label: 'Subtitle', value: firstValue(data.subtitle, meta.subtitle, meta.subTitle), missing: !firstValue(data.subtitle, meta.subtitle, meta.subTitle), kind: 'text', payload: (value) => ({ subtitle: value }) },
    { key: 'brand', label: 'Brand', value: firstValue(data.brand, meta.brand, attrs.brand), missing: !firstValue(data.brand, meta.brand, attrs.brand), kind: 'text', payload: (value) => ({ brand: value }) },
    { key: 'description', label: 'Description', value: firstValue(data.description, meta.description, attrs.description), missing: !firstValue(data.description, meta.description, attrs.description), kind: 'textarea', payload: (value) => ({ description: value }) },
    { key: 'size', label: 'Size', value: firstValue(attrs.size, meta.size, attrs.variant, meta.variant), missing: !firstValue(attrs.size, meta.size, attrs.variant, meta.variant), kind: 'text', payload: (value) => ({ size: value }) },
    { key: 'weight', label: 'Weight', value: data.weight ? `${num(data.weight)} lb` : '', missing: !data.weight, kind: 'number', payload: (value) => ({ weight: parseNumberOrNull(value) }) },
    { key: 'dimensions', label: 'Dimensions', value: dimText(data.dimensions), missing: !dimText(data.dimensions), kind: 'dimensions', payload: (value) => {
      return { dimensions: dimensionPayloadFromEntry(value) };
    } },
    { key: 'identity', label: 'UPC / EAN / ASIN', value: identityValue, missing: !identityValue, kind: 'identity', payload: (value) => {
      const { upc, ean, asin } = splitIdentity(value);
      return { upc, ean, asin };
    } },
    { key: 'images', label: 'Images', value: images.length ? `${images.length} image${images.length === 1 ? '' : 's'}` : '', missing: !images.length, kind: 'images', payload: (value) => ({ images: value.split(/\r?\n/).map((url) => url.trim()).filter(Boolean) }) },
    { key: 'price', label: 'Price', value: data.price != null ? `$${num(data.price).toFixed(2)}` : '', missing: data.price == null, kind: 'number', payload: (value) => ({ price: parseNumberOrNull(value) }) },
    { key: 'category', label: 'Category', value: categoryValue, missing: !categoryValue, kind: 'category', payload: (value) => {
      const { category, subCategory } = splitCategory(value);
      return { category, subCategory };
    } },
    { key: 'supplierId', label: 'Supplier', value: supplierName, supplierId: data.supplierId || null, missing: !data.supplierId, kind: 'supplier', payload: (value) => ({ supplierId: value || null }) },
    { key: 'cost', label: 'Cost', value: `$${costValue.toFixed(2)}`, missing: costValue <= 0, kind: 'number', payload: (value) => ({ cost: parseNumberOrNull(value) ?? 0 }) },
  ];
  const missing = fields.filter((field) => field.missing).length;
  const complete = Math.round(((fields.length - missing) / fields.length) * 100);
  return (
    <div className="card sku-details-card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div>
          <div className="card-title"><Icon name="box" size={15} /> Item details</div>
          <div className="card-subtitle">Click any field to edit. Missing values are marked red for cleanup.</div>
        </div>
        <Chip tone={missing ? 'red' : 'green'} dot={false}>{complete}% enriched</Chip>
      </div>
      <div className="sku-detail-grid">
        {fields.map((field) => (
          <EditableDetailField key={field.key} skuId={data.id} field={field} images={images as string[]} dimensions={data.dimensions} identifiers={{ upc: data.upc || '', ean: data.ean || '', asin: data.asin || '' }} category={{ category: data.category || '', subCategory: data.subCategory || '' }} suppliers={suppliers} supplierLoadFailed={supplierLoadFailed} onSaved={onSaved} />
        ))}
      </div>
    </div>
  );
};

const editableInitialValue = (
  field: DetailField,
  options: {
    images: string[];
    dimensions?: OmsSkuDetail['dimensions'] | null;
    identifiers: { upc: string; ean: string; asin: string };
    category: { category: string; subCategory: string };
  },
) => {
  if (field.kind === 'images') return options.images.join('\n');
  if (field.kind === 'dimensions') {
    return dimensionEntryFromDimensions(options.dimensions);
  }
  if (field.kind === 'identity') return [options.identifiers.upc, options.identifiers.ean, options.identifiers.asin].join('|');
  if (field.kind === 'category') return [options.category.category, options.category.subCategory].join('|');
  if (field.kind === 'supplier') return field.supplierId || '';
  if (field.kind === 'number') return field.value.replace(/[$,]| lb/g, '');
  return field.value;
};

const EditableDetailField = ({
  skuId,
  field,
  images,
  dimensions,
  identifiers,
  category,
  suppliers,
  supplierLoadFailed,
  onSaved,
}: {
  skuId: string;
  field: DetailField;
  images: string[];
  dimensions?: OmsSkuDetail['dimensions'] | null;
  identifiers: { upc: string; ean: string; asin: string };
  category: { category: string; subCategory: string };
  suppliers: OmsSupplier[];
  supplierLoadFailed?: boolean;
  onSaved: (detail: OmsSkuDetail) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const begin = () => {
    setValue(editableInitialValue(field, { images, dimensions, identifiers, category }));
    setError('');
    setEditing(true);
  };
  const onEditorKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setEditing(false);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void save();
    }
  };
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (field.kind === 'category') rememberCustomCategory(value);
      const next = await updateOmsSkuEnrichment(skuId, field.payload(value));
      onSaved(next);
      setEditing(false);
    } catch (e: any) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={begin}
        className={`sku-detail-field editable ${field.missing ? 'missing' : ''}`}
        data-hint={`Edit ${field.label}`}
        data-sku-detail-field={field.key}
      >
        <div className="kv-label">{field.label}</div>
        <div className="kv-value">{field.value || 'Missing'}</div>
        <Icon name="settings" size={11} className="field-edit-icon" />
      </button>
    );
  }

  return (
    <div className={`sku-detail-field editing ${field.missing ? 'missing' : ''}`} data-sku-detail-field={field.key}>
      <div className="kv-label">{field.label}</div>
      {field.kind === 'dimensions' ? (
        <DimensionEditor value={value} onChange={setValue} onKeyDown={onEditorKeyDown} />
      ) : field.kind === 'identity' ? (
        <IdentityEditor value={value} onChange={setValue} onKeyDown={onEditorKeyDown} />
      ) : field.kind === 'category' ? (
        <CategoryEditor value={value} onChange={setValue} onKeyDown={onEditorKeyDown} />
      ) : field.kind === 'images' ? (
        <ImagesEditor
          value={value}
          onChange={setValue}
          onKeyDown={onEditorKeyDown}
          uploading={uploading}
          onUpload={async (files) => {
            if (!files.length) return;
            setUploading(true);
            setError('');
            try {
              const uploaded = await Promise.all(files.map((file) => uploadCatalogImage(file)));
              const current = value.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
              setValue([...current, ...uploaded.map((file) => file.url)].join('\n'));
            } catch (e: any) {
              setError(e.message || 'Image upload failed');
            } finally {
              setUploading(false);
            }
          }}
        />
      ) : field.kind === 'supplier' ? (
        <>
          <select className="sku-field-input" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onEditorKeyDown} autoFocus>
            <option value="">No supplier assigned</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
          <div className="sku-field-help">
            {supplierLoadFailed ? 'Supplier list could not load. You can still clear the assignment.' : suppliers.length ? 'Supplier assignment is saved to the SKU master record.' : 'No suppliers exist yet. Create suppliers before assigning this SKU.'}
          </div>
        </>
      ) : field.kind === 'textarea' ? (
        <textarea className="sku-field-input textarea" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onEditorKeyDown} rows={2} />
      ) : (
        <input className="sku-field-input" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onEditorKeyDown} />
      )}
      {error && <div className="sku-field-error">{error}</div>}
      <div className="sku-field-actions">
        <button className="btn primary sm" onClick={save} disabled={saving || uploading}><Icon name="check" size={11} /> {saving ? 'Saving' : 'Save'}</button>
        <button className="btn sm" onClick={() => setEditing(false)} disabled={saving || uploading}>Cancel</button>
      </div>
    </div>
  );
};

const DimensionEditor = ({
  value,
  onChange,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}) => {
  const update = (raw: string) => {
    const cleaned = raw.replace(/[^\d.x,\s]/gi, '');
    onChange(cleaned);
  };
  return (
    <>
      <input
        className="sku-field-input"
        inputMode="decimal"
        value={value}
        onChange={(e) => update(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="1010.05"
        autoFocus
      />
      <div className="sku-field-help">
        {dimensionPreview(value)}. Type 1010.05 for 10 x 10 x 0.05. Enter saves.
      </div>
    </>
  );
};

const IdentityEditor = ({
  value,
  onChange,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}) => {
  const current = splitIdentity(value);
  const update = (key: 'upc' | 'ean' | 'asin', next: string) => {
    const merged = { ...current, [key]: identityPart(next) };
    onChange([merged.upc, merged.ean, merged.asin].join('|'));
  };
  return (
    <div className="sku-triple-editor">
      <input className="sku-field-input" value={current.upc} onChange={(e) => update('upc', e.target.value)} onKeyDown={onKeyDown} placeholder="UPC" autoFocus />
      <input className="sku-field-input" value={current.ean} onChange={(e) => update('ean', e.target.value)} onKeyDown={onKeyDown} placeholder="EAN" />
      <input className="sku-field-input" value={current.asin} onChange={(e) => update('asin', e.target.value)} onKeyDown={onKeyDown} placeholder="ASIN" />
      <div className="sku-field-help span-all">Letters and numbers only. Enter saves.</div>
    </div>
  );
};

const CategoryEditor = ({
  value,
  onChange,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}) => {
  const current = splitCategory(value);
  const [accountNodes, setAccountNodes] = useState<{ category: string; subcategories: string[] }[]>([]);
  useEffect(() => {
    let alive = true;
    fetchOmsSkus({ limit: 500 } as any)
      .then((result) => {
        if (!alive) return;
        const map = new Map<string, Set<string>>();
        for (const sku of result.skus || []) {
          const cat = String((sku as any).category || '').trim();
          const sub = String((sku as any).subCategory || '').trim();
          if (!cat) continue;
          if (!map.has(cat)) map.set(cat, new Set());
          if (sub) map.get(cat)?.add(sub);
        }
        setAccountNodes(Array.from(map.entries()).map(([category, subs]) => ({ category, subcategories: Array.from(subs) })));
      })
      .catch(() => setAccountNodes([]));
    return () => {
      alive = false;
    };
  }, []);
  const customNodes = useMemo(loadCustomCategories, []);
  const customCategoryNames = [...customNodes, ...accountNodes].map((node) => node.category);
  const categories = Array.from(new Set([...amazonCategoryNames, ...customCategoryNames, current.category].filter(Boolean))).sort();
  const subcategories = Array.from(new Set([
    ...amazonSubcategoriesFor(current.category),
    ...(customNodes.find((node) => node.category.toLowerCase() === current.category.toLowerCase())?.subcategories || []),
    ...(accountNodes.find((node) => node.category.toLowerCase() === current.category.toLowerCase())?.subcategories || []),
    current.subCategory,
  ].filter(Boolean))).sort();
  const update = (next: { category?: string; subCategory?: string }) => {
    onChange([next.category ?? current.category, next.subCategory ?? current.subCategory].join('|'));
  };
  return (
    <div className="sku-category-editor">
      <input
        className="sku-field-input"
        value={current.category}
        onChange={(e) => update({ category: e.target.value, subCategory: '' })}
        onKeyDown={onKeyDown}
        list="uc-amazon-category-list"
        placeholder="Amazon category"
        autoFocus
      />
      <datalist id="uc-amazon-category-list">
        {categories.map((cat) => <option key={cat} value={cat} />)}
      </datalist>
      <input
        className="sku-field-input"
        value={current.subCategory}
        onChange={(e) => update({ subCategory: e.target.value })}
        onKeyDown={onKeyDown}
        list="uc-amazon-subcategory-list"
        placeholder="Sub-category"
      />
      <datalist id="uc-amazon-subcategory-list">
        {subcategories.map((sub) => <option key={sub} value={sub} />)}
      </datalist>
      <div className="sku-field-help">Amazon category tree suggestions plus custom account values. Enter saves.</div>
    </div>
  );
};

const ImagesEditor = ({
  value,
  onChange,
  onKeyDown,
  uploading,
  onUpload,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  uploading: boolean;
  onUpload: (files: File[]) => Promise<void>;
}) => (
  <div className="sku-images-editor">
    <textarea
      className="sku-field-input textarea"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      rows={3}
      placeholder="One image URL per line"
      autoFocus
    />
    <label className={`sku-upload-control ${uploading ? 'disabled' : ''}`}>
      <Icon name="download" size={12} style={{ transform: 'rotate(180deg)' }} />
      {uploading ? 'Uploading to S3...' : 'Upload image files'}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        disabled={uploading}
        onChange={(event) => {
          void onUpload(Array.from(event.target.files || []));
          event.currentTarget.value = '';
        }}
      />
    </label>
    <div className="sku-field-help">Upload files or paste image links. Shift+Enter adds a new line; Enter saves.</div>
  </div>
);

const SkuIntelligenceStrip = ({
  sku,
  productIntel,
  recommendations,
  onNavigate,
  onOpenRecommendation,
}: {
  sku: OmsSkuDetail;
  productIntel: ProductResearchResult | null;
  recommendations: OmsRecommendation[];
  onNavigate: ScreenProps['onNavigate'];
  onOpenRecommendation: () => void;
}) => {
  const result = productIntel?.result;
  const missing = new Set(result?.missingData || []);
  const hasDims = Boolean(sku.dimensions?.length && sku.dimensions?.width && sku.dimensions?.height);
  const hasWeight = num(sku.weight) > 0;
  const hasPrice = sku.price != null && num(sku.price) > 0;
  const hasCost = num((sku.metadata as any)?.cost ?? (sku.attributes as any)?.cost) > 0;
  if (hasDims && hasWeight) missing.delete('dimensions_weight');
  if (hasPrice) missing.delete('selling_price');
  if (hasCost) missing.delete('cost');
  const effectiveMissing = Array.from(missing);
  const hasRec = recommendations.length > 0;
  const requirements = [
    { label: 'Dimensions', met: hasDims || !effectiveMissing.includes('dimensions_weight') },
    { label: 'Weight', met: hasWeight || !effectiveMissing.includes('dimensions_weight') },
    { label: 'Cost', met: hasCost || !effectiveMissing.includes('cost') },
    { label: 'Selling price', met: hasPrice || !effectiveMissing.includes('selling_price') },
    { label: 'Demand source', met: !effectiveMissing.includes('marketplace_or_csv_demand') },
  ];
  const summary = effectiveMissing.length
    ? `Complete ${effectiveMissing.map((m) => m.replace(/_/g, ' ')).join(', ')} before high-confidence optimization.`
    : (result?.recommendedAction || 'SKU baseline is ready for Cortex optimization.');
  return (
    <div className="sku-intel-minibar">
      <div className="sku-intel-minibar-grid">
        <div className="sku-intel-copy">
          <div className="sku-intel-title">
            <Icon name="sparkle" size={13} />
            Cortex optimization readiness
            {hasRec && <span className="inline-alert"><Icon name="warning" size={11} /> {recommendations.length}</span>}
          </div>
          <div className="sku-intel-requirements" aria-label="Cortex baseline requirements">
            {requirements.map((req) => (
              <span key={req.label} className={`requirement-pill ${req.met ? 'met' : 'missing'}`}>
                {req.met ? <Icon name="check" size={10} /> : <Icon name="warning" size={10} />}
                {req.label}
              </span>
            ))}
          </div>
          <div className="sku-intel-summary">
            {summary}
          </div>
        </div>
        <div className="kv">
          <div className="kv-label">Score</div>
          <div className="kv-value" style={{ color: 'var(--purple-text)' }}>{result?.opportunityScore ?? '—'}</div>
        </div>
        <div className="kv">
          <div className="kv-label">Open recs</div>
          <div className="kv-value">{recommendations.length}</div>
        </div>
        {hasRec ? (
          <button className="btn sm primary" onClick={onOpenRecommendation}>
            <Icon name="sparkle" size={13} /> Review Cortex
          </button>
        ) : effectiveMissing.length ? (
          <button className="btn sm" onClick={() => onNavigate('product-research')} data-hint="Use Product Research only to fill missing enrichment data">
            <Icon name="search" size={13} /> Enrich data
          </button>
        ) : (
          <button className="btn sm" onClick={() => onNavigate('double')}>
            <Icon name="double" size={13} /> Optimize
          </button>
        )}
      </div>
    </div>
  );
};

const Overview = ({ data }: { data: OmsSkuDetail }) => (
  <div className="row-2">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <NextSixShipments data={data} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ChannelBreakdownCard data={data} />
      <RelatedSkusCard data={data} />
    </div>
  </div>
);

const SkuDemandHeatmap = ({ data }: { data: OmsSkuDetail }) => {
  const channels = data.channels || [];
  const warehouses = data.warehouses || [];
  const maxUnits = Math.max(1, ...channels.map((channel) => num(channel.units30d)));
  const totalUnits = channels.reduce((sum, channel) => sum + num(channel.units30d), 0);
  const totalWarehouseUnits = warehouses.reduce((sum, wh) => sum + num(wh.available), 0);
  return (
    <div className="sku-detail-heatmap">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title"><Icon name="grid" size={15} /> SKU demand heatmap</div>
            <div className="card-subtitle">Demand for this active SKU by channel, paired with inventory cover by warehouse.</div>
          </div>
          <Chip tone={totalUnits ? 'green' : 'amber'} dot={false}>{totalUnits ? `${totalUnits.toLocaleString()}u / 30d` : 'No demand signal'}</Chip>
        </div>
        <div className="sku-channel-heat-grid">
          {channels.length === 0 ? (
            <EmptyState>No channel demand data is available for this SKU yet.</EmptyState>
          ) : channels.map((channel) => {
            const units = num(channel.units30d);
            const intensity = Math.min(100, Math.max(0, (units / maxUnits) * 100));
            return (
              <div key={channel.channel} className={`sku-channel-heat ${intensity >= 75 ? 'hot' : intensity >= 35 ? 'warm' : 'cool'}`}>
                <div className="sku-channel-heat-head">
                  <span>{channel.channel}</span>
                  <strong>{Math.round(intensity)}%</strong>
                </div>
                <div className="sku-channel-heat-body">
                  <div>{units.toLocaleString()} units</div>
                  <div>{fmt.money(num(channel.revenue30d), { compact: true })}</div>
                  <div>{Math.round(num(channel.shareOfDemand) * 100)}% share</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title"><Icon name="inventory" size={15} /> Warehouse cover heatmap</div>
            <div className="card-subtitle">Each tile is a warehouse holding this SKU. Red means demand can outrun local cover.</div>
          </div>
          <Chip dot={false}>{totalWarehouseUnits.toLocaleString()} units on hand</Chip>
        </div>
        <div className="sku-warehouse-heat-grid">
          {warehouses.length === 0 ? (
            <EmptyState>No warehouse allocation exists for this SKU.</EmptyState>
          ) : warehouses.map((wh) => {
            const d = num(wh.daysOfCover);
            const tone = d < 14 ? 'hot' : d < 28 ? 'warm' : 'cool';
            return (
              <div key={wh.code} className={`sku-warehouse-heat ${tone}`}>
                <div className="sku-channel-heat-head">
                  <span className="mono">{wh.code}</span>
                  <strong>{Math.round(d)}d</strong>
                </div>
                <div className="sku-channel-heat-body">
                  <div>{num(wh.available).toLocaleString()} on hand</div>
                  <div>{num(wh.inbound).toLocaleString()} inbound</div>
                  <div>{num(wh.velocityPerDay).toFixed(1)} / day</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const NextSixShipments = ({ data }: { data: OmsSkuDetail }) => {
  const ships = data.nextShipments || [];
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <Icon name="shipments" size={15} /> Next 6 shipments
          </div>
          <div className="card-subtitle">Confirmed + AI-planned inbound to your network</div>
        </div>
        <button className="btn ghost sm"><Icon name="plus" size={11} /> Manual</button>
      </div>
      <div style={{ padding: 0 }}>
        {ships.length === 0 && <EmptyState>No inbound shipments planned for this SKU.</EmptyState>}
        {ships.slice(0, 6).map((s, i) => (
          <div
            key={s.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr auto',
              gap: 14,
              padding: '12px 16px',
              borderBottom: i === Math.min(ships.length, 6) - 1 ? 'none' : '1px solid var(--border-subtle)',
              alignItems: 'center',
            }}
          >
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              {/* s.date is a full ISO datetime (2026-06-22T13:33:24.9Z), not YYYY-MM-DD — take
                  the MM/DD calendar date only. minWidth:0 + overflow:hidden + nowrap keep this
                  fixed 90px column from ever painting over the id/status column. */}
              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{(s.date || '').slice(5, 10).replace('-', '/') || '—'}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{(s.date || '').slice(0, 4)}</div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{s.id}</span>
                <StatusChip status={s.status} />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                {s.origin} → <span className="mono" style={{ fontWeight: 600 }}>{s.destination}</span>
                {s.mode ? ` · ${s.mode}` : ''}
                {s.cube ? ` · ${s.cube}ft³` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{num(s.quantity).toLocaleString()}u</div>
              <button className="btn ghost sm">View</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ChannelBreakdownCard = ({ data }: { data: OmsSkuDetail }) => {
  const channels = data.channels || [];
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Channel breakdown</div>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {channels.length === 0 && <EmptyState>Channel breakdown not yet available for this SKU.</EmptyState>}
        {channels.map((c) => (
          <div key={c.channel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, background: channelColor(c.channel), borderRadius: 2 }} />
                {c.channel}
              </span>
              <span className="mono" style={{ fontSize: 12 }}>
                {num(c.units30d).toLocaleString()}u · {fmt.money(num(c.revenue30d), { compact: true })}
              </span>
            </div>
            <ProgressBar value={num(c.shareOfDemand) * 100} color="accent" height={5} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
              <span>{Math.round(num(c.shareOfDemand) * 100)}% of demand</span>
              <span>Refund rate {(num(c.refundRate) * 100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const RelatedSkusCard = ({ data }: { data: OmsSkuDetail }) => {
  const related = data.relatedSkus || [];
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Related SKUs</div>
      </div>
      <div style={{ padding: 0 }}>
        {related.length === 0 && <EmptyState>No related SKUs.</EmptyState>}
        {related.map((s, i) => (
          <div
            key={s.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              padding: '10px 14px',
              borderBottom: i === related.length - 1 ? 'none' : '1px solid var(--border-subtle)',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.sku}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{s.title || s.sku}</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{Math.round(num(s.daysOfCover))}d</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Warehouses = ({ data }: { data: OmsSkuDetail }) => (
  <div className="table-wrap">
    {data.warehouses.length === 0 ? (
      <EmptyState>No WMS inventory reported for this SKU yet. Once a connected warehouse stocks it and syncs, its on-hand appears here per warehouse.</EmptyState>
    ) : (
      <table className="data">
        <thead>
          <tr>
            <th>Warehouse</th>
            <th>Region</th>
            <th className="num">On hand</th>
            <th className="num">Inbound</th>
            <th className="num">Velocity /day</th>
            <th>Days of cover</th>
            <th className="num">Storage cost / mo</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.warehouses.map((b) => {
            const d = num(b.daysOfCover);
            const tone = docTone(d);
            return (
              <tr key={b.code}>
                <td className="mono strong">{b.code}</td>
                <td className="muted">{b.region || b.name || '—'}</td>
                <td className="num mono strong">{num(b.available).toLocaleString()}</td>
                <td className="num mono muted">{num(b.inbound) > 0 ? num(b.inbound).toLocaleString() : '—'}</td>
                <td className="num mono">{num(b.velocityPerDay).toFixed(1)}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110 }}>
                    <div className="bar" style={{ flex: 1, height: 5 }}>
                      <div className={`bar-fill ${tone}`} style={{ width: `${Math.min(100, (d / 60) * 100)}%` }} />
                    </div>
                    <span className="mono num" style={{ fontSize: 11.5, color: `var(--${tone}-text)`, fontWeight: 600, minWidth: 28 }}>
                      {Math.round(d)}d
                    </span>
                  </div>
                </td>
                <td className="num mono">{b.storageCost != null ? fmt.money(num(b.storageCost)) : '—'}</td>
                <td>
                  <Chip tone={tone}>{tone === 'green' ? 'Healthy' : tone === 'amber' ? 'Low cover' : 'Stockout risk'}</Chip>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    )}
  </div>
);

const History = ({ data }: { data: OmsSkuDetail }) => {
  const events = data.history || [];
  const typeIcon: Record<string, string> = { ai: 'sparkle', ledger: 'ledger', shipment: 'shipments', billing: 'billing' };
  const typeTone: Record<string, string> = { ai: 'purple', ledger: 'blue', shipment: 'blue', billing: 'amber' };
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Activity history</div>
        <div className="seg">
          <button className="active">All</button>
          <button>AI</button>
          <button>Inventory</button>
          <button>Billing</button>
        </div>
      </div>
      <div style={{ padding: 0 }}>
        {events.length === 0 && <EmptyState>No recorded activity for this SKU yet.</EmptyState>}
        {events.map((e, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '150px 28px 1fr auto',
              gap: 14,
              padding: '12px 16px',
              borderBottom: i === events.length - 1 ? 'none' : '1px solid var(--border-subtle)',
            }}
          >
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{e.ts}</span>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                background: `var(--${typeTone[e.type] || 'blue'}-soft)`,
                color: `var(--${typeTone[e.type] || 'blue'})`,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name={typeIcon[e.type] || 'info'} size={12} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--text)' }}>{e.subject}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{e.actor}</div>
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: e.impact ? (e.impact > 0 ? 'var(--green-text)' : 'var(--red-text)') : 'var(--text-tertiary)',
              }}
            >
              {e.impact ? `${e.impact > 0 ? '+' : ''}${fmt.money(e.impact)}` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Channels = ({ data }: { data: OmsSkuDetail }) => {
  const channels = data.channels || [];
  if (channels.length === 0)
    return (
      <div className="card">
        <div className="card-body"><EmptyState>Per-channel performance not yet available for this SKU.</EmptyState></div>
      </div>
    );
  return (
    <div className="row-2-eq">
      {channels.map((c) => (
        <div key={c.channel} className="card">
          <div className="card-header">
            <div className="card-title">{c.channel}</div>
            <Chip tone="green" dot={false}>Live</Chip>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            <div className="kv"><div className="kv-label">30d units</div><div className="kv-value">{num(c.units30d).toLocaleString()}</div></div>
            <div className="kv"><div className="kv-label">30d revenue</div><div className="kv-value">{fmt.money(num(c.revenue30d), { compact: true })}</div></div>
            <div className="kv"><div className="kv-label">Share of demand</div><div className="kv-value">{Math.round(num(c.shareOfDemand) * 100)}%</div></div>
            <div className="kv"><div className="kv-label">Refund rate</div><div className="kv-value">{(num(c.refundRate) * 100).toFixed(1)}%</div></div>
          </div>
        </div>
      ))}
    </div>
  );
};

const Billing = ({ data }: { data: OmsSkuDetail }) => {
  const b = data.billing;
  const drivers = b?.drivers || [];
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">SKU-level cost · last 30 days</div>
        <Chip dot={false}>WMS-allocated</Chip>
      </div>
      {!b ? (
        <EmptyState>No billing breakdown available for this SKU.</EmptyState>
      ) : (
        <>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div className="kv"><div className="kv-label">Current monthly</div><div className="kv-value">{fmt.money(num(b.currentMonthly))}</div></div>
            <div className="kv"><div className="kv-label">Optimized monthly</div><div className="kv-value" style={{ color: 'var(--purple-text)' }}>{fmt.money(num(b.optimizedMonthly))}</div></div>
            <div className="kv"><div className="kv-label">Savings / mo</div><div className="kv-value" style={{ color: 'var(--green-text)' }}>{fmt.money(num(b.currentMonthly) - num(b.optimizedMonthly))}</div></div>
          </div>
          {drivers.length > 0 && (
            <table className="data">
              <thead>
                <tr>
                  <th>WH</th>
                  <th className="num">Storage</th>
                  <th className="num">Handling</th>
                  <th className="num">Accessorial</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((c, i) => {
                  const total = num(c.storage) + num(c.handling) + num(c.accessorial);
                  return (
                    <tr key={i}>
                      <td className="mono strong">{c.wh}</td>
                      <td className="num mono">{fmt.money(num(c.storage))}</td>
                      <td className="num mono">{fmt.money(num(c.handling))}</td>
                      <td className="num mono">{c.accessorial ? fmt.money(num(c.accessorial)) : '—'}</td>
                      <td className="num mono strong">{fmt.money(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
};
