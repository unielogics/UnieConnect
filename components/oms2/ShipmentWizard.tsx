import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons';
import { Modal, Chip } from './ui';
import type { SelSku } from './SelectionBar';
import { fetchOmsSuppliers, createShipmentDraft, confirmShipmentDraft, fetchShipmentPalletLabels, retryShipmentVendorEmail, fetchWarehouseOverview, OmsSupplier, OmsWarehouseOverview } from '../../lib/oms';
import { fetchShipmentPricingPreview, type ShipmentPricingPreview } from '../../lib/shipment-plan';

type Cfg = Record<string, { unitsPerCarton: number; cartons: number; palletize: boolean }>;
type VendorEmailStatus = 'sent' | 'queued' | 'failed' | 'not_configured';
type ShipmentCompletion = {
  draftId: string;
  filename: string;
  downloadStatus: 'downloaded' | 'failed';
  downloadError?: string;
  vendorEmail?: { status?: VendorEmailStatus; recipient?: string | null; reason?: string };
};

const anyNum = (s: any, k: string, d: number) => {
  const v = s?.[k];
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : d;
};

const money = (value: unknown) => {
  const n = Number(value || 0);
  return `$${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
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

const asNumber = (value: unknown, fallback = 0) => {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizedDimensions = (source: any) => {
  const dims = source?.dimensions || {};
  return {
    length: asNumber(dims.length ?? dims.l ?? source?.length ?? source?.lengthIn, 0),
    width: asNumber(dims.width ?? dims.w ?? source?.width ?? source?.widthIn, 0),
    height: asNumber(dims.height ?? dims.h ?? source?.height ?? source?.heightIn, 0),
  };
};

const skuPricingKey = (value?: unknown) => String(value || '').trim().toLowerCase();

const pricingEconomicsForSku = (preview: ShipmentPricingPreview | null, sku: SelSku) => {
  const economics = preview?.perSkuEconomics || [];
  const itemId = skuPricingKey(sku.id);
  const skuCode = skuPricingKey((sku as any).sku || sku.name);
  return economics.find((row) => skuPricingKey(row.itemId) === itemId)
    || economics.find((row) => skuPricingKey(row.sku) === skuCode)
    || null;
};

const economicsCosts = (row?: any) => row?.costs || {};

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
  const qty = Math.max(1, asNumber(row?.quantity, 1));
  return asNumber(costs.totalPerUnit ?? costs.currentPerUnit ?? (economicsTotal(row) / qty), 0);
};

const economicsOptimizedNetwork = (row?: any) => row?.pricingPayload?.networkComparison?.optimizedTwoNode || {};

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

const economicsFulfillment = (row?: any) => {
  const costs = economicsCosts(row);
  return asNumber(costs.prepLabTotal, 0)
    + asNumber(costs.unitLabelTotal, 0)
    + asNumber(costs.cartonLabelTotal, 0)
    + asNumber(costs.pickTotal, 0)
    + asNumber(costs.packTotal, 0)
    + asNumber(costs.orderHandlingTotal, 0)
    + asNumber(costs.materialsTotal, 0);
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

const economicsLabels = (row?: any) => {
  const costs = economicsCosts(row);
  return asNumber(costs.labelTotal, 0) + asNumber(costs.unitLabelTotal, 0) + asNumber(costs.cartonLabelTotal, 0);
};

const perSkuPricingAggregate = (rows: any[]) => {
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
  }, { units: 0, current: 0, optimized: 0, optimizedUnits: 0, receiving: 0, prepFulfill: 0, shippingLabel: 0, transfer: 0, labelUnits: 0, transferUnits: 0, storage: 0, total: 0, optimizedBlockedReasons: new Set<string>() });
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
  };
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

const warehouseName = (warehouse?: OmsWarehouseOverview | null) =>
  warehouse?.facilityName || warehouse?.name || warehouse?.warehouseCode || warehouse?.code || 'Receiving warehouse';

const warehouseAddress = (warehouse?: OmsWarehouseOverview | null) => {
  if (!warehouse) return '';
  const address = warehouse.address || {};
  const line1 = warehouse.addressLine1 || String(address.addressLine1 || address.line1 || address.street1 || address.street || '');
  const line2 = warehouse.addressLine2 || String(address.addressLine2 || address.line2 || address.street2 || '');
  const city = warehouse.city || String(address.city || '');
  const state = warehouse.state || String(address.stateOrProvinceCode || address.state || '');
  const postal = warehouse.postalCode || String(address.postalCode || address.postal || address.zip || '');
  const country = warehouse.countryCode || String(address.countryCode || address.country || '');
  return [line1, line2, [city, state, postal].filter(Boolean).join(', ').replace(', ', ', '), country].filter(Boolean).join(' · ');
};

const warehouseByCode = (warehouses: OmsWarehouseOverview[], code: string) =>
  warehouses.find((warehouse) => (warehouse.warehouseCode || warehouse.code) === code);

const StepBar = ({ step }: { step: number }) => {
  const steps = ['Supplier', 'Logistics', 'Configure', 'Review'];
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 22 }}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const current = step === n;
        return (
          <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: done ? 'var(--green)' : current ? 'var(--accent)' : 'var(--bg-active)',
                color: done || current ? 'white' : 'var(--text-tertiary)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {done ? <Icon name="check" size={12} /> : n}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: current ? 'var(--text)' : 'var(--text-tertiary)' }}>{label}</span>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: done ? 'var(--green)' : 'var(--border)' }} />}
          </div>
        );
      })}
    </div>
  );
};

const YesNoCard = ({
  question,
  detail,
  value,
  setValue,
  yesNote,
  noNote,
}: {
  question: string;
  detail: string;
  value: boolean | null;
  setValue: (v: boolean) => void;
  yesNote: string;
  noNote: string;
}) => (
  <div style={{ marginBottom: 14, padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-elev)' }}>
    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{question}</div>
    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 10 }}>{detail}</div>
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={() => setValue(true)}
        style={{
          flex: 1,
          padding: '10px 14px',
          border: value === true ? '2px solid var(--green)' : '1px solid var(--border)',
          background: value === true ? 'var(--green-soft)' : 'var(--bg-elev)',
          borderRadius: 8,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
          {value === true && <Icon name="check" size={13} style={{ color: 'var(--green)' }} />}
          Yes
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{yesNote}</div>
      </button>
      <button
        onClick={() => setValue(false)}
        style={{
          flex: 1,
          padding: '10px 14px',
          border: value === false ? '2px solid var(--accent)' : '1px solid var(--border)',
          background: value === false ? 'var(--accent-soft)' : 'var(--bg-elev)',
          borderRadius: 8,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
          {value === false && <Icon name="check" size={13} style={{ color: 'var(--accent)' }} />}
          No
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{noNote}</div>
      </button>
    </div>
  </div>
);

const NumberInput = ({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <button onClick={() => onChange(Math.max(min, value - 1))} style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>−</button>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Math.min(max, Math.max(min, parseInt(e.target.value || '0', 10))))}
      style={{ width: 56, height: 22, padding: '0 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-elev)', fontSize: 12, textAlign: 'center', fontFamily: 'var(--mono)' }}
    />
    <button onClick={() => onChange(Math.min(max, value + 1))} style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>+</button>
  </div>
);

const SummaryStat2 = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <div>
    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 3, color: tone ? `var(--${tone}-text)` : 'var(--text)' }}>{value}</div>
  </div>
);

const ReviewCard = ({ title, children, tone }: { title: string; children: React.ReactNode; tone?: string }) => (
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
    <div style={{ fontSize: 13 }}>{children}</div>
  </div>
);

const CortexPricingPanel = ({
  preview,
  loading,
  error,
  units,
}: {
  preview: ShipmentPricingPreview | null;
  loading: boolean;
  error?: string | null;
  units: number;
}) => {
  if (loading) {
    return (
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div className="card-title"><Icon name="sparkle" size={14} /> Cortex pricing intelligence</div>
        <div className="card-subtitle">Calculating fulfillment, label, storage, and transportation exposure…</div>
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
  const currentPerUnit = hasSkuAggregate ? skuAggregate.currentPerUnit : previewWarehousePerUnit(current, totals.estimatedPerUnit);
  const optimizedPerUnit = hasSkuAggregate ? skuAggregate.optimizedPerUnit : previewWarehousePerUnit(optimized, totals.estimatedPerUnit);
  const optimizedBlockedReasons = hasSkuAggregate ? skuAggregate.optimizedBlockedReasons : [];
  const optimizedBlockedCopy = optimizedBlockedReasons.length ? optimizedBlockedReasons.map(networkBlockedCopy).join('; ') : null;
  const fulfillmentPerUnit = hasSkuAggregate ? skuAggregate.fulfillmentPerUnit : asNumber(fee.fulfillmentFeePerUnit ?? currentPerUnit, 0);
  const labelAvg = hasSkuAggregate ? skuAggregate.labelAvg : Number(totals.labelWeightedAverage ?? (current as any)?.weightedLabelCostPerUnit ?? 0);
  const transferPerUnit = hasSkuAggregate ? skuAggregate.transferPerUnit : optionalNumber((totals as any).transferLtlPerUnit ?? (totals as any).transportationPerUnit);
  const storageTotal = hasSkuAggregate ? skuAggregate.storage : asNumber(totals.storageMonthlyEstimate, 0);
  const receivingPrepLabTotal = hasSkuAggregate ? skuAggregate.receivingPrepLab : asNumber(totals.receivingPrepLabEstimate, 0);
  const fulfillmentTotal = hasSkuAggregate ? skuAggregate.fulfillment : asNumber(totals.fulfillmentEstimate, 0);
  const labelTotal = hasSkuAggregate ? skuAggregate.label : (labelAvg == null ? 0 : labelAvg * units);
  const transferTotal = hasSkuAggregate ? skuAggregate.transfer : asNumber(totals.transportationEstimate, 0);
  const total = hasSkuAggregate ? skuAggregate.total : Number(totals.estimatedTotal ?? previewWarehouseTotal(current));
  const dueToday = previewDueToday(preview);
  const confidence = preview.confidence == null ? null : Math.round(Number(preview.confidence) * 100);
  const degraded = Boolean((preview as any).fallbackAvailable || (preview as any).cortex?.ok === false || String(preview.source || '').includes('fallback'));

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-header">
        <div>
          <div className="card-title"><Icon name="sparkle" size={14} /> Cortex pricing intelligence</div>
          <div className="card-subtitle">
            Estimated cost to receive, fulfill, store, and ship. Warehouse fees are charged when services are performed.
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
            Cortex live pricing did not authorize this request, so UnieConnect is showing stored or modeled per-SKU economics and saving them for reuse. Fix the Cortex credential to replace these modeled values with live Cortex pricing.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(142px, 1fr))', gap: 10 }}>
          <ReviewCard title="Current / unit">
            <strong>{money(currentPerUnit)}</strong>
            <div className="muted" style={{ fontSize: 11 }}>{(current as any)?.warehouseCode || 'modeled'}</div>
          </ReviewCard>
          <ReviewCard title="Optimized / unit" tone={optimizedPerUnit != null && optimizedPerUnit < currentPerUnit ? 'green' : 'purple'}>
            <strong>{moneyOrMissing(optimizedPerUnit)}</strong>
            <div className="muted" style={{ fontSize: 11 }}>{optimizedBlockedCopy || (optimized as any)?.warehouseCode || 'modeled'}</div>
          </ReviewCard>
          <ReviewCard title="Fulfillment / unit">
            <strong>{money(fulfillmentPerUnit)}</strong>
            <div className="muted" style={{ fontSize: 11 }}>pick, pack, receive</div>
          </ReviewCard>
          <ReviewCard title="48-state label avg">
            <strong>{moneyOrMissing(labelAvg)}</strong>
            <div className="muted" style={{ fontSize: 11 }}>parcel exposure</div>
          </ReviewCard>
          <ReviewCard title="LTL transfer / unit">
            <strong>{moneyOrMissing(transferPerUnit)}</strong>
            <div className="muted" style={{ fontSize: 11 }}>warehouse-to-warehouse</div>
          </ReviewCard>
          <ReviewCard title="Storage / month">
            <strong>{money(storageTotal)}</strong>
            <div className="muted" style={{ fontSize: 11 }}>{(hasSkuAggregate ? skuAggregate.units : units).toLocaleString()} units</div>
          </ReviewCard>
          <ReviewCard title="Due today" tone={dueToday > 0 ? 'purple' : 'green'}>
            <strong>{money(dueToday)}</strong>
            <div className="muted" style={{ fontSize: 11 }}>{dueToday > 0 ? 'transport due now' : '$0 unless pickup selected'}</div>
          </ReviewCard>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
          <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-sunken)' }}>
            <div style={{ fontSize: 11, fontWeight: 850, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Cost breakdown</div>
            {[
              ['Receiving / prep / LAB', receivingPrepLabTotal],
              ['Fulfillment estimate', fulfillmentTotal],
              ['48-state label estimate', labelAvg == null ? null : labelTotal],
              ['LTL transfer estimate', transferPerUnit == null ? null : transferTotal],
              ['Estimated total', total],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, marginBottom: 6 }}>
                <span>{label}</span>
                <strong>{moneyOrMissing(value)}</strong>
              </div>
            ))}
          </div>
          <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-sunken)' }}>
            <div style={{ fontSize: 11, fontWeight: 850, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Controls & blockers</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
              {preview.feeTimingNotice || 'Warehouse fees are billed when services are performed. Due today is $0.00 unless supplier pickup or paid transportation is selected.'}
            </div>
            {(preview.blockers || []).length > 0 && (
              <div style={{ display: 'grid', gap: 5, marginTop: 10 }}>
                {(preview.blockers || []).slice(0, 4).map((blocker) => (
                  <div key={blocker} style={{ color: 'var(--amber-text)', fontSize: 12, fontWeight: 700 }}>• {String(blocker).replace(/_/g, ' ')}</div>
                ))}
              </div>
            )}
            {optimizedBlockedReasons.length > 0 && (
              <div style={{ display: 'grid', gap: 5, marginTop: 10 }}>
                {optimizedBlockedReasons.slice(0, 4).map((reason) => (
                  <div key={String(reason)} style={{ color: 'var(--amber-text)', fontSize: 12, fontWeight: 700 }}>• {networkBlockedCopy(reason)}</div>
                ))}
              </div>
            )}
            {preview.sourceLabels?.length ? (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
                {preview.sourceLabels.slice(0, 4).map((label) => <Chip key={label} dot={false}>{label.replace(/_/g, ' ')}</Chip>)}
              </div>
            ) : null}
          </div>
        </div>
        {perSkuEconomics.length > 0 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 850, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>Per-SKU pricing breakdown</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Each row is priced independently from its quantity, workflow, dimensions, weight, and warehouse policy.</div>
              </div>
              <Chip tone={degraded ? 'amber' : 'green'} dot={false}>{degraded ? 'Modeled fallback' : 'Cortex priced'}</Chip>
            </div>
            <table className="data">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th className="num">Qty</th>
                  <th className="num">Receive / unit</th>
                  <th className="num">Prep / fulfill / unit</th>
                  <th className="num">48-state label / unit</th>
                  <th className="num">LTL transfer / unit</th>
                  <th className="num">Storage / unit</th>
                  <th className="num">Total / unit</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {perSkuEconomics.map((row, index) => {
                  const labelPerUnit = economicsShippingLabelPerUnit(row);
                  const transferPerUnit = economicsTransferPerUnit(row);
                  const optimizedBlocker = economicsOptimizedBlockedReason(row);
                  const rowConfidence = row.confidence == null ? null : Math.round(Number(row.confidence) * 100);
                  return (
                    <tr key={`${row.itemId || row.sku || index}`}>
                      <td>
                        <div className="mono strong">{row.sku || row.itemId || 'SKU'}</div>
                        {row.title && <div className="muted" style={{ fontSize: 11 }}>{row.title}</div>}
                      </td>
                      <td className="num mono">{economicsQuantity(row).toLocaleString()}</td>
                      <td className="num mono">{money(economicsReceivingPerUnit(row))}</td>
                      <td className="num mono">{money(economicsPrepFulfillPerUnit(row))}</td>
                      <td className="num mono">{moneyOrMissing(labelPerUnit)}</td>
                      <td className="num mono">{moneyOrMissing(transferPerUnit)}</td>
                      <td className="num mono">{money(economicsStoragePerUnit(row))}</td>
                      <td className="num mono strong">{money(economicsPerUnit(row))}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <Chip tone={String(row.cacheState || '').includes('cached') ? 'green' : 'amber'} dot={false}>{String(row.cacheState || row.sourceQuality || 'modeled').replace(/_/g, ' ')}</Chip>
                          {optimizedBlocker && <Chip tone="amber" dot={false}>{networkBlockedCopy(optimizedBlocker)}</Chip>}
                          {rowConfidence != null && <Chip tone={rowConfidence >= 70 ? 'green' : 'amber'} dot={false}>{rowConfidence}%</Chip>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const ShipmentWizard = ({
  skus,
  forcedSupplierId,
  onNewSupplier,
  onClose,
  onComplete,
}: {
  skus: SelSku[];
  forcedSupplierId?: string | null;
  onNewSupplier?: (onCreated?: (supplier?: OmsSupplier) => void) => void;
  onClose: () => void;
  onComplete: () => void;
}) => {
  const list = skus.length ? skus : [];
  const [step, setStep] = useState(1);
  const [suppliers, setSuppliers] = useState<OmsSupplier[]>([]);
  const [warehouses, setWarehouses] = useState<OmsWarehouseOverview[]>([]);
  const [warehousesLoaded, setWarehousesLoaded] = useState(false);
  const [supplierId, setSupplierId] = useState<string | null>(forcedSupplierId || null);
  const [supplierReloadToken, setSupplierReloadToken] = useState(0);
  const [assignSupplierToSkus, setAssignSupplierToSkus] = useState(false);
  const [needsLTL, setNeedsLTL] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [completion, setCompletion] = useState<ShipmentCompletion | null>(null);
  const [retryingEmail, setRetryingEmail] = useState(false);
  const [downloadingLabels, setDownloadingLabels] = useState(false);
  const [pricingPreview, setPricingPreview] = useState<ShipmentPricingPreview | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [config, setConfig] = useState<Cfg>(() =>
    list.reduce((acc, s) => ({ ...acc, [s.id]: { unitsPerCarton: 24, cartons: 20, palletize: true } }), {})
  );

  useEffect(() => {
    fetchOmsSuppliers()
      .then((d) => {
        setSuppliers(d.suppliers || []);
        if (!supplierId && d.suppliers?.length) {
          const match = d.suppliers.find((sp) => list.some((sk) => (sp.skus || []).includes(sk.id) || (sk as any).supplierId === sp.id));
          if (match) setSupplierId(match.id);
        }
      })
      .catch(() => {});
  }, [supplierReloadToken]);

  useEffect(() => {
    let alive = true;
    fetchWarehouseOverview()
      .then((result) => {
        if (!alive) return;
        setWarehouses(result.warehouses || []);
      })
      .catch(() => {
        if (!alive) return;
        setWarehouses([]);
      })
      .finally(() => {
        if (alive) setWarehousesLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (forcedSupplierId) setSupplierId(forcedSupplierId);
  }, [forcedSupplierId]);

  const handleCreateSupplier = () => {
    onNewSupplier?.((created) => {
      if (created?.id) {
        setSuppliers((current) => [created, ...current.filter((supplier) => supplier.id !== created.id)]);
        setSupplierId(created.id);
      }
      setSupplierReloadToken((token) => token + 1);
    });
  };

  const connectedWarehouseCodes = useMemo(
    () => warehouses.map((warehouse) => warehouse.warehouseCode || warehouse.code).filter(Boolean),
    [warehouses],
  );
  const hasConnectedWarehouses = connectedWarehouseCodes.length > 0;
  const routingMode = hasConnectedWarehouses ? 'connected_warehouse' : 'national_network';
  const primaryWarehouse = warehouses[0] || null;
  const primaryFacilityId = primaryWarehouse?.facilityId || null;
  const shipmentWorkflowType = useMemo(
    () => list.some((sku) => Boolean((sku as any).fbaIntent || (sku as any).amazon?.fulfillmentChannel === 'FBA')) ? 'FBA' : 'DTC',
    [list],
  );

  const routedDestinations = useMemo(() => {
    const acc: Record<string, string> = {};
    list.forEach((s, index) => {
      const skuWarehouse = String((s as any).primaryWh || (s as any).primaryWarehouse || '').trim();
      if (hasConnectedWarehouses) {
        acc[s.id] = connectedWarehouseCodes.includes(skuWarehouse)
          ? skuWarehouse
          : connectedWarehouseCodes[index % connectedWarehouseCodes.length];
        return;
      }
      acc[s.id] = skuWarehouse || 'National network';
    });
    return acc;
  }, [connectedWarehouseCodes, hasConnectedWarehouses, list]);

  const destSummary = useMemo(() => {
    const groups: Record<string, number> = {};
    list.forEach((s) => {
      const d = routedDestinations[s.id];
      groups[d] = (groups[d] || 0) + (config[s.id]?.cartons || 0) * (config[s.id]?.unitsPerCarton || 0);
    });
    return Object.entries(groups).map(([wh, units]) => {
      const warehouse = warehouseByCode(warehouses, wh);
      return {
        wh,
        units,
        name: hasConnectedWarehouses ? warehouseName(warehouse) : wh,
        address: hasConnectedWarehouses ? warehouseAddress(warehouse) : '',
      };
    });
  }, [config, hasConnectedWarehouses, list, routedDestinations, warehouses]);

  const totals = useMemo(() => {
    let units = 0;
    let cartons = 0;
    let weight = 0;
    let cube = 0;
    for (const sku of list) {
      const c = config[sku.id] || { unitsPerCarton: 24, cartons: 10, palletize: true };
      const u = c.cartons * c.unitsPerCarton;
      units += u;
      cartons += c.cartons;
      weight += u * anyNum(sku, 'palletWeightLbs', 0.5);
      cube += c.cartons * Math.max(0.3, anyNum(sku, 'palletCubeFt', 0.02) * c.unitsPerCarton);
    }
    const pallets = Math.ceil(cube / 50) || 1;
    return {
      units,
      cartons,
      weight: weight.toFixed(0),
      cube: cube.toFixed(1),
      pallets,
    };
  }, [config, needsLTL, list]);

  const pricingItems = useMemo(() => list.map((s) => {
    const c = config[s.id] || { unitsPerCarton: 24, cartons: 1, palletize: true };
    const dims = normalizedDimensions(s);
    const weight = asNumber((s as any).unitWeightLb ?? (s as any).weight ?? (s as any).palletWeightLbs, 0);
    return {
      itemId: s.id,
      sku: String((s as any).sku || s.name || s.id),
      title: String(s.name || (s as any).title || (s as any).sku || s.id),
      quantity: Math.max(1, c.cartons * c.unitsPerCarton),
      boxCount: Math.max(1, c.cartons),
      cartons: Math.max(1, c.cartons),
      unitsPerCarton: Math.max(1, c.unitsPerCarton),
      unitWeightLb: weight,
      weight,
      dimensions: dims,
      cost: asNumber((s as any).cost ?? (s as any).unitCost ?? (s as any).metadata?.cost, 0),
      sellingPrice: asNumber((s as any).sellingPrice ?? (s as any).price ?? (s as any).metadata?.price, 0),
      asin: String((s as any).asin || ''),
      upc: String((s as any).upc || ''),
      ean: String((s as any).ean || ''),
      keepaState: (s as any).keepaState ?? (s as any).metadata?.keepaState ?? null,
    };
  }), [config, list]);

  const pricingKey = useMemo(
    () => JSON.stringify({ pricingItems, facilityId: primaryFacilityId, needsLTL, routingMode, shipmentWorkflowType }),
    [pricingItems, primaryFacilityId, needsLTL, routingMode, shipmentWorkflowType],
  );

  useEffect(() => {
    if (completion || step !== 4 || !pricingItems.length) return;
    let alive = true;
    setPricingLoading(true);
    setPricingError(null);
    fetchShipmentPricingPreview({
      facilityId: primaryFacilityId || undefined,
      supplierPickupRequired: Boolean(needsLTL),
      serviceWorkflow: shipmentWorkflowType === 'FBA' ? 'prep' : 'dtc_fbm',
      workflowType: shipmentWorkflowType,
      marketplaceType: shipmentWorkflowType,
      items: pricingItems,
    })
      .then((preview) => {
        if (!alive) return;
        setPricingPreview(preview);
      })
      .catch((error) => {
        if (!alive) return;
        setPricingPreview(null);
        setPricingError(error?.message || 'Cortex pricing preview failed.');
      })
      .finally(() => {
        if (alive) setPricingLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [completion, step, pricingKey]);

  const supplier = suppliers.find((s) => s.id === supplierId);
  const supplierMatchCount = supplier ? list.filter((sk) => (supplier.skus || []).includes(sk.id) || (sk as any).supplierId === supplier.id).length : 0;
  const hasAnySupplierMatch = suppliers.some((sp) => list.some((sk) => (sp.skus || []).includes(sk.id) || (sk as any).supplierId === sp.id));
  const unassignedSupplierCount = list.filter((sk) => !(sk as any).supplierId).length;
  const differentSupplierCount = supplierId ? list.filter((sk) => (sk as any).supplierId && (sk as any).supplierId !== supplierId).length : 0;
  const needsSupplierReassignment = Boolean(supplierId && (unassignedSupplierCount > 0 || differentSupplierCount > 0));
  const canAdvance = step === 1 ? !!supplierId : step === 2 ? needsLTL !== null : true;

  const downloadPalletLabels = async (draftId: string, filename?: string | null) => {
    setDownloadingLabels(true);
    try {
      const blob = await fetchShipmentPalletLabels(draftId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `ASN-${draftId.slice(0, 8)}-pallet-labels.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setCompletion((current) => current ? { ...current, downloadStatus: 'downloaded', downloadError: undefined } : current);
      return true;
    } catch (e: any) {
      setCompletion((current) => current ? { ...current, downloadStatus: 'failed', downloadError: e.message || 'Download failed' } : current);
      return false;
    } finally {
      setDownloadingLabels(false);
    }
  };

  const retryVendorEmail = async () => {
    if (!completion?.draftId) return;
    setRetryingEmail(true);
    try {
      const vendorEmail = await retryShipmentVendorEmail(completion.draftId);
      setCompletion((current) => current ? { ...current, vendorEmail } : current);
    } catch (e: any) {
      setCompletion((current) => current ? { ...current, vendorEmail: { status: 'failed', reason: e.message || 'Email retry failed' } } : current);
    } finally {
      setRetryingEmail(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const body = {
        supplierId,
        assignSupplierToSkus,
        facilityId: primaryFacilityId,
        warehouseRoutingMode: routingMode,
        connectedWarehouseCodes,
        requiresBol: !!needsLTL,
        requiresLabels: true,
        selectedItems: list.map((s) => ({
          itemId: s.id,
          sku: (s as any).sku || s.name,
          unitsPerCarton: config[s.id].unitsPerCarton,
          cartons: config[s.id].cartons,
          palletize: config[s.id].palletize,
        })),
        packagePlan: { pallets: totals.pallets, totalUnits: totals.units, totalCartons: totals.cartons, routingMode, destinations: destSummary },
      };
      const { draft } = await createShipmentDraft(body);
      const result = await confirmShipmentDraft(draft.id, body);
      if (result?.status === 'needs_input' || result?.status === 'needs_setup') {
        throw new Error(String(result.message || 'Shipment needs more setup before it can be confirmed.'));
      }
      const docs = (result?.documents || {}) as any;
      const filename = docs?.palletLabels?.filename || `ASN-${draft.id.slice(0, 8)}-pallet-labels.pdf`;
      setCompletion({
        draftId: draft.id,
        filename,
        downloadStatus: 'downloaded',
        vendorEmail: docs?.vendorEmail || undefined,
      });
      const downloaded = await downloadPalletLabels(draft.id, filename);
      if (!downloaded) {
        setCompletion((current) => current ? { ...current, downloadStatus: 'failed' } : current);
      }
    } catch (e: any) {
      setSubmitErr(e.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Create shipment plan"
      subtitle={`${list.length} SKU${list.length > 1 ? 's' : ''} · ${totals.units.toLocaleString()} units · ${hasConnectedWarehouses ? `${connectedWarehouseCodes.length} connected warehouse${connectedWarehouseCodes.length === 1 ? '' : 's'}` : 'national network routing'}`}
      onClose={onClose}
      fullscreen
      chrome={
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Chip tone={hasConnectedWarehouses ? 'green' : 'purple'} dot={false}>
            {hasConnectedWarehouses ? 'Connected warehouses' : 'Network routing'}
          </Chip>
        </div>
      }
      footer={
        <>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {completion ? 'Shipment created · required pallet labels are ready' : `Step ${step} of 4 · An ASN is automatically created on submit`}
            {submitErr ? <span style={{ color: 'var(--red-text)', marginLeft: 10 }}>{submitErr}</span> : null}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {completion ? (
              <>
                <button className="btn" onClick={() => downloadPalletLabels(completion.draftId, completion.filename)} disabled={downloadingLabels}>
                  <Icon name="download" size={12} /> {downloadingLabels ? 'Downloading...' : 'Download labels'}
                </button>
                <button className="btn primary" onClick={onComplete}>Open shipments</button>
              </>
            ) : (
              <>
                {step > 1 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
                <button className="btn ghost" onClick={onClose}>Cancel</button>
                {step < 4 ? (
              <button className="btn primary" disabled={!canAdvance} onClick={() => setStep(step + 1)}>
                Continue <Icon name="arrowRight" size={12} />
              </button>
                ) : (
              <button className="btn primary lg" onClick={submit} disabled={submitting}>
                <Icon name="check" size={13} /> {submitting ? 'Submitting…' : 'Submit shipment plan'}
              </button>
                )}
              </>
            )}
          </div>
        </>
      }
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <StepBar step={step} />

        {completion && (
          <div className="card" style={{ padding: 20, background: 'var(--bg-elev)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--green-soft)', color: 'var(--green-text)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name="check" size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 5 }}>Shipment plan created</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
                  The ASN was created and the required 4x6 pallet label PDF is ready. The vendor must print these labels and place one on each pallet before pickup.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: 10 }}>
                  <div style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-sunken)' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Pallet label PDF</div>
                    <div style={{ fontSize: 12, color: completion.downloadStatus === 'downloaded' ? 'var(--green-text)' : 'var(--red-text)', fontWeight: 700 }}>
                      {completion.downloadStatus === 'downloaded' ? 'Downloaded automatically' : 'Download failed'}
                    </div>
                    {completion.downloadError && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>{completion.downloadError}</div>}
                    <button className="btn sm" style={{ marginTop: 10 }} onClick={() => downloadPalletLabels(completion.draftId, completion.filename)} disabled={downloadingLabels}>
                      <Icon name="download" size={11} /> {downloadingLabels ? 'Downloading...' : 'Download again'}
                    </button>
                  </div>
                  <div style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-sunken)' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Vendor email</div>
                    <div style={{ fontSize: 12, color: completion.vendorEmail?.status === 'sent' || completion.vendorEmail?.status === 'queued' ? 'var(--green-text)' : 'var(--amber-text)', fontWeight: 700 }}>
                      {completion.vendorEmail?.status === 'sent'
                        ? 'Sent to vendor'
                        : completion.vendorEmail?.status === 'queued'
                          ? 'Queued for vendor'
                          : completion.vendorEmail?.status === 'not_configured'
                            ? 'Email not configured'
                            : 'Manual email required'}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {completion.vendorEmail?.recipient
                        ? `Recipient: ${completion.vendorEmail.recipient}`
                        : 'Download the PDF and email it to the vendor for reassurance.'}
                    </div>
                    {completion.vendorEmail?.reason && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>{completion.vendorEmail.reason}</div>}
                    <button className="btn sm" style={{ marginTop: 10 }} onClick={retryVendorEmail} disabled={retryingEmail}>
                      <Icon name="refresh" size={11} /> {retryingEmail ? 'Retrying...' : 'Retry email'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!completion && step === 1 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Supplier required before shipment creation</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Every shipment plan must be tied to one supplier so UnieConnect can create the ASN, pickup context, and warehouse handoff correctly.
              </div>
            </div>
            {suppliers.length === 0 ? (
              <div className="card" style={{ padding: 18, background: 'var(--bg-sunken)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--amber-soft)', color: 'var(--amber-text)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon name="warning" size={17} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>No suppliers exist yet</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Create a supplier first, then return to this shipment plan. Supplier data is required for pickup rules, labels, BOL context, and ASN routing.
                    </div>
                  </div>
                  <button className="btn primary" onClick={handleCreateSupplier}>
                    <Icon name="plus" size={13} /> Create supplier
                  </button>
                </div>
              </div>
            ) : (
              <>
                {!hasAnySupplierMatch && (
                  <div className="card" style={{ padding: 12, marginBottom: 12, background: 'var(--amber-soft)', color: 'var(--amber-text)', borderColor: 'var(--amber)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700 }}>
                      <Icon name="warning" size={14} />
                      No supplier assigned to these SKUs. Choose one below or create a supplier.
                    </div>
                  </div>
                )}
                {supplierId && supplierMatchCount > 0 && (
                  <div className="card" style={{ padding: 10, marginBottom: 12, color: 'var(--purple-text)', background: 'var(--purple-soft)', borderColor: 'var(--purple-soft)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700 }}>
                      <Icon name="sparkle" size={14} />
                      Auto-selected from SKU supplier history.
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                  <button className="btn" onClick={handleCreateSupplier}>
                    <Icon name="plus" size={13} /> Create supplier
                  </button>
                </div>
                {needsSupplierReassignment && (
                  <div className="card" style={{ padding: 12, marginBottom: 12, background: 'var(--bg-sunken)', borderColor: 'var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--purple-soft)', color: 'var(--purple-text)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Icon name="tag" size={14} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Supplier assignment review</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                          The selected supplier will be used for this shipment plan and ASN. {unassignedSupplierCount > 0 ? `${unassignedSupplierCount} SKU${unassignedSupplierCount === 1 ? '' : 's'} currently have no supplier. ` : ''}{differentSupplierCount > 0 ? `${differentSupplierCount} SKU${differentSupplierCount === 1 ? ' is' : 's are'} assigned to another supplier. ` : ''}
                        </div>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10, fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={assignSupplierToSkus}
                            onChange={(event) => setAssignSupplierToSkus(event.target.checked)}
                            style={{ marginTop: 2 }}
                          />
                          Also update the SKU master supplier assignment for every selected SKU.
                        </label>
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {suppliers.map((s) => {
                const matchCount = list.filter((sk) => (s.skus || []).includes(sk.id) || (sk as any).supplierId === s.id).length;
                const sel = supplierId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSupplierId(s.id)}
                    style={{
                      textAlign: 'left',
                      padding: 14,
                      border: sel ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: sel ? 'var(--accent-soft)' : 'var(--bg-elev)',
                      borderRadius: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent), #5b3bcc)', color: 'white', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {(s.name || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {(() => {
                        const cityState = [s.city, s.state].map((v) => String(v || '').trim()).filter(Boolean).join(', ');
                        const isOnline = !cityState;
                        return (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</span>
                              {isOnline && <Chip tone="blue" dot={false}>Online supplier</Chip>}
                              {matchCount > 0 && <Chip tone="purple" dot={false}>Match · {matchCount}</Chip>}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                              {isOnline
                                ? 'No pickup address · ships online'
                                : [cityState, s.country].filter(Boolean).join(' · ')}
                              {s.leadTime ? ` · ${s.leadTime}d lead` : ''}
                              {s.onTime != null ? ` · ${Math.round(s.onTime * 100)}% on-time` : ''}
                            </div>
                          </>
                        );
                      })()}
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                        {s.paymentTerms || '—'}
                        {s.rating != null ? ` · ★ ${s.rating}` : ''}
                      </div>
                    </div>
                    {sel && <Icon name="check" size={16} style={{ color: 'var(--accent)' }} />}
                  </button>
                );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {!completion && step === 2 && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>How is this shipment moving?</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Tell us whether you need a Bill of Lading (BOL) for LTL freight pickup. Pallet labels are mandatory and generated automatically for the vendor.
              </div>
            </div>
            <div className="card" style={{ marginBottom: 18, background: hasConnectedWarehouses ? 'var(--green-soft)' : 'var(--purple-soft)', border: `1px solid ${hasConnectedWarehouses ? 'var(--green-soft)' : 'var(--purple-soft)'}` }}>
              <div className="card-body" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: hasConnectedWarehouses ? 'var(--green)' : 'var(--purple)', color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon name="box" size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{hasConnectedWarehouses ? 'Ship-to connected warehouse network' : 'Ship-to national network'}</span>
                    <Chip tone={hasConnectedWarehouses ? 'green' : 'purple'} dot={false}>
                      {hasConnectedWarehouses ? 'Configured' : 'No warehouse connected'}
                    </Chip>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    {hasConnectedWarehouses
                      ? 'This shipment routes only to warehouses connected to this account. The ASN uses the connected WMS facility for receiving.'
                      : 'No warehouse connection is configured yet. UnieConnect can project the shipment against the national network, but physical receiving needs a connected WMS warehouse.'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {warehousesLoaded && destSummary.map((d) => (
                      <div key={d.wh} style={{ minWidth: 220, maxWidth: 360, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-elev)', border: '1px solid var(--border)', fontSize: 11.5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontWeight: 800 }}>{d.name}</span>
                          <span className="mono" style={{ color: hasConnectedWarehouses ? 'var(--green-text)' : 'var(--purple-text)' }}>{d.units.toLocaleString()}u</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                          {d.address || (hasConnectedWarehouses ? d.wh : 'Projected receiving network')}
                        </div>
                        {hasConnectedWarehouses && <div className="mono" style={{ color: 'var(--text-tertiary)', marginTop: 3 }}>{d.wh}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <YesNoCard
              question="Do you need a BOL for LTL/freight pickup at the supplier?"
              detail="A Bill of Lading lets the supplier hand the shipment to your carrier. If yes, we generate the BOL and book the pickup."
              value={needsLTL}
              setValue={setNeedsLTL}
              yesNote="BOL generated · pickup booked"
              noNote="Supplier handles outbound freight"
            />
            <div className="card" style={{ marginBottom: 14, padding: 14, background: 'var(--green-soft)', borderColor: 'var(--green-soft)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Icon name="check" size={14} style={{ color: 'var(--green)', marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>Pallet labels are required</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    UnieConnect will generate a 4x6 PDF with ASN and pallet barcodes. The vendor must print the labels and place one on each pallet before pickup.
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 18, padding: 14, background: 'var(--green-soft)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="check" size={14} style={{ color: 'var(--green)' }} />
              <div style={{ fontSize: 12.5 }}>
                <strong>ASN auto-generated.</strong> An Advance Ship Notice is created on submit regardless of your BOL/label choices. Connected warehouses receive WMS execution; network-routed plans stay projected until a warehouse is connected.
              </div>
            </div>
          </div>
        )}

        {!completion && step === 3 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Configure cartons &amp; pallets</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Enter units per carton and total cartons for each SKU. Pallets are computed from cube.</div>
            </div>
            <div className="table-wrap" style={{ marginBottom: 16 }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th className="num">Units / carton</th>
                    <th className="num">Cartons</th>
                    <th className="num">Total units</th>
                    <th>Palletize</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((sku) => {
                    const c = config[sku.id];
                    return (
                      <tr key={sku.id}>
                        <td className="mono strong">{(sku as any).sku || sku.id}</td>
                        <td>{sku.name}</td>
                        <td className="num">
                          <NumberInput value={c.unitsPerCarton} onChange={(v) => setConfig((p) => ({ ...p, [sku.id]: { ...p[sku.id], unitsPerCarton: v } }))} min={1} max={500} />
                        </td>
                        <td className="num">
                          <NumberInput value={c.cartons} onChange={(v) => setConfig((p) => ({ ...p, [sku.id]: { ...p[sku.id], cartons: v } }))} min={1} max={2000} />
                        </td>
                        <td className="num mono strong">{(c.cartons * c.unitsPerCarton).toLocaleString()}</td>
                        <td>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                            <input type="checkbox" checked={c.palletize} onChange={(e) => setConfig((p) => ({ ...p, [sku.id]: { ...p[sku.id], palletize: e.target.checked } }))} className="row-check" />
                            Yes
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: 16, background: 'var(--bg-sunken)', borderRadius: 10 }}>
              <SummaryStat2 label="Total units" value={totals.units.toLocaleString()} />
              <SummaryStat2 label="Total cartons" value={totals.cartons.toLocaleString()} />
              <SummaryStat2 label="Est. weight" value={`${(+totals.weight).toLocaleString()} lb`} />
              <SummaryStat2 label="Pallets" value={totals.pallets} tone="purple" />
            </div>
          </div>
        )}

        {!completion && step === 4 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Review &amp; submit</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Submitting creates the ASN, generates required pallet labels, and emails the vendor when email is configured.
              </div>
            </div>
            <div className="row-2-eq" style={{ marginBottom: 14 }}>
              <ReviewCard title="Supplier">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent), #5b3bcc)', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
                    {(supplier?.name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{supplier?.name || '—'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                      {supplier?.region || ''}
                      {supplier?.leadTime ? ` · ${supplier.leadTime}d lead` : ''}
                    </div>
                  </div>
                </div>
              </ReviewCard>
              <ReviewCard title={hasConnectedWarehouses ? 'Destinations · connected warehouses' : 'Destinations · national network'} tone={hasConnectedWarehouses ? 'green' : 'purple'}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {destSummary.map((d) => (
                    <div key={d.wh} style={{ minWidth: 220, flex: '1 1 220px', padding: '8px 10px', borderRadius: 8, background: 'var(--bg-elev)', border: `1px solid ${hasConnectedWarehouses ? 'var(--green-soft)' : 'var(--purple-soft)'}`, fontSize: 11.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontWeight: 800 }}>{d.name}</span>
                        <span className="mono" style={{ color: hasConnectedWarehouses ? 'var(--green-text)' : 'var(--purple-text)' }}>{d.units.toLocaleString()}u</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                        {d.address || (hasConnectedWarehouses ? d.wh : 'Projected receiving network')}
                      </div>
                      {hasConnectedWarehouses && <div className="mono" style={{ color: 'var(--text-tertiary)', marginTop: 3 }}>{d.wh}</div>}
                    </div>
                  ))}
                </div>
              </ReviewCard>
            </div>
            <div className="row-3" style={{ marginBottom: 14 }}>
              <ReviewCard title="BOL & freight" tone={needsLTL ? 'green' : undefined}>
                {needsLTL ? (
                  <>
                    BOL generated · LTL pickup requested
                  </>
                ) : (
                  <>Supplier-arranged (no BOL)</>
                )}
              </ReviewCard>
              <ReviewCard title="Pallet labels" tone="green">
                Required 4x6 ASN pallet labels · no UnieConnect label cost · auto-download after submit
              </ReviewCard>
              <ReviewCard title="ASN" tone="green">
                <strong>Auto-generated</strong> on submit · {hasConnectedWarehouses ? 'pushed to connected destination WMS' : 'held as projected until WMS connection'}
              </ReviewCard>
            </div>
            <CortexPricingPanel
              preview={pricingPreview}
              loading={pricingLoading}
              error={pricingError}
              units={totals.units}
            />
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-header">
                <div className="card-title">SKUs in this plan ({list.length})</div>
              </div>
              <table className="data">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Routed to</th>
                    <th className="num">U/Ctn</th>
                    <th className="num">Cartons</th>
                    <th className="num">Units</th>
                    <th className="num">Cost / unit</th>
                    <th className="num">Est. total</th>
                    <th>Pricing</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((sku) => {
                    const c = config[sku.id];
                    const routedCode = routedDestinations[sku.id];
                    const routedWarehouse = warehouseByCode(warehouses, routedCode);
                    const skuPricing = pricingEconomicsForSku(pricingPreview, sku);
                    const skuPricingBlocker = economicsOptimizedBlockedReason(skuPricing);
                    const skuConfidence = skuPricing?.confidence == null ? null : Math.round(Number(skuPricing.confidence) * 100);
                    return (
                      <tr key={sku.id}>
                        <td className="mono strong">{(sku as any).sku || sku.id}</td>
                        <td>{sku.name}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{hasConnectedWarehouses ? warehouseName(routedWarehouse) : routedCode}</div>
                          <div className="muted" style={{ fontSize: 11 }}>{hasConnectedWarehouses ? warehouseAddress(routedWarehouse) || routedCode : 'Projected receiving network'}</div>
                        </td>
                        <td className="num mono">{c.unitsPerCarton}</td>
                        <td className="num mono">{c.cartons}</td>
                        <td className="num mono strong">{(c.cartons * c.unitsPerCarton).toLocaleString()}</td>
                        <td className="num mono strong">
                          {skuPricing ? money(economicsPerUnit(skuPricing)) : pricingLoading ? '…' : 'Not calculated'}
                        </td>
                        <td className="num mono">
                          {skuPricing ? money(economicsTotal(skuPricing)) : pricingLoading ? '…' : 'Not calculated'}
                        </td>
                        <td>
                          {skuPricing ? (
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                              <Chip tone={String(skuPricing.cacheState || '').includes('cached') ? 'green' : 'amber'} dot={false}>
                                {String(skuPricing.cacheState || skuPricing.sourceQuality || 'modeled').replace(/_/g, ' ')}
                              </Chip>
                              {skuPricingBlocker && <Chip tone="amber" dot={false}>{networkBlockedCopy(skuPricingBlocker)}</Chip>}
                              {skuConfidence != null && <Chip tone={skuConfidence >= 70 ? 'green' : 'amber'} dot={false}>{skuConfidence}%</Chip>}
                            </div>
                          ) : (
                            <span className="muted" style={{ fontSize: 11 }}>Waiting on pricing</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: 16, background: 'var(--green-soft)', borderRadius: 10, border: '1px solid var(--green-soft)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <SummaryStat2 label="Units" value={totals.units.toLocaleString()} />
              <SummaryStat2 label="Cartons" value={totals.cartons} />
              <SummaryStat2 label="Pallets" value={totals.pallets} />
              <SummaryStat2 label="Cube" value={`${totals.cube} ft³`} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
