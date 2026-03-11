import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../../../components/DashboardLayout';
import { fetchItemShipmentActivity } from '../../../lib/shipment-plan';

const ACTION_LABELS: Record<string, string> = {
  added_to_shipment: 'Added to shipment',
  removed_from_shipment: 'Removed from shipment',
  shipment_created: 'Shipment created',
  shipment_updated: 'Shipment updated',
  asn_line_created: 'ASN line created',
};

export default function ItemShipmentActivityPage() {
  const router = useRouter();
  const { id } = router.query;
  const [events, setEvents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof id !== 'string') return;
    void fetchItemShipmentActivity(id)
      .then((r) => {
        setEvents(r.events);
        setTotal(r.total);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <DashboardLayout title="Product shipment activity" subtitle="Shipment history for this item">
      <div className="card" style={{ padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <Link href="/catalog" className="muted" style={{ fontSize: 14 }}>
            ← Back to Catalog
          </Link>
        </div>
        {loading ? (
          <div className="muted">Loading...</div>
        ) : events.length === 0 ? (
          <div className="muted">No shipment activity for this item.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Time</th>
                <th style={{ padding: '10px 12px' }}>Action</th>
                <th style={{ padding: '10px 12px' }}>Shipment Plan</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px' }} className="muted">
                    {e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{ACTION_LABELS[e.action] || e.action}</td>
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
        )}
      </div>
    </DashboardLayout>
  );
}
