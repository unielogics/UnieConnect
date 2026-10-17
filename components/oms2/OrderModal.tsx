import React from 'react';
import { Icon } from './icons';
import { Modal, Chip, StatusChip, Avatar } from './ui';
import type { OmsOrder } from '../../lib/oms';
import { num } from '../../lib/oms-adapters';
import type { NavFn } from './UnieConnectApp';

const OrdStat = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <div>
    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 3, color: tone === 'good' ? 'var(--green-text)' : 'var(--text)' }}>{value}</div>
  </div>
);

export const OrderModal = ({ order, onClose, onNavigate }: { order: OmsOrder; onClose: () => void; onNavigate: NavFn }) => {
  const ch = order.ch || order.account_channel || 'channel';
  const customer = order.customer || order.customer_name || order.display_name || order.customer_email || 'Customer';
  const total = num(order.total);
  const cost = num(order.cost);
  const lines = order.lines || [];
  const qty = num(order.qty) || lines.reduce((sum, line) => sum + num(line.quantity), 0);
  const wh = order.wh || 'Not assigned';
  const status = order.status || 'new';
  const date = order.date || '';
  const promised = order.promised || '—';

  const timeline = order.timeline || [];
  const recommendation = order.metadata?.fulfillmentRecommendation;
  const eventTime = (value?: string) => {
    if (!value) return '—';
    const dateValue = new Date(value);
    return Number.isNaN(dateValue.getTime()) ? value : dateValue.toLocaleString();
  };

  return (
    <Modal
      title={`Order ${order.id}`}
      subtitle={`${ch} · ${order.chOrderId || order.id} · ${date}`}
      onClose={onClose}
      width={1040}
      footer={
        <>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
            <span className="mono">{order.tracking || '—'}</span> · {order.carrier || '—'}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" onClick={() => onNavigate('ledger')}><Icon name="ledger" size={13} /> Ledger</button>
          </div>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16, padding: 14, background: 'var(--bg-sunken)', borderRadius: 10 }}>
        <OrdStat label="Items" value={order.items ?? 1} />
        <OrdStat label="Quantity" value={qty} />
        <OrdStat label="Total" value={`$${total.toFixed(2)}`} />
        <OrdStat label="Fulfillment cost" value={cost ? `$${cost.toFixed(2)}` : '—'} />
        <OrdStat label="Margin" value={total ? `${Math.round(((total - cost) / total) * 100)}%` : '—'} tone="good" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <StatusChip status={status} />
        {order.sla && <StatusChip status={order.sla} />}
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>·</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
          Promised by <strong style={{ color: 'var(--text)' }}>{promised}</strong>
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn sm" onClick={() => { onNavigate('customers'); onClose(); }}>View customer →</button>
          {order.sku && (
            <button className="btn sm" onClick={() => { onNavigate('sku-detail', order.sku); onClose(); }}>View SKU →</button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Fulfillment timeline</div>
            <Chip dot={false}>{timeline.length} events</Chip>
          </div>
          <div style={{ padding: 0 }}>
            {timeline.length === 0 && <div style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 12.5 }}>No fulfillment events have been received from a connected warehouse yet.</div>}
            {timeline.map((t, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 28px 1fr',
                  gap: 12,
                  padding: '12px 16px',
                  borderBottom: i === timeline.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                }}
              >
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{eventTime(t.ts)}</span>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--green)',
                    color: 'white',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  <Icon name="check" size={12} />
                  {i < timeline.length - 1 && (
                    <div style={{ position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)', width: 1, height: 32, background: 'var(--border)' }} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.title}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{t.source || 'OMS'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Customer</div>
              <button className="btn ghost sm" onClick={() => { onNavigate('customers'); onClose(); }}>Profile →</button>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Avatar name={customer} size={36} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{customer}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {order.state || '—'}
                    {order.customer_email ? ` · ${order.customer_email}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="kv">
                  <div className="kv-label">Channel</div>
                  <div className="kv-value">
                    <Chip dot={false}>{ch}</Chip>
                  </div>
                </div>
                <div className="kv">
                  <div className="kv-label">Warehouse</div>
                  <div className="kv-value mono">{wh}</div>
                </div>
              </div>
            </div>
          </div>

          {lines.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Order items</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {lines.map((line, index) => (
                  <button key={line.id || index} className="order-line-row" onClick={() => line.itemId && (onNavigate('sku-detail', line.itemId), onClose())} disabled={!line.itemId}>
                    <span className="mono">{line.sku || 'No SKU'}</span>
                    <span>{line.title || line.sku || 'Order item'}</span>
                    <span className="mono">{num(line.quantity)} × ${num(line.unitPrice).toFixed(2)}</span>
                    <strong>${num(line.totalPrice || num(line.quantity) * num(line.unitPrice)).toFixed(2)}</strong>
                  </button>
                ))}
              </div>
            </div>
          )}

          {order.metadata?.wmsHold?.held && (
            <div className="card" style={{ borderColor: 'var(--amber-soft)', background: 'linear-gradient(180deg, var(--amber-soft) 0%, var(--bg-elev) 60%)' }}>
              <div className="card-header">
                <div className="card-title">
                  <Icon name="warning" size={15} style={{ color: 'var(--amber)' }} /> Held for shipping approval
                </div>
              </div>
              <div className="card-body" style={{ fontSize: 12.5 }}>
                {order.metadata.wmsHold.reason || 'This order is on hold at the warehouse pending a shipping-rate decision.'}
                {order.metadata.wmsHold.at && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                    Held since {new Date(order.metadata.wmsHold.at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )}

          {status === 'exception' && (
            <div className="card" style={{ borderColor: 'var(--red-soft)', background: 'linear-gradient(180deg, var(--red-soft) 0%, var(--bg-elev) 60%)' }}>
              <div className="card-header">
                <div className="card-title">
                  <Icon name="warning" size={15} style={{ color: 'var(--red)' }} /> Exception
                </div>
              </div>
              <div className="card-body" style={{ fontSize: 12.5 }}>
                {order.metadata?.exceptionReason || `The warehouse reported an exception for this order${wh !== 'Not assigned' ? ` at ${wh}` : ''}. Review the connected WMS event history before taking action.`}
              </div>
            </div>
          )}

          {recommendation?.summary && (
            <div className="card" style={{ borderColor: 'var(--purple-soft)' }}>
              <div className="card-header">
                <div className="card-title">
                  <Icon name="sparkle" size={15} style={{ color: 'var(--purple)' }} /> Cortex recommendation
                </div>
              </div>
              <div className="card-body" style={{ fontSize: 12.5 }}>{recommendation.summary}</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
