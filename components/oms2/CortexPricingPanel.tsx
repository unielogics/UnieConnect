import React from 'react';
import { Icon } from './icons';
import { Chip } from './ui';
import type { ShipmentPricingPreview } from '../../lib/shipment-plan';

/**
 * Shared Cortex pricing intelligence panel — the single, segregated shipment-cost breakdown.
 *
 * Renders per-unit cost segregated into inbound (receiving/prep/LAB), pick/pack/fulfillment,
 * shipping label, LTL transfer, and storage; PLUS a single-warehouse vs multi-warehouse
 * rate-shopping comparison (the "single vs multi" the operator asked for) drawn from each SKU's
 * `pricingPayload.networkComparison.{singleWarehouse, optimizedTwoNode}`. Every rate carries the
 * mandatory disclosure that it is an estimate from rate-shopping of similar items by weight & size.
 *
 * The pricing helpers mirror those in ShipmentWizard.tsx (same field contract); keep them in sync.
 */

export const RATE_DISCLOSURE = 'Estimate based on rate shopping of similar items (weight & size).';

const money = (value: unknown) => {
  const n = Number(value || 0);
  return `$${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
};

const asNumber = (value: unknown, fallback = 0) => {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : fallback;
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

const previewDueToday = (preview?: ShipmentPricingPreview | null) => {
  if (!preview) return 0;
  if (typeof preview.dueToday === 'number') return preview.dueToday;
  return Number(preview.dueToday?.amount || 0);
};

const previewWarehouseTotal = (warehouse: any) =>
  Number(warehouse?.feePreview?.total ?? warehouse?.totalEstimatedCost ?? warehouse?.totals?.estimatedTotal ?? 0);

const previewWarehousePerUnit = (warehouse: any, fallback?: unknown) =>
  Number(warehouse?.feePreview?.perUnit ?? warehouse?.totalEstimatedCostPerUnit ?? warehouse?.estimatedCostPerUnit ?? fallback ?? 0);

const networkBlockedCopy = (reason?: unknown) => {
  const key = String(reason || '').trim();
  const labels: Record<string, string> = {
    network_expansion_not_allowed_by_warehouse: 'Network expansion not allowed by warehouse',
    no_approved_second_node_configured: 'No approved second node configured',
    no_positive_savings_after_transfer: 'No positive savings after transfer',
    no_eligible_network_node_available: 'No eligible network node available',
    no_distinct_second_node_selected: 'No distinct second node selected',
    optimization_pricing_unavailable: 'Optimization pricing unavailable',
    ltl_transfer_rate_unavailable: 'LTL transfer rate unavailable',
  };
  return labels[key] || key.replace(/_/g, ' ') || 'Network expansion blocked';
};

const pricingScopeLabel = (scope?: string) => {
  switch (String(scope || '').toLowerCase()) {
    case 'anchor_only':
      return 'Single connected warehouse';
    case 'anchor_priority_network':
      return 'Anchor-priority network';
    case 'full_network':
      return 'Full Cortex network';
    default:
      return scope ? scope.replace(/_/g, ' ') : 'Cortex pricing';
  }
};

const economicsCosts = (row?: any) => row?.costs || {};
const economicsQuantity = (row?: any) => Math.max(1, asNumber(row?.quantity, 1));

const economicsPerUnitValue = (row: any, perUnitKey: string, totalKey: string) => {
  const costs = economicsCosts(row);
  const perUnit = optionalNumber(costs[perUnitKey]);
  if (perUnit != null) return perUnit;
  return asNumber(costs[totalKey], 0) / economicsQuantity(row);
};

const economicsOptionalPerUnitValue = (row: any, perUnitKey: string, totalKey?: string) => {
  const costs = economicsCosts(row);
  const perUnit = optionalNumber(costs[perUnitKey]);
  if (perUnit != null) return perUnit;
  if (!totalKey) return null;
  const total = optionalNumber(costs[totalKey]);
  return total == null ? null : total / economicsQuantity(row);
};

const economicsTotal = (row?: any) => {
  const costs = economicsCosts(row);
  return asNumber(costs.total ?? costs.estimatedTotal ?? costs.totalCost, 0);
};

const economicsPerUnit = (row?: any) => {
  const costs = economicsCosts(row);
  const qty = economicsQuantity(row);
  return asNumber(costs.totalPerUnit ?? costs.currentPerUnit ?? (economicsTotal(row) / qty), 0);
};

const economicsNetwork = (row?: any) => row?.pricingPayload?.networkComparison || {};
const economicsSingleNode = (row?: any) => economicsNetwork(row).singleWarehouse || {};
const economicsOptimizedNetwork = (row?: any) => economicsNetwork(row).optimizedTwoNode || {};

const economicsOptimizedBlockedReason = (row?: any) => {
  const optimized = economicsOptimizedNetwork(row);
  if (optimized.status === 'blocked' || optimized.blockedReason || optimized.distinctSecondNode === false || Number(optimized.selectedWarehouseCount || 0) < 2) {
    return optimized.blockedReason || 'no_distinct_second_node_selected';
  }
  return null;
};

const economicsOptimizedPerUnit = (row?: any) => {
  if (economicsOptimizedBlockedReason(row)) return null;
  const optimized = economicsOptimizedNetwork(row);
  return optionalNumber(optimized.totalPerUnit ?? economicsCosts(row).optimizedPerUnit);
};

const economicsReceivingPerUnit = (row?: any) => economicsPerUnitValue(row, 'receivingPerUnit', 'receivingTotal');

const economicsPrepFulfillPerUnit = (row?: any) => {
  const costs = economicsCosts(row);
  const qty = economicsQuantity(row);
  return economicsPerUnitValue(row, 'prepLabPerUnit', 'prepLabTotal')
    + economicsPerUnitValue(row, 'pickPerUnit', 'pickTotal')
    + economicsPerUnitValue(row, 'packPerUnit', 'packTotal')
    + economicsPerUnitValue(row, 'orderHandlingPerUnit', 'orderHandlingTotal')
    + economicsPerUnitValue(row, 'materialsPerUnit', 'materialsTotal')
    + economicsPerUnitValue(row, 'reboxPerUnit', 'reboxTotal')
    + asNumber(costs.unitLabelTotal, 0) / qty
    + asNumber(costs.cartonLabelTotal, 0) / qty;
};

const economicsStoragePerUnit = (row?: any) => economicsPerUnitValue(row, 'storagePerUnitMonth', 'storageTotalMonth');
const economicsShippingLabelPerUnit = (row?: any) => economicsOptionalPerUnitValue(row, 'domesticLabelPerUnit', 'labelTotal');
const economicsTransferPerUnit = (row?: any) =>
  economicsOptionalPerUnitValue(row, 'transferLtlPerUnit')
  ?? economicsOptionalPerUnitValue(row, 'optimizedNetworkTransferPerUnit');

/**
 * Roll per-SKU economics into shipment-level totals, segregated by cost category, plus the
 * single-warehouse vs multi-warehouse (optimized) per-unit comparison + captured warehouse codes.
 */
export const perSkuPricingAggregate = (rows: any[]) => {
  const totals = rows.reduce((acc, row) => {
    const qty = economicsQuantity(row);
    const currentPerUnit = economicsPerUnit(row);
    const optimizedPerUnit = economicsOptimizedPerUnit(row);
    const optimizedBlocker = economicsOptimizedBlockedReason(row);
    const receiving = economicsReceivingPerUnit(row) * qty;
    const prepFulfill = economicsPrepFulfillPerUnit(row) * qty;
    const labelPerUnit = economicsShippingLabelPerUnit(row);
    const transferPerUnit = economicsTransferPerUnit(row);
    const shippingLabel = labelPerUnit == null ? 0 : labelPerUnit * qty;
    const transfer = transferPerUnit == null ? 0 : transferPerUnit * qty;
    const storage = economicsStoragePerUnit(row) * qty;
    const single = economicsSingleNode(row);
    const optimized = economicsOptimizedNetwork(row);
    (single.warehouseCodes || []).forEach((c: string) => c && acc.singleCodes.add(c));
    (optimized.warehouseCodes || []).forEach((c: string) => c && acc.multiCodes.add(c));
    acc.units += qty;
    acc.current += currentPerUnit * qty;
    if (optimizedPerUnit != null) {
      acc.optimized += optimizedPerUnit * qty;
      acc.optimizedUnits += qty;
    } else if (optimizedBlocker) {
      acc.optimizedBlockedReasons.add(optimizedBlocker);
    }
    acc.receiving += receiving;
    acc.prepFulfill += prepFulfill;
    acc.shippingLabel += shippingLabel;
    acc.transfer += transfer;
    if (labelPerUnit != null) acc.labelUnits += qty;
    if (transferPerUnit != null) acc.transferUnits += qty;
    acc.storage += storage;
    acc.total += currentPerUnit * qty;
    return acc;
  }, { units: 0, current: 0, optimized: 0, optimizedUnits: 0, receiving: 0, prepFulfill: 0, shippingLabel: 0, transfer: 0, labelUnits: 0, transferUnits: 0, storage: 0, total: 0, optimizedBlockedReasons: new Set<string>(), singleCodes: new Set<string>(), multiCodes: new Set<string>() });
  return {
    units: totals.units,
    currentPerUnit: totals.units > 0 ? totals.current / totals.units : 0,
    optimizedPerUnit: totals.optimizedUnits > 0 ? totals.optimized / totals.optimizedUnits : null,
    optimizedBlockedReasons: Array.from(totals.optimizedBlockedReasons),
    fulfillmentPerUnit: totals.units > 0 ? (totals.receiving + totals.prepFulfill) / totals.units : 0,
    labelAvg: totals.labelUnits > 0 ? totals.shippingLabel / totals.labelUnits : null,
    transferPerUnit: totals.transferUnits > 0 ? totals.transfer / totals.transferUnits : null,
    storage: totals.storage,
    receivingPrepLab: totals.receiving + totals.prepFulfill,
    fulfillment: totals.prepFulfill,
    label: totals.shippingLabel,
    transfer: totals.transfer,
    total: totals.total,
    singleWarehouseCodes: Array.from(totals.singleCodes),
    multiWarehouseCodes: Array.from(totals.multiCodes),
  };
};

const ReviewCard = ({ title, value, sub, tone }: { title: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }) => (
  <div
    style={{
      padding: 14,
      borderRadius: 10,
      background: tone === 'green' ? 'var(--green-soft)' : tone === 'purple' ? 'var(--purple-soft)' : 'var(--bg-sunken)',
      border: tone === 'green' ? '1px solid var(--green-soft)' : tone === 'purple' ? '1px solid var(--purple-soft)' : '1px solid var(--border-subtle)',
    }}
  >
    <div style={{ fontSize: 10.5, color: tone === 'purple' ? 'var(--purple-text)' : 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 6 }}>
      {title}
    </div>
    <div style={{ fontSize: 13 }}>
      <strong style={{ fontSize: 18 }}>{value}</strong>
      {sub != null && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

export const CortexPricingPanel = ({
  preview,
  loading,
  error,
  units,
  compact,
}: {
  preview: ShipmentPricingPreview | null;
  loading: boolean;
  error?: string | null;
  units: number;
  compact?: boolean;
}) => {
  if (loading) {
    return (
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div className="card-title"><Icon name="sparkle" size={14} /> Cortex pricing intelligence</div>
        <div className="card-subtitle">Rate-shopping fulfillment, label, storage, and transportation exposure…</div>
      </div>
    );
  }

  if (!preview && error) {
    return (
      <div className="card" style={{ padding: 16, marginBottom: 14, borderColor: 'var(--amber-border)', background: 'var(--amber-soft)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="warning" size={15} style={{ color: 'var(--amber-text)', marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 850, color: 'var(--amber-text)' }}>Cortex pricing unavailable</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  const warehouses = Array.isArray(preview.warehouses) ? preview.warehouses : [];
  const perSkuEconomics = Array.isArray(preview.perSkuEconomics) ? preview.perSkuEconomics : [];
  const skuAggregate = perSkuPricingAggregate(perSkuEconomics);
  const hasSkuAggregate = skuAggregate.units > 0;
  const current = warehouses.find((warehouse: any) => warehouse.isAnchor || warehouse.scopeRole === 'anchor') || warehouses[0] || {};
  const optimized = warehouses.length
    ? warehouses.reduce((best: any, warehouse: any) => {
        const next = previewWarehousePerUnit(warehouse, preview.totals?.estimatedPerUnit);
        const currentBest = previewWarehousePerUnit(best, preview.totals?.estimatedPerUnit);
        return !best || (next > 0 && next < currentBest) ? warehouse : best;
      }, warehouses[0])
    : {};
  const totals = preview.totals || {};
  const fee = preview.feePreview || {};
  const singlePerUnit = hasSkuAggregate ? skuAggregate.currentPerUnit : previewWarehousePerUnit(current, totals.estimatedPerUnit);
  const multiPerUnit = hasSkuAggregate ? skuAggregate.optimizedPerUnit : previewWarehousePerUnit(optimized, totals.estimatedPerUnit);
  const optimizedBlockedReasons = hasSkuAggregate ? skuAggregate.optimizedBlockedReasons : [];
  const optimizedBlockedCopy = optimizedBlockedReasons.length ? optimizedBlockedReasons.map(networkBlockedCopy).join('; ') : null;
  const savingsPerUnit = multiPerUnit != null && singlePerUnit > 0 ? Math.max(0, singlePerUnit - multiPerUnit) : null;
  const fulfillmentPerUnit = hasSkuAggregate ? skuAggregate.fulfillmentPerUnit : asNumber(fee.fulfillmentFeePerUnit ?? singlePerUnit, 0);
  const receivingPrepLabTotal = hasSkuAggregate ? skuAggregate.receivingPrepLab : asNumber(totals.receivingPrepLabEstimate, 0);
  const fulfillmentTotal = hasSkuAggregate ? skuAggregate.fulfillment : asNumber(totals.fulfillmentEstimate, 0);
  const labelAvg = hasSkuAggregate ? skuAggregate.labelAvg : Number(totals.labelWeightedAverage ?? (current as any)?.weightedLabelCostPerUnit ?? 0);
  const labelTotal = hasSkuAggregate ? skuAggregate.label : (labelAvg == null ? 0 : labelAvg * units);
  const transferPerUnit = hasSkuAggregate ? skuAggregate.transferPerUnit : optionalNumber((totals as any).transferLtlPerUnit);
  const transferTotal = hasSkuAggregate ? skuAggregate.transfer : asNumber(totals.transportationEstimate, 0);
  const storageTotal = hasSkuAggregate ? skuAggregate.storage : asNumber(totals.storageMonthlyEstimate, 0);
  const total = hasSkuAggregate ? skuAggregate.total : Number(totals.estimatedTotal ?? previewWarehouseTotal(current));
  const dueToday = previewDueToday(preview);
  const confidence = preview.confidence == null ? null : Math.round(Number(preview.confidence) * 100);
  const degraded = Boolean((preview as any).fallbackAvailable || (preview as any).cortex?.ok === false || String(preview.source || '').includes('fallback'));
  const singleCodes = skuAggregate.singleWarehouseCodes.length ? skuAggregate.singleWarehouseCodes : [String((current as any)?.warehouseCode || 'anchor')].filter(Boolean);
  const multiCodes = skuAggregate.multiWarehouseCodes;

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-header">
        <div>
          <div className="card-title"><Icon name="sparkle" size={14} /> Fulfillment cost per unit</div>
          <div className="card-subtitle">
            Segregated inbound + pick/pack, shipping labels, and storage — plus single- vs multi-warehouse rate shopping.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Chip tone={String(preview.rateShopScope || '').includes('full') ? 'purple' : 'green'} dot={false}>{pricingScopeLabel(preview.rateShopScope)}</Chip>
          {confidence != null && <Chip tone={confidence >= 70 ? 'green' : 'amber'} dot={false}>{confidence}% confidence</Chip>}
        </div>
      </div>
      <div className="card-body" style={{ display: 'grid', gap: 12 }}>
        {degraded && (
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--amber-soft)', border: '1px solid var(--amber-border)', color: 'var(--amber-text)', fontSize: 12.5, fontWeight: 700 }}>
            Cortex live pricing did not authorize this request, so UnieConnect is showing stored or modeled per-SKU economics and saving them for reuse.
          </div>
        )}

        {/* Single vs multi warehouse rate shopping */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ReviewCard
            title="Single warehouse / unit"
            value={money(singlePerUnit)}
            sub={`Rate-shopped from ${singleCodes.join(', ') || 'anchor / nearest supplier'}`}
          />
          <ReviewCard
            title="Multi-warehouse / unit"
            tone={savingsPerUnit != null && savingsPerUnit > 0 ? 'green' : 'purple'}
            value={moneyOrMissing(multiPerUnit)}
            sub={
              multiPerUnit != null
                ? <>Rate-shopped to hot zones{multiCodes.length ? ` · ${multiCodes.join(', ')}` : ''}{savingsPerUnit != null && savingsPerUnit > 0 ? ` · saves ${money(savingsPerUnit)}/unit` : ''}</>
                : (optimizedBlockedCopy || 'No eligible second warehouse')
            }
          />
        </div>

        {/* Segregated per-unit cost categories */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <ReviewCard title="Inbound / unit" value={money(hasSkuAggregate ? skuAggregate.receivingPrepLab / Math.max(1, skuAggregate.units) : (receivingPrepLabTotal / Math.max(1, units)))} sub="receiving · prep · LAB" />
          <ReviewCard title="Pick / pack / unit" value={money(fulfillmentPerUnit)} sub="pick, pack, handling" />
          <ReviewCard title="Shipping label / unit" value={moneyOrMissing(labelAvg)} sub="48-state parcel avg" />
          <ReviewCard title="LTL transfer / unit" value={moneyOrMissing(transferPerUnit)} sub="warehouse-to-warehouse" />
          <ReviewCard title="Storage / month" value={money(storageTotal)} sub={`${(hasSkuAggregate ? skuAggregate.units : units).toLocaleString()} units`} />
          <ReviewCard title="Due today" tone={dueToday > 0 ? 'purple' : 'green'} value={money(dueToday)} sub={dueToday > 0 ? 'transport due now' : '$0 unless pickup'} />
        </div>

        {/* Cost breakdown totals */}
        {!compact && (
          <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-sunken)' }}>
            <div style={{ fontSize: 11, fontWeight: 850, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Cost breakdown</div>
            {[
              ['Inbound: receiving / prep / LAB', receivingPrepLabTotal],
              ['Pick / pack / fulfillment', fulfillmentTotal],
              ['Shipping labels', labelAvg == null ? null : labelTotal],
              ['LTL transfer', transferPerUnit == null ? null : transferTotal],
              ['Storage / month', storageTotal],
              ['Estimated total', total],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, marginBottom: 6 }}>
                <span>{label}</span>
                <strong>{moneyOrMissing(value)}</strong>
              </div>
            ))}
          </div>
        )}

        {/* Mandatory rate disclosure */}
        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontStyle: 'italic', display: 'flex', gap: 6, alignItems: 'center' }}>
          <Icon name="info" size={12} /> {RATE_DISCLOSURE}
        </div>
      </div>
    </div>
  );
};
