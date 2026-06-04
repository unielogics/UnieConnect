import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, StatusChip, fmt, Loading, ErrorState, EmptyState } from '../ui';
import { useCtxMenu } from '../ContextMenu';
import {
  fetchInventoryPlan,
  fetchOmsSkuDetail,
  InventoryPlanFull,
  OmsSku,
  OmsSkuDetail,
} from '../../../lib/oms';
import { num, docTone, monthShort } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';

const actionFor = (s: OmsSku): { action: string; tone: 'blue' | 'purple' | 'green' | 'amber' | 'default' } => {
  const r = (s.recommendation || '').toLowerCase();
  if (s.risk === 'high' || r.includes('reorder') || r.includes('po')) return { action: 'reorder', tone: 'blue' };
  if (r.includes('rebalance') || r.includes('consolidate') || r.includes('pallet')) return { action: 'rebalance', tone: 'purple' };
  if (s.proposedWarehouseCount > s.currentWarehouseCount) return { action: 'expand', tone: 'green' };
  return { action: 'hold', tone: 'amber' };
};

export const InventoryPlan = ({ onNavigate, toggleSelect, isSelected }: ScreenProps) => {
  const [plan, setPlan] = useState<InventoryPlanFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'forecast' | 'timeline' | 'network'>('forecast');
  const [detail, setDetail] = useState<OmsSkuDetail | null>(null);
  const ctx = useCtxMenu();

  const load = () => {
    setLoading(true);
    setErr(null);
    fetchInventoryPlan('6m')
      .then((d) => {
        setPlan(d);
        if (d.skus?.length && !selectedSku) setSelectedSku(d.skus[0].id);
      })
      .catch((e) => setErr(e.message || 'Failed to load inventory plan'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  useEffect(() => {
    if (!selectedSku) return;
    setDetail(null);
    fetchOmsSkuDetail(selectedSku).then(setDetail).catch(() => setDetail(null));
  }, [selectedSku]);

  const sku = useMemo(
    () => plan?.skus?.find((s) => s.id === selectedSku) ?? plan?.skus?.[0],
    [plan, selectedSku]
  );

  if (err) return <div className="page fade-in"><div className="card"><ErrorState message={err} onRetry={load} /></div></div>;
  if (loading || !plan) return <div className="page fade-in"><div className="card"><Loading rows={6} /></div></div>;

  const cur = plan.current || {};
  const prop = plan.proposed || {};
  const diffs = [
    { label: 'Stockout-risk SKUs', current: num(cur.stockoutRiskSkus), proposed: num(prop.stockoutRiskSkus), money: false },
    { label: 'Warehouse nodes', current: num(cur.warehouseCount), proposed: num(prop.warehouseCount), money: false, betterHigher: true },
    { label: 'Monthly cost', current: num(cur.estimatedMonthlyCost), proposed: num(prop.estimatedMonthlyCost), money: true },
    { label: 'SKUs in plan', current: num(cur.skuCount), proposed: num((prop as any).skuCount ?? cur.skuCount), money: false, neutral: true },
    { label: 'Shared pallets', current: 0, proposed: num(prop.sharedPalletCandidates), money: false, betterHigher: true },
    {
      label: 'Plan savings / mo',
      current: 0,
      proposed: num(cur.estimatedMonthlyCost) - num(prop.estimatedMonthlyCost),
      money: true,
      betterHigher: true,
    },
  ];

  const enriched = plan.skus.map((s) => ({ ...s, ...actionFor(s) }));
  const filtered = filter === 'all' ? enriched : enriched.filter((e) => e.action === filter);

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Plan</h1>
          <p className="page-subtitle">
            Current business vs. proposed plan. AI proposes quantities, placement, and timing over the next 6 months.
          </p>
        </div>
        <div className="page-actions">
          <Chip tone="purple" dot={false}>
            Cortex:Demand · {plan.generatedAt ? new Date(plan.generatedAt).toLocaleDateString() : 'live'}
          </Chip>
          <button className="btn" onClick={load}><Icon name="refresh" size={13} /> Re-forecast</button>
          <button className="btn"><Icon name="download" size={13} /> Export plan</button>
        </div>
      </div>

      <div className="card" style={{ background: 'linear-gradient(180deg, var(--purple-soft) 0%, var(--bg-elev) 60%)' }}>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr) auto', gap: 18, alignItems: 'center', padding: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Chip tone="purple" dot={false}>PROPOSED PLAN</Chip>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{plan.horizon || '6m'}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>6-month inventory &amp; placement plan</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
              {num(cur.skuCount)} SKUs · {num(prop.warehouseCount)} warehouses · {plan.months?.length || 0} planning periods
            </div>
          </div>
          <SummaryStat label="Monthly cost (plan)" value={fmt.money(num(prop.estimatedMonthlyCost), { compact: true })} tone="green" sub={`was ${fmt.money(num(cur.estimatedMonthlyCost), { compact: true })}`} />
          <SummaryStat label="Stockout risk" value={`${num(prop.stockoutRiskSkus)} SKUs`} tone="green" sub={`vs ${num(cur.stockoutRiskSkus)} today`} />
          <SummaryStat label="Shared pallets" value={String(num(prop.sharedPalletCandidates))} tone="purple" sub="consolidation" />
          <SummaryStat label="Nodes" value={`${num(prop.warehouseCount)}`} sub={`vs ${num(cur.warehouseCount)}`} />
          <button className="btn primary lg" style={{ minWidth: 160 }} onClick={() => onNavigate('double')}>
            <Icon name="check" size={13} /> Review &amp; accept
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Current business vs. proposed plan</div>
            <div className="card-subtitle">Differences and changes highlighted.</div>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11.5 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, background: 'var(--text-tertiary)', borderRadius: 2 }} />
              <span style={{ color: 'var(--text-secondary)' }}>Current</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, background: 'var(--purple)', borderRadius: 2 }} />
              <span style={{ color: 'var(--text-secondary)' }}>Proposed</span>
            </span>
          </div>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, padding: 18 }}>
          {diffs.map((d) => {
            const delta = d.proposed - d.current;
            const better = d.neutral ? true : (d as any).betterHigher ? delta > 0 : delta < 0;
            const pct = d.current ? (delta / d.current) * 100 : 0;
            const f = (v: number) => (d.money ? fmt.money(v, { compact: true }) : String(Math.round(v)));
            return (
              <div key={d.label}>
                <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 6 }}>
                  {d.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>{f(d.current)}</span>
                  <Icon name="arrowRight" size={11} style={{ color: 'var(--text-tertiary)' }} />
                  <span style={{ fontSize: 17, fontWeight: 700, color: better ? 'var(--green-text)' : 'var(--red-text)' }}>{f(d.proposed)}</span>
                </div>
                {!d.neutral && (
                  <div style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 10.5, fontWeight: 700, background: better ? 'var(--green-soft)' : 'var(--red-soft)', color: better ? 'var(--green-text)' : 'var(--red-text)' }}>
                    {delta > 0 ? '+' : ''}
                    {f(Math.abs(delta))}
                    {pct ? ` (${pct > 0 ? '+' : ''}${pct.toFixed(0)}%)` : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!sku ? (
        <div className="card" style={{ marginTop: 16 }}>
          <EmptyState>No SKUs in the current plan yet. Add products to build a 6-month plan.</EmptyState>
        </div>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 360px) 1fr', gap: 16, alignItems: 'flex-start', marginTop: 16 }}>
        <div className="card" style={{ position: 'sticky', top: 70 }}>
          <div className="card-header">
            <div className="card-title">
              SKUs in plan <Chip dot={false}>{enriched.length}</Chip>
            </div>
            <button className="btn ghost sm"><Icon name="filter" size={12} /></button>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
            {['all', 'reorder', 'rebalance', 'expand', 'hold'].map((f) => (
              <button
                key={f}
                className={`chip ${filter === f ? 'purple' : 'outline'}`}
                onClick={() => setFilter(f)}
                style={{ cursor: 'pointer', textTransform: 'capitalize' }}
              >
                {f}
              </button>
            ))}
          </div>
          <div style={{ maxHeight: 'calc(100vh - 460px)', overflowY: 'auto' }}>
            {filtered.length === 0 && <EmptyState>No SKUs for this filter.</EmptyState>}
            {filtered.map((s) => {
              const sel = isSelected(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedSku(s.id)}
                  onContextMenu={(e) =>
                    ctx.open(e, [
                      { label: 'SKU' },
                      { icon: 'eye', title: 'Open SKU page', onClick: () => onNavigate('sku-detail', s.id) },
                      { icon: 'studio', title: 'Focus in plan', onClick: () => setSelectedSku(s.id) },
                      { divider: true },
                      {
                        icon: 'plus',
                        title: sel ? 'Remove from shipment' : 'Add to shipment plan',
                        onClick: () => toggleSelect({ id: s.id, name: s.title || s.sku, ...(s as any) }),
                      },
                      { divider: true },
                      { icon: 'refresh', title: 'Refresh plan for this SKU', shortcut: '⌘R', onClick: load },
                    ])
                  }
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '11px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: selectedSku === s.id ? 'var(--accent-soft)' : sel ? 'var(--purple-soft)' : 'transparent',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  {sel && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--purple)' }} />}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{s.sku}</span>
                    <Chip tone={s.tone} dot={false}>{s.action}</Chip>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title || s.sku}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.recommendation || `${s.proposedUnits}u proposed`}
                    </span>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{Math.round(s.daysOfCover)}d</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>{sku.sku}</span>
                  <Chip tone="purple" dot={false}>AI-planned</Chip>
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>{sku.title || sku.sku}</div>
              </div>
              <div className="seg">
                <button className={viewMode === 'forecast' ? 'active' : ''} onClick={() => setViewMode('forecast')}>6-mo forecast</button>
                <button className={viewMode === 'timeline' ? 'active' : ''} onClick={() => setViewMode('timeline')}>Plan timeline</button>
                <button className={viewMode === 'network' ? 'active' : ''} onClick={() => setViewMode('network')}>By warehouse</button>
              </div>
            </div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, paddingTop: 14, paddingBottom: 16 }}>
              <DetailKv label="Available" value={`${num(sku.available).toLocaleString()}u`} />
              <DetailKv label="Inbound" value={`${num(sku.inbound).toLocaleString()}u`} />
              <DetailKv label="Days of cover" value={`${Math.round(num(sku.daysOfCover))}d`} tone={docTone(num(sku.daysOfCover))} />
              <DetailKv label="Velocity / 30d" value={`${num(sku.velocity30d).toLocaleString()}u`} />
              <DetailKv label="Proposed units" value={`${num(sku.proposedUnits).toLocaleString()}u`} tone="purple" />
              <DetailKv label="Pallet fill" value={`${num(sku.fillPercent)}%`} />
            </div>
          </div>

          {viewMode === 'forecast' && <ForecastChart months={plan.months} sku={sku} />}
          {viewMode === 'timeline' && <PlanTimeline months={plan.months} />}
          {viewMode === 'network' && <NetworkBreakdown warehouses={plan.warehouses} sku={sku} />}

          <PlanNextSixShipments detail={detail} skuLabel={sku.sku} />

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Icon name="sparkle" size={15} style={{ color: 'var(--purple)' }} /> Why the plan looks like this
              </div>
              <button className="btn ghost sm"><Icon name="eye" size={12} /> Full evidence</button>
            </div>
            <div className="card-body" style={{ fontSize: 13, lineHeight: 1.6 }}>
              <p style={{ margin: 0, color: 'var(--text)' }}>
                <span className="mono" style={{ fontWeight: 600 }}>{sku.sku}</span> — {sku.recommendation || 'Cortex maintains target days-of-cover with the lowest landed cost across the network.'}{' '}
                Service tier <strong>{sku.serviceTier}</strong>; minimum viable order <strong>{num(sku.minViableUnits).toLocaleString()}u</strong> at{' '}
                <strong>{num(sku.fillPercent)}%</strong> pallet fill ({num(sku.palletCubeFt)} ft³, {num(sku.palletWeightLbs)} lb).
              </p>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

const SummaryStat = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) => (
  <div>
    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 19, fontWeight: 700, color: tone ? `var(--${tone}-text)` : 'var(--text)', marginTop: 3 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{sub}</div>}
  </div>
);

const DetailKv = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div>
    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 17, fontWeight: 700, color: tone ? `var(--${tone}-text)` : 'var(--text)', marginTop: 2 }}>{value}</div>
  </div>
);

const ForecastChart = ({ months, sku }: { months: InventoryPlanFull['months']; sku: OmsSku }) => {
  if (!months || months.length === 0) {
    return (
      <div className="card">
        <div className="card-header"><div className="card-title">6-month projection</div></div>
        <div className="card-body"><EmptyState>No monthly projection returned for this plan.</EmptyState></div>
      </div>
    );
  }
  const N = months.length;
  const W = 920;
  const H = 280;
  const P = { l: 56, r: 16, t: 24, b: 36 };
  const finite = (v: unknown) => {
    const n = num(v);
    return Number.isFinite(n) ? n : 0;
  };
  const demand = months.map((m) => finite(m.projectedUnits));
  const current: number[] = [];
  let s = num(sku.available);
  months.forEach((m, i) => {
    s -= finite(m.projectedUnits);
    if (i === Math.floor(N / 2)) s += finite(sku.inbound);
    current.push(Number.isFinite(s) ? s : 0);
  });
  const planSeries: number[] = [];
  let p = num(sku.available);
  months.forEach((m) => {
    p += finite(m.proposedReplenishment);
    p -= finite(m.projectedUnits) * 0.97;
    planSeries.push(Number.isFinite(p) ? p : 0);
  });
  const max = Math.max(1, ...current, ...planSeries, ...demand) * 1.1;
  const min = Math.min(0, ...current.filter(Number.isFinite));
  const xStep = (W - P.l - P.r) / Math.max(1, N - 1);
  const yScale = (v: number) => {
    const safe = Number.isFinite(v) ? v : 0;
    return H - P.b - ((safe - min) / (max - min || 1)) * (H - P.t - P.b);
  };
  const yZero = yScale(0);
  const linePath = (vals: number[]) =>
    vals.length >= 2 ? vals.map((v, i) => `${i ? 'L' : 'M'}${P.l + i * xStep} ${yScale(v)}`).join(' ') : '';
  const areaPath = (vals: number[]) => {
    const line = linePath(vals);
    return line ? `${line} L${P.l + (N - 1) * xStep} ${yZero} L${P.l} ${yZero} Z` : '';
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">6-month projection</div>
          <div className="card-subtitle">Demand forecast + projected stock with and without the AI plan. Plan recalculates daily.</div>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 11.5 }}>
          <LegendDot color="var(--accent)" label="Demand fcst" />
          <LegendDot color="var(--red)" label="Current trajectory" dashed />
          <LegendDot color="var(--green)" label="With AI plan" />
        </div>
      </div>
      <div style={{ padding: '8px 0 0' }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="uc-planGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--green)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((q) => {
            const y = yScale(min + (max - min) * q);
            return (
              <g key={q}>
                <line x1={P.l} x2={W - P.r} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="0.5" />
                <text x={P.l - 8} y={y + 3} textAnchor="end" fontSize="9.5" fill="var(--text-tertiary)" fontFamily="var(--mono)">
                  {Math.round(min + (max - min) * q).toLocaleString()}
                </text>
              </g>
            );
          })}
          <line x1={P.l} x2={W - P.r} y1={yZero} y2={yZero} stroke="var(--red)" strokeWidth="1" strokeDasharray="4 4" opacity="0.55" />
          <text x={W - P.r - 6} y={yZero - 4} textAnchor="end" fontSize="10" fill="var(--red-text)" fontWeight="600">Stockout</text>
          <path d={areaPath(planSeries)} fill="url(#uc-planGrad)" />
          <path d={linePath(demand)} fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity="0.85" />
          <path d={linePath(current)} fill="none" stroke="var(--red)" strokeWidth="2" strokeDasharray="5 3" />
          <path d={linePath(planSeries)} fill="none" stroke="var(--green)" strokeWidth="2.5" />
          {months.map((m, i) => {
            const x = P.l + i * xStep;
            return (
              <text key={i} x={x} y={H - 14} textAnchor="middle" fontSize="10.5" fill="var(--text-tertiary)" fontWeight="500">
                {monthShort(m.month)}
              </text>
            );
          })}
        </svg>
        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {months
            .filter((m) => num(m.proposedReplenishment) > 0)
            .map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  border: '1px solid var(--purple-soft)',
                  borderRadius: 999,
                  background: 'var(--purple-soft)',
                  color: 'var(--purple-text)',
                  fontSize: 11.5,
                  fontWeight: 600,
                }}
              >
                <span className="mono" style={{ fontSize: 10 }}>{monthShort(m.month)}</span>
                +{num(m.proposedReplenishment).toLocaleString()}u replenishment
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

const LegendDot = ({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <span style={{ width: 14, height: 0, borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }} />
    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
  </span>
);

const PlanTimeline = ({ months }: { months: InventoryPlanFull['months'] }) => (
  <div className="card">
    <div className="card-header">
      <div>
        <div className="card-title">Plan timeline · next 6 months</div>
        <div className="card-subtitle">Every event executes autonomously once the plan is accepted.</div>
      </div>
    </div>
    <div style={{ padding: 0 }}>
      {(!months || months.length === 0) && <EmptyState>No timeline events.</EmptyState>}
      {months.map((m, i) => {
        const repl = num(m.proposedReplenishment);
        const tone = repl > 0 ? 'green' : 'blue';
        return (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 40px 1fr auto',
              gap: 14,
              padding: '14px 16px',
              borderBottom: i === months.length - 1 ? 'none' : '1px solid var(--border-subtle)',
              alignItems: 'flex-start',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{monthShort(m.month)}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{m.month}</div>
            </div>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `var(--${tone}-soft)`, color: `var(--${tone})`, display: 'grid', placeItems: 'center' }}>
              <Icon name={repl > 0 ? 'tag' : 'info'} size={13} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {repl > 0 ? 'Auto-replenishment' : 'Demand checkpoint'}
                </span>
                <Chip tone={tone} dot={false}>{repl > 0 ? `${repl.toLocaleString()}u` : '—'}</Chip>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Projected demand {num(m.projectedUnits).toLocaleString()}u · saves {fmt.money(num(m.savings), { compact: true })}
              </div>
            </div>
            <button className="btn ghost sm">Details</button>
          </div>
        );
      })}
    </div>
  </div>
);

const NetworkBreakdown = ({ warehouses, sku }: { warehouses: InventoryPlanFull['warehouses']; sku: OmsSku }) => (
  <div className="card">
    <div className="card-header">
      <div>
        <div className="card-title">Placement plan by warehouse</div>
        <div className="card-subtitle">Network nodes that participate in this plan.</div>
      </div>
      <Chip dot={false}>{sku.proposedWarehouseCount} of {warehouses.length} nodes</Chip>
    </div>
    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {warehouses.length === 0 && <EmptyState>No warehouse network returned.</EmptyState>}
      {warehouses.map((w, i) => {
        const active = i < (sku.proposedWarehouseCount || 0);
        return (
          <div key={w.id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 14, alignItems: 'center' }}>
            <div>
              <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{w.code || w.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                {[w.city, w.state].filter(Boolean).join(', ') || '—'}
              </div>
            </div>
            <div className="bar" style={{ height: 14 }}>
              <div style={{ height: '100%', width: active ? '100%' : '12%', background: active ? 'var(--purple)' : 'var(--text-tertiary)', borderRadius: 4, opacity: active ? 1 : 0.4 }} />
            </div>
            <Chip tone={active ? 'purple' : 'default'} dot={false}>{active ? 'In plan' : 'Not used'}</Chip>
          </div>
        );
      })}
    </div>
  </div>
);

const PlanNextSixShipments = ({ detail, skuLabel }: { detail: OmsSkuDetail | null; skuLabel: string }) => {
  const ships = detail?.nextShipments || [];
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <Icon name="shipments" size={15} /> Next 6 shipments for {skuLabel}
          </div>
          <div className="card-subtitle">Confirmed + AI-planned inbound to your network.</div>
        </div>
        <button className="btn ghost sm">View all shipments</button>
      </div>
      {!detail ? (
        <Loading rows={3} />
      ) : ships.length === 0 ? (
        <EmptyState>No inbound shipments planned for this SKU yet.</EmptyState>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Plan ID</th>
              <th>Origin</th>
              <th>Destination</th>
              <th className="num">Units</th>
              <th>Mode</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ships.slice(0, 6).map((s) => (
              <tr key={s.id}>
                <td><span style={{ fontSize: 12.5, fontWeight: 700 }}>{s.date}</span></td>
                <td className="mono strong">{s.id}</td>
                <td>{s.origin}</td>
                <td className="mono">{s.destination}</td>
                <td className="num mono strong">{num(s.quantity).toLocaleString()}</td>
                <td><Chip dot={false}>{s.mode || 'LTL'}</Chip></td>
                <td><StatusChip status={s.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
