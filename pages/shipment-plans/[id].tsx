import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../../components/DashboardLayout';
import {
  fetchShipmentPlan,
  createASN,
  cancelShipmentPlan,
  submitShipmentPlan,
  fetchEstimatedCost,
  type ShipmentPlan,
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
  const [estimatedCost, setEstimatedCost] = useState<{ total: number; perUnit: number } | null>(null);
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
        .then((c) => setEstimatedCost({ total: c.total, perUnit: c.perUnit }))
        .catch(() => setEstimatedCost(null));
    }
  }, [plan?.id]);

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

  return (
    <DashboardLayout title={`Shipment ${plan.internalShipmentId}`} subtitle={plan.shipmentTitle || 'Plan detail'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900 }}>
        {error && (
          <div className="alert error">
            {error}
          </div>
        )}

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

          <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <h4 style={{ marginBottom: 8 }}>Supplier</h4>
              <p style={{ margin: 0 }}>{plan.supplier?.name || '—'}</p>
              <h4 style={{ marginTop: 16, marginBottom: 8 }}>Facility</h4>
              <p style={{ margin: 0 }}>{plan.facility?.name || '—'}</p>
              <h4 style={{ marginTop: 16, marginBottom: 8 }}>Ship from</h4>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                {addr ? [addr.addressLine1, addr.city, addr.stateOrProvinceCode, addr.postalCode].filter(Boolean).join(', ') : '—'}
              </p>
            </div>
            <div>
              {estimatedCost && (
                <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 8 }}>
                  <h4 style={{ marginTop: 0, marginBottom: 8 }}>Estimated cost</h4>
                  <p style={{ margin: 0 }}>${estimatedCost.total.toFixed(2)} total</p>
                  <p className="muted" style={{ margin: 0, fontSize: 14 }}>${estimatedCost.perUnit.toFixed(2)} per unit</p>
                </div>
              )}
              {plan.orderNo && <p><strong>PO:</strong> {plan.orderNo}</p>}
              {plan.receiptNo && <p><strong>Receipt:</strong> {plan.receiptNo}</p>}
            </div>
          </div>

          <h4 style={{ marginTop: 24, marginBottom: 12 }}>Items</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px' }}>SKU</th>
                  <th style={{ padding: '8px 12px' }}>Title</th>
                  <th style={{ padding: '8px 12px' }}>Qty</th>
                  <th style={{ padding: '8px 12px' }}>Boxes</th>
                  <th style={{ padding: '8px 12px' }}>Units/box</th>
                  <th style={{ padding: '8px 12px' }}>Exp date</th>
                </tr>
              </thead>
              <tbody>
                {(plan.items || []).map((it, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{it.sku}</td>
                    <td style={{ padding: '8px 12px' }}>{it.title || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{it.quantity}</td>
                    <td style={{ padding: '8px 12px' }}>{it.boxCount}</td>
                    <td style={{ padding: '8px 12px' }}>{it.unitsPerBox}</td>
                    <td style={{ padding: '8px 12px' }}>{it.expDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 style={{ marginTop: 24, marginBottom: 12 }}>Documents</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plan.asnId && (
              <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                <strong>ASN label</strong>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
                  Available from WMS. Link will appear when OMS document integration is complete.
                </p>
              </div>
            )}
            {plan.prepServicesOnly && (
              <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                <strong>FBA/FBW labels</strong>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
                  Available when FBA/FBW flow is completed in the shipment plan workflow.
                </p>
              </div>
            )}
            {!plan.asnId && !plan.prepServicesOnly && (
              <p className="muted" style={{ fontSize: 14 }}>No documents yet. Create ASN to generate labels.</p>
            )}
          </div>

          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link href={`/shipment-plans/activity?shipmentPlanId=${plan.id}`} className="muted" style={{ fontSize: 14 }}>
              View shipment activity
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
