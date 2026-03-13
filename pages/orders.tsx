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
  createdAt?: string;
  totals?: { total?: number; subtotal?: number; tax?: number; shipping?: number; discounts?: number; currency?: string };
  currency?: string;
  customer?: { id: string; email?: string; phone?: string; name?: { first?: string; last?: string }; addresses?: any[] } | null;
};

type OrderLine = {
  sku?: string;
  quantity: number;
  price?: number;
  fulfillmentStatus?: string;
  itemId?: { _id: string; title?: string; image?: string; sku?: string } | null;
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

function formatDateTime(s?: string): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function formatAddress(addr: { line1?: string; line2?: string; city?: string; region?: string; postalCode?: string; country?: string }): string {
  const parts = [addr.line1, addr.line2, [addr.city, addr.region, addr.postalCode].filter(Boolean).join(' '), addr.country].filter(Boolean);
  return parts.join(', ');
}

function StatusBadge({ label, variant = 'default' }: { label: string; variant?: 'success' | 'warning' | 'default' }) {
  const colors = variant === 'success' ? 'bg-green-100 text-green-800' : variant === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700';
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${colors}`}>{label}</span>;
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
          title={detailLoading ? 'Order details' : `Order #${detailOrder?.externalOrderId || ''}`}
        >
          {detailLoading ? (
            <div className="text-gray-500">Loading...</div>
          ) : detailOrder ? (
            <div className="space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Status row + date (Shopify-style) */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <StatusBadge label={detailOrder.status || 'Unknown'} variant={detailOrder.status === 'paid' || detailOrder.status === 'fulfilled' ? 'success' : 'warning'} />
                <StatusBadge label={detailOrder.lines?.some((l) => l.fulfillmentStatus !== 'fulfilled') ? 'Unfulfilled' : 'Fulfilled'} variant={detailOrder.lines?.every((l) => l.fulfillmentStatus === 'fulfilled') ? 'success' : 'warning'} />
                <span className="text-sm text-gray-500">{formatDateTime(detailOrder.placedAt)}</span>
                {detailOrder.channel && (
                  <span className="text-sm text-gray-500">from {detailOrder.channelDisplay || detailOrder.channel}</span>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Products + Totals */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Line items (product-style cards) */}
                  {detailOrder.lines && detailOrder.lines.length > 0 ? (
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      {detailOrder.lines.map((line, i) => {
                        const item = line.itemId && typeof line.itemId === 'object' ? line.itemId : null;
                        const title = item?.title || line.sku || `Item ${i + 1}`;
                        const image = item?.image;
                        return (
                          <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0">
                            <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                              {image ? (
                                <img src={image} alt={title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <span className="text-gray-400 text-xs">Img</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900">{title}</div>
                              <div className="text-sm text-gray-500">{line.fulfillmentStatus || '—'}</div>
                            </div>
                            <div className="text-sm text-gray-600">× {line.quantity}</div>
                            <div className="font-medium text-gray-900">{formatMoney((line.price ?? 0) * line.quantity, detailOrder.currency)}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-200 p-4 text-gray-500 text-sm">No line items</div>
                  )}

                  {/* Totals block */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-2">
                    {detailOrder.totals?.subtotal != null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span>{formatMoney(detailOrder.totals.subtotal, detailOrder.currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Total</span>
                      <span>{formatMoney(detailOrder.totals?.total ?? undefined, detailOrder.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-700 font-medium">
                      <span>Paid</span>
                      <span>{formatMoney(detailOrder.totals?.total ?? undefined, detailOrder.currency)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Customer, addresses, timeline */}
                <div className="space-y-4">
                  {/* Timeline placeholder */}
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="text-xs font-medium text-gray-500 mb-3">Timeline</div>
                    <div className="space-y-2 text-sm">
                      <div className="text-gray-700">
                        {formatDateTime(detailOrder.placedAt)} — Order placed
                      </div>
                      {detailOrder.createdAt && (
                        <div className="text-gray-500 text-xs">Synced {formatDateTime(detailOrder.createdAt)}</div>
                      )}
                    </div>
                  </div>

                  {/* Customer card */}
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="text-xs font-medium text-gray-500 mb-2">Customer</div>
                    <div className="font-semibold text-gray-900">{customerDisplay(detailOrder.customer)}</div>
                    {detailOrder.customer?.email && <div className="text-sm text-gray-600 mt-0.5">{detailOrder.customer.email}</div>}
                    {detailOrder.customer?.phone && <div className="text-sm text-gray-600">{detailOrder.customer.phone}</div>}
                  </div>

                  {/* Shipping address */}
                  {detailOrder.customer?.addresses && detailOrder.customer.addresses.length > 0 && (
                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="text-xs font-medium text-gray-500 mb-2">Shipping address</div>
                      <div className="text-sm text-gray-900 whitespace-pre-line">{formatAddress(detailOrder.customer.addresses[0])}</div>
                    </div>
                  )}

                  {/* Billing - same as shipping for now */}
                  {detailOrder.customer?.addresses && detailOrder.customer.addresses.length > 0 && (
                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="text-xs font-medium text-gray-500 mb-2">Billing address</div>
                      <div className="text-sm text-gray-600">Same as shipping address</div>
                    </div>
                  )}

                  {/* Notes placeholder */}
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="text-xs font-medium text-gray-500 mb-1">Notes</div>
                    <div className="text-sm text-gray-400">No notes from customer</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </ViewModal>
      )}
    </DashboardLayout>
  );
}
