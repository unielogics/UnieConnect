import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { StatusChip, Avatar, fmt, Loading, ErrorState, EmptyState, useCloseOnOmsNavigation } from '../ui';
import { useCtxMenu } from '../ContextMenu';
import { CortexRowAction, useInlineRecommendations } from '../InlineRecommendation';
import { cancelOrder, fetchOmsOrders, OmsOrder, publicEntityId } from '../../../lib/oms';
import { num, channelColor } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';
import { MarketplaceFilter, MarketplaceFilterValue } from '../MarketplaceFilter';

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

export const Orders = ({ onOpenOrder, onNavigate, onNewOrder, onImportCsv }: ScreenProps) => {
  const [orders, setOrders] = useState<OmsOrder[]>([]);
  const [marketplaceFilter, setMarketplaceFilter] = useState<MarketplaceFilterValue>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'risk' | 'exceptions' | 'hold' | 'new'>('all');
  const [cancelTarget, setCancelTarget] = useState<OmsOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  useCloseOnOmsNavigation(() => setCancelTarget(null), !!cancelTarget);
  const ctx = useCtxMenu();
  const { recFor, setSelectedRec, drawer: recDrawer } = useInlineRecommendations('orders');

  const load = () => {
    setLoading(true);
    setErr(null);
    fetchOmsOrders(marketplaceFilter)
      .then((d) => setOrders(d.orders || []))
      .catch((e) => setErr(e.message || 'Failed to load orders'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [marketplaceFilter.channel, marketplaceFilter.channelAccountId]);

  const norm = (o: OmsOrder) => ({
    ...o,
    _ch: o.ch || o.account_channel || '—',
    _cust: o.customer || o.customer_name || o.display_name || o.customer_email || '—',
    // A WMS-triggered rate-shop approval hold takes precedence over whatever fulfillment-stage
    // status the order otherwise carries -- surfaces via the existing 'hold' tab/StatusChip
    // ('hold' -> amber, already wired below) without WMS ever writing to orders.status directly.
    _status: o.metadata?.wmsHold?.held ? 'hold' : (o.status || 'new'),
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

  const submitCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelOrder(cancelTarget.id, cancelReason.trim() || 'Cancelled from OMS order screen');
      setCancelTarget(null);
      setCancelReason('');
      await load();
    } finally {
      setCancelling(false);
    }
  };

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
          <button className="btn" onClick={() => onImportCsv?.('orders')}>
            <Icon name="download" size={13} style={{ transform: 'rotate(180deg)' }} /> Import CSV
          </button>
          <button className="btn"><Icon name="download" size={13} /> Export CSV</button>
          <button className="btn primary" onClick={onNewOrder}><Icon name="plus" size={13} /> Manual order</button>
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
            <MarketplaceFilter value={marketplaceFilter} onChange={setMarketplaceFilter} />
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
                  <th style={{ width: 52 }} />
                  <th>Order</th>
                  <th>Channel</th>
                  <th>Customer · State</th>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Total</th>
                  <th>WH</th>
                  <th>Status</th>
                  <th>SLA</th>
                  <th>Promised</th>
                  <th>Carrier · Tracking</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const rec = recFor(o.id, o.publicId, o.displayId, o.chOrderId);
                  return (
                  <tr
                    key={o.id}
                    className={`clickable ${rec ? 'row-cortex-signal' : ''}`}
                    style={{ height: 56 }}
                    onClick={() => onOpenOrder && onOpenOrder(o)}
                    onContextMenu={(e) =>
                      ctx.open(e, [
                        { label: 'Order' },
                        { icon: 'eye', title: 'Open order details', onClick: () => onOpenOrder && onOpenOrder(o) },
                        ...(o.sku ? [{ icon: 'box', title: `Open SKU ${o.sku}`, onClick: () => onNavigate('sku-detail', o.sku!) }] : []),
                        ...(rec ? [{ icon: 'sparkle', title: 'Review Cortex decision', onClick: () => setSelectedRec(rec) }] : []),
                        { icon: 'support', title: 'Email customer', shortcut: '⌘E' },
                        { divider: true },
                        { icon: 'audit', title: 'Open dispute', onClick: () => onNavigate('audits') },
                        { icon: 'refresh', title: `Re-sync from ${o._ch}`, shortcut: '⌘R', onClick: load },
                        { divider: true },
                        {
                          icon: 'x',
                          title: o._status === 'cancelled' ? 'Order already cancelled' : 'Cancel order',
                          danger: true,
                          onClick: () => {
                            if (o._status !== 'cancelled') setCancelTarget(o);
                          },
                        },
                      ])
                    }
                  >
                    <td>
                      <div
                        style={{
                          width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                          border: '1px solid var(--border-subtle)', background: 'var(--bg-elev)', overflow: 'hidden',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)',
                        }}
                      >
                        {o.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={o.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Icon name="box" size={18} />
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="mono strong" style={{ color: 'var(--text)' }}>{o.displayId || o.publicId || publicEntityId('OR', o.id)}</span>
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
                      <div style={{ fontSize: 12.5, color: 'var(--text)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.skuName || o.sku || '—'}
                        {(o.itemCount || 0) > 1 && (
                          <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 600 }}> +{(o.itemCount || 1) - 1} more</span>
                        )}
                      </div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.skuName ? (o.sku || '') : ''}
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
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          {rec && <CortexRowAction rec={rec} onOpen={() => setSelectedRec(rec)} />}
                          <button
                            className="btn ghost sm"
                            disabled={o._status === 'cancelled'}
                            onClick={() => setCancelTarget(o)}
                          >
                            <Icon name="x" size={12} /> Cancel
                          </button>
                        </div>
                      </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      {recDrawer}
      {cancelTarget && (
        <div className="modal-overlay" onClick={() => setCancelTarget(null)}>
          <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Cancel order</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {cancelTarget.displayId || cancelTarget.publicId || publicEntityId('OR', cancelTarget.id)}
                </div>
              </div>
              <button className="icon-btn" onClick={() => setCancelTarget(null)}><Icon name="x" /></button>
            </div>
            <div className="modal-body">
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Reason
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why is this order being stopped or cancelled?"
                style={{
                  width: '100%',
                  height: 110,
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  resize: 'vertical',
                }}
              />
            </div>
            <div className="modal-foot">
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>This archives OMS execution and writes the cancellation to the ledger.</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn ghost" onClick={() => setCancelTarget(null)}>Back</button>
                <button className="btn primary" onClick={submitCancel} disabled={cancelling}>
                  {cancelling ? 'Cancelling…' : 'Cancel order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
