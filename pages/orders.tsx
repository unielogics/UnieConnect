import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ChannelBadge from '../components/ChannelBadge';
import ChannelFilter from '../components/ChannelFilter';
import { ViewModal } from '../components/ViewModal';
import { Button } from '../components/Button';
import { apiUrl, TOKEN_KEY } from '../lib/api';

type Order = {
  _id: string;
  externalOrderId: string;
  channel?: string;
  channelDisplay?: string;
  status?: string;
  placedAt?: string;
  totals?: { total?: number; currency?: string };
  currency?: string;
  customer?: { id: string; email?: string; name?: { first?: string; last?: string } } | null;
};

type OrderLine = {
  sku?: string;
  quantity: number;
  price?: number;
  fulfillmentStatus?: string;
};

type OrderDetail = Order & {
  lines?: OrderLine[];
};

async function fetchOrders(token: string, channel?: string): Promise<Order[]> {
  const url = new URL(apiUrl('/api/v1/orders'));
  if (channel) url.searchParams.set('channel', channel);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchOrderDetail(token: string, id: string): Promise<OrderDetail | null> {
  const res = await fetch(apiUrl(`/api/v1/orders/${id}`), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return res.json();
}

function formatDate(s?: string): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { dateStyle: 'short' });
  } catch {
    return '—';
  }
}

function formatMoney(amount?: number, currency?: string): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);
}

function customerDisplay(c?: { email?: string; name?: { first?: string; last?: string } } | null): string {
  if (!c) return '—';
  const name = [c.name?.first, c.name?.last].filter(Boolean).join(' ');
  return name || c.email || '—';
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState('');
  const [detailOrder, setDetailOrder] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadOrders = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchOrders(token, channelFilter || undefined);
      setOrders(data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [channelFilter]);

  const openDetail = async (id: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;
    setDetailLoading(true);
    setDetailOrder(null);
    try {
      const order = await fetchOrderDetail(token, id);
      setDetailOrder(order || null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOrder(null);
  };

  return (
    <DashboardLayout title="Orders" subtitle="View and manage all orders across your sales channels">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Orders</h2>
          <ChannelFilter value={channelFilter} onChange={setChannelFilter} />
        </div>

        {loading ? (
          <div className="text-gray-500">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="text-gray-500">No orders found. Connect a marketplace and sync to see orders here.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Order ID</th>
                  <th style={{ padding: '10px 12px' }}>Date</th>
                  <th style={{ padding: '10px 12px' }}>Channel</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>Customer</th>
                  <th style={{ padding: '10px 12px' }}>Total</th>
                  <th style={{ padding: '10px 12px', width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{order.externalOrderId || order._id}</td>
                    <td style={{ padding: '10px 12px' }}>{formatDate(order.placedAt)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {order.channel ? (
                        <ChannelBadge channel={order.channel} label={order.channelDisplay} />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{order.status || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{customerDisplay(order.customer)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {formatMoney(order.totals?.total ?? undefined, order.currency)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void openDetail(order._id)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(detailOrder !== null || detailLoading) && (
        <ViewModal
          isOpen
          onClose={closeDetail}
          title={detailLoading ? 'Order details' : `Order ${detailOrder?.externalOrderId || ''}`}
        >
          {detailLoading ? (
            <div className="text-gray-500">Loading...</div>
          ) : detailOrder ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>Channel</div>
                  <div>{detailOrder.channel ? <ChannelBadge channel={detailOrder.channel} label={detailOrder.channelDisplay} /> : '—'}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>Status</div>
                  <div>{detailOrder.status || '—'}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>Date</div>
                  <div>{formatDate(detailOrder.placedAt)}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>Total</div>
                  <div>{formatMoney(detailOrder.totals?.total ?? undefined, detailOrder.currency)}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="muted" style={{ fontSize: 12 }}>Customer</div>
                  <div>{customerDisplay(detailOrder.customer)}</div>
                  {detailOrder.customer?.email && (
                    <div className="muted" style={{ fontSize: 13 }}>{detailOrder.customer.email}</div>
                  )}
                </div>
              </div>
              {detailOrder.lines && detailOrder.lines.length > 0 && (
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Line items</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '8px 0', textAlign: 'left' }}>SKU</th>
                        <th style={{ padding: '8px 0', textAlign: 'right' }}>Qty</th>
                        <th style={{ padding: '8px 0', textAlign: 'right' }}>Price</th>
                        <th style={{ padding: '8px 0', textAlign: 'left' }}>Fulfillment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailOrder.lines.map((line, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 0' }}>{line.sku || '—'}</td>
                          <td style={{ padding: '8px 0', textAlign: 'right' }}>{line.quantity}</td>
                          <td style={{ padding: '8px 0', textAlign: 'right' }}>{formatMoney(line.price)}</td>
                          <td style={{ padding: '8px 0' }}>{line.fulfillmentStatus || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </ViewModal>
      )}
    </DashboardLayout>
  );
}
