import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Icon } from '../icons';
import { Chip, ProgressBar, fmt, Loading, ErrorState, EmptyState } from '../ui';
import { fetchHeatmap, HeatmapResponse } from '../../../lib/oms';
import { num } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';

const HeatmapMap = dynamic(() => import('../HeatmapMap').then((m) => m.HeatmapMap), {
  ssr: false,
  loading: () => (
    <div className="skel" style={{ height: 460, borderRadius: 10 }} />
  ),
});

type Metric = 'demand' | 'orders' | 'revenue';

export const Heatmap = ({ onSelectState }: ScreenProps) => {
  const [metric, setMetric] = useState<Metric>('demand');
  const [hover, setHover] = useState<string | null>(null);
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr(null);
    fetchHeatmap()
      .then(setData)
      .catch((e) => setErr(e.message || 'Failed to load heatmap'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const byState = useMemo(() => {
    const m: Record<string, { demand: number; orders: number; revenue: number }> = {};
    (data?.states || []).forEach((s) => {
      m[(s.state || '').toUpperCase()] = { demand: num(s.demand), orders: num(s.orders), revenue: num(s.revenue) };
    });
    return m;
  }, [data]);

  const getter = (d: { demand: number; orders: number; revenue: number }) =>
    metric === 'demand' ? d.demand : metric === 'orders' ? d.orders : d.revenue;
  const fmtV = (v: number) =>
    metric === 'demand' ? `${Math.round(v * 100)}%` : metric === 'orders' ? v.toLocaleString() : fmt.money(v, { compact: true });
  const all = Object.values(byState);
  const maxVal = Math.max(1, ...all.map(getter));
  const totalOrders = all.reduce((s, x) => s + x.orders, 0);
  const totalRev = all.reduce((s, x) => s + x.revenue, 0);
  const hoverData = hover ? byState[hover] : null;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">US Heatmap</h1>
          <p className="page-subtitle">
            Account-wide demand, orders, revenue, and warehouse coverage by state across all SKUs. Hover a state for detail, click it to drill in.
          </p>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button className={metric === 'demand' ? 'active' : ''} onClick={() => setMetric('demand')}>Demand</button>
            <button className={metric === 'orders' ? 'active' : ''} onClick={() => setMetric('orders')}>Orders</button>
            <button className={metric === 'revenue' ? 'active' : ''} onClick={() => setMetric('revenue')}>Revenue</button>
          </div>
          <button className="btn"><Icon name="download" size={13} /> Export</button>
        </div>
      </div>

      {err ? (
        <div className="card"><ErrorState message={err} onRetry={load} /></div>
      ) : loading || !data ? (
        <div className="card"><Loading rows={6} /></div>
      ) : (
        <>
          <div className="stat-grid cols-3">
            <div className="stat"><div className="stat-label">States with demand</div><div className="stat-value">{Object.keys(byState).length}</div></div>
            <div className="stat"><div className="stat-label">Orders (30d)</div><div className="stat-value">{fmt.num(totalOrders)}</div></div>
            <div className="stat good"><div className="stat-label">Revenue (30d)</div><div className="stat-value">{fmt.money(totalRev, { compact: true })}</div></div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div>
                <div className="card-title">
                  {metric === 'demand' ? 'Demand intensity' : metric === 'orders' ? 'Orders (30d)' : 'Revenue (30d)'} by state
                </div>
                <div className="card-subtitle">Interactive choropleth · hover for detail · click a state to drill in</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>0</span>
                <div style={{ width: 140, height: 10, borderRadius: 4, background: 'linear-gradient(90deg, rgba(109,40,217,0.06), rgba(109,40,217,0.95))' }} />
                <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{fmtV(maxVal)}</span>
              </div>
            </div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 18 }}>
              <HeatmapMap
                byState={byState}
                metric={metric}
                maxVal={maxVal}
                fmtV={fmtV}
                onSelectState={(c) => onSelectState && onSelectState(c)}
                onHover={setHover}
              />
              <div style={{ padding: 14, background: 'var(--bg-sunken)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                {hoverData ? (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>STATE</div>
                    <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{hover}</div>
                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <SideStat label="Demand intensity" value={`${Math.round(hoverData.demand * 100)}%`} />
                      <SideStat label="Orders (30d)" value={hoverData.orders.toLocaleString()} />
                      <SideStat label="Revenue (30d)" value={fmt.money(hoverData.revenue, { compact: true })} />
                    </div>
                    <button className="btn sm" style={{ marginTop: 14, width: '100%' }} onClick={() => onSelectState && onSelectState(hover!)}>
                      Open {hover} detail
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 10 }}>
                      Top {metric}
                    </div>
                    {Object.entries(byState)
                      .map(([s, d]) => ({ state: s, d }))
                      .sort((a, b) => getter(b.d) - getter(a.d))
                      .slice(0, 8)
                      .map((s, i, arr) => (
                        <button
                          key={s.state}
                          onClick={() => onSelectState && onSelectState(s.state)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%',
                            padding: '6px 0',
                            borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                            fontSize: 12,
                            cursor: 'pointer',
                            color: 'var(--text)',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', width: 14 }}>{i + 1}</span>
                            <span className="mono" style={{ fontWeight: 700 }}>{s.state}</span>
                          </span>
                          <span className="mono" style={{ fontWeight: 600 }}>{fmtV(getter(s.d))}</span>
                        </button>
                      ))}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Icon name="box" size={15} /> Warehouse coverage
              </div>
              <Chip tone="purple" dot={false}>{data.warehouses.length} active nodes</Chip>
            </div>
            <div className="card-body">
              {data.warehouses.length === 0 ? (
                <EmptyState>No warehouses connected.</EmptyState>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(6, data.warehouses.length)}, 1fr)`, gap: 12 }}>
                  {data.warehouses.map((w) => {
                    const cap = num(w.capacity) || (num(w.inventoryUnits) > 0 ? 0.6 : 0.2);
                    return (
                      <div key={w.id} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-elev)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{w.code || w.name}</span>
                          <Chip tone={w.status === 'warn' ? 'amber' : 'green'} dot={false}>{w.status === 'warn' ? 'Warn' : 'Live'}</Chip>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 8 }}>{w.region || w.state || '—'}</div>
                        <ProgressBar value={cap * 100} color={cap > 0.85 ? 'red' : cap > 0.7 ? 'amber' : 'green'} showLabel height={6} />
                        <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
                          {num(w.inventoryUnits).toLocaleString()}u · {num(w.activeSkus)} SKUs
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const SideStat = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
    <span style={{ fontWeight: 700 }}>{value}</span>
  </div>
);
