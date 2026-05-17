import React, { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { Chip, StatusChip, ProgressBar, fmt, Loading, ErrorState, EmptyState } from '../ui';
import { fetchOmsSkuDetail, OmsSkuDetail } from '../../../lib/oms';
import { num, docTone, riskLabel, channelColor } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';

type Tab = 'overview' | 'warehouses' | 'history' | 'channels' | 'billing' | 'orders';

export const SkuDetail = ({ skuId, onBack, onNavigate, toggleSelect, isSelected }: ScreenProps & { onBack?: () => void }) => {
  const [data, setData] = useState<OmsSkuDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const load = () => {
    if (!skuId) {
      setErr('No SKU selected');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    fetchOmsSkuDetail(skuId)
      .then(setData)
      .catch((e) => setErr(e.message || 'Failed to load SKU'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [skuId]);

  const back = () => (onBack ? onBack() : onNavigate('skus'));

  if (err) return <div className="page fade-in"><div className="card"><ErrorState message={err} onRetry={load} /></div></div>;
  if (loading || !data) return <div className="page fade-in"><div className="card"><Loading rows={6} /></div></div>;

  const intel = data.intelligence || {};
  const rl = riskLabel(intel.risk as string);
  const doc = num(intel.daysOfCover);
  const rev = num(intel.revenue30d);
  const gp = num(intel.grossProfit30d);

  return (
    <div className="page fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12.5 }}>
        <button className="btn ghost sm" onClick={back}>
          <Icon name="chevron" size={11} style={{ transform: 'rotate(180deg)' }} /> Back to SKUs
        </button>
        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
        <span style={{ color: 'var(--text-tertiary)' }}>SKU detail</span>
        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
        <span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>{data.sku}</span>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 18, alignItems: 'center', padding: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              background: 'linear-gradient(135deg, var(--bg-sunken) 0%, var(--bg-active) 100%)',
              border: '1px solid var(--border)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-tertiary)',
              overflow: 'hidden',
            }}
          >
            {data.image ? <img src={data.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="box" size={36} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>{data.sku}</span>
              {data.asin && <Chip dot={false}>{data.asin}</Chip>}
              <Chip tone={rl.tone}>{rl.label}</Chip>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>{data.title || data.sku}</div>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              {data.price != null && (
                <>
                  <span>Price <strong style={{ color: 'var(--text)' }}>${num(data.price).toFixed(2)}</strong></span>
                  <span>·</span>
                </>
              )}
              {data.margin != null && (
                <>
                  <span>Margin <strong style={{ color: 'var(--text)' }}>{(num(data.margin) * 100).toFixed(0)}%</strong></span>
                  <span>·</span>
                </>
              )}
              {data.weight != null && (
                <>
                  <span>Weight <strong style={{ color: 'var(--text)' }}>{num(data.weight)} lb</strong></span>
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn ghost" onClick={() => onNavigate('ledger')}><Icon name="ledger" size={13} /> Ledger</button>
            <button className="btn" onClick={() => onNavigate('plan', data.id)}><Icon name="eye" size={13} /> View in Plan</button>
            <button
              className={`btn ${isSelected(data.id) ? '' : 'primary'}`}
              onClick={() => toggleSelect({ id: data.id, name: data.title || data.sku, ...(data as any) })}
            >
              {isSelected(data.id) ? (
                <><Icon name="check" size={13} /> Selected</>
              ) : (
                <><Icon name="plus" size={13} /> Add to shipment</>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="stat-grid cols-5" style={{ marginBottom: 16 }}>
        <KpiTile label="On hand" value={num(intel.available).toLocaleString()} unit="u" sub={`across ${data.warehouses.length} WHs`} />
        <KpiTile label="Inbound" value={num(intel.inbound).toLocaleString()} unit="u" sub={num(intel.inbound) > 0 ? 'ASNs en route' : 'no inbound'} />
        <KpiTile label="Days of cover" value={Math.round(doc)} unit="d" tone={doc < 14 ? 'danger' : doc < 28 ? 'warn' : 'good'} />
        <KpiTile label="Velocity / 30d" value={num(intel.velocity30d).toLocaleString()} unit="u" />
        <KpiTile label="Revenue / 30d" value={fmt.money(rev, { compact: true })} sub={`${fmt.money(gp, { compact: true })} GP`} tone="good" />
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {([
          ['overview', 'Overview', undefined],
          ['warehouses', 'Warehouses', data.warehouses.length],
          ['history', 'History', undefined],
          ['channels', 'Channels', data.channels?.length],
          ['billing', 'Billing', undefined],
          ['orders', 'Orders', undefined],
        ] as [Tab, string, number | undefined][]).map(([id, label, count]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
            {count !== undefined && <span className="count">{count}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview data={data} />}
      {tab === 'warehouses' && <Warehouses data={data} />}
      {tab === 'history' && <History data={data} />}
      {tab === 'channels' && <Channels data={data} />}
      {tab === 'billing' && <Billing data={data} />}
      {tab === 'orders' && (
        <div className="card">
          <div className="card-body">
            <EmptyState>
              SKU-level order history is shown on the Orders screen filtered by this SKU.
              <div style={{ marginTop: 12 }}>
                <button className="btn sm" onClick={() => onNavigate('orders')}>
                  <Icon name="orders" size={12} /> Open Orders
                </button>
              </div>
            </EmptyState>
          </div>
        </div>
      )}
    </div>
  );
};

const KpiTile = ({ label, value, unit, sub, tone }: { label: string; value: React.ReactNode; unit?: string; sub?: string; tone?: string }) => (
  <div className={`stat ${tone || ''}`}>
    <div className="stat-label">{label}</div>
    <div className="stat-value">
      {value}
      {unit && <span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: 3 }}>{unit}</span>}
    </div>
    {sub && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{sub}</div>}
  </div>
);

const Overview = ({ data }: { data: OmsSkuDetail }) => (
  <div className="row-2">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <NextSixShipments data={data} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ChannelBreakdownCard data={data} />
      <RelatedSkusCard data={data} />
    </div>
  </div>
);

const NextSixShipments = ({ data }: { data: OmsSkuDetail }) => {
  const ships = data.nextShipments || [];
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <Icon name="shipments" size={15} /> Next 6 shipments
          </div>
          <div className="card-subtitle">Confirmed + AI-planned inbound to your network</div>
        </div>
        <button className="btn ghost sm"><Icon name="plus" size={11} /> Manual</button>
      </div>
      <div style={{ padding: 0 }}>
        {ships.length === 0 && <EmptyState>No inbound shipments planned for this SKU.</EmptyState>}
        {ships.slice(0, 6).map((s, i) => (
          <div
            key={s.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr auto',
              gap: 14,
              padding: '12px 16px',
              borderBottom: i === Math.min(ships.length, 6) - 1 ? 'none' : '1px solid var(--border-subtle)',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{(s.date || '').split('-').slice(1).join('/') || '—'}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{(s.date || '').slice(0, 4)}</div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{s.id}</span>
                <StatusChip status={s.status} />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                {s.origin} → <span className="mono" style={{ fontWeight: 600 }}>{s.destination}</span>
                {s.mode ? ` · ${s.mode}` : ''}
                {s.cube ? ` · ${s.cube}ft³` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{num(s.quantity).toLocaleString()}u</div>
              <button className="btn ghost sm">View</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ChannelBreakdownCard = ({ data }: { data: OmsSkuDetail }) => {
  const channels = data.channels || [];
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Channel breakdown</div>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {channels.length === 0 && <EmptyState>Channel breakdown not yet available for this SKU.</EmptyState>}
        {channels.map((c) => (
          <div key={c.channel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, background: channelColor(c.channel), borderRadius: 2 }} />
                {c.channel}
              </span>
              <span className="mono" style={{ fontSize: 12 }}>
                {num(c.units30d).toLocaleString()}u · {fmt.money(num(c.revenue30d), { compact: true })}
              </span>
            </div>
            <ProgressBar value={num(c.shareOfDemand) * 100} color="accent" height={5} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
              <span>{Math.round(num(c.shareOfDemand) * 100)}% of demand</span>
              <span>Refund rate {(num(c.refundRate) * 100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const RelatedSkusCard = ({ data }: { data: OmsSkuDetail }) => {
  const related = data.relatedSkus || [];
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Related SKUs</div>
      </div>
      <div style={{ padding: 0 }}>
        {related.length === 0 && <EmptyState>No related SKUs.</EmptyState>}
        {related.map((s, i) => (
          <div
            key={s.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              padding: '10px 14px',
              borderBottom: i === related.length - 1 ? 'none' : '1px solid var(--border-subtle)',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.sku}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{s.title || s.sku}</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{Math.round(num(s.daysOfCover))}d</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Warehouses = ({ data }: { data: OmsSkuDetail }) => (
  <div className="table-wrap">
    {data.warehouses.length === 0 ? (
      <EmptyState>No warehouse allocation for this SKU.</EmptyState>
    ) : (
      <table className="data">
        <thead>
          <tr>
            <th>Warehouse</th>
            <th>Region</th>
            <th className="num">On hand</th>
            <th className="num">Inbound</th>
            <th className="num">Velocity /day</th>
            <th>Days of cover</th>
            <th className="num">Storage cost / mo</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.warehouses.map((b) => {
            const d = num(b.daysOfCover);
            const tone = docTone(d);
            return (
              <tr key={b.code}>
                <td className="mono strong">{b.code}</td>
                <td className="muted">{b.region || b.name || '—'}</td>
                <td className="num mono strong">{num(b.available).toLocaleString()}</td>
                <td className="num mono muted">{num(b.inbound) > 0 ? num(b.inbound).toLocaleString() : '—'}</td>
                <td className="num mono">{num(b.velocityPerDay).toFixed(1)}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110 }}>
                    <div className="bar" style={{ flex: 1, height: 5 }}>
                      <div className={`bar-fill ${tone}`} style={{ width: `${Math.min(100, (d / 60) * 100)}%` }} />
                    </div>
                    <span className="mono num" style={{ fontSize: 11.5, color: `var(--${tone}-text)`, fontWeight: 600, minWidth: 28 }}>
                      {Math.round(d)}d
                    </span>
                  </div>
                </td>
                <td className="num mono">{b.storageCost != null ? fmt.money(num(b.storageCost)) : '—'}</td>
                <td>
                  <Chip tone={tone}>{tone === 'green' ? 'Healthy' : tone === 'amber' ? 'Low cover' : 'Stockout risk'}</Chip>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    )}
  </div>
);

const History = ({ data }: { data: OmsSkuDetail }) => {
  const events = data.history || [];
  const typeIcon: Record<string, string> = { ai: 'sparkle', ledger: 'ledger', shipment: 'shipments', billing: 'billing' };
  const typeTone: Record<string, string> = { ai: 'purple', ledger: 'blue', shipment: 'blue', billing: 'amber' };
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Activity history</div>
        <div className="seg">
          <button className="active">All</button>
          <button>AI</button>
          <button>Inventory</button>
          <button>Billing</button>
        </div>
      </div>
      <div style={{ padding: 0 }}>
        {events.length === 0 && <EmptyState>No recorded activity for this SKU yet.</EmptyState>}
        {events.map((e, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '150px 28px 1fr auto',
              gap: 14,
              padding: '12px 16px',
              borderBottom: i === events.length - 1 ? 'none' : '1px solid var(--border-subtle)',
            }}
          >
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{e.ts}</span>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                background: `var(--${typeTone[e.type] || 'blue'}-soft)`,
                color: `var(--${typeTone[e.type] || 'blue'})`,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name={typeIcon[e.type] || 'info'} size={12} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--text)' }}>{e.subject}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{e.actor}</div>
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: e.impact ? (e.impact > 0 ? 'var(--green-text)' : 'var(--red-text)') : 'var(--text-tertiary)',
              }}
            >
              {e.impact ? `${e.impact > 0 ? '+' : ''}${fmt.money(e.impact)}` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Channels = ({ data }: { data: OmsSkuDetail }) => {
  const channels = data.channels || [];
  if (channels.length === 0)
    return (
      <div className="card">
        <div className="card-body"><EmptyState>Per-channel performance not yet available for this SKU.</EmptyState></div>
      </div>
    );
  return (
    <div className="row-2-eq">
      {channels.map((c) => (
        <div key={c.channel} className="card">
          <div className="card-header">
            <div className="card-title">{c.channel}</div>
            <Chip tone="green" dot={false}>Live</Chip>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            <div className="kv"><div className="kv-label">30d units</div><div className="kv-value">{num(c.units30d).toLocaleString()}</div></div>
            <div className="kv"><div className="kv-label">30d revenue</div><div className="kv-value">{fmt.money(num(c.revenue30d), { compact: true })}</div></div>
            <div className="kv"><div className="kv-label">Share of demand</div><div className="kv-value">{Math.round(num(c.shareOfDemand) * 100)}%</div></div>
            <div className="kv"><div className="kv-label">Refund rate</div><div className="kv-value">{(num(c.refundRate) * 100).toFixed(1)}%</div></div>
          </div>
        </div>
      ))}
    </div>
  );
};

const Billing = ({ data }: { data: OmsSkuDetail }) => {
  const b = data.billing;
  const drivers = b?.drivers || [];
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">SKU-level cost · last 30 days</div>
        <Chip dot={false}>WMS-allocated</Chip>
      </div>
      {!b ? (
        <EmptyState>No billing breakdown available for this SKU.</EmptyState>
      ) : (
        <>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div className="kv"><div className="kv-label">Current monthly</div><div className="kv-value">{fmt.money(num(b.currentMonthly))}</div></div>
            <div className="kv"><div className="kv-label">Optimized monthly</div><div className="kv-value" style={{ color: 'var(--purple-text)' }}>{fmt.money(num(b.optimizedMonthly))}</div></div>
            <div className="kv"><div className="kv-label">Savings / mo</div><div className="kv-value" style={{ color: 'var(--green-text)' }}>{fmt.money(num(b.currentMonthly) - num(b.optimizedMonthly))}</div></div>
          </div>
          {drivers.length > 0 && (
            <table className="data">
              <thead>
                <tr>
                  <th>WH</th>
                  <th className="num">Storage</th>
                  <th className="num">Handling</th>
                  <th className="num">Accessorial</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((c, i) => {
                  const total = num(c.storage) + num(c.handling) + num(c.accessorial);
                  return (
                    <tr key={i}>
                      <td className="mono strong">{c.wh}</td>
                      <td className="num mono">{fmt.money(num(c.storage))}</td>
                      <td className="num mono">{fmt.money(num(c.handling))}</td>
                      <td className="num mono">{c.accessorial ? fmt.money(num(c.accessorial)) : '—'}</td>
                      <td className="num mono strong">{fmt.money(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
};
