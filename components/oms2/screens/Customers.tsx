import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { Icon } from '../icons';
import { Chip, Avatar, fmt, Loading, ErrorState, EmptyState, downloadCsv, useCloseOnOmsNavigation } from '../ui';
import { useCtxMenu } from '../ContextMenu';
import { fetchOmsCustomerDetail, fetchOmsCustomers, OmsCustomer, OmsCustomerDetail } from '../../../lib/oms';
import { num, channelColor } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';

const ChannelTagInline = ({ ch }: { ch?: string }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 7px',
      borderRadius: 4,
      background: 'var(--bg-active)',
      color: 'var(--text-secondary)',
    }}
  >
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: channelColor(ch) }} />
    {ch || '—'}
  </span>
);

const segChip = (seg?: string) => {
  switch (seg) {
    case 'VIP':
      return <Chip tone="purple">VIP</Chip>;
    case 'Repeat':
      return <Chip tone="green">Repeat</Chip>;
    case 'Returning':
      return <Chip tone="blue">Returning</Chip>;
    default:
      return <Chip>{seg || 'New'}</Chip>;
  }
};

const formatDate = (value?: string) => value
  ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  : '—';

const formatAddress = (customer: OmsCustomer) => {
  const address = customer.addresses?.[0];
  if (!address) return 'No address on file';
  return [
    address.line1 || address.addressLine1 || address.address,
    address.line2 || address.addressLine2,
    [address.city, address.state || address.region || address.stateOrProvinceCode, address.postalCode || address.postal || address.zipCode || address.zip].filter(Boolean).join(' '),
    address.country,
  ].filter(Boolean).join(', ');
};

export const Customers = ({ onNavigate, onOpenOrderById, onNewCustomer, onImportCsv, onCortexEntityChange }: ScreenProps) => {
  const router = useRouter();
  const [rows, setRows] = useState<OmsCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('all');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OmsCustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const ctx = useCtxMenu();

  const load = () => {
    setLoading(true);
    setErr(null);
    fetchOmsCustomers()
      .then((d) => setRows(d.customers || []))
      .catch((e) => setErr(e.message || 'Failed to load customers'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const loadDetail = (customerId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    fetchOmsCustomerDetail(customerId)
      .then(setDetail)
      .catch((error: any) => {
        setDetail(null);
        setDetailError(error?.message || 'Customer details could not be loaded.');
      })
      .finally(() => setDetailLoading(false));
  };

  const openCustomer = (customerId: string) => {
    setDetailId(customerId);
    onCortexEntityChange?.({ type: 'customer', id: customerId });
    setDetail(null);
    loadDetail(customerId);
    router.replace(
      { pathname: '/oms', query: { view: 'customers', customer: customerId } },
      undefined,
      { shallow: true }
    );
  };

  const closeCustomer = () => {
    setDetailId(null);
    onCortexEntityChange?.(null);
    setDetail(null);
    setDetailError(null);
    if (router.query.customer) {
      router.replace({ pathname: '/oms', query: { view: 'customers' } }, undefined, { shallow: true });
    }
  };

  useEffect(() => {
    if (!router.isReady) return;
    const customerId = typeof router.query.customer === 'string' ? router.query.customer.trim() : '';
    if (!customerId || customerId === detailId) return;
    setDetailId(customerId);
    onCortexEntityChange?.({ type: 'customer', id: customerId });
    setDetail(null);
    loadDetail(customerId);
  }, [detailId, router.isReady, router.query.customer]);

  const filtered = useMemo(
    () =>
      rows.filter((c) => {
        if (segment !== 'all' && c.segment !== segment) return false;
        if (
          search &&
          !(c.name || '').toLowerCase().includes(search.toLowerCase()) &&
          !(c.email || '').toLowerCase().includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [rows, search, segment]
  );

  const totalLTV = rows.reduce((s, c) => s + num(c.ltv), 0);
  const repeatRate = rows.length ? rows.filter((c) => num(c.orders) > 1).length / rows.length : 0;
  const vips = rows.filter((c) => c.segment === 'VIP').length;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Buyers who've ordered across your channels. Unified by email + address fingerprint.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => onImportCsv?.('customers')}>
            <Icon name="download" size={13} style={{ transform: 'rotate(180deg)' }} /> Import CSV
          </button>
          <button className="btn" onClick={() => downloadCsv('unieconnect-customers.csv', filtered.map((customer) => ({
            Name: customer.name, Email: customer.email || '', Phone: customer.phone || '', City: customer.city || '', State: customer.state || '',
            'Primary channel': customer.primaryChannel || '', Orders: customer.orders, LTV: customer.ltv, AOV: customer.aov,
            Segment: customer.segment || '', 'Last order': customer.lastOrder || '',
          })))}><Icon name="download" size={13} /> Export</button>
          <button className="btn" onClick={onNewCustomer}><Icon name="plus" size={13} /> Add customer</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Customers</div>
          <div className="stat-value">{fmt.num(rows.length)}</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>unified</div>
        </div>
        <div className="stat good">
          <div className="stat-label">Repeat rate</div>
          <div className="stat-value">{Math.round(repeatRate * 100)}%</div>
          <div className="stat-delta up"><span className="arrow">▲</span> &gt;1 order</div>
        </div>
        <div className="stat">
          <div className="stat-label">VIP customers</div>
          <div className="stat-value">{vips}</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>
            {rows.length ? Math.round((vips / rows.length) * 100) : 0}% of total
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Avg LTV</div>
          <div className="stat-value">${rows.length ? (totalLTV / rows.length).toFixed(0) : 0}</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>lifetime value</div>
        </div>
      </div>

      {err ? (
        <div className="card"><ErrorState message={err} onRetry={load} /></div>
      ) : loading ? (
        <div className="card"><Loading rows={6} /></div>
      ) : (
        <div className="table-wrap">
          <div className="table-toolbar">
            <div style={{ position: 'relative', flex: '0 1 280px' }}>
              <Icon name="search" size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email"
                style={{ width: '100%', height: 28, padding: '0 10px 0 28px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 12 }}
              />
            </div>
            {['all', 'VIP', 'Repeat', 'Returning', 'New'].map((s) => (
              <button key={s} className={`filter-chip ${segment === s ? 'applied' : ''}`} onClick={() => setSegment(s)} style={{ cursor: 'pointer', textTransform: 'capitalize' }}>
                {s}
              </button>
            ))}
            <div className="spacer" />
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
              {filtered.length} of {rows.length}
            </span>
          </div>
          {filtered.length === 0 ? (
            <EmptyState>No customers match.</EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Location</th>
                  <th>Primary channel</th>
                  <th className="num">Orders</th>
                  <th className="num">LTV</th>
                  <th className="num">AOV</th>
                  <th>Last order</th>
                  <th>First order</th>
                  <th>Segment</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="clickable"
                    onClick={() => openCustomer(c.id)}
                    onContextMenu={(e) =>
                      ctx.open(e, [
                        { label: 'Customer' },
                        { icon: 'eye', title: 'Open customer profile', onClick: () => openCustomer(c.id) },
                        { icon: 'orders', title: 'View orders', onClick: () => onNavigate('orders') },
                        ...(c.email ? [{ icon: 'support', title: 'Email customer', onClick: () => { window.location.href = `mailto:${c.email}`; } }] : []),
                        { divider: true },
                        { icon: 'refresh', title: 'Refresh data', shortcut: '⌘R', onClick: load },
                      ])
                    }
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={c.name} size={26} />
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{c.city || '—'}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{c.state || ''}</div>
                    </td>
                    <td><ChannelTagInline ch={c.primaryChannel} /></td>
                    <td className="num mono strong">{num(c.orders)}</td>
                    <td className="num mono strong">${num(c.ltv).toLocaleString()}</td>
                    <td className="num mono muted">${num(c.aov).toFixed(2)}</td>
                    <td className="muted">{c.lastOrder || '—'}</td>
                    <td className="muted">{c.firstOrder || '—'}</td>
                    <td>{segChip(c.segment)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(c.tags || []).map((t) => (
                          <Chip key={t} dot={false} tone="outline">
                            {t}
                          </Chip>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {detailId && (
        <CustomerDetailDrawer
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={closeCustomer}
          onRetry={() => loadDetail(detailId)}
          onOpenOrder={(orderId) => onOpenOrderById?.(orderId)}
        />
      )}
    </div>
  );
};

const CustomerDetailDrawer = ({ detail, loading, error, onClose, onRetry, onOpenOrder }: {
  detail: OmsCustomerDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  onOpenOrder: (orderId: string) => void;
}) => {
  useCloseOnOmsNavigation(onClose);
  const customer = detail?.customer;

  return (
    <div className="modal-overlay" style={{ placeItems: 'stretch end' }} onClick={onClose}>
      <div className="modal oms-side-drawer" style={{ width: 'min(100vw, 620px)', minWidth: 0, maxHeight: '100vh', height: '100vh', borderRadius: 0 }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Avatar name={customer?.name || 'Customer'} size={34} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer?.name || 'Customer profile'}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{customer?.displayId || customer?.publicId || ''}</div>
            </div>
          </div>
          <button className="icon-btn" aria-label="Close customer details" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="modal-body">
          {loading ? (
            <Loading rows={6} />
          ) : error ? (
            <ErrorState message={error} onRetry={onRetry} />
          ) : !customer || !detail ? (
            <EmptyState>Customer details are unavailable.</EmptyState>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="stat-grid cols-3" style={{ margin: 0 }}>
                <div className="stat"><div className="stat-label">Orders</div><div className="stat-value">{fmt.num(detail.summary.totalOrders)}</div></div>
                <div className="stat good"><div className="stat-label">Lifetime value</div><div className="stat-value">{fmt.money(detail.summary.totalValue)}</div></div>
                <div className="stat"><div className="stat-label">Average order</div><div className="stat-value">{fmt.money(customer.aov)}</div></div>
              </div>

              <div className="card" style={{ boxShadow: 'none' }}>
                <div className="card-header"><div className="card-title">Customer details</div>{segChip(customer.segment)}</div>
                <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                  <div><div className="field-label">Contact</div><div>{customer.email || 'No email'}{customer.phone ? ` · ${customer.phone}` : ''}</div></div>
                  <div><div className="field-label">Address</div><div>{formatAddress(customer)}</div></div>
                  <div><div className="field-label">Primary channel</div><ChannelTagInline ch={customer.primaryChannel} /></div>
                  <div><div className="field-label">Activity</div><div>{formatDate(customer.firstOrder)} first order · {formatDate(customer.lastOrder)} latest order</div></div>
                  {(customer.tags || []).length > 0 && <div><div className="field-label">Tags</div><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{customer.tags!.map((tag) => <Chip key={tag} dot={false} tone="outline">{tag}</Chip>)}</div></div>}
                </div>
              </div>

              <div className="card" style={{ boxShadow: 'none' }}>
                <div className="card-header"><div className="card-title">Recent orders <Chip dot={false}>{detail.orders.length}</Chip></div></div>
                {detail.orders.length === 0 ? (
                  <EmptyState>No orders are linked to this customer.</EmptyState>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data">
                      <thead><tr><th>Order</th><th>Date</th><th>Status</th><th className="num">Total</th><th /></tr></thead>
                      <tbody>{detail.orders.slice(0, 20).map((order) => (
                        <tr key={order.id} className="clickable" onClick={() => onOpenOrder(order.id)}>
                          <td className="mono strong">{order.displayId || order.chOrderId || order.id}</td>
                          <td>{formatDate(order.placedAt || order.date)}</td>
                          <td><Chip dot={false}>{order.status || 'open'}</Chip></td>
                          <td className="num mono strong">{fmt.money(num(order.total))}</td>
                          <td><Icon name="chevron" size={13} /></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
