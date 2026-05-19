import React, { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { Chip, ProgressBar, fmt, Loading, ErrorState, EmptyState } from '../ui';
import { fetchBillingProfit, BillingProfitResponse } from '../../../lib/oms';
import { num } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';
import { OptimizationImpact } from '../OptimizationImpact';

const CAT_META: { key: string; label: string; desc: string; refund?: boolean }[] = [
  { key: 'storage', label: 'Storage', desc: 'Long-term tier avoidance, smarter pre-positioning' },
  { key: 'freight', label: 'Freight (in + out)', desc: 'Lane consolidation, shared pallets, zone optimization' },
  { key: 'handling', label: 'Handling & pick', desc: 'Split-node strategy effect' },
  { key: 'accessorials', label: 'Accessorials', desc: 'Auto-disputed rework, dim-weight reclass' },
  { key: 'refundsCaptured', label: 'Refunds captured', desc: 'Cortex audit bot files more claims', refund: true },
  { key: 'lostRevenue', label: 'Lost revenue (SLA)', desc: 'Faster SLA reduces refund/chargeback rate' },
];

export const Billing = (_: ScreenProps) => {
  const [scope, setScope] = useState<'30d' | '90d' | 'yr'>('30d');
  const [data, setData] = useState<BillingProfitResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr(null);
    fetchBillingProfit()
      .then(setData)
      .catch((e) => setErr(e.message || 'Failed to load billing'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (err) return <div className="page fade-in"><div className="card"><ErrorState message={err} onRetry={load} /></div></div>;
  if (loading || !data) return <div className="page fade-in"><div className="card"><Loading rows={6} /></div></div>;

  const cur = data.current || ({} as any);
  const opt = data.optimized || ({} as any);
  const mult = scope === '90d' ? 3 : scope === 'yr' ? 12 : 1;
  const cats = CAT_META.filter((c) => c.key in cur || c.key in opt).map((c) => ({
    ...c,
    current: num(cur[c.key]) * mult,
    optimized: num(opt[c.key]) * mult,
  }));
  const sum = (sel: 'current' | 'optimized') =>
    cats.reduce((s, c) => s + (c.refund ? -Math.abs(c[sel]) : c[sel]), 0);
  const currentTotal = sum('current');
  const optimizedTotal = sum('optimized');
  const savings = currentTotal - optimizedTotal;
  const maxBar = Math.max(1, ...cats.flatMap((c) => [Math.abs(c.current), Math.abs(c.optimized)]));
  const perWh = data.perWarehouse || [];

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing &amp; Profit</h1>
          <p className="page-subtitle">Cost of operation today vs. cost if you operate on the AI plan. Every line reconciled against WMS truth.</p>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button className={scope === '30d' ? 'active' : ''} onClick={() => setScope('30d')}>30 days</button>
            <button className={scope === '90d' ? 'active' : ''} onClick={() => setScope('90d')}>Last 90d</button>
            <button className={scope === 'yr' ? 'active' : ''} onClick={() => setScope('yr')}>Annualized</button>
          </div>
          <button className="btn"><Icon name="download" size={13} /> Export</button>
        </div>
      </div>

      <OptimizationImpact screen="billing" title="Cost leak and profit optimization" />

      <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(180deg, var(--purple-soft) 0%, var(--bg-elev) 50%)' }}>
        <div className="card-body" style={{ padding: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 1fr', gap: 28, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>CURRENT OPERATION</div>
              <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmt.money(currentTotal)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{scope} scope</div>
            </div>
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-elev)', border: '2px solid var(--purple)', display: 'grid', placeItems: 'center', color: 'var(--purple)' }}>
                <Icon name="arrowRight" size={22} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--purple-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>WITH AI PLAN APPLIED</div>
              <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--purple-text)' }}>{fmt.money(optimizedTotal)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>autonomous execution</div>
            </div>
            <div style={{ background: 'var(--green-soft)', padding: 18, borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--green-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>YOU SAVE</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--green-text)', marginTop: 4 }}>{fmt.money(savings)}</div>
              <div style={{ fontSize: 12, color: 'var(--green-text)', fontWeight: 600, marginTop: 2 }}>
                {currentTotal ? ((savings / currentTotal) * 100).toFixed(1) : 0}% lower cost · {scope}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Cost breakdown — current vs. optimized</div>
            <div className="card-subtitle">Every line reconciled against WMS-allocated charges.</div>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11.5 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, background: 'var(--text-tertiary)', borderRadius: 2 }} />
              <span style={{ color: 'var(--text-secondary)' }}>Current</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, background: 'var(--purple)', borderRadius: 2 }} />
              <span style={{ color: 'var(--text-secondary)' }}>With AI plan</span>
            </span>
          </div>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {cats.length === 0 && <EmptyState>No cost categories returned.</EmptyState>}
          {cats.map((c) => {
            const delta = c.current - c.optimized;
            const good = c.refund ? c.optimized > c.current : delta > 0;
            return (
              <div key={c.key} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 80px', gap: 14, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{c.desc}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(['current', 'optimized'] as const).map((sel) => (
                    <div key={sel} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10.5, color: sel === 'optimized' ? 'var(--purple-text)' : 'var(--text-tertiary)', width: 50, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: sel === 'optimized' ? 700 : 600 }}>
                        {sel === 'optimized' ? 'Plan' : 'Now'}
                      </span>
                      <div className="bar" style={{ flex: 1, height: 16 }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, (Math.abs(c[sel]) / maxBar) * 100)}%`,
                            background: c.refund ? 'var(--green)' : sel === 'optimized' ? 'var(--purple)' : 'var(--text-tertiary)',
                            opacity: sel === 'current' && !c.refund ? 0.5 : 1,
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <span className="mono num" style={{ fontSize: 12, fontWeight: sel === 'optimized' ? 700 : 600, minWidth: 80, textAlign: 'right', color: sel === 'optimized' ? 'var(--purple-text)' : 'var(--text)' }}>
                        {c.refund ? '−' : ''}
                        {fmt.money(Math.abs(c[sel]))}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: good ? 'var(--green-text)' : 'var(--red-text)' }}>
                    {good ? '−' : '+'}
                    {fmt.money(Math.abs(delta), { compact: true })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {c.current ? ((delta / c.current) * 100).toFixed(0) : 0}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Icon name="box" size={15} /> Per-warehouse cost reduction
          </div>
          <Chip dot={false}>{scope}</Chip>
        </div>
        {perWh.length === 0 ? (
          <EmptyState>Per-warehouse cost split is not yet exposed by the billing feed.</EmptyState>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Region</th>
                <th className="num">Current</th>
                <th className="num">Optimized</th>
                <th className="num">Savings</th>
                <th>Impact</th>
              </tr>
            </thead>
            <tbody>
              {perWh.map((w) => {
                const d = num(w.current) - num(w.optimized);
                const pct = w.current ? (d / num(w.current)) * 100 : 0;
                return (
                  <tr key={w.code}>
                    <td className="mono strong">{w.code}</td>
                    <td className="muted">{w.region || '—'}</td>
                    <td className="num mono">{fmt.money(num(w.current))}</td>
                    <td className="num mono strong" style={{ color: 'var(--purple-text)' }}>{fmt.money(num(w.optimized))}</td>
                    <td className="num mono strong" style={{ color: 'var(--green-text)' }}>−{fmt.money(d)}</td>
                    <td>
                      <ProgressBar value={pct} max={30} color="green" showLabel height={5} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
