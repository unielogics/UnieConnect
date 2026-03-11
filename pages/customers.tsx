import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ChannelBadge from '../components/ChannelBadge';
import ChannelFilter from '../components/ChannelFilter';
import { ViewModal } from '../components/ViewModal';
import { Button } from '../components/Button';
import { apiUrl, TOKEN_KEY } from '../lib/api';

type Customer = {
  _id: string;
  email?: string;
  phone?: string;
  name?: { first?: string; last?: string };
  channels?: string[];
  mappings?: { channel: string; channelDisplay?: string }[];
};

async function fetchCustomers(token: string, channel?: string): Promise<Customer[]> {
  const url = new URL(apiUrl('/api/v1/customers'));
  url.searchParams.set('includeMappings', '1');
  if (channel) url.searchParams.set('channel', channel);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchCustomerDetail(token: string, id: string): Promise<Customer | null> {
  const res = await fetch(apiUrl(`/api/v1/customers/${id}`), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return res.json();
}

function nameDisplay(n?: { first?: string; last?: string } | null): string {
  if (!n) return '—';
  const parts = [n.first, n.last].filter(Boolean);
  return parts.length ? parts.join(' ') : '—';
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState('');
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadCustomers = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchCustomers(token, channelFilter || undefined);
      setCustomers(data);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, [channelFilter]);

  const openDetail = async (id: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;
    setDetailLoading(true);
    setDetailCustomer(null);
    try {
      const customer = await fetchCustomerDetail(token, id);
      setDetailCustomer(customer || null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailCustomer(null);
  };

  return (
    <DashboardLayout title="Customers" subtitle="Manage customer information and relationships">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Customers</h2>
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
                  <th style={{ padding: '10px 12px', width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c._id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{nameDisplay(c.name) === '—' ? (c.email || '—') : nameDisplay(c.name)}</td>
                    <td style={{ padding: '10px 12px' }}>{c.email || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {c.channels && c.channels.length > 0 ? (
                          c.channels.map((ch) => <ChannelBadge key={ch} channel={ch} />)
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
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
            <div className="flex flex-col gap-4 text-sm">
              <div className="grid gap-3">
                <div>
                  <div className="text-xs text-gray-500">Name</div>
                  <div>{nameDisplay(detailCustomer.name)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Email</div>
                  <div>{detailCustomer.email || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Phone</div>
                  <div>{detailCustomer.phone || '—'}</div>
                </div>
                {detailCustomer.mappings && detailCustomer.mappings.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Channels</div>
                    <div className="flex gap-2 flex-wrap">
                      {detailCustomer.mappings.map((m, i) => (
                        <ChannelBadge key={i} channel={m.channel} label={m.channelDisplay} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </ViewModal>
      )}
    </DashboardLayout>
  );
}
