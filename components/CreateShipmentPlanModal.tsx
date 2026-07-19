import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, Package, Boxes, ShoppingBag, Store, Truck, Download, Printer } from 'lucide-react';
import { Modal } from './Modal';
import { TransportationTemplatePopup } from './TransportationTemplatePopup';
import { CreationVerificationScreen } from './CreationVerificationScreen';
import { AddonsSidePanel } from './AddonsSidePanel';
import { ShipmentMapView, type MapPin } from './ShipmentMapView';
import { fetchSuppliers, fetchShipFromLocations } from '../lib/amazon-fba';
import type { ShipFromLocation } from '../lib/amazon-fba';
import {
  createShipmentPlan,
  createASN,
  fetchEstimatedCost,
  fetchEstimateServiceFees,
  fetchAsnLabelBlob,
  fetchItemBarcodeBlob,
  fetchClosestFacilityPreview,
  type ShipmentPlanItem,
  type EstimateServiceFeesLineItem,
  type ShipmentPricingPreview,
} from '../lib/shipment-plan';
import { fetchTransportationTemplates, type TransportationTemplate } from '../lib/transportation-template';

export type CreateShipmentPlanInitialItem = {
  sku: string;
  title?: string;
  asin?: string;
  imageUrl?: string;
  itemId?: string;
  weight?: number;
  dimensions?: { length?: number; width?: number; height?: number };
};

type Section = 1 | 2 | 3 | 4 | 4.5 | 5 | 6 | 7 | 8 | 9 | 10; // 1-4 workflow, 4.5=acknowledgement, 5=ASN/PDFs

interface CreateShipmentPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItems?: CreateShipmentPlanInitialItem[];
}

function formatAddress(addr: { addressLine1?: string; city?: string; stateOrProvinceCode?: string; postalCode?: string; countryCode?: string } | undefined): string {
  if (!addr) return '';
  const parts = [addr.addressLine1, addr.city, addr.stateOrProvinceCode, addr.postalCode, addr.countryCode].filter(Boolean) as string[];
  return parts.join(', ');
}

function shipFromDisplay(location: ShipFromLocation | null): string {
  if (!location) return 'Select supplier';
  const addr = formatAddress(location.address as any);
  return addr ? `${location.label} – ${addr}` : location.label || '—';
}

// Cubic feet for one unit from L×W×H inches (1728 in³ = 1 ft³). Mirrors the backend itemCubeFt.
function itemCubicFeet(dims?: { length?: number; width?: number; height?: number }): number | null {
  if (!dims) return null;
  const l = dims.length ?? 0, w = dims.width ?? 0, h = dims.height ?? 0;
  if (l <= 0 || w <= 0 || h <= 0) return null;
  return Number(((l * w * h) / 1728).toFixed(3));
}

// Coarse size tier from cubic feet — small/medium/large. Reference-only label for the operator;
// the real FBA size-tier classifier lives in Cortex. Thresholds: ~<0.5 ft³ small, <2 ft³ medium.
function sizeTier(dims?: { length?: number; width?: number; height?: number }): 'small' | 'medium' | 'large' | null {
  const cf = itemCubicFeet(dims);
  if (cf == null) return null;
  if (cf < 0.5) return 'small';
  if (cf < 2) return 'medium';
  return 'large';
}

function shipToDisplay(wh: { name: string; address?: { city?: string; stateOrProvinceCode?: string } } | null | 'loading'): string {
  if (!wh || wh === 'loading') return '—';
  const city = wh.address?.city || '';
  const state = wh.address?.stateOrProvinceCode || '';
  if (!city && !state) return wh.name;
  return `${city}, ${state}`;
}

function shipToFullAddress(wh: { name: string; address?: Record<string, string | number | undefined> } | null | 'loading'): string {
  if (!wh || wh === 'loading') return wh === 'loading' ? 'Loading…' : '—';
  const addr = formatAddress(wh.address as any);
  return addr ? `${wh.name} – ${addr}` : wh.name;
}

type PricingAwareEstimate = {
  total: number;
  perUnit: number;
  breakdown?: Record<string, number>;
  lineItems?: EstimateServiceFeesLineItem[];
  warehouseCode?: string;
  dueToday?: number;
  feeTimingNotice?: string;
  confidence?: number;
  blockers?: string[];
  pricingPreview?: ShipmentPricingPreview;
  source?: string;
};

function money(value: number | undefined | null) {
  const n = Number(value || 0);
  return `$${n.toFixed(2)}`;
}

function previewDueToday(preview?: ShipmentPricingPreview) {
  if (!preview) return undefined;
  if (typeof preview.dueToday === 'number') return preview.dueToday;
  return Number(preview.dueToday?.amount || 0);
}

export function CreateShipmentPlanModal({
  isOpen,
  onClose,
  initialItems = [],
}: CreateShipmentPlanModalProps) {
  const [hasCompletedGate, setHasCompletedGate] = useState(false);
  const [currentSection, setCurrentSection] = useState<Section>(1);
  const [prepServicesOnly, setPrepServicesOnly] = useState<boolean | null>(null);
  const [marketplaceType, setMarketplaceType] = useState<'FBA' | 'FBW'>('FBA');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [locations, setLocations] = useState<ShipFromLocation[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState<(ShipmentPlanItem & { imageUrl?: string; itemId?: string })[]>(() =>
    initialItems.length > 0
      ? initialItems.map((p) => ({
          sku: p.sku,
          title: p.title,
          asin: p.asin,
          imageUrl: p.imageUrl,
          itemId: p.itemId,
          // Seed physical attributes from the catalog so weight/dims are present before (and as a
          // fallback to) any transportation template selection — powers total weight + rate shopping.
          weightPerUnit: p.weight,
          dimensions: p.dimensions,
        }))
      : []
  );
  const [planId, setPlanId] = useState<string | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<PricingAwareEstimate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TransportationTemplate[]>([]);
  const [templatePopupOpen, setTemplatePopupOpen] = useState(false);
  const [templatePopupForItemIdx, setTemplatePopupForItemIdx] = useState<number | null>(null);
  const [addonsForItemIdx, setAddonsForItemIdx] = useState<number | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  // Filter the review grid of pre-selected items by SKU / title / ASIN.
  const [itemSearch, setItemSearch] = useState('');
  const [deliveryOption, setDeliveryOption] = useState<'parcel' | 'pallet' | 'none' | null>(null);
  const [verificationSteps, setVerificationSteps] = useState<Array<{ id: string; label: string; status: 'pending' | 'in_progress' | 'success' | 'error'; detail?: string }>>([]);
  const [showVerification, setShowVerification] = useState(false);
  const [asnId, setAsnId] = useState<string | null>(null);
  const [estimateServiceFees, setEstimateServiceFees] = useState<PricingAwareEstimate | 'loading' | null>(null);
  const [acknowledgedAgreed, setAcknowledgedAgreed] = useState(false);
  const [planItemsWithWms, setPlanItemsWithWms] = useState<(ShipmentPlanItem & { wmsItemId?: string; wmsSku?: string })[]>([]);
  const [warehousePreview, setWarehousePreview] = useState<{
    name: string;
    code?: string;
    address?: {
      addressLine1?: string;
      city?: string;
      stateOrProvinceCode?: string;
      postalCode?: string;
      countryCode?: string;
      lat?: number;
      long?: number;
    };
    shipFromAddress?: { lat: number; long: number };
    distanceMiles?: number;
  } | null | 'loading'>(null);
  const [asnPdfPreviewUrl, setAsnPdfPreviewUrl] = useState<string | null>(null);
  const [asnPdfError, setAsnPdfError] = useState<string | null>(null);
  const asnPdfBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen && initialItems.length > 0) {
      setItems(
        initialItems.map((p) => ({
          sku: p.sku,
          title: p.title,
          asin: p.asin,
          imageUrl: p.imageUrl,
          itemId: p.itemId,
          weightPerUnit: p.weight,
          dimensions: p.dimensions,
        }))
      );
    }
  }, [isOpen, initialItems]);

  useEffect(() => {
    if (isOpen) {
      void (async () => {
        try {
          const [s, l, t] = await Promise.all([
            fetchSuppliers(),
            fetchShipFromLocations(),
            fetchTransportationTemplates(supplierId || undefined),
          ]);
          setSuppliers(s);
          setLocations(l);
          setTemplates(t.templates);
        } catch {}
      })();
    }
  }, [isOpen, supplierId]);

  const locationsForSupplier = useMemo(
    () => (supplierId ? locations.filter((l: any) => String(l.supplierId) === String(supplierId)) : []),
    [supplierId, locations]
  );

  const selectedLocation = useMemo(
    () => locationsForSupplier.find((l: any) => l.isDefault) || locationsForSupplier[0] || null,
    [locationsForSupplier]
  );
  const shipFromLocationId = selectedLocation?.id || '';

  const shipFromText = useMemo(() => shipFromDisplay(selectedLocation), [selectedLocation]);
  const shipToText = useMemo(() => shipToDisplay(warehousePreview), [warehousePreview]);

  const totalUnits = useMemo(() => items.reduce((s, i) => s + (i.quantity || 0), 0), [items]);
  const totalBoxes = useMemo(() => items.reduce((s, i) => s + (i.boxCount || 0), 0), [items]);
  // Total shipment weight: prefer per-unit weight × units; fall back to per-box weight × boxes.
  const totalWeight = useMemo(
    () =>
      items.reduce((s, i) => {
        if (i.weightPerUnit != null) return s + i.weightPerUnit * (i.quantity || 0);
        if (i.weightPerBox != null) return s + i.weightPerBox * (i.boxCount || 0);
        return s;
      }, 0),
    [items],
  );
  // Items still missing physical attributes needed to rate-shop (per the "force the client to
  // provide dimensions" policy — we never invent size). Gate the cost step on this.
  const itemsMissingDims = useMemo(
    () =>
      items.filter((i) => {
        const d = i.dimensions;
        const hasDims = d && (d.length ?? 0) > 0 && (d.width ?? 0) > 0 && (d.height ?? 0) > 0;
        const hasWeight = (i.weightPerUnit ?? 0) > 0 || (i.weightPerBox ?? 0) > 0;
        return !hasDims || !hasWeight;
      }),
    [items],
  );

  const mapPins = useMemo(() => {
    const pins: MapPin[] = [];
    const shipFrom = warehousePreview && warehousePreview !== 'loading' ? warehousePreview.shipFromAddress : undefined;
    const shipFromAddr = selectedLocation?.address as { lat?: number; long?: number } | undefined;
    const shipFromCoords = shipFrom ?? (shipFromAddr?.lat != null && shipFromAddr?.long != null ? { lat: shipFromAddr.lat!, long: shipFromAddr.long! } : null);
    if (shipFromCoords) {
      pins.push({
        lat: shipFromCoords.lat,
        lng: shipFromCoords.long,
        label: shipFromText,
        index: 1,
        type: 'ship-from',
      });
    }
    const whAddr = warehousePreview && warehousePreview !== 'loading' ? warehousePreview.address : undefined;
    if (whAddr?.lat != null && whAddr?.long != null) {
      pins.push({
        lat: whAddr.lat,
        lng: whAddr.long,
        label: shipToFullAddress(warehousePreview),
        index: 2,
        type: 'ship-to',
      });
    }
    return pins;
  }, [shipFromLocationId, selectedLocation, warehousePreview, shipFromText]);

  const updateItem = (idx: number, patch: Partial<ShipmentPlanItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const handleCreate = async () => {
    if (!supplierId || !shipFromLocationId || items.length === 0) {
      setError('Supplier and at least one item are required.');
      return;
    }
    const validItems = items.filter(
      (i) => (i.quantity ?? 0) > 0 && (i.boxCount ?? 0) > 0 && (i.unitsPerBox ?? 0) > 0
    );
    if (validItems.length === 0) {
      setError('All items need a template with quantity, boxes, and units per box.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const plan = await createShipmentPlan({
        supplierId,
        shipFromLocationId,
        prepServicesOnly: prepServicesOnly ?? false,
        marketplaceType: prepServicesOnly ? marketplaceType : undefined,
        items: validItems.map((i) => ({
          ...i,
          quantity: i.quantity!,
          boxCount: i.boxCount!,
          unitsPerBox: i.unitsPerBox!,
        })),
        shipmentTitle: shipToText !== '—' ? shipToText : undefined,
      });
      setPlanId(plan.id);
      setCurrentSection(4.5);
    } catch (e: any) {
      setError(e?.message || 'Failed to create plan');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateASN = async () => {
    if (!planId) return;
    setBusy(true);
    setError(null);
    setVerificationSteps([
      { id: 'asn', label: 'Creating ASN in WMS', status: 'in_progress' },
      { id: 'labels', label: 'Preparing labels', status: 'pending' },
    ]);
    try {
      const res = await createASN(planId);
      if (res.asn?.id) setAsnId(res.asn.id);
      if (res.plan?.items) setPlanItemsWithWms(res.plan.items);
      setVerificationSteps([
        { id: 'asn', label: 'ASN created', status: 'success', detail: res.asn?.poNo || 'Created' },
        { id: 'labels', label: 'Labels', status: prepServicesOnly ? 'pending' : 'success', detail: prepServicesOnly ? 'FBA/FBW flow for labels' : 'DTC – no marketplace labels' },
      ]);
      setCurrentSection(5);
      setShowVerification(true);
    } catch (e: any) {
      setVerificationSteps([
        { id: 'asn', label: 'Creating ASN in WMS', status: 'error', detail: e?.message },
        { id: 'labels', label: 'Preparing labels', status: 'pending' },
      ]);
      setError(e?.message || 'Failed to create ASN');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadAsnLabel = async () => {
    if (!asnId) return;
    try {
      const blob = await fetchAsnLabelBlob(asnId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ASN-label.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to download ASN PDF: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleDownloadItemBarcode = async (sku: string, wmsItemId: string) => {
    if (!asnId) return;
    try {
      const blob = await fetchItemBarcodeBlob(asnId, wmsItemId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SKU-barcode-${sku}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to download barcode: ' + (err?.message || 'Unknown error'));
    }
  };

  useEffect(() => {
    if (planId) {
      void fetchEstimatedCost(planId)
        .then((c) => setEstimatedCost({
          total: c.total,
          perUnit: c.perUnit,
          breakdown: c.breakdown,
          dueToday: c.dueToday ?? previewDueToday(c.pricingPreview),
          feeTimingNotice: c.feeTimingNotice || c.pricingPreview?.feeTimingNotice,
          confidence: c.confidence ?? c.pricingPreview?.confidence,
          blockers: c.blockers || c.pricingPreview?.blockers || [],
          pricingPreview: c.pricingPreview,
        }))
        .catch(() => setEstimatedCost(null));
    }
  }, [planId]);

  useEffect(() => {
    if (!asnId) {
      if (asnPdfBlobUrlRef.current) {
        URL.revokeObjectURL(asnPdfBlobUrlRef.current);
        asnPdfBlobUrlRef.current = null;
      }
      setAsnPdfPreviewUrl(null);
      setAsnPdfError(null);
      return;
    }
    setAsnPdfError(null);
    void fetchAsnLabelBlob(asnId)
      .then((blob) => {
        if (asnPdfBlobUrlRef.current) URL.revokeObjectURL(asnPdfBlobUrlRef.current);
        const url = URL.createObjectURL(blob);
        asnPdfBlobUrlRef.current = url;
        setAsnPdfPreviewUrl(url);
      })
      .catch((err) => {
        setAsnPdfError(err?.message || 'Failed to load ASN PDF');
      });
    return () => {
      if (asnPdfBlobUrlRef.current) {
        URL.revokeObjectURL(asnPdfBlobUrlRef.current);
        asnPdfBlobUrlRef.current = null;
      }
    };
  }, [asnId]);

  useEffect(() => {
    if (currentSection === 2 && prepServicesOnly === true && items.length > 0) {
      const needsRelabeling = items.some(
        (it) => (it.quantity ?? 0) > 0 && !(it.labRequirements?.services ?? []).some((s) => s.type === 'relabeling')
      );
      if (needsRelabeling) {
        setItems((prev) =>
          prev.map((it) => {
            if ((it.quantity ?? 0) <= 0) return it;
            const svcs = it.labRequirements?.services ?? [];
            if (svcs.some((s) => s.type === 'relabeling')) return it;
            return {
              ...it,
              labRequirements: { ...it.labRequirements, services: [...svcs, { type: 'relabeling' as const }] },
            };
          })
        );
      }
    }
  }, [currentSection, prepServicesOnly, items.length]);

  useEffect(() => {
    if (hasCompletedGate && shipFromLocationId && !planId) {
      setWarehousePreview('loading');
      void fetchClosestFacilityPreview(shipFromLocationId)
        .then((r) =>
          setWarehousePreview(
            r.facility || r.shipFromAddress
              ? {
                  name: r.facility?.name ?? '—',
                  code: r.facility?.code,
                  address: r.facility?.address
                    ? {
                        addressLine1: r.facility.address.addressLine1,
                        city: r.facility.address.city,
                        stateOrProvinceCode: r.facility.address.stateOrProvinceCode,
                        postalCode: r.facility.address.postalCode,
                        countryCode: r.facility.address.countryCode,
                        lat: r.facility.address.lat,
                        long: r.facility.address.long,
                      }
                    : undefined,
                  shipFromAddress: r.shipFromAddress,
                  distanceMiles: r.distanceMiles ?? undefined,
                }
              : null
          )
        )
        .catch(() => setWarehousePreview(null));
    } else if (planId) {
      setWarehousePreview(null);
    } else {
      setWarehousePreview(null);
    }
  }, [hasCompletedGate, shipFromLocationId, planId]);

  useEffect(() => {
    if (!hasCompletedGate || !shipFromLocationId || planId) {
      setEstimateServiceFees(null);
      return;
    }
    const validItems = items.filter((i) => (i.quantity ?? 0) > 0);
    if (validItems.length === 0) {
      setEstimateServiceFees(null);
      return;
    }
    setEstimateServiceFees('loading');
    const payload = {
      shipFromLocationId,
      items: validItems.map((i) => ({
        sku: i.sku,
        quantity: i.quantity,
        boxCount: i.boxCount,
        labRequirements: i.labRequirements,
      })),
      prepServicesOnly: prepServicesOnly ?? false,
      marketplaceType: prepServicesOnly ? marketplaceType : undefined,
    };
    fetchEstimateServiceFees(payload)
      .then((r) => setEstimateServiceFees({
        total: r.total,
        perUnit: r.perUnit,
        lineItems: r.lineItems,
        warehouseCode: r.warehouseCode,
        dueToday: r.dueToday ?? previewDueToday(r.pricingPreview),
        feeTimingNotice: r.feeTimingNotice || r.pricingPreview?.feeTimingNotice,
        confidence: r.confidence ?? r.pricingPreview?.confidence,
        blockers: r.blockers || r.pricingPreview?.blockers || [],
        pricingPreview: r.pricingPreview,
        source: r.source,
      }))
      .catch(() => setEstimateServiceFees(null));
  }, [hasCompletedGate, shipFromLocationId, planId, items, prepServicesOnly, marketplaceType]);

  if (!isOpen) return null;

  // Pre-entry gate: supplier + marketplace (Amazon/Walmart or DTC)
  if (!hasCompletedGate) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Create Shipment Plan" size="full">
        <div className="sta-workflow-container" style={{ maxWidth: 520 }}>
          {error && (
            <div className="alert error" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}
          <h3 style={{ marginBottom: 8 }}>Where is this shipment going?</h3>
          <p className="muted" style={{ marginBottom: 24 }}>
            Select supplier and destination. FBA/FBW enables marketplace APIs.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 12 }}>Supplier</label>
              <input
                type="search"
                placeholder="Search suppliers..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  marginBottom: 12,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                }}
              />
              <div style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', minWidth: 'min-content' }}>
                {suppliers
                  .filter((s) => !supplierSearch.trim() || s.name.toLowerCase().includes(supplierSearch.trim().toLowerCase()))
                  .map((s) => {
                  const selected = supplierId === s.id;
                  const loc = locations.find((l: any) => String(l.supplierId) === String(s.id));
                  const addr = loc?.address as { city?: string; stateOrProvinceCode?: string } | undefined;
                  const addrSnippet = addr ? [addr.city, addr.stateOrProvinceCode].filter(Boolean).join(', ') : '';
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSupplierId(s.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 4,
                        padding: 12,
                        minWidth: 140,
                        flexShrink: 0,
                        border: `1px solid ${selected ? 'var(--accent, #2563eb)' : 'var(--border)'}`,
                        borderRadius: 8,
                        background: selected ? 'color-mix(in srgb, var(--accent, #2563eb) 10%, var(--surface))' : 'var(--surface)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                      {addrSnippet && (
                        <span className="muted" style={{ fontSize: 11 }}>{addrSnippet}</span>
                      )}
                    </button>
                  );
                })}
                </div>
              </div>
            </div>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 12 }}>Sending to Amazon or Walmart?</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { setPrepServicesOnly(true); setMarketplaceType('FBA'); }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    padding: 16,
                    border: `1px solid ${prepServicesOnly === true && marketplaceType === 'FBA' ? 'var(--accent, #2563eb)' : 'var(--border)'}`,
                    borderRadius: 8,
                    background: prepServicesOnly === true && marketplaceType === 'FBA' ? 'color-mix(in srgb, var(--accent, #2563eb) 10%, var(--surface))' : 'var(--surface)',
                    cursor: 'pointer',
                  }}
                >
                  <ShoppingBag size={24} color={prepServicesOnly === true && marketplaceType === 'FBA' ? 'var(--accent, #2563eb)' : 'var(--muted)'} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Amazon (FBA)</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setPrepServicesOnly(true); setMarketplaceType('FBW'); }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    padding: 16,
                    border: `1px solid ${prepServicesOnly === true && marketplaceType === 'FBW' ? 'var(--accent, #2563eb)' : 'var(--border)'}`,
                    borderRadius: 8,
                    background: prepServicesOnly === true && marketplaceType === 'FBW' ? 'color-mix(in srgb, var(--accent, #2563eb) 10%, var(--surface))' : 'var(--surface)',
                    cursor: 'pointer',
                  }}
                >
                  <Store size={24} color={prepServicesOnly === true && marketplaceType === 'FBW' ? 'var(--accent, #2563eb)' : 'var(--muted)'} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Walmart (FBW)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrepServicesOnly(false)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    padding: 16,
                    border: `1px solid ${prepServicesOnly === false ? 'var(--accent, #2563eb)' : 'var(--border)'}`,
                    borderRadius: 8,
                    background: prepServicesOnly === false ? 'color-mix(in srgb, var(--accent, #2563eb) 10%, var(--surface))' : 'var(--surface)',
                    cursor: 'pointer',
                  }}
                >
                  <Truck size={24} color={prepServicesOnly === false ? 'var(--accent, #2563eb)' : 'var(--muted)'} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>DTC</span>
                </button>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <button
                className="button-primary"
                style={{ padding: '10px 24px' }}
                onClick={() => {
                  setError(null);
                  if (!supplierId) {
                    setError('Select a supplier.');
                    return;
                  }
                  if (prepServicesOnly === null) {
                    setError('Select a destination (Amazon, Walmart, or DTC).');
                    return;
                  }
                  setHasCompletedGate(true);
                }}
                disabled={!supplierId || prepServicesOnly === null}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Shipment Plan"
      size="full"
    >
      <div style={{ display: 'flex', gap: 0, minHeight: 0, flex: 1 }}>
        <div className="sta-workflow-container" style={{ flex: 1, minWidth: 0 }}>
        {error && (
          <div className="alert error" style={{ marginBottom: 0 }}>
            {error}
          </div>
        )}

        <div className="sta-workflow-strip sta-summary-bar" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Row 1: Ship From | Ship To (with miles under Ship To) */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>Ship from</span>
              <div style={{ fontWeight: 600 }}>{supplierId ? shipFromText : '—'}</div>
            </div>
            <div>
              <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>Ship to</span>
              <div style={{ fontWeight: 600 }}>
                {planId ? 'Assigned' : warehousePreview === 'loading' ? 'Finding closest…' : warehousePreview ? shipToFullAddress(warehousePreview) : 'No warehouse found'}
              </div>
              {!planId && warehousePreview && warehousePreview !== 'loading' && warehousePreview.distanceMiles != null && (
                <span className="muted" style={{ fontSize: 11, display: 'block' }}>{warehousePreview.distanceMiles.toFixed(1)} mi from ship-from</span>
              )}
              {!planId && warehousePreview === null && hasCompletedGate && shipFromLocationId && (
                <span className="muted" style={{ fontSize: 11, display: 'block' }}>Add facilities in Settings</span>
              )}
            </div>
          </div>
          {/* Row 2: Units, Boxes, Workflow, FBA fields */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>Units</span>
              <div style={{ fontWeight: 600 }}>{totalUnits}</div>
            </div>
            <div>
              <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>Boxes</span>
              <div style={{ fontWeight: 600 }}>{totalBoxes}</div>
            </div>
            <div>
              <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>Workflow</span>
              <div style={{ fontWeight: 600 }}>{prepServicesOnly === true ? marketplaceType : prepServicesOnly === false ? 'DTC' : '—'}</div>
            </div>
            {prepServicesOnly === true && (
              <>
                <div>
                  <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>Amazon responses</span>
                  <div style={{ fontWeight: 600 }}>—</div>
                </div>
                <div>
                  <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>Inbound plan</span>
                  <div style={{ fontWeight: 600 }}>—</div>
                </div>
                <div>
                  <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>Status</span>
                  <div style={{ fontWeight: 600 }}>—</div>
                </div>
                <div>
                  <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>Placement options</span>
                  <div style={{ fontWeight: 600 }}>—</div>
                </div>
                <div>
                  <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>Confirmed shipments</span>
                  <div style={{ fontWeight: 600 }}>—</div>
                </div>
              </>
            )}
            {asnId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginLeft: 'auto' }}>
                <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>ASN document</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span title="Download" style={{ display: 'flex', alignItems: 'center', color: 'var(--accent, #2563eb)' }}><Download size={16} /></span>
                  <span style={{ opacity: 0.6 }}>→</span>
                  <span title="Print" style={{ display: 'flex', alignItems: 'center', color: 'var(--muted)' }}><Printer size={16} /></span>
                  <span style={{ opacity: 0.6 }}>→</span>
                  <span title="Add to shipment" style={{ display: 'flex', alignItems: 'center', color: 'var(--muted)' }}><Package size={16} /></span>
                </div>
                <button
                  type="button"
                  className="button-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13 }}
                  onClick={handleDownloadAsnLabel}
                >
                  <Download size={14} />
                  Download ASN
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Step 1: Selected items summary */}
        <section className="sta-section-card">
          <button
            type="button"
            className={`sta-section-toggle ${currentSection === 1 ? 'active' : ''}`}
            onClick={() => setCurrentSection(1)}
          >
            <span className="sta-section-index">1</span>
            <span>
              <strong>Confirm Items for this Shipment</strong>
              <small>{items.length} item(s) from catalog</small>
            </span>
          </button>
          {currentSection === 1 && (
            <div className="sta-section-body">
              {items.length === 0 ? (
                <p className="muted">No items. Select products from Catalog first, then click Create Shipment Plan.</p>
              ) : (
                <>
                {items.length > 6 && (
                  <div style={{ marginBottom: 12 }}>
                    <input
                      type="text"
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      placeholder="Search items by SKU, title, or ASIN…"
                      style={{
                        width: '100%', height: 34, padding: '0 12px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--bg, #fff)', fontSize: 13,
                      }}
                    />
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
                  {items
                    .filter((it) => {
                      const q = itemSearch.trim().toLowerCase();
                      if (!q) return true;
                      return `${it.sku || ''} ${(it as any).title || ''} ${(it as any).asin || ''}`.toLowerCase().includes(q);
                    })
                    .map((it, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: 16,
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        background: 'var(--surface)',
                      }}
                    >
                      <div
                        style={{
                          width: 100,
                          height: 100,
                          borderRadius: 8,
                          overflow: 'hidden',
                          background: 'var(--bg-muted, #f4f4f4)',
                          flexShrink: 0,
                          marginBottom: 12,
                        }}
                      >
                        {(it as any).imageUrl ? (
                          <img
                            src={(it as any).imageUrl}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--muted)',
                              fontSize: 12,
                            }}
                          >
                            —
                          </div>
                        )}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, textAlign: 'center', marginBottom: 4 }}>{it.sku}</div>
                      <div
                        className="muted"
                        style={{
                          fontSize: 12,
                          textAlign: 'center',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                          marginBottom: 8,
                        }}
                      >
                        {it.title || '—'}
                      </div>
                      <div style={{ fontWeight: 500 }}>Qty: {it.quantity != null ? it.quantity : '—'}</div>
                    </div>
                  ))}
                </div>
                </>
              )}
              <div className="fba-stage-footer">
                <div className="muted">{items.length} item(s)</div>
                <button
                  className="button-primary"
                  onClick={() => setCurrentSection(2)}
                  disabled={!supplierId || items.length === 0 || prepServicesOnly === null}
                >
                  Next: Receiving details
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Step 4: Transportation details (template, boxes, exp) */}
        <section className="sta-section-card">
          <button
            type="button"
            className={`sta-section-toggle ${currentSection === 2 ? 'active' : ''}`}
            onClick={() => setCurrentSection(2)}
          >
            <span className="sta-section-index">2</span>
            <span>
              <strong>Receiving Details</strong>
              <small>Template per SKU, add-ons, exp date</small>
            </span>
          </button>
          {currentSection === 2 && (
            <div className="sta-section-body" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: addonsForItemIdx != null ? 'row' : 'column', gap: 0 }}>
                <div style={{ flex: addonsForItemIdx != null ? 1 : 'none', minWidth: 0 }}>
                  <p className="muted" style={{ marginBottom: 16 }}>
                    Select a template per SKU. Click the + to add LAB services (add-ons).
                  </p>
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="fba-selection-card"
                  style={{ marginBottom: 16, padding: 16, border: '1px solid var(--border)', borderRadius: 8, display: 'flex', gap: 16, alignItems: 'flex-start' }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: 'var(--bg-muted, #f4f4f4)',
                      flexShrink: 0,
                    }}
                  >
                    {(it as any).imageUrl ? (
                      <img
                        src={(it as any).imageUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--muted)',
                          fontSize: 11,
                        }}
                      >
                        —
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                  <div style={{ fontWeight: 600, marginBottom: 12 }}>{it.sku} – {it.title || '—'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: 12 }}>Template</label>
                      <select
                        value={it.templateId || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__manage__') {
                            setTemplatePopupForItemIdx(idx);
                            setTemplatePopupOpen(true);
                            return;
                          }
                          const t = templates.find((x) => x.id === v);
                          if (t) {
                            const boxCount = it.boxCount ?? 1;
                            updateItem(idx, {
                              templateId: t.id,
                              unitsPerBox: t.unitsPerBox,
                              weightPerBox: t.weightPerBox,
                              // Keep the catalog-derived per-unit weight/dims when the template
                              // doesn't carry them, so rate shopping still has physical attributes.
                              weightPerUnit: t.weightPerUnit ?? it.weightPerUnit,
                              boxCount,
                              quantity: boxCount * t.unitsPerBox,
                              dimensions: t.dimensions ?? it.dimensions,
                            });
                          }
                        }}
                        style={{ width: '100%', maxWidth: 280, padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                      >
                        <option value="">Select template</option>
                        {templates
                          .filter((t) => {
                            const d = t.dimensions;
                            return d && d.length != null && d.width != null && d.height != null;
                          })
                          .map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        <option value="__manage__">— Manage templates —</option>
                      </select>
                      {(() => {
                        const cube = itemCubicFeet(it.dimensions);
                        const tier = sizeTier(it.dimensions);
                        const perUnitWeight = it.weightPerUnit ?? (it.weightPerBox != null && it.unitsPerBox ? it.weightPerBox / it.unitsPerBox : null);
                        const hasSpecs = it.weightPerBox != null || perUnitWeight != null || cube != null;
                        if (!hasSpecs) return null;
                        return (
                          <div
                            style={{
                              marginTop: 12,
                              padding: 12,
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              fontSize: 13,
                            }}
                          >
                            <strong style={{ display: 'block', marginBottom: 6 }}>Item specs</strong>
                            <div className="muted">
                              {it.unitsPerBox != null && <>{it.unitsPerBox} units/box · </>}
                              {perUnitWeight != null ? `${perUnitWeight.toFixed(2)} lbs/unit` : `${it.weightPerBox ?? 0} lbs/box`}
                              {(it.dimensions?.length ?? it.dimensions?.width ?? it.dimensions?.height) != null && (
                                <> · {[it.dimensions?.length, it.dimensions?.width, it.dimensions?.height].filter((n) => n != null).join('×')} in</>
                              )}
                              {cube != null && <> · {cube} ft³/unit</>}
                              {tier && <> · <span style={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--text)' }}>{tier}</span></>}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: 12 }}>Boxes</label>
                      <input
                        type="number"
                        min={1}
                        value={it.boxCount ?? ''}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 1;
                          const upb = it.unitsPerBox ?? 1;
                          updateItem(idx, { boxCount: v, quantity: v * upb });
                        }}
                        style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                        disabled={!it.templateId}
                      />
                    </div>
                    <div>
                      <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: 12 }}>Exp date</label>
                      <input
                        type="date"
                        value={it.expDate || ''}
                        onChange={(e) => updateItem(idx, { expDate: e.target.value || undefined })}
                        style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                      />
                    </div>
                    {it.templateId && (it.boxCount ?? 0) > 0 && (it.unitsPerBox ?? 0) > 0 && (
                      <div style={{ gridColumn: '1 / -1', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                        <strong>Total units: {(it.boxCount ?? 0) * (it.unitsPerBox ?? 0)}</strong>
                      </div>
                    )}
                  </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddonsForItemIdx(addonsForItemIdx === idx ? null : idx)}
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      background: addonsForItemIdx === idx ? 'color-mix(in srgb, var(--accent, #2563eb) 15%, var(--surface))' : 'var(--surface)',
                      cursor: 'pointer',
                      color: addonsForItemIdx === idx ? 'var(--accent, #2563eb)' : 'var(--muted)',
                      alignSelf: 'flex-start',
                      marginLeft: 'auto',
                    }}
                    title="Add-ons"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              ))}
                </div>
                <AddonsSidePanel
                  isOpen={addonsForItemIdx != null}
                  onClose={() => setAddonsForItemIdx(null)}
                  itemIndex={addonsForItemIdx ?? 0}
                  itemSku={items[addonsForItemIdx ?? 0]?.sku ?? ''}
                  itemTitle={items[addonsForItemIdx ?? 0]?.title}
                  itemQuantity={items[addonsForItemIdx ?? 0]?.quantity}
                  services={items[addonsForItemIdx ?? 0]?.labRequirements?.services ?? []}
                  relabelingRequired={prepServicesOnly === true}
                  notes={items[addonsForItemIdx ?? 0]?.labRequirements?.instructions ?? ''}
                  expenseBreakdown={
                    estimateServiceFees && estimateServiceFees !== 'loading'
                      ? {
                          total: estimateServiceFees.total,
                          lineItems: (estimateServiceFees.lineItems || []).map((l) => ({ label: l.label, amount: l.amount })),
                        }
                      : undefined
                  }
                  onNotesChange={(notes) => {
                    if (addonsForItemIdx != null) {
                      updateItem(addonsForItemIdx, {
                        labRequirements: {
                          ...items[addonsForItemIdx]?.labRequirements,
                          instructions: notes,
                        },
                      });
                    }
                  }}
                  onUpdate={(services) => {
                    if (addonsForItemIdx != null) {
                      updateItem(addonsForItemIdx, {
                        labRequirements: {
                          ...items[addonsForItemIdx]?.labRequirements,
                          services,
                        },
                      });
                    }
                  }}
                />
              </div>
              <div className="fba-stage-footer" style={{ marginTop: 24 }}>
                <button className="button-secondary" onClick={() => setCurrentSection(1)}>
                  Back
                </button>
                <button
                  className="button-primary"
                  onClick={() => setCurrentSection(3)}
                  disabled={items.some((i) => (i.quantity ?? 0) <= 0 || (i.boxCount ?? 0) <= 0 || (i.unitsPerBox ?? 0) <= 0)}
                >
                  Next: Options to Ship
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Step 3: Options to Ship */}
        <section className="sta-section-card">
          <button
            type="button"
            className={`sta-section-toggle ${currentSection === 3 ? 'active' : ''}`}
            onClick={() => setCurrentSection(3)}
          >
            <span className="sta-section-index">3</span>
            <span>
              <strong>Options to Ship</strong>
              <small>Parcel, Pallet, or Not required</small>
            </span>
          </button>
          {currentSection === 3 && (
            <div className="sta-section-body" style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
              <p className="muted" style={{ marginBottom: 24 }}>
                Choose how to ship to our warehouse. Select delivery speed and price.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                {/* Parcel */}
                <button
                  type="button"
                  onClick={() => setDeliveryOption('parcel')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: 24,
                    border: `2px solid ${deliveryOption === 'parcel' ? 'var(--accent, #2563eb)' : 'var(--border)'}`,
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: deliveryOption === 'parcel' ? 'color-mix(in srgb, var(--accent, #2563eb) 8%, var(--surface))' : 'var(--surface)',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                >
                  <div style={{ width: 72, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: deliveryOption === 'parcel' ? 'var(--accent, #2563eb)' : 'var(--muted)' }}>
                    <Package size={48} strokeWidth={1.5} />
                  </div>
                  <strong style={{ fontSize: 16 }}>Parcel</strong>
                  <span className="muted" style={{ fontSize: 13, marginTop: 4, display: 'block' }}>LTL / courier</span>
                  <div style={{ marginTop: 16, width: '100%', display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>2 day</span><span>${42}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>3 day</span><span>${32}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>7 day</span><span>${22}</span></div>
                  </div>
                </button>
                {/* Pallet */}
                <button
                  type="button"
                  onClick={() => setDeliveryOption('pallet')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: 24,
                    border: `2px solid ${deliveryOption === 'pallet' ? 'var(--accent, #2563eb)' : 'var(--border)'}`,
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: deliveryOption === 'pallet' ? 'color-mix(in srgb, var(--accent, #2563eb) 8%, var(--surface))' : 'var(--surface)',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                >
                  <div style={{ width: 72, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: deliveryOption === 'pallet' ? 'var(--accent, #2563eb)' : 'var(--muted)' }}>
                    <Boxes size={48} strokeWidth={1.5} />
                  </div>
                  <strong style={{ fontSize: 16 }}>Pallet</strong>
                  <span className="muted" style={{ fontSize: 13, marginTop: 4, display: 'block' }}>Truck FTL</span>
                  <div style={{ marginTop: 16, width: '100%', display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>2 day</span><span>${128}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>3 day</span><span>${98}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>7 day</span><span>${68}</span></div>
                  </div>
                </button>
              </div>
              <div className="fba-stage-footer" style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <button className="button-secondary" onClick={() => setCurrentSection(2)}>Back</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setDeliveryOption('none')}
                    style={{
                      padding: '8px 16px',
                      border: `1px solid ${deliveryOption === 'none' ? 'var(--accent, #2563eb)' : 'var(--border)'}`,
                      borderRadius: 8,
                      background: deliveryOption === 'none' ? 'color-mix(in srgb, var(--accent, #2563eb) 8%, var(--surface))' : 'transparent',
                      cursor: 'pointer',
                      fontSize: 14,
                      color: deliveryOption === 'none' ? 'var(--accent, #2563eb)' : 'inherit',
                    }}
                  >
                    Not Required
                  </button>
                  <button
                    className="button-primary"
                    onClick={() => setCurrentSection(4)}
                    disabled={deliveryOption === null}
                  >
                    Next: Review & create
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Step 4: Review and Create */}
        <section className="sta-section-card">
          <button
            type="button"
            className={`sta-section-toggle ${currentSection === 4 ? 'active' : ''}`}
            onClick={() => setCurrentSection(4)}
          >
            <span className="sta-section-index">4</span>
            <span>
              <strong>Review and Create</strong>
              <small>Map, summary, create plan</small>
            </span>
          </button>
          {currentSection === 4 && !planId && (
            <div className="sta-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div className="fba-inline-summary-bar" style={{ marginBottom: 16 }}>
                <span className="pill subtle">Items: {items.length}</span>
                <span className="pill subtle">Units: {totalUnits}</span>
                <span className="pill subtle">Boxes: {totalBoxes}</span>
                <span className="pill subtle">Est. weight: {totalWeight > 0 ? `${totalWeight.toFixed(2)} lbs` : '—'}</span>
                <span className="pill subtle">Prep: {prepServicesOnly ? marketplaceType : 'DTC'}</span>
                <span className="pill subtle">Ship from: {shipFromText}</span>
                <span className="pill subtle">Ship to: {shipToText}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', gap: 16, minHeight: 320 }}>
                <div style={{ flex: 1, minHeight: 320, minWidth: 0 }}>
                  <ShipmentMapView
                    key={`map-${shipFromLocationId}`}
                    pins={mapPins}
                    fitBounds
                    style={{ width: '100%', height: 320, minHeight: 320, marginBottom: 0 }}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Flow: 1 → 2</div>
                  <p className="muted" style={{ margin: '0 0 8px', fontSize: 12 }}>
                    {shipFromText} → {shipToFullAddress(warehousePreview)}
                  </p>
                  <div style={{ overflow: 'auto', flex: 1, border: '1px solid var(--border)', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-muted, #f4f4f4)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>SKU</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Units</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Boxes</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Services</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.filter((i) => (i.quantity ?? 0) > 0).map((it, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 12px' }}>{it.sku}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>{it.quantity ?? 0}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>{it.boxCount ?? 0}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12 }}>
                              {(it.labRequirements?.services ?? []).map((s) => (
                                <span key={s.type} style={{ marginRight: 6 }}>
                                  {(s.type === 'bundling' || s.type === 'kitting') && s.bundleQuantity
                                    ? `${s.type} ×${s.bundleQuantity}`
                                    : s.type}
                                </span>
                              ))}
                              {((it.labRequirements?.services ?? []).length === 0) && '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {deliveryOption && deliveryOption !== 'none' && (
                    <div style={{ fontSize: 12, padding: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
                      Ship via: {deliveryOption === 'parcel' ? 'Parcel (LTL/courier)' : 'Pallet (FTL)'}
                    </div>
                  )}
                  {itemsMissingDims.length > 0 && (
                    <div style={{ marginTop: 12, padding: 12, background: 'var(--amber-soft, #fef3c7)', border: '1px solid var(--amber, #f59e0b)', borderRadius: 8, fontSize: 12.5 }}>
                      <strong style={{ color: 'var(--amber-text, #92400e)' }}>Enter dimensions &amp; weight to rate-shop these SKUs.</strong>
                      <div style={{ color: 'var(--amber-text, #92400e)', marginTop: 2, marginBottom: 8 }}>
                        We never estimate size — accurate L×W×H and weight are required for a real shipping rate. Saved back to the catalog for next time.
                      </div>
                      {itemsMissingDims.map((mi) => {
                        const idx = items.findIndex((x) => x === mi);
                        const d = mi.dimensions || {};
                        const numOrUndef = (v: string) => (v === '' ? undefined : Number(v));
                        return (
                          <div key={mi.sku} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                            <span className="mono" style={{ minWidth: 120, fontWeight: 600, fontSize: 12 }}>{mi.sku}</span>
                            <input type="number" min={0} step="0.01" placeholder="L in" value={d.length ?? ''} onChange={(e) => updateItem(idx, { dimensions: { ...d, length: numOrUndef(e.target.value) } })} style={{ width: 66, padding: 5, borderRadius: 6, border: '1px solid var(--border)' }} />
                            <input type="number" min={0} step="0.01" placeholder="W in" value={d.width ?? ''} onChange={(e) => updateItem(idx, { dimensions: { ...d, width: numOrUndef(e.target.value) } })} style={{ width: 66, padding: 5, borderRadius: 6, border: '1px solid var(--border)' }} />
                            <input type="number" min={0} step="0.01" placeholder="H in" value={d.height ?? ''} onChange={(e) => updateItem(idx, { dimensions: { ...d, height: numOrUndef(e.target.value) } })} style={{ width: 66, padding: 5, borderRadius: 6, border: '1px solid var(--border)' }} />
                            <input type="number" min={0} step="0.01" placeholder="lbs" value={mi.weightPerUnit ?? ''} onChange={(e) => updateItem(idx, { weightPerUnit: numOrUndef(e.target.value) })} style={{ width: 66, padding: 5, borderRadius: 6, border: '1px solid var(--border)' }} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="fba-stage-footer" style={{ marginTop: 'auto', paddingTop: 16 }}>
                    <button className="button-secondary" onClick={() => setCurrentSection(3)}>Back</button>
                    <button className="button-primary" onClick={handleCreate} disabled={busy || itemsMissingDims.length > 0} title={itemsMissingDims.length > 0 ? 'Enter dimensions & weight for all SKUs first' : undefined}>
                      {busy ? 'Creating...' : 'Create plan'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {currentSection === 4 && planId && (
            <div className="sta-section-body">
              <p className="muted" style={{ marginBottom: 16 }}>
                Shipment plan created. Continue to Acknowledgement to confirm and create ASN.
              </p>
              <div className="fba-stage-footer">
                <button className="button-primary" onClick={() => setCurrentSection(4.5)}>
                  Continue to Acknowledgement
                </button>
                <Link href={`/shipment-plans/${planId}`} className="button-secondary" onClick={onClose}>View plan</Link>
              </div>
            </div>
          )}
        </section>

        {/* Step 4.5: Acknowledgement */}
        <section className="sta-section-card">
          <button
            type="button"
            className={`sta-section-toggle ${currentSection === 4.5 ? 'active' : ''}`}
            onClick={() => planId && setCurrentSection(4.5)}
          >
            <span className="sta-section-index">4.5</span>
            <span>
              <strong>Acknowledgement</strong>
              <small>Confirm and validate plan</small>
            </span>
          </button>
          {currentSection === 4.5 && planId && (
            <div className="sta-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="fba-inline-summary-bar" style={{ flexWrap: 'wrap' }}>
                <span className="pill subtle">Ship from: {shipFromText}</span>
                <span className="pill subtle">Ship to: {shipToText}</span>
                <span className="pill subtle">Items: {items.filter((i) => (i.quantity ?? 0) > 0).length}</span>
                <span className="pill subtle">Workflow: {prepServicesOnly ? marketplaceType : 'DTC'}</span>
              </div>
              {estimatedCost && (
                <div className="fba-summary-panel">
                  <div className="fba-summary-metric">
                    <span>Est. total</span>
                    <strong>{money(estimatedCost.total)}</strong>
                  </div>
                  <div className="fba-summary-metric">
                    <span>Per unit</span>
                    <strong>{money(estimatedCost.perUnit)}</strong>
                  </div>
                  <div className="fba-summary-metric">
                    <span>Due today</span>
                    <strong>{money(estimatedCost.dueToday ?? previewDueToday(estimatedCost.pricingPreview))}</strong>
                  </div>
                </div>
              )}
              <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: 13 }}>
                <p style={{ marginBottom: 12, fontWeight: 600 }}>Please review and confirm:</p>
                <p style={{ marginBottom: 16 }}>I confirm that all information provided is accurate. In the event we identify that information was intentionally misrepresented (not a mistake), we will take action against servicing the account.</p>
                <p style={{ marginBottom: 8 }}>Warehouse fees are billed when services are performed. Due today is $0.00 unless supplier pickup or paid transportation is selected.</p>
                <p style={{ marginBottom: 0 }}>Invoicing will cover: (a) individual fulfillment of orders, (b) relevant services to inventory, and (c) services related to this shipment plan. These details are linked to this shipment plan and will appear in your Invoices.</p>
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={acknowledgedAgreed}
                  onChange={(e) => setAcknowledgedAgreed(e.target.checked)}
                  style={{ marginTop: 3, flexShrink: 0 }}
                />
                <span>I have read and agree to the above terms.</span>
              </label>
              <div className="fba-stage-footer" style={{ marginTop: 'auto' }}>
                <button className="button-secondary" onClick={() => setCurrentSection(4)}>Back</button>
                <button
                  className="button-primary"
                  onClick={handleCreateASN}
                  disabled={busy || !acknowledgedAgreed}
                >
                  {busy ? 'Creating ASN...' : 'Confirm and Create ASN'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Step 5: PDFs / ASN created */}
        <section className="sta-section-card">
          <button
            type="button"
            className={`sta-section-toggle ${currentSection === 5 ? 'active' : ''}`}
            onClick={() => setCurrentSection(5)}
          >
            <span className="sta-section-index">5</span>
            <span>
              <strong>PDFs (ASN etc.)</strong>
              <small>Download documents</small>
            </span>
          </button>
          {currentSection === 5 && planId && (
            <div className="sta-section-body">
              {showVerification && verificationSteps.length > 0 ? (
                <>
                  <CreationVerificationScreen
                    steps={verificationSteps}
                    allSuccess={verificationSteps.every((s) => s.status !== 'error')}
                    errors={verificationSteps.filter((s) => s.status === 'error').map((s) => s.detail || s.label)}
                    planId={planId}
                    onClose={onClose}
                  />
                  <div style={{ marginTop: 24, marginBottom: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
                    <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 14 }}>ASN document — next steps</p>
                    <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>Download the ASN label, print it, and include it with your shipment for warehouse receiving.</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: 'color-mix(in srgb, var(--accent, #2563eb) 15%, transparent)' }}>
                          <Download size={18} color="var(--accent, #2563eb)" />
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>Download</span>
                      </div>
                      <span style={{ opacity: 0.5 }}>→</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: 'var(--bg-muted, #f4f4f4)' }}>
                          <Printer size={18} color="var(--muted)" />
                        </span>
                        <span className="muted" style={{ fontSize: 13 }}>Print</span>
                      </div>
                      <span style={{ opacity: 0.5 }}>→</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: 'var(--bg-muted, #f4f4f4)' }}>
                          <Package size={18} color="var(--muted)" />
                        </span>
                        <span className="muted" style={{ fontSize: 13 }}>Add to shipment</span>
                      </div>
                      <button
                        type="button"
                        className="button-primary"
                        style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                        onClick={handleDownloadAsnLabel}
                      >
                        <Download size={16} />
                        Download ASN label PDF
                      </button>
                    </div>
                  </div>
                  <h4 style={{ marginBottom: 12 }}>ASN document preview</h4>
                  {asnId && (
                    <div style={{ marginBottom: 16 }}>
                      {asnPdfError ? (
                        <div className="alert error" style={{ marginBottom: 8 }}>{asnPdfError}</div>
                      ) : asnPdfPreviewUrl ? (
                        <iframe
                          src={`${asnPdfPreviewUrl}#view=FitH`}
                          title="ASN PDF preview"
                          style={{ width: '100%', height: 400, border: '1px solid var(--border)', borderRadius: 8 }}
                        />
                      ) : (
                        <p className="muted" style={{ padding: 24 }}>Loading PDF preview…</p>
                      )}
                    </div>
                  )}
                  <h4 style={{ marginTop: 16, marginBottom: 8 }}>Item barcode labels</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {asnId && planItemsWithWms.filter((i: any) => i.wmsItemId).map((i: any) => {
                      const itemName = (i as any).title || (i as any).itemName || i.sku;
                      const wmsSku = (i as any).wmsSku || i.sku;
                      const warehouseName = warehousePreview && warehousePreview !== 'loading' ? (warehousePreview.name || warehousePreview.code || 'warehouse') : 'warehouse';
                      return (
                        <div key={i.sku} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <span className="muted" style={{ fontSize: 13 }}>
                            <strong>{itemName}</strong> has SKU <code>{wmsSku}</code> in {warehouseName}
                          </span>
                          <button
                            type="button"
                            className="button-secondary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                            onClick={() => handleDownloadItemBarcode(i.sku, i.wmsItemId)}
                          >
                            Download barcode
                          </button>
                        </div>
                      );
                    })}
                    {asnId && planItemsWithWms.filter((i: any) => i.wmsItemId).length === 0 && (
                      <p className="muted" style={{ fontSize: 13 }}>Item barcode PDFs available after WMS items are created.</p>
                    )}
                  </div>
                  {prepServicesOnly && (
                    <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                      <strong>FBA/FBW labels</strong>
                      <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                        Available when FBA/FBW flow is completed in the shipment plan workflow.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="muted" style={{ marginBottom: 16 }}>
                    ASN has been created.
                    {warehousePreview && warehousePreview !== 'loading' && (warehousePreview.code || warehousePreview.name) && (
                      <> Warehouse: {[warehousePreview.code, warehousePreview.name].filter(Boolean).join(' — ')}.</>
                    )}
                    {' '}Your shipment plan is ready.
                  </p>
                  <div style={{ marginBottom: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
                    <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 14 }}>ASN document — next steps</p>
                    <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>Download the ASN label, print it, and include it with your shipment for warehouse receiving.</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: 'color-mix(in srgb, var(--accent, #2563eb) 15%, transparent)' }}>
                          <Download size={18} color="var(--accent, #2563eb)" />
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>Download</span>
                      </div>
                      <span style={{ opacity: 0.5 }}>→</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: 'var(--bg-muted, #f4f4f4)' }}>
                          <Printer size={18} color="var(--muted)" />
                        </span>
                        <span className="muted" style={{ fontSize: 13 }}>Print</span>
                      </div>
                      <span style={{ opacity: 0.5 }}>→</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: 'var(--bg-muted, #f4f4f4)' }}>
                          <Package size={18} color="var(--muted)" />
                        </span>
                        <span className="muted" style={{ fontSize: 13 }}>Add to shipment</span>
                      </div>
                      <button
                        type="button"
                        className="button-primary"
                        style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                        onClick={handleDownloadAsnLabel}
                      >
                        <Download size={16} />
                        Download ASN label PDF
                      </button>
                    </div>
                  </div>
                  <h4 style={{ marginBottom: 12 }}>ASN document preview</h4>
                  {asnId && (
                    <div style={{ marginBottom: 16 }}>
                      {asnPdfError ? (
                        <div className="alert error" style={{ marginBottom: 8 }}>{asnPdfError}</div>
                      ) : asnPdfPreviewUrl ? (
                        <iframe
                          src={`${asnPdfPreviewUrl}#view=FitH`}
                          title="ASN PDF preview"
                          style={{ width: '100%', height: 400, border: '1px solid var(--border)', borderRadius: 8 }}
                        />
                      ) : (
                        <p className="muted" style={{ padding: 24 }}>Loading PDF preview…</p>
                      )}
                    </div>
                  )}
                  <h4 style={{ marginTop: 16, marginBottom: 8 }}>Item barcode labels</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                    {asnId && planItemsWithWms.filter((i: any) => i.wmsItemId).map((i: any) => {
                      const itemName = (i as any).title || (i as any).itemName || i.sku;
                      const wmsSku = (i as any).wmsSku || i.sku;
                      const warehouseName = warehousePreview && warehousePreview !== 'loading' ? (warehousePreview.name || warehousePreview.code || 'warehouse') : 'warehouse';
                      return (
                        <div key={i.sku} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <span className="muted" style={{ fontSize: 13 }}>
                            <strong>{itemName}</strong> has SKU <code>{wmsSku}</code> in {warehouseName}
                          </span>
                          <button
                            type="button"
                            className="button-secondary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                            onClick={() => handleDownloadItemBarcode(i.sku, i.wmsItemId)}
                          >
                            Download barcode
                          </button>
                        </div>
                      );
                    })}
                    {asnId && planItemsWithWms.filter((i: any) => i.wmsItemId).length === 0 && (
                      <p className="muted" style={{ fontSize: 13 }}>Item barcode PDFs available after WMS items are created.</p>
                    )}
                  </div>
                  {prepServicesOnly && (
                      <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                        <strong>FBA/FBW labels</strong>
                        <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>Available when FBA/FBW flow is complete.</p>
                      </div>
                    )}
                  <div className="fba-stage-footer">
                    <Link href={`/shipment-plans/${planId}`} className="button-primary" onClick={onClose}>View plan</Link>
                    <Link href="/shipment-plans" className="button-secondary" onClick={onClose}>Back to list</Link>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <TransportationTemplatePopup
          isOpen={templatePopupOpen}
          onClose={() => {
            setTemplatePopupOpen(false);
            setTemplatePopupForItemIdx(null);
            void fetchTransportationTemplates(supplierId || undefined).then((r) => setTemplates(r.templates));
          }}
          supplierId={supplierId || undefined}
          onSelect={(template) => {
            if (templatePopupForItemIdx != null) {
              const it = items[templatePopupForItemIdx];
              const boxCount = it?.boxCount ?? 1;
              updateItem(templatePopupForItemIdx, {
                templateId: template.id,
                unitsPerBox: template.unitsPerBox,
                weightPerBox: template.weightPerBox,
                weightPerUnit: template.weightPerUnit,
                boxCount,
                quantity: boxCount * template.unitsPerBox,
                dimensions: template.dimensions,
              });
            }
            setTemplatePopupOpen(false);
            setTemplatePopupForItemIdx(null);
            void fetchTransportationTemplates(supplierId || undefined).then((r) => setTemplates(r.templates));
          }}
        />
        </div>

        {/* Estimate sidebar - sticky, viewport-centered when scrolling */}
        {hasCompletedGate && (
          <div
            style={{
              width: 200,
              flexShrink: 0,
              alignSelf: 'flex-start',
              position: 'sticky',
              top: '50%',
              transform: 'translateY(-50%)',
              borderLeft: '1px solid var(--border)',
              padding: 16,
              background: 'var(--surface)',
              maxHeight: 'calc(100vh - 100px)',
              overflowY: 'auto',
            }}
          >
            <h4 style={{ margin: '0 0 12px', fontSize: 13, textTransform: 'uppercase', opacity: 0.8 }}>
              {planId && estimatedCost ? 'Est. cost' : 'Est. service fees'}
            </h4>
            {planId && estimatedCost ? (
              <>
                {Object.entries(estimatedCost.breakdown || {}).map(([key, amount]) => {
                  const label = key === 'boxes' ? 'Box handling' : key === 'units' ? 'Unit processing' : key === 'labeling' ? 'Labeling' : key;
                  return (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        marginBottom: 6,
                        gap: 8,
                      }}
                      >
                        <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
                      <span>{money(amount)}</span>
                    </div>
                  );
                })}
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  <span>Total</span>
                  <span>{money(estimatedCost.total)}</span>
                </div>
                <p className="muted" style={{ marginTop: 4, fontSize: 11 }}>
                  {money(estimatedCost.perUnit)}/unit
                </p>
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 11.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>Due today</span>
                    <span>{money(estimatedCost.dueToday ?? previewDueToday(estimatedCost.pricingPreview))}</span>
                  </div>
                  <p className="muted" style={{ margin: '6px 0 0', lineHeight: 1.35 }}>
                    {estimatedCost.feeTimingNotice || estimatedCost.pricingPreview?.feeTimingNotice || 'Warehouse fees are billed when services are performed.'}
                  </p>
                  {estimatedCost.confidence != null && (
                    <p className="muted" style={{ margin: '6px 0 0' }}>Confidence {Math.round(estimatedCost.confidence * 100)}%</p>
                  )}
                  {estimatedCost.blockers?.slice(0, 3).map((blocker) => (
                    <p key={blocker} style={{ margin: '5px 0 0', color: 'var(--warning, #b45309)' }}>• {blocker}</p>
                  ))}
                </div>
              </>
            ) : (
              <>
                {estimateServiceFees === 'loading' && (
                  <p className="muted" style={{ fontSize: 12 }}>Computing…</p>
                )}
                {estimateServiceFees === null && (
                  <p className="muted" style={{ fontSize: 12 }}>Add items or wait for warehouse</p>
                )}
                {estimateServiceFees != null && estimateServiceFees !== 'loading' && (
                  <>
                    {(estimateServiceFees.lineItems || []).map((line: EstimateServiceFeesLineItem, i: number) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          marginBottom: 6,
                          gap: 8,
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0 }}>{line.label}</span>
                        <span>{money(line.amount)}</span>
                      </div>
                    ))}
                    <div
                      style={{
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                      >
                        <span>Total</span>
                      <span>{money(estimateServiceFees.total)}</span>
                    </div>
                    <p className="muted" style={{ marginTop: 4, fontSize: 11 }}>
                      {money(estimateServiceFees.perUnit)}/unit
                    </p>
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 11.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                        <span>Due today</span>
                        <span>{money(estimateServiceFees.dueToday ?? previewDueToday(estimateServiceFees.pricingPreview))}</span>
                      </div>
                      <p className="muted" style={{ margin: '6px 0 0', lineHeight: 1.35 }}>
                        {estimateServiceFees.feeTimingNotice || estimateServiceFees.pricingPreview?.feeTimingNotice || 'Warehouse fees are billed when services are performed.'}
                      </p>
                      {estimateServiceFees.confidence != null && (
                        <p className="muted" style={{ margin: '6px 0 0' }}>Confidence {Math.round(estimateServiceFees.confidence * 100)}%</p>
                      )}
                      {estimateServiceFees.blockers?.slice(0, 3).map((blocker) => (
                        <p key={blocker} style={{ margin: '5px 0 0', color: 'var(--warning, #b45309)' }}>• {blocker}</p>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
