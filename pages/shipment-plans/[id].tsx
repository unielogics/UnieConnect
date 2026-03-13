import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, Download, Printer } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import {
  fetchShipmentPlan,
  createASN,
  cancelShipmentPlan,
  submitShipmentPlan,
  fetchEstimatedCost,
  fetchEstimateServiceFees,
  fetchAsnLabelBlob,
  fetchItemBarcodeBlob,
  type ShipmentPlan,
  type EstimateServiceFeesLineItem,
} from '../../lib/shipment-plan';

function statusLabel(s: string) {
  const map: Record<string, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    asn_created: 'ASN Created',
    in_transit: 'In Transit',
    received: 'Received',
    cancelled: 'Cancelled',
  };
  return map[s] || s;
}

export default function ShipmentPlanDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [plan, setPlan] = useState<ShipmentPlan | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<{ total: number; perUnit: number; breakdown?: Record<string, number> } | null>(null);
  const [estimateServiceFees, setEstimateServiceFees] = useState<{
    total: number;
    perUnit: number;
    lineItems: EstimateServiceFeesLineItem[];
  } | 'loading' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof id !== 'string') return;
    void fetchShipmentPlan(id)
      .then(setPlan)
      .catch(() => setPlan(null));
  }, [id]);

  useEffect(() => {
    if (plan?.id) {
      void fetchEstimatedCost(plan.id)
        .then((c) => setEstimatedCost({ total: c.total, perUnit: c.perUnit, breakdown: c.breakdown }))
        .catch(() => setEstimatedCost(null));
    }
  }, [plan?.id]);

  useEffect(() => {
    if (!plan?.shipFromLocationId || !plan?.items?.length) {
      setEstimateServiceFees(null);
      return;
    }
    setEstimateServiceFees('loading');
    const payload = {
      shipFromLocationId: plan.shipFromLocationId,
      items: plan.items.map((i) => ({
        sku: i.sku,
        quantity: i.quantity,
        boxCount: i.boxCount,
        labRequirements: i.labRequirements,
      })),
      prepServicesOnly: plan.prepServicesOnly ?? false,
      marketplaceType: plan.prepServicesOnly ? plan.marketplaceType : undefined,
    };
    fetchEstimateServiceFees(payload)
      .then((r) => setEstimateServiceFees({ total: r.total, perUnit: r.perUnit, lineItems: r.lineItems }))
      .catch(() => setEstimateServiceFees(null));
  }, [plan?.id, plan?.shipFromLocationId, plan?.prepServicesOnly, plan?.marketplaceType]);

  const handleCreateASN = async () => {
    if (!plan?.id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createASN(plan.id);
      setPlan(res.plan);
    } catch (e: any) {
      setError(e?.message || 'Failed to create ASN');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!plan?.id) return;
    setBusy(true);
    setError(null);
    try {
      const p = await submitShipmentPlan(plan.id);
      setPlan(p);
    } catch (e: any) {
      setError(e?.message || 'Failed to submit');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!plan?.id || !confirm('Cancel this shipment plan?')) return;
    setBusy(true);
    setError(null);
    try {
      const p = await cancelShipmentPlan(plan.id);
      setPlan(p);
    } catch (e: any) {
      setError(e?.message || 'Failed to cancel');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadAsnLabel = async () => {
    if (!plan?.asnId) return;
    try {
      const blob = await fetchAsnLabelBlob(plan.asnId);
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
    if (!plan?.asnId) return;
    try {
      const blob = await fetchItemBarcodeBlob(plan.asnId, wmsItemId);
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

  if (!id || (plan === null && !error)) {
    return (
      <DashboardLayout title="Shipment Plan" subtitle="Loading...">
        <div className="card">
          <div className="muted">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!plan) {
    return (
      <DashboardLayout title="Shipment Plan" subtitle="Not found">
        <div className="card">
          <div className="muted">Plan not found.</div>
          <Link href="/shipment-plans" className="button-primary" style={{ marginTop: 16, display: 'inline-block' }}>
            Back to list
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const addr = plan.shipFromAddress as any;
  const items = plan.items || [];
  const facilityName = plan.facility?.name || plan.facility?.code || 'warehouse';
  const itemsWithWms = items.filter((i: any) => i.wmsItemId);

  return (
    <DashboardLayout title={`Shipment ${plan.internalShipmentId}`} subtitle={plan.shipmentTitle || 'Plan detail'}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', maxWidth: 1200 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {error && (
            <div className="alert error">
              {error}
            </div>
          )}

          {/* Header card */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, marginBottom: 8 }}>{plan.internalShipmentId}</h3>
                <span className="badge">{statusLabel(plan.status)}</span>
                <span style={{ marginLeft: 8 }} className="muted">
                  {plan.prepServicesOnly ? `Prep: ${plan.marketplaceType}` : 'DTC'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href="/shipment-plans" className="button-secondary">
                  Back to list
                </Link>
                {plan.status === 'draft' && (
                  <>
                    <button className="button-primary" onClick={handleSubmit} disabled={busy}>
                      Submit
                    </button>
                    <button className="button-secondary" onClick={handleCancel} disabled={busy}>
                      Cancel plan
                    </button>
                  </>
                )}
                {plan.status === 'submitted' && !plan.asnId && (
                  <button className="button-primary" onClick={handleCreateASN} disabled={busy}>
                    {busy ? 'Creating...' : 'Create ASN'}
                  </button>
                )}
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>Supplier</span>
                <p style={{ margin: '4px 0 0' }}>{plan.supplier?.name || '—'}</p>
              </div>
              <div>
                <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>Facility</span>
                <p style={{ margin: '4px 0 0' }}>{plan.facility?.name || '—'}</p>
              </div>
              <div>
                <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>Ship from</span>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
                  {addr ? [addr.addressLine1, addr.city, addr.stateOrProvinceCode, addr.postalCode].filter(Boolean).join(', ') : '—'}
                </p>
              </div>
              {plan.orderNo && (
                <div>
                  <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>PO</span>
                  <p style={{ margin: '4px 0 0' }}>{plan.orderNo}</p>
                </div>
              )}
              {plan.receiptNo && (
                <div>
                  <span className="sta-kicker" style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8 }}>Receipt</span>
                  <p style={{ margin: '4px 0 0' }}>{plan.receiptNo}</p>
                </div>
              )}
            </div>
          </div>

          {/* Section 1: Items */}
          <section className="sta-section-card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <span className="sta-section-index">1</span>
              <strong>Items</strong>
              <small style={{ marginLeft: 8 }}>{items.length} item(s)</small>
            </div>
            <div className="sta-section-body" style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
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
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--muted)',
                        fontSize: 12,
                      }}
                    >
                      {(it as any).imageUrl ? (
                        <img
                          src={(it as any).imageUrl}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : '—'}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, textAlign: 'center', marginBottom: 4 }}>{it.sku}</div>
                    <div className="muted" style={{ fontSize: 12, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', marginBottom: 8 }}>
                      {it.title || '—'}
                    </div>
                    <div style={{ fontSize: 13 }}>Qty: {it.quantity ?? '—'}</div>
                    <div style={{ fontSize: 12 }}>Boxes: {it.boxCount ?? '—'}</div>
                    <div style={{ fontSize: 12 }}>Units/box: {it.unitsPerBox ?? '—'}</div>
                    {it.expDate && <div className="muted" style={{ fontSize: 11 }}>Exp: {it.expDate}</div>}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 2: Receiving details */}
          <section className="sta-section-card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <span className="sta-section-index">2</span>
              <strong>Receiving details</strong>
            </div>
            <div className="sta-section-body" style={{ padding: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                    <div>
                      <strong>{it.sku}</strong>
                      {it.title && <span className="muted" style={{ marginLeft: 8 }}>{it.title}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                      <span>Template: {(it as any).templateId ? 'Selected' : '—'}</span>
                      <span>Boxes: {it.boxCount ?? '—'}</span>
                      <span>Units/box: {it.unitsPerBox ?? '—'}</span>
                      {it.expDate && <span>Exp: {it.expDate}</span>}
                      {(it.labRequirements?.services?.length ?? 0) > 0 && (
                        <span>Add-ons: {(it.labRequirements!.services!).map((s: any) => s.type).join(', ')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 3: Shipment options */}
          <section className="sta-section-card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <span className="sta-section-index">3</span>
              <strong>Shipment options</strong>
            </div>
            <div className="sta-section-body" style={{ padding: 20 }}>
              <p className="muted" style={{ margin: 0 }}>
                {plan.prepServicesOnly ? `Prep services for ${plan.marketplaceType}` : 'DTC shipment'} — Parcel, Pallet, or carrier as configured.
              </p>
              {plan.estimatedArrivalDate && (
                <p style={{ margin: '12px 0 0' }}><strong>Est. arrival:</strong> {plan.estimatedArrivalDate}</p>
              )}
            </div>
          </section>

          {/* Section 4: Documents */}
          <section className="sta-section-card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <span className="sta-section-index">4</span>
              <strong>Documents</strong>
            </div>
            <div className="sta-section-body" style={{ padding: 20 }}>
              {plan.asnId && (
                <>
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
                  <h4 style={{ marginBottom: 12 }}>Item barcode labels</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {itemsWithWms.map((i: any) => {
                      const itemName = i.title || i.itemName || i.sku;
                      const wmsSku = i.wmsSku || i.sku;
                      return (
                        <div key={i.sku} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <span className="muted" style={{ fontSize: 13 }}>
                            <strong>{itemName}</strong> has SKU <code>{wmsSku}</code> in {facilityName}
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
                    {itemsWithWms.length === 0 && (
                      <p className="muted" style={{ fontSize: 13 }}>Item barcode PDFs available after WMS items are created.</p>
                    )}
                  </div>
                </>
              )}
              {plan.prepServicesOnly && (
                <div style={{ marginTop: plan.asnId ? 16 : 0, padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                  <strong>FBA/FBW labels</strong>
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
                    Available when FBA/FBW flow is completed in the shipment plan workflow.
                  </p>
                </div>
              )}
              {!plan.asnId && !plan.prepServicesOnly && (
                <p className="muted" style={{ fontSize: 14 }}>No documents yet. Create ASN to generate labels.</p>
              )}
              {!plan.asnId && plan.status === 'submitted' && (
                <p className="muted" style={{ fontSize: 14, marginTop: 12 }}>Create ASN to generate the ASN label and item barcodes.</p>
              )}
              <div style={{ marginTop: 20 }}>
                <Link href={`/shipment-plans/activity?shipmentPlanId=${plan.id}`} className="muted" style={{ fontSize: 14 }}>
                  View shipment activity
                </Link>
              </div>
            </div>
          </section>
        </div>

        {/* Sticky sidebar - Est. service breakdown */}
        <div
          style={{
            width: 220,
            flexShrink: 0,
            alignSelf: 'flex-start',
            position: 'sticky',
            top: 24,
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 16,
            background: 'var(--surface)',
          }}
        >
          <h4 style={{ margin: '0 0 12px', fontSize: 13, textTransform: 'uppercase', opacity: 0.8 }}>
            Est. service fees
          </h4>
          {estimateServiceFees === 'loading' && (
            <p className="muted" style={{ fontSize: 12 }}>Computing…</p>
          )}
          {estimateServiceFees === null && !estimatedCost && (
            <p className="muted" style={{ fontSize: 12 }}>Unable to load breakdown</p>
          )}
          {estimateServiceFees != null && estimateServiceFees !== 'loading' && (
            <>
              {estimateServiceFees.lineItems.map((line, i) => (
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
                  <span>${line.amount.toFixed(2)}</span>
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
                <span>${estimateServiceFees.total.toFixed(2)}</span>
              </div>
              <p className="muted" style={{ marginTop: 4, fontSize: 11 }}>
                ${estimateServiceFees.perUnit.toFixed(2)}/unit
              </p>
            </>
          )}
          {estimateServiceFees === null && estimatedCost && (
            <>
              {estimatedCost.breakdown && Object.entries(estimatedCost.breakdown).map(([key, amount]) => {
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
                    <span>${amount.toFixed(2)}</span>
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
                <span>${estimatedCost.total.toFixed(2)}</span>
              </div>
              <p className="muted" style={{ marginTop: 4, fontSize: 11 }}>
                ${estimatedCost.perUnit.toFixed(2)}/unit
              </p>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
