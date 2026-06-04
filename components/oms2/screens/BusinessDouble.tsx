import React, { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { Chip, fmt, Loading, ErrorState, EmptyState } from '../ui';
import {
  fetchBusinessDouble,
  approveBusinessDouble,
  fetchHeatmap,
  fetchLatestOptimization,
  runSellerOptimization,
  BusinessDoubleResponse,
  HeatmapResponse,
  SellerOptimizationSummary,
} from '../../../lib/oms';
import { num } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';

const WH_GEO: Record<string, { lat: number; lng: number }> = {
  ATL1: { lat: 33.7, lng: -84.4 },
  DFW2: { lat: 32.8, lng: -96.8 },
  EWR4: { lat: 40.7, lng: -74.2 },
  ONT3: { lat: 34.1, lng: -117.6 },
  ORD5: { lat: 41.9, lng: -87.9 },
  SEA6: { lat: 47.6, lng: -122.3 },
};

const METRIC_LABELS: Record<string, { label: string; unit?: string; inverse?: boolean }> = {
  freight: { label: 'Freight' },
  storage: { label: 'Storage' },
  handling: { label: 'Handling', inverse: true },
  accessorials: { label: 'Accessorials' },
  lostRevenue: { label: 'Lost revenue (SLA)' },
  sla: { label: 'SLA (days)', unit: 'd' },
  slaDays: { label: 'SLA (days)', unit: 'd' },
};

export const BusinessDouble = (_: ScreenProps) => {
  const [bd, setBd] = useState<BusinessDoubleResponse | null>(null);
  const [hm, setHm] = useState<HeatmapResponse | null>(null);
  const [latestOpt, setLatestOpt] = useState<SellerOptimizationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [denied, setDenied] = useState(false);
  const [running, setRunning] = useState(false);

  const load = () => {
    setLoading(true);
    setErr(null);
    fetchBusinessDouble()
      .then((d) => {
        setBd(d);
        setAccepted(d.plan?.status === 'approved' || !!d.latestApproved);
        setDenied(false);
      })
      .catch((e) => setErr(e.message || 'Failed to load business double'))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    fetchHeatmap().then(setHm).catch(() => {});
    fetchLatestOptimization().then((r) => setLatestOpt(r.latest || null)).catch(() => {});
  }, []);

  const runOptimization = async () => {
    setRunning(true);
    try {
      const response = await runSellerOptimization({ source: 'business_double' });
      setLatestOpt(response.optimization);
      load();
    } catch (e: any) {
      setErr(e.message || 'Seller Optimization failed');
    } finally {
      setRunning(false);
    }
  };

  const accept = async () => {
    if (!bd?.plan?.id) return;
    setAccepting(true);
    try {
      await approveBusinessDouble(bd.plan.id);
      setAccepted(true);
    } catch (e: any) {
      setErr(e.message || 'Approval failed');
    } finally {
      setAccepting(false);
    }
  };

  if (err) return <div className="page fade-in"><div className="card"><ErrorState message={err} onRetry={load} /></div></div>;
  if (loading || !bd) return <div className="page fade-in"><div className="card"><Loading rows={5} /></div></div>;

  const plan = bd.plan;
  const cur = plan.currentMetrics || {};
  const opt = plan.optimizedMetrics || {};
  const sum = (o: Record<string, number>) =>
    ['freight', 'storage', 'handling', 'accessorials', 'lostRevenue'].reduce((s, k) => s + num(o[k]), 0);
  const totalCur = sum(cur);
  const totalOpt = sum(opt);
  const savings = num(plan.savings?.total) || totalCur - totalOpt;

  const warehouses = (hm?.warehouses || []).map((w) => ({
    code: w.code || w.name || '',
    state: w.state,
    active: (w.inventoryUnits ?? 0) > 0 || (w.activeSkus ?? 0) > 0,
  }));
  const curNodes = warehouses.filter((w) => w.active).map((w) => w.code);

  const impactKeys = Object.keys(METRIC_LABELS).filter((k) => k in cur || k in opt);
  const uniqueImpact = impactKeys.filter((k, i) => impactKeys.findIndex((x) => METRIC_LABELS[x].label === METRIC_LABELS[k].label) === i).slice(0, 5);

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Business Double</h1>
          <p className="page-subtitle">
            Your business today vs. your business if you accept the AI plan.{' '}
            <strong style={{ color: 'var(--text)' }}>This is the only thing you approve</strong> — everything else runs autonomously.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn ghost"><Icon name="save" size={13} /> Save snapshot</button>
          <button className="btn"><Icon name="download" size={13} /> Export deck</button>
          <button className="btn primary" onClick={runOptimization} disabled={running}>
            <Icon name="sparkle" size={13} /> {running ? 'Running...' : 'Run Seller Optimization'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16, alignItems: 'center', padding: 16 }}>
          <div>
            <Chip tone={latestOpt ? 'purple' : 'amber'} dot={false}>{latestOpt ? 'Latest Seller Optimization loaded' : 'No Seller Optimization run yet'}</Chip>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              Optimize Suite uses marketplace connections first, CSV/manual data as fallback, and WMS truth for execution readiness.
            </div>
          </div>
          <div className="kv">
            <div className="kv-label">AI confidence</div>
            <div className="kv-value">{latestOpt?.confidence != null ? `${Math.round(latestOpt.confidence * 100)}%` : '—'}</div>
          </div>
          <div className="kv">
            <div className="kv-label">Source mode</div>
            <div className="kv-value" style={{ fontSize: 14 }}>{String((latestOpt?.summary as any)?.sourceMode || 'pending').replace(/_/g, ' ')}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <StrategyCard
            badge="Today"
            tone="default"
            active={!accepted}
            title="Current strategy"
            nodes={`${curNodes.length || (plan.currentMetrics && plan.currentMetrics.warehouseCount) || 0} active nodes`}
            cost={totalCur}
            sla={`${num(cur.sla ?? cur.slaDays).toFixed(1)} days avg`}
            note="What you'd have done without UnieConnect"
          />
          <StrategyCard
            badge="Recommended"
            tone="purple"
            active={accepted}
            title={plan.title || 'Optimized operating model'}
            nodes={plan.summary || `${plan.autonomousAfterApproval?.length || 0} autonomous actions`}
            cost={totalOpt}
            sla={`${num(opt.sla ?? opt.slaDays).toFixed(1)} days avg`}
            savings={savings}
            note={`Cortex · ${plan.forecastHorizonMonths || 6}-month horizon`}
          />
        </div>
      </div>

      <div className="row-2-eq" style={{ marginBottom: 16 }}>
        <ScenarioPanel label="Current strategy" accent="default" warehouses={warehouses} activeNodes={curNodes} scenario={cur} />
        <ScenarioPanel
          label="Optimized strategy"
          accent="purple"
          warehouses={warehouses}
          activeNodes={warehouses.map((w) => w.code)}
          scenario={opt}
          savings={savings}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Icon name="bolt" size={15} /> Cash & service impact, projected over next 30 days
          </div>
          <Chip tone="purple" dot={false}>Modeled by Cortex Net-Opt</Chip>
        </div>
        <div className="card-body" style={{ paddingTop: 18 }}>
          {uniqueImpact.length === 0 ? (
            <EmptyState>Cost breakdown not yet returned by the plan model.</EmptyState>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${uniqueImpact.length}, 1fr)`, gap: 16 }}>
              {uniqueImpact.map((k) => (
                <ImpactComparison
                  key={k}
                  label={METRIC_LABELS[k].label}
                  before={num(cur[k])}
                  after={num(opt[k])}
                  unit={METRIC_LABELS[k].unit}
                  inverse={METRIC_LABELS[k].inverse}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ApprovalSurface
        savings={savings}
        accepted={accepted}
        denied={denied}
        accepting={accepting}
        onAccept={accept}
        onDeny={() => {
          setAccepted(false);
          setDenied(true);
        }}
        plan={plan}
      />
    </div>
  );
};

const StrategyCard = ({
  active,
  badge,
  tone,
  title,
  nodes,
  cost,
  sla,
  savings,
  note,
}: {
  active: boolean;
  badge: string;
  tone: string;
  title: string;
  nodes: string;
  cost: number;
  sla: string;
  savings?: number;
  note: string;
}) => (
  <div
    style={{
      textAlign: 'left',
      padding: 16,
      borderRadius: 10,
      border: active ? `1.5px solid var(--${tone === 'default' ? 'accent' : tone})` : '1px solid var(--border)',
      background: active ? `var(--${tone === 'default' ? 'accent' : tone}-soft)` : 'var(--bg-elev)',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <Chip tone={tone === 'default' ? 'default' : (tone as any)} dot={false}>{badge}</Chip>
      {active && <Icon name="check" size={14} style={{ color: `var(--${tone === 'default' ? 'accent' : tone})` }} />}
    </div>
    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nodes}</div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>30d total</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{fmt.money(cost)}</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>SLA</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{sla}</span>
    </div>
    {savings !== undefined && savings > 0 && (
      <div style={{ marginTop: 8, padding: '6px 8px', background: 'var(--green-soft)', color: 'var(--green-text)', borderRadius: 4, fontSize: 11.5, fontWeight: 700, textAlign: 'center' }}>
        Saves {fmt.money(savings, { compact: true })} / mo
      </div>
    )}
    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 6 }}>{note}</div>
  </div>
);

const ScenarioPanel = ({
  label,
  accent,
  warehouses,
  activeNodes,
  scenario,
  savings,
}: {
  label: string;
  accent: 'default' | 'purple';
  warehouses: { code: string; state?: string }[];
  activeNodes: string[];
  scenario: Record<string, number>;
  savings?: number;
}) => {
  const W = 400;
  const H = 220;
  const project = (lng: number, lat: number) => {
    const x = ((lng - -125) / (-67 - -125)) * (W - 60) + 30;
    const y = ((50 - lat) / (50 - 24)) * (H - 50) + 25;
    return [x, y] as const;
  };
  const nodes = warehouses
    .map((w) => ({ ...w, geo: WH_GEO[w.code] }))
    .filter((w) => w.geo);

  return (
    <div className="card" style={{ borderColor: accent === 'purple' ? 'var(--purple-soft)' : 'var(--border)' }}>
      <div className="card-header" style={{ background: accent === 'purple' ? 'var(--purple-soft)' : 'transparent' }}>
        <div className="card-title">{label}</div>
        {savings !== undefined && <Chip tone="green" dot={false}>+{fmt.money(savings, { compact: true })}/mo</Chip>}
      </div>
      <div style={{ padding: 0 }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
          <path
            d="M40,160 Q60,80 130,70 Q200,40 280,55 Q360,40 430,55 Q500,30 560,50 Q620,40 660,80 Q680,100 670,140 Q650,180 600,200 Q540,210 460,200 Q420,220 360,210 Q300,200 240,210 Q180,220 130,200 Q80,200 40,160 Z"
            fill="none"
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="2 3"
            transform={`scale(${W / 700} ${H / 250})`}
          />
          {nodes
            .filter((w) => activeNodes.includes(w.code))
            .map((w, i, arr) => {
              const [x1, y1] = project(w.geo!.lng, w.geo!.lat);
              return arr.slice(i + 1).map((w2) => {
                const [x2, y2] = project(w2.geo!.lng, w2.geo!.lat);
                return (
                  <line
                    key={`${w.code}-${w2.code}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={accent === 'purple' ? 'var(--purple)' : 'var(--text-tertiary)'}
                    strokeWidth="1"
                    strokeDasharray="2 4"
                    opacity="0.4"
                  />
                );
              });
            })}
          {nodes.map((w) => {
            const [x, y] = project(w.geo!.lng, w.geo!.lat);
            const isActive = activeNodes.includes(w.code);
            const color = isActive ? (accent === 'purple' ? 'var(--purple)' : 'var(--accent)') : 'var(--text-disabled)';
            const r = isActive ? 7 : 4;
            return (
              <g key={w.code} opacity={isActive ? 1 : 0.5}>
                {isActive && <circle cx={x} cy={y} r={r + 6} fill={color} opacity="0.18" />}
                <circle cx={x} cy={y} r={r} fill={color} stroke="var(--bg-elev)" strokeWidth="2" />
                <text x={x} y={y - r - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill={isActive ? 'var(--text)' : 'var(--text-tertiary)'} fontFamily="var(--mono)">
                  {w.code}
                </text>
              </g>
            );
          })}
        </svg>
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, borderTop: '1px solid var(--border-subtle)' }}>
          <div className="kv"><div className="kv-label">Active rooftops</div><div className="kv-value">{activeNodes.length}</div></div>
          <div className="kv"><div className="kv-label">Avg SLA</div><div className="kv-value">{num(scenario.sla ?? scenario.slaDays).toFixed(1)}d</div></div>
          <div className="kv"><div className="kv-label">30d freight</div><div className="kv-value">{fmt.money(num(scenario.freight))}</div></div>
          <div className="kv"><div className="kv-label">30d storage</div><div className="kv-value">{fmt.money(num(scenario.storage))}</div></div>
        </div>
      </div>
    </div>
  );
};

const ImpactComparison = ({
  label,
  before,
  after,
  unit,
  inverse = false,
}: {
  label: string;
  before: number;
  after: number;
  unit?: string;
  inverse?: boolean;
}) => {
  const delta = after - before;
  const pct = before ? (delta / before) * 100 : 0;
  const good = inverse ? delta > 0 : delta < 0;
  const fmtVal = (v: number) => (unit === 'd' ? `${v.toFixed(1)}d` : fmt.money(v));
  return (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmtVal(before)}</span>
        <Icon name="arrowRight" size={11} style={{ color: 'var(--text-tertiary)' }} />
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{fmtVal(after)}</span>
      </div>
      <div style={{ height: 6, display: 'flex', gap: 2 }}>
        <div style={{ flex: Math.abs(before) || 1, background: 'var(--bg-active)', borderRadius: 3 }} />
        <div style={{ flex: Math.abs(after) || 1, background: good ? 'var(--green)' : 'var(--red)', borderRadius: 3, opacity: 0.85 }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: good ? 'var(--green-text)' : 'var(--red-text)', marginTop: 4 }}>
        {delta > 0 ? '+' : '−'}
        {unit === 'd' ? `${Math.abs(delta).toFixed(1)}d` : fmt.money(Math.abs(delta), { compact: true })} ({pct > 0 ? '+' : ''}
        {pct.toFixed(1)}%)
      </div>
    </div>
  );
};

const AREA_ICON: Record<string, { icon: string; color: string }> = {
  wms: { icon: 'box', color: '#3157f6' },
  tms: { icon: 'shipments', color: '#6d28d9' },
  procurement: { icon: 'tag', color: '#10b981' },
  audit: { icon: 'audit', color: '#f59e0b' },
  customer: { icon: 'support', color: '#ec4899' },
  cortex: { icon: 'sparkle', color: '#a855f7' },
};

const ApprovalSurface = ({
  savings,
  accepted,
  denied,
  accepting,
  onAccept,
  onDeny,
  plan,
}: {
  savings: number;
  accepted: boolean;
  denied: boolean;
  accepting: boolean;
  onAccept: () => void;
  onDeny: () => void;
  plan: BusinessDoubleResponse['plan'];
}) => {
  const areas = (plan.autonomousAfterApproval || []).map((a) => {
    const key = Object.keys(AREA_ICON).find((k) => a.toLowerCase().includes(k)) || 'cortex';
    return { area: a, ...AREA_ICON[key] };
  });
  const cur = plan.currentMetrics || {};
  const opt = plan.optimizedMetrics || {};
  const state = accepted ? 'approved' : denied ? 'denied' : 'no decision';

  return (
    <div
      className="card"
      style={{
        marginTop: 16,
        background: accepted
          ? 'linear-gradient(180deg, var(--green-soft) 0%, var(--bg-elev) 60%)'
          : denied
            ? 'linear-gradient(180deg, var(--red-soft) 0%, var(--bg-elev) 60%)'
            : 'linear-gradient(180deg, var(--purple-soft) 0%, var(--bg-elev) 60%)',
        border: accepted ? '1px solid var(--green-soft)' : denied ? '1px solid var(--red-soft)' : '1px solid var(--purple-soft)',
      }}
    >
      <div className="card-body" style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr .7fr auto auto', gap: 14, alignItems: 'stretch' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, marginBottom: 7 }}>Current</div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Current operating model</div>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginTop: 6 }}>
              {`Cost: ${fmt.money(num(cur.monthlyCost ?? cur.freight))}\nWarehouses: ${num(cur.warehouseNodes)}\nSLA: ${num(cur.averageDeliveryDays ?? cur.sla ?? cur.slaDays).toFixed(1)} days`}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--purple-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, marginBottom: 7 }}>Suggested</div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{plan.title || 'Optimized operating model'}</div>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--purple-text)', whiteSpace: 'pre-wrap', marginTop: 6, fontWeight: 700 }}>
              {`Cost: ${fmt.money(num(opt.monthlyCost ?? opt.freight))}\nWarehouses: ${num(opt.warehouseNodes)}\nSLA: ${num(opt.averageDeliveryDays ?? opt.sla ?? opt.slaDays).toFixed(1)} days`}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, marginBottom: 7 }}>Improvement</div>
            <div style={{ fontSize: 38, fontWeight: 700, color: 'var(--green-text)', letterSpacing: '-0.02em', lineHeight: 1 }}>
              +{fmt.money(Math.abs(savings))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>30-day upside</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, marginBottom: 7 }}>Status</div>
            <Chip tone={accepted ? 'green' : denied ? 'red' : 'default'} dot={false}>{state}</Chip>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
              {plan.id} · {plan.status}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, justifyContent: 'center' }}>
            <button
              className={`btn ${accepted ? '' : 'primary'} lg`}
              onClick={onAccept}
              disabled={accepting || accepted || denied}
              style={{ marginTop: 8, height: 44, fontSize: 14 }}
            >
              {accepted ? (
                <>
                  <Icon name="check" size={15} /> Plan accepted
                </>
              ) : (
                <>
                  <Icon name="bolt" size={15} /> {accepting ? 'Accepting…' : 'Accept this plan'}
                </>
              )}
            </button>
            <button className="btn lg" disabled={accepting || accepted || denied} onClick={onDeny} style={{ height: 40, fontSize: 14 }}>
              {denied ? 'Plan denied' : 'Deny plan'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 12 }}>
            What happens autonomously {accepted ? '(running now)' : 'if you accept'}
          </div>
          {areas.length === 0 ? (
            <EmptyState>No autonomous actions defined for this plan.</EmptyState>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {areas.map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr',
                    gap: 10,
                    padding: 12,
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    background: 'var(--bg-elev)',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: a.color, color: 'white', display: 'grid', placeItems: 'center' }}>
                    <Icon name={a.icon} size={15} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{a.area}</span>
                      {accepted && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} className="pulsing" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {plan.approvalRequiredFor?.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
              Still requires your approval: {plan.approvalRequiredFor.join(' · ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
