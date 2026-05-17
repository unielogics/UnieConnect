import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, ProgressBar, fmt, Loading, ErrorState, EmptyState } from '../ui';
import { fetchHeatmap, HeatmapResponse } from '../../../lib/oms';
import { num } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';

const STATE_GRID: Record<string, [number, number]> = {
  AK: [0, 0], ME: [0, 10], VT: [1, 9], NH: [1, 10],
  WA: [1, 1], ID: [1, 2], MT: [1, 3], ND: [1, 4], MN: [1, 5], WI: [1, 6], MI: [1, 7], NY: [1, 8], MA: [1, 9],
  OR: [2, 1], NV: [2, 2], WY: [2, 3], SD: [2, 4], IA: [2, 5], IL: [2, 6], IN: [2, 7], OH: [2, 8], PA: [2, 9], NJ: [2, 10], RI: [3, 10],
  CA: [3, 1], UT: [3, 2], CO: [3, 3], NE: [3, 4], MO: [3, 5], KY: [3, 6], WV: [3, 7], VA: [3, 8], MD: [3, 9], DC: [4, 9], DE: [4, 10],
  AZ: [4, 2], NM: [4, 3], KS: [4, 4], AR: [4, 5], TN: [4, 6], NC: [4, 7], SC: [4, 8],
  OK: [5, 3], LA: [5, 4], MS: [5, 5], AL: [5, 6], GA: [5, 7],
  HI: [6, 0], TX: [5, 2], FL: [6, 7],
};

type Metric = 'demand' | 'orders' | 'revenue';

export const Heatmap = (_: ScreenProps) => {
  const [metric, setMetric] = useState<Metric>('demand');
  const [hover, setHover] = useState<{ state: string; d: { demand: number; orders: number; revenue: number } } | null>(null);
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

  const whStates = useMemo(() => new Set((data?.warehouses || []).map((w) => (w.state || '').toUpperCase())), [data]);

  const getter = (d: { demand: number; orders: number; revenue: number }) =>
    metric === 'demand' ? d.demand : metric === 'orders' ? d.orders : d.revenue;
  const fmtV = (v: number) => (metric === 'demand' ? `${Math.round(v * 100)}%` : metric === 'orders' ? v.toLocaleString() : fmt.money(v, { compact: true }));
  const all = Object.values(byState);
  const maxVal = Math.max(1, ...all.map(getter));
  const totalOrders = all.reduce((s, x) => s + x.orders, 0);
  const totalRev = all.reduce((s, x) => s + x.revenue, 0);

  const rows = 7;
  const cols = 11;
  const cell = 52;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">US Heatmap</h1>
          <p className="page-subtitle">Demand and warehouse coverage by state. Plan acceptance updates this map daily.</p>
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
                <div className="card-subtitle">★ tiles are active warehouses · brighter tiles = higher {metric}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>0</span>
                <div style={{ width: 140, height: 10, borderRadius: 4, background: 'linear-gradient(90deg, oklch(50% 0.18 290 / 0.06), oklch(50% 0.18 290 / 0.95))' }} />
                <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{fmtV(maxVal)}</span>
                <span style={{ marginLeft: 12, fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                  <span style={{ color: 'var(--purple)', fontWeight: 700 }}>★</span> Active warehouse
                </span>
              </div>
            </div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 18 }}>
              <div style={{ overflowX: 'auto' }}>
                <svg width={cols * cell + 8} height={rows * cell + 8} style={{ display: 'block' }}>
                  {Object.entries(STATE_GRID).map(([state, [r, c]]) => {
                    const d = byState[state] || { demand: 0, orders: 0, revenue: 0 };
                    const v = getter(d);
                    const intensity = Math.max(0.05, Math.min(1, v / maxVal));
                    const isWh = whStates.has(state);
                    const x = c * cell + 4;
                    const y = r * cell + 4;
                    return (
                      <g key={state} onMouseEnter={() => setHover({ state, d })} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }}>
                        <rect x={x} y={y} width={cell - 4} height={cell - 4} rx="6" fill={`oklch(50% 0.18 290 / ${0.06 + intensity * 0.85})`} stroke={isWh ? 'var(--purple)' : 'transparent'} strokeWidth={isWh ? 2 : 0} />
                        <text x={x + (cell - 4) / 2} y={y + (cell - 4) / 2 - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={intensity > 0.5 ? 'white' : 'var(--text)'}>
                          {state}
                        </text>
                        <text x={x + (cell - 4) / 2} y={y + (cell - 4) / 2 + 10} textAnchor="middle" fontSize="9" fill={intensity > 0.5 ? 'rgba(255,255,255,0.85)' : 'var(--text-tertiary)'} fontFamily="var(--mono)">
                          {fmtV(v).replace('$', '')}
                        </text>
                        {isWh && (
                          <text x={x + cell - 12} y={y + 12} fontSize="11" fill="var(--purple)" fontWeight="700">★</text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div style={{ padding: 14, background: 'var(--bg-sunken)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                {hover ? (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>STATE</div>
                    <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{hover.state}</div>
                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <SideStat label="Demand intensity" value={`${Math.round(hover.d.demand * 100)}%`} />
                      <SideStat label="Orders (30d)" value={hover.d.orders.toLocaleString()} />
                      <SideStat label="Revenue (30d)" value={fmt.money(hover.d.revenue, { compact: true })} />
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 10 }}>
                      Top {metric}
                    </div>
                    {Object.entries(byState)
                      .map(([s, d]) => ({ state: s, d }))
                      .sort((a, b) => getter(b.d) - getter(a.d))
                      .slice(0, 6)
                      .map((s, i, arr) => (
                        <div key={s.state} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--border-subtle)', fontSize: 12 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', width: 14 }}>{i + 1}</span>
                            <span className="mono" style={{ fontWeight: 700 }}>{s.state}</span>
                          </span>
                          <span className="mono" style={{ fontWeight: 600 }}>{fmtV(getter(s.d))}</span>
                        </div>
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
