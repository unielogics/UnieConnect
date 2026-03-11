import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import { fetchShipmentActivity } from '../../lib/shipment-plan';

const ACTION_LABELS: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  submitted: 'Submitted',
  cancelled: 'Cancelled',
  asn_created: 'ASN created',
  status_changed: 'Status changed',
  fba_confirmed: 'FBA confirmed',
};

export default function ShipmentActivityPage() {
  const router = useRouter();
  const { shipmentPlanId, action, from, to } = router.query;
  const [events, setEvents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 50;

  useEffect(() => {
    void load();
  }, [shipmentPlanId, action, from, to, page]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchShipmentActivity({
        limit,
        offset: page * limit,
        shipmentPlanId: typeof shipmentPlanId === 'string' ? shipmentPlanId : undefined,
        action: typeof action === 'string' ? action : undefined,
        from: typeof from === 'string' ? from : undefined,
        to: typeof to === 'string' ? to : undefined,
      });
      setEvents(res.events);
      setTotal(res.total);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Shipment Activity" subtitle="All shipment-related events">
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <Link href="/shipment-plans" className="button-secondary">
            Back to Shipment Plans
          </Link>
          <button
            className="button-secondary"
            onClick={() => {
              const csv = [
                ['Time', 'Action', 'Shipment ID', 'Plan ID'].join(','),
                ...events.map((e) =>
                  [
                    e.createdAt || '',
                    (e.action || '').replace(/,/g, ';'),
                    (e.internalShipmentId || '').replace(/,/g, ';'),
                    e.shipmentPlanId || '',
                  ].join(',')
                ),
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `shipment-activity-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            disabled={events.length === 0}
          >
            Export CSV
          </button>
        </div>

        {loading ? (
          <div className="muted">Loading...</div>
        ) : events.length === 0 ? (
          <div className="muted">No shipment activity yet.</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Time</th>
                    <th style={{ padding: '10px 12px' }}>Action</th>
                    <th style={{ padding: '10px 12px' }}>Shipment ID</th>
                    <th style={{ padding: '10px 12px' }}>Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }} className="muted">
                        {e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{ACTION_LABELS[e.action] || e.action}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{e.internalShipmentId || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {e.shipmentPlanId ? (
                          <Link href={`/shipment-plans/${e.shipmentPlanId}`}>View plan</Link>
                        ) : (
                          '—'
                        )}
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
