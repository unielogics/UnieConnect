import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Modal } from './Modal';
import { TransportationTemplatePopup } from './TransportationTemplatePopup';
import { CreationVerificationScreen } from './CreationVerificationScreen';
import { fetchSuppliers, fetchShipFromLocations } from '../lib/amazon-fba';
import type { ShipFromLocation } from '../lib/amazon-fba';
import {
  createShipmentPlan,
  createASN,
  fetchEstimatedCost,
  fetchClosestFacilityPreview,
  type ShipmentPlanItem,
} from '../lib/shipment-plan';
import { fetchTransportationTemplates, type TransportationTemplate } from '../lib/transportation-template';

export type CreateShipmentPlanInitialItem = {
  sku: string;
  title?: string;
  asin?: string;
  imageUrl?: string;
};

type Section = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10; // 1-8 workflow, 9=plan created, 10=ASN created

interface CreateShipmentPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItems?: CreateShipmentPlanInitialItem[];
}

function strategyLabel(location: ShipFromLocation | null): string {
  if (!location?.address) return '—';
  const city = (location.address as any).city || '';
  const state = (location.address as any).stateOrProvinceCode || '';
  if (!city && !state) return '—';
  return city && state ? `${city}, ${state}` : city || state;
}

function shipFromSummary(location: ShipFromLocation | null): string {
  if (!location?.address) return 'Select supplier';
  const city = (location.address as any).city || '';
  const state = (location.address as any).stateOrProvinceCode || '';
  if (!city && !state) return location.label || '—';
  return `${city}, ${state}`;
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
  const [items, setItems] = useState<(ShipmentPlanItem & { imageUrl?: string })[]>(() =>
    initialItems.length > 0
      ? initialItems.map((p) => ({
          sku: p.sku,
          title: p.title,
          asin: p.asin,
          imageUrl: p.imageUrl,
          quantity: 1,
          boxCount: 1,
          unitsPerBox: 1,
        }))
      : []
  );
  const [planId, setPlanId] = useState<string | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<{ total: number; perUnit: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TransportationTemplate[]>([]);
  const [templatePopupOpen, setTemplatePopupOpen] = useState(false);
  const [verificationSteps, setVerificationSteps] = useState<Array<{ id: string; label: string; status: 'pending' | 'in_progress' | 'success' | 'error'; detail?: string }>>([]);
  const [showVerification, setShowVerification] = useState(false);
  const [warehousePreview, setWarehousePreview] = useState<{ name: string; code?: string } | null | 'loading'>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialItems.length > 0) {
        setItems(
          initialItems.map((p) => ({
            sku: p.sku,
            title: p.title,
            asin: p.asin,
            imageUrl: p.imageUrl,
            quantity: 1,
            boxCount: 1,
            unitsPerBox: 1,
          }))
        );
      }
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

  const strategy = useMemo(() => strategyLabel(selectedLocation), [selectedLocation]);
  const shipFromText = useMemo(() => shipFromSummary(selectedLocation), [selectedLocation]);

  const totalUnits = useMemo(() => items.reduce((s, i) => s + (i.quantity || 0), 0), [items]);
  const totalBoxes = useMemo(() => items.reduce((s, i) => s + (i.boxCount || 0), 0), [items]);

  const updateItem = (idx: number, patch: Partial<ShipmentPlanItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const handleCreate = async () => {
    if (!supplierId || !shipFromLocationId || items.length === 0) {
      setError('Supplier and at least one item are required.');
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
        items,
        shipmentTitle: strategy || undefined,
      });
      setPlanId(plan.id);
      setCurrentSection(4);
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

  useEffect(() => {
    if (planId) {
      void fetchEstimatedCost(planId)
        .then((c) => setEstimatedCost({ total: c.total, perUnit: c.perUnit }))
        .catch(() => setEstimatedCost(null));
    }
  }, [planId]);

  useEffect(() => {
    if (hasCompletedGate && shipFromLocationId && !planId) {
      setWarehousePreview('loading');
      void fetchClosestFacilityPreview(shipFromLocationId)
        .then((r) => setWarehousePreview(r.facility ? { name: r.facility.name, code: r.facility.code } : null))
        .catch(() => setWarehousePreview(null));
    } else if (planId) {
      setWarehousePreview(null);
    } else {
      setWarehousePreview(null);
    }
  }, [hasCompletedGate, shipFromLocationId, planId]);

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}
              >
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {supplierId && shipFromText !== 'Select supplier' && (
                <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>Ship from: {shipFromText}</p>
              )}
            </div>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 12 }}>Sending to Amazon or Walmart?</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="dest"
                    checked={prepServicesOnly === true}
                    onChange={() => { setPrepServicesOnly(true); setMarketplaceType('FBA'); }}
                  />
                  <span>Yes – Amazon (FBA)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="dest"
                    checked={prepServicesOnly === true && marketplaceType === 'FBW'}
                    onChange={() => { setPrepServicesOnly(true); setMarketplaceType('FBW'); }}
                  />
                  <span>Yes – Walmart (FBW)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="dest"
                    checked={prepServicesOnly === false}
                    onChange={() => setPrepServicesOnly(false)}
                  />
                  <span>No – DTC (Direct-to-Consumer)</span>
                </label>
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
      <div className="sta-workflow-container">
        {error && (
          <div className="alert error" style={{ marginBottom: 0 }}>
            {error}
          </div>
        )}

        <div className="sta-workflow-strip sta-summary-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>Ship from</span>
              <div style={{ fontWeight: 600 }}>{supplierId ? shipFromText : '—'}</div>
            </div>
            <div>
              <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>To: Warehouse</span>
              <div style={{ fontWeight: 600 }}>
                {planId ? 'Assigned' : warehousePreview === 'loading' ? 'Resolving...' : warehousePreview ? warehousePreview.name : 'Auto-assigned'}
              </div>
            </div>
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
              <strong>Selected items</strong>
              <small>{items.length} item(s) from catalog</small>
            </span>
          </button>
          {currentSection === 1 && (
            <div className="sta-section-body">
              {items.length === 0 ? (
                <p className="muted">No items. Select products from Catalog first, then click Create Shipment Plan.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
                  {items.map((it, i) => (
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
                      <div style={{ fontWeight: 500 }}>Qty: {it.quantity}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="fba-stage-footer">
                <div className="muted">{items.length} item(s)</div>
                <button
                  className="button-primary"
                  onClick={() => setCurrentSection(2)}
                  disabled={!supplierId || items.length === 0 || prepServicesOnly === null || items.some((i) => (i.quantity || 0) <= 0)}
                >
                  Next: Transportation
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
              <strong>Transportation details</strong>
              <small>Per-SKU template, boxes, exp date</small>
            </span>
          </button>
          {currentSection === 2 && (
            <div className="sta-section-body">
              <p className="muted" style={{ marginBottom: 16 }}>
                Select a template per SKU. Specs (units/box, weight, dimensions) come from the template.
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, marginBottom: 12 }}>{it.sku} – {it.title || '—'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: 12 }}>Template</label>
                      <select
                        value=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__manage__') {
                            setTemplatePopupOpen(true);
                            e.target.value = '';
                            return;
                          }
                          const t = templates.find((x) => x.id === v);
                          if (t) {
                            updateItem(idx, {
                              unitsPerBox: t.unitsPerBox,
                              weightPerBox: t.weightPerBox,
                              weightPerUnit: t.weightPerUnit,
                              quantity: it.boxCount * t.unitsPerBox,
                              dimensions: t.dimensions,
                            });
                          }
                          e.target.value = '';
                        }}
                        style={{ width: '100%', maxWidth: 280, padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
                      >
                        <option value="">Select template</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                        <option value="__manage__">— Manage templates —</option>
                      </select>
                      {(it.weightPerBox != null || (it.dimensions && (it.dimensions.length ?? it.dimensions.width ?? it.dimensions.height) != null)) && (
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
                          <strong style={{ display: 'block', marginBottom: 6 }}>Template specs</strong>
                          <div className="muted">
                            {it.unitsPerBox} units/box · {it.weightPerBox ?? 0} lbs/box
                            {(it.dimensions?.length ?? it.dimensions?.width ?? it.dimensions?.height) != null && (
                              <> · {[it.dimensions?.length, it.dimensions?.width, it.dimensions?.height].filter((n) => n != null).join('×')} in</>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: 12 }}>Boxes</label>
                      <input
                        type="number"
                        min={1}
                        value={it.boxCount}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 1;
                          updateItem(idx, { boxCount: v, quantity: v * it.unitsPerBox });
                        }}
                        style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
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
                  </div>
                  </div>
                </div>
              ))}
              <div className="fba-stage-footer" style={{ marginTop: 24 }}>
                <button className="button-secondary" onClick={() => setCurrentSection(1)}>
                  Back
                </button>
                <button className="button-primary" onClick={() => setCurrentSection(3)}>
                  Next: Review & create
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Section 3: Review & create */}
        <section className="sta-section-card">
          <button
            type="button"
            className={`sta-section-toggle ${currentSection === 3 ? 'active' : ''}`}
            onClick={() => setCurrentSection(3)}
          >
            <span className="sta-section-index">3</span>
            <span>
              <strong>Review & create</strong>
              <small>Summary and create plan</small>
            </span>
          </button>
          {currentSection === 3 && (
            <div className="sta-section-body">
              <div className="fba-inline-summary-bar" style={{ marginBottom: 16 }}>
                <span className="pill subtle">Items: {items.length}</span>
                <span className="pill subtle">Prep: {prepServicesOnly ? marketplaceType : 'DTC'}</span>
                <span className="pill subtle">Ship from: {shipFromText}</span>
                <span className="pill subtle">Strategy: {strategy}</span>
              </div>
              <ul style={{ marginBottom: 20, paddingLeft: 20 }}>
                <li>Supplier selected; closest facility will be assigned automatically</li>
                <li>Strategy: {strategy}</li>
              </ul>
              <div className="fba-stage-footer">
                <button className="button-secondary" onClick={() => setCurrentSection(2)}>
                  Back
                </button>
                <button className="button-primary" onClick={handleCreate} disabled={busy}>
                  {busy ? 'Creating...' : 'Create plan'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Section 4: Plan created */}
        <section className="sta-section-card">
          <button
            type="button"
            className={`sta-section-toggle ${currentSection === 4 ? 'active' : ''}`}
            onClick={() => setCurrentSection(4)}
          >
            <span className="sta-section-index">4</span>
            <span>
              <strong>Plan created</strong>
              <small>Create ASN for WMS</small>
            </span>
          </button>
          {currentSection === 4 && planId && (
            <div className="sta-section-body">
              <p className="muted" style={{ marginBottom: 16 }}>
                Shipment plan created. Create ASN to send to WMS.
              </p>
              {estimatedCost && (
                <div className="fba-summary-panel" style={{ marginBottom: 16 }}>
                  <div className="fba-summary-metric">
                    <span>Estimated total</span>
                    <strong>${estimatedCost.total.toFixed(2)}</strong>
                  </div>
                  <div className="fba-summary-metric">
                    <span>Per unit</span>
                    <strong>${estimatedCost.perUnit.toFixed(2)}</strong>
                  </div>
                </div>
              )}
              <div className="fba-stage-footer">
                <button className="button-primary" onClick={handleCreateASN} disabled={busy}>
                  {busy ? 'Creating ASN...' : 'Create ASN'}
                </button>
                <Link href={`/shipment-plans/${planId}`} className="button-secondary" onClick={onClose}>
                  View plan
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Section 5: ASN created */}
        <section className="sta-section-card">
          <button
            type="button"
            className={`sta-section-toggle ${currentSection === 5 ? 'active' : ''}`}
            onClick={() => setCurrentSection(5)}
          >
            <span className="sta-section-index">5</span>
            <span>
              <strong>ASN created</strong>
              <small>Done</small>
            </span>
          </button>
          {currentSection === 5 && planId && (
            <div className="sta-section-body">
              {showVerification && verificationSteps.length > 0 ? (
                <CreationVerificationScreen
                  steps={verificationSteps}
                  allSuccess={verificationSteps.every((s) => s.status !== 'error')}
                  errors={verificationSteps.filter((s) => s.status === 'error').map((s) => s.detail || s.label)}
                  planId={planId}
                  onClose={onClose}
                />
              ) : (
                <>
                  <p className="muted" style={{ marginBottom: 16 }}>
                    ASN has been created. Your shipment plan is ready.
                  </p>
                  <div className="fba-stage-footer">
                    <Link href={`/shipment-plans/${planId}`} className="button-primary" onClick={onClose}>
                      View plan
                    </Link>
                    <Link href="/shipment-plans" className="button-secondary" onClick={onClose}>
                      Back to list
                    </Link>
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
            void fetchTransportationTemplates(supplierId || undefined).then((r) => setTemplates(r.templates));
          }}
          supplierId={supplierId || undefined}
        />
      </div>
    </Modal>
  );
}
