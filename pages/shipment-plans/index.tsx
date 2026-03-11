import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../../components/DashboardLayout';
import { fetchShipmentPlans, type ShipmentPlan } from '../../lib/shipment-plan';

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

export default function ShipmentPlansPage() {
  const [plans, setPlans] = useState<ShipmentPlan[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const limit = 25;

  useEffect(() => {
    void load();
  }, [statusFilter, page]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchShipmentPlans({
        limit,
        offset: page * limit,
        status: statusFilter || undefined,
      });
      setPlans(res.plans);
      setTotal(res.total);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Shipment Plans" subtitle="Create and manage inbound shipment plans">
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href="/catalog" className="button-primary">
              Create new (from Catalog)
            </Link>
            <Link href="/shipment-plans/activity" className="button-secondary">
              Shipment Activity
            </Link>
            <Link href="/catalog" className="button-secondary">
              Back to Catalog
            </Link>
            <button
              className="button-secondary"
              onClick={() => {
                const csv = [
                  ['ID', 'Internal ID', 'Supplier', 'Facility', 'Status', 'Prep Services', 'Items', 'Updated'].join(','),
                  ...plans.map((p) =>
                    [
                      p.id,
                      p.internalShipmentId,
                      (p.supplier?.name || '').replace(/,/g, ';'),
                      (p.facility?.name || '').replace(/,/g, ';'),
                      p.status,
                      p.prepServicesOnly ? 'FBA/FBW' : 'DTC',
                      p.items?.length || 0,
                      p.updatedAt || '',
                    ].join(',')
                  ),
                ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `shipment-plans-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              disabled={plans.length === 0}
            >
              Export CSV
            </button>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)' }}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="asn_created">ASN Created</option>
              <option value="in_transit">In Transit</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="muted">Loading...</div>
        ) : plans.length === 0 ? (
          <div className="muted">
            No shipment plans yet. Go to <Link href="/catalog">Catalog</Link> to select products and create a shipment plan.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>ID</th>
                    <th style={{ padding: '10px 12px' }}>Supplier</th>
                    <th style={{ padding: '10px 12px' }}>Facility</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px' }}>Prep Services</th>
                    <th style={{ padding: '10px 12px' }}>Items</th>
                    <th style={{ padding: '10px 12px' }}>Updated</th>
                    <th style={{ padding: '10px 12px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{p.internalShipmentId}</td>
                      <td style={{ padding: '10px 12px' }}>{p.supplier?.name || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>{p.facility?.name || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className="badge">{statusLabel(p.status)}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>{p.prepServicesOnly ? 'FBA/FBW' : 'DTC'}</td>
                      <td style={{ padding: '10px 12px' }}>{p.items?.length || 0}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }} className="muted">
                        {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <Link href={`/shipment-plans/${p.id}`} className="button-secondary" style={{ padding: '6px 12px', fontSize: 13 }}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > limit && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
                <button
                  className="button-secondary"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <span className="muted" style={{ fontSize: 14 }}>
                  Page {page + 1} of {Math.ceil(total / limit)}
                </span>
                <button
                  className="button-secondary"
                  disabled={(page + 1) * limit >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
