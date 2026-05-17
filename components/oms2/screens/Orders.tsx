import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { StatusChip, Avatar, fmt, Loading, ErrorState, EmptyState } from '../ui';
import { useCtxMenu } from '../ContextMenu';
import { fetchOmsOrders, OmsOrder } from '../../../lib/oms';
import { num, channelColor } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';

const ChannelTag = ({ ch }: { ch: string }) => (
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
    {ch}
  </span>
);

export const Orders = ({ onOpenOrder, onNavigate }: ScreenProps) => {
  const [orders, setOrders] = useState<OmsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'risk' | 'exceptions' | 'hold' | 'new'>('all');
  const ctx = useCtxMenu();

  const load = () => {
    setLoading(true);
    setErr(null);
    fetchOmsOrders()
      .then((d) => setOrders(d.orders || []))
      .catch((e) => setErr(e.message || 'Failed to load orders'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const norm = (o: OmsOrder) => ({
    ...o,
    _ch: o.ch || o.account_channel || '—',
    _cust: o.customer || o.customer_name || o.display_name || o.customer_email || '—',
    _status: o.status || 'new',
    _sla: o.sla || 'on-track',
  });
  const all = useMemo(() => orders.map(norm), [orders]);
  const counts = {
    all: all.length,
    risk: all.filter((o) => o._sla !== 'on-track').length,
    exceptions: all.filter((o) => o._status === 'exception').length,
    hold: all.filter((o) => o._status === 'hold').length,
    new: all.filter((o) => o._status === 'new').length,
  };
  const filtered = all.filter((o) => {
    if (tab === 'all') return true;
    if (tab === 'risk') return o._sla !== 'on-track';
    if (tab === 'exceptions') return o._status === 'exception';
    if (tab === 'hold') return o._status === 'hold';
    if (tab === 'new') return o._status === 'new';
    return true;
  });

  const totalRev = all.reduce((a, o) => a + num(o.total), 0);
  const avgCost = all.length ? all.reduce((a, o) => a + num(o.cost), 0) / all.length : 0;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">
            Marketplace orders, enriched with WMS fulfillment truth and SLA risk. {all.length} orders matched.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={load}><Icon name="refresh" size={13} /> Sync</button>
          <button className="btn"><Icon name="download" size={13} /> Export CSV</button>
          <button className="btn primary"><Icon name="plus" size={13} /> Manual order</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Orders</div>
          <div className="stat-value">{fmt.num(all.length)}</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>matched window</div>
        </div>
        <div className="stat warn">
          <div className="stat-label">At-risk SLA</div>
          <div className="stat-value">{counts.risk}</div>
          <div className="stat-delta down"><span className="arrow">▲</span> needs attention</div>
        </div>
        <div className="stat danger">
          <div className="stat-label">Exceptions / holds</div>
          <div className="stat-value">{counts.exceptions + counts.hold}</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>open</div>
        </div>
        <div className="stat good">
          <div className="stat-label">Order revenue</div>
          <div className="stat-value">{fmt.money(totalRev, { compact: true })}</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>avg cost {fmt.money(avgCost)}</div>
        </div>
      </div>

      <div className="tabs">
        {(['all', 'risk', 'exceptions', 'hold', 'new'] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
            {t === 'risk' ? 'At-risk' : t}
            <span className="count">{counts[t]}</span>
          </button>
        ))}
      </div>

      {err ? (
        <div className="card"><ErrorState message={err} onRetry={load} /></div>
      ) : loading ? (
        <div className="card"><Loading rows={6} /></div>
      ) : (
        <div className="table-wrap">
          <div className="table-toolbar">
            <button className="filter-chip applied">Channel: All <Icon name="x" size={10} /></button>
            <button className="filter-chip">Warehouse</button>
            <button className="filter-chip">Date</button>
            <button className="filter-chip">Carrier</button>
            <div className="spacer" />
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
              Saved view: <strong style={{ color: 'var(--text)' }}>Ops daily</strong>
            </span>
            <button className="btn ghost sm"><Icon name="columns" size={12} /> Columns</button>
          </div>
          {filtered.length === 0 ? (
            <EmptyState>No orders in this view.</EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Channel</th>
                  <th>Customer · State</th>
                  <th>SKU</th>
                  <th className="num">Qty</th>
                  <th className="num">Total</th>
                  <th>WH</th>
                  <th>Status</th>
                  <th>SLA</th>
                  <th>Promised</th>
                  <th>Carrier · Tracking</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    className="clickable"
                    onClick={() => onOpenOrder && onOpenOrder(o)}
                    onContextMenu={(e) =>
                      ctx.open(e, [
                        { label: 'Order' },
                        { icon: 'eye', title: 'Open order details', onClick: () => onOpenOrder && onOpenOrder(o) },
                        ...(o.sku ? [{ icon: 'box', title: `Open SKU ${o.sku}`, onClick: () => onNavigate('sku-detail', o.sku!) }] : []),
                        { icon: 'support', title: 'Email customer', shortcut: '⌘E' },
                        { divider: true },
                        { icon: 'audit', title: 'Open dispute', onClick: () => onNavigate('audits') },
                        { icon: 'refresh', title: `Re-sync from ${o._ch}`, shortcut: '⌘R', onClick: load },
                        { divider: true },
                        { icon: 'x', title: 'Cancel order', danger: true },
                      ])
                    }
                  >
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="mono strong" style={{ color: 'var(--text)' }}>{o.id}</span>
                        <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{o.chOrderId || ''}</span>
                      </div>
                    </td>
                    <td><ChannelTag ch={o._ch} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Avatar name={o._cust} size={20} />
                        <div>
                          <div style={{ fontSize: 12.5 }}>{o._cust}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{o.state || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text)' }}>{o.sku || '—'}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {o.skuName || ''}
                      </div>
                    </td>
                    <td className="num mono">{num(o.qty)}</td>
                    <td className="num mono strong">${num(o.total).toFixed(2)}</td>
                    <td className="mono">{o.wh || '—'}</td>
                    <td><StatusChip status={o._status} /></td>
                    <td><StatusChip status={o._sla} /></td>
                    <td className="muted">{o.promised || '—'}</td>
                    <td>
                      <div style={{ fontSize: 12 }}>{o.carrier || '—'}</div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{o.tracking || ''}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
