import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../components/DashboardLayout';
import ChannelBadge from '../components/ChannelBadge';
import ChannelFilter from '../components/ChannelFilter';
import { ViewModal } from '../components/ViewModal';
import { Button } from '../components/Button';
import { NotesPanel } from '../components/NotesPanel';
import { apiUrl, TOKEN_KEY } from '../lib/api';

type CustomerAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
};

type Customer = {
  _id: string;
  email?: string;
  phone?: string;
  name?: { first?: string; last?: string };
  addresses?: CustomerAddress[];
  tags?: string[];
  channels?: string[];
  mappings?: { channel: string; channelDisplay?: string }[];
  orderCount?: number;
  lastOrderDate?: string;
  orderStatuses?: string[];
  totalItems?: number;
};

type FetchCustomersParams = {
  channel?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

async function fetchCustomers(token: string, params?: FetchCustomersParams): Promise<Customer[]> {
  const url = new URL(apiUrl('/api/v1/customers'));
  url.searchParams.set('includeMappings', '1');
  if (params?.channel) url.searchParams.set('channel', params.channel);
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.sortBy) url.searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) url.searchParams.set('sortOrder', params.sortOrder);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function formatOrderStatusSummary(statuses?: string[]): string {
  if (!statuses || statuses.length === 0) return '—';
  const counts = statuses.reduce<Record<string, number>>((acc, s) => {
    const k = (s || 'unknown').toLowerCase();
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
    .join(', ');
}

async function fetchCustomerDetail(token: string, id: string): Promise<Customer | null> {
  const res = await fetch(apiUrl(`/api/v1/customers/${id}`), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return res.json();
}

type CustomerOrdersResponse = {
  orders: Array<{
    _id: string;
    externalOrderId: string;
    status: string;
    channel?: string;
    channelDisplay?: string;
    placedAt?: string;
    totals?: { total?: number };
    currency?: string;
  }>;
  summary: { totalOrders: number; totalValue: number; ordersByStatus: Array<{ _id: string; count: number }> };
};

async function fetchCustomerOrders(token: string, customerId: string): Promise<CustomerOrdersResponse | null> {
  const res = await fetch(apiUrl(`/api/v1/customers/${customerId}/orders`), {
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
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount);
}

function nameDisplay(n?: { first?: string; last?: string } | null): string {
  if (!n) return '—';
  const parts = [n.first, n.last].filter(Boolean);
  return parts.length ? parts.join(' ') : '—';
}

function formatAddress(addr: CustomerAddress): string {
  const parts = [addr.line1, addr.line2, [addr.city, addr.region, addr.postalCode].filter(Boolean).join(' '), addr.country].filter(Boolean);
  return parts.join('\n');
}

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrdersResponse | null>(null);

  const loadCustomers = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchCustomers(token, {
        channel: channelFilter || undefined,
        search: search || undefined,
        sortBy,
        sortOrder,
      });
      setCustomers(data);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, [channelFilter, search, sortBy, sortOrder]);

  const handleSearch = () => setSearch(searchInput.trim());

  const openDetail = async (id: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;
    setDetailLoading(true);
    setDetailCustomer(null);
    setCustomerOrders(null);
    router.replace(`/customers?id=${id}`, undefined, { shallow: true });
    try {
      const [customer, ordersData] = await Promise.all([
        fetchCustomerDetail(token, id),
        fetchCustomerOrders(token, id),
      ]);
      setDetailCustomer(customer || null);
      setCustomerOrders(ordersData || null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    const id = typeof router.query.id === 'string' ? router.query.id : null;
    if (id && !detailLoading && detailCustomer?._id !== id) void openDetail(id);
  }, [router.query.id]);

  const closeDetail = () => {
    setDetailCustomer(null);
    setCustomerOrders(null);
    if (router.query.id) router.replace('/customers', undefined, { shallow: true });
  };

  return (
    <DashboardLayout title="Customers" subtitle="Manage customer information and relationships">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Customers</h2>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search name, email, phone..."
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-56 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Button variant="secondary" size="sm" onClick={handleSearch}>
              Search
            </Button>
          </div>
          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [by, ord] = e.target.value.split(':');
              setSortBy(by);
              setSortOrder((ord as 'asc' | 'desc') || 'desc');
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="updatedAt:desc">Newest first</option>
            <option value="updatedAt:asc">Oldest first</option>
            <option value="name:asc">Name A–Z</option>
            <option value="name:desc">Name Z–A</option>
            <option value="orderCount:desc">Most orders</option>
            <option value="orderCount:asc">Fewest orders</option>
            <option value="lastOrderDate:desc">Last order (newest)</option>
            <option value="lastOrderDate:asc">Last order (oldest)</option>
            <option value="totalItems:desc">Most items</option>
            <option value="totalItems:asc">Fewest items</option>
          </select>
          <ChannelFilter value={channelFilter} onChange={setChannelFilter} includeUnmapped />
        </div>

        {loading ? (
          <div className="text-gray-500">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="text-gray-500">No customers found. Sync orders from your marketplaces to see customers here.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Name</th>
                  <th style={{ padding: '10px 12px' }}>Email</th>
                  <th style={{ padding: '10px 12px' }}>Channels</th>
                  <th style={{ padding: '10px 12px', width: 80 }}>Orders</th>
                  <th style={{ padding: '10px 12px', width: 100 }}>Last order</th>
                  <th style={{ padding: '10px 12px', minWidth: 120 }}>Order status</th>
                  <th style={{ padding: '10px 12px', width: 80 }}>Items</th>
                  <th style={{ padding: '10px 12px', width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c._id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                      <Link href={`/customers?id=${c._id}`} className="text-blue-600 hover:underline font-medium">
                        {nameDisplay(c.name) === '—' ? (c.email || '—') : nameDisplay(c.name)}
                      </Link>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{c.email || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {c.mappings && c.mappings.length > 0 ? (
                          (() => {
                            const seen = new Set<string>();
                            return c.mappings
                              .filter((m) => {
                                const key = m.channelDisplay || m.channel;
                                if (seen.has(key)) return false;
                                seen.add(key);
                                return true;
                              })
                              .map((m, i) => <ChannelBadge key={i} channel={m.channel} label={m.channelDisplay} />);
                          })()
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{c.orderCount ?? 0}</td>
                    <td style={{ padding: '10px 12px' }}>{formatDate(c.lastOrderDate)}</td>
                    <td style={{ padding: '10px 12px' }}>{formatOrderStatusSummary(c.orderStatuses)}</td>
                    <td style={{ padding: '10px 12px' }}>{c.totalItems ?? 0}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void openDetail(c._id)}
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

      {(detailCustomer !== null || detailLoading) && (
        <ViewModal
          isOpen
          onClose={closeDetail}
          title={detailLoading ? 'Customer details' : nameDisplay(detailCustomer?.name) || detailCustomer?.email || 'Customer'}
        >
          {detailLoading ? (
            <div className="text-gray-500">Loading...</div>
          ) : detailCustomer ? (
            <div className="modal-content-with-notes" style={{ height: '100%' }}>
              <div className="modal-form-main">
            <div className="space-y-6">
              {/* Stats row: Orders, Amount, Shipment status, Channels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                  <div className="text-xs text-gray-500 font-medium mb-0.5">Orders</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {customerOrders?.summary?.totalOrders ?? 0}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                  <div className="text-xs text-gray-500 font-medium mb-0.5">Amount spent</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {customerOrders?.summary?.totalValue != null
                      ? formatMoney(customerOrders.summary.totalValue)
                      : '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                  <div className="text-xs text-gray-500 font-medium mb-0.5">Shipment status</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {customerOrders?.summary?.ordersByStatus && customerOrders.summary.ordersByStatus.length > 0
                      ? customerOrders.summary.ordersByStatus.map((s) => (
                          <span
                            key={s._id}
                            className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {String(s._id).replace(/_/g, ' ')}: {s.count}
                          </span>
                        ))
                      : <span className="text-sm text-gray-400">—</span>}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                  <div className="text-xs text-gray-500 font-medium mb-0.5">Channels</div>
                  <div className="flex gap-1 flex-wrap">
                    {detailCustomer.mappings && detailCustomer.mappings.length > 0
                      ? detailCustomer.mappings.map((m, i) => <ChannelBadge key={i} channel={m.channel} label={m.channelDisplay} />)
                      : '—'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Timeline placeholder, Contact */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="text-xs font-medium text-gray-500 mb-3">Recent orders</div>
                    {customerOrders?.orders && customerOrders.orders.length > 0 ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                              <th style={{ padding: '6px 8px' }}>Order</th>
                              <th style={{ padding: '6px 8px' }}>Date</th>
                              <th style={{ padding: '6px 8px' }}>Status</th>
                              <th style={{ padding: '6px 8px' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerOrders.orders.slice(0, 10).map((o) => (
                              <tr key={o._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '6px 8px' }}>
                                  <Link href={`/orders?id=${o._id}`} className="text-blue-600 hover:underline font-medium">
                                    {o.externalOrderId || o._id}
                                  </Link>
                                </td>
                                <td style={{ padding: '6px 8px' }}>{formatDate(o.placedAt)}</td>
                                <td style={{ padding: '6px 8px' }}>{o.status || '—'}</td>
                                <td style={{ padding: '6px 8px' }}>{formatMoney(o.totals?.total, o.currency)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {customerOrders.orders.length > 10 && (
                          <div className="text-xs text-gray-500 mt-2">
                            Showing 10 of {customerOrders.orders.length} orders
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No orders yet</div>
                    )}
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="text-xs font-medium text-gray-500 mb-2">Contact information</div>
                    <div className="space-y-1 text-sm">
                      {detailCustomer.email && <div className="text-gray-900">{detailCustomer.email}</div>}
                      {detailCustomer.phone && <div className="text-gray-900">{detailCustomer.phone}</div>}
                      {!detailCustomer.email && !detailCustomer.phone && <div className="text-gray-400">—</div>}
                    </div>
                  </div>
                </div>

                {/* Right: Default address, Tags, Notes */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="text-xs font-medium text-gray-500 mb-2">Default address</div>
                    {detailCustomer.addresses && detailCustomer.addresses.length > 0 ? (
                      <div className="text-sm text-gray-900 whitespace-pre-line">{formatAddress(detailCustomer.addresses[0])}</div>
                    ) : (
                      <div className="text-sm text-gray-400">No address</div>
                    )}
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="text-xs font-medium text-gray-500 mb-1">Tags</div>
                    <div className="text-sm text-gray-400">{detailCustomer.tags && detailCustomer.tags.length > 0 ? detailCustomer.tags.join(', ') : 'None'}</div>
                  </div>
                </div>
              </div>
            </div>
              </div>
              <NotesPanel entityType="customer" entityId={detailCustomer._id} />
            </div>
          ) : null}
        </ViewModal>
      )}
    </DashboardLayout>
  );
}
