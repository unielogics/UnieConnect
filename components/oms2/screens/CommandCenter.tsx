import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, Sparkline, ProgressBar, fmt, Loading, ErrorState, EmptyState } from '../ui';
import {
  approveRecommendation,
  fetchCommandCenter,
  fetchCortexTasks,
  fetchBusinessDouble,
  fetchLatestOptimization,
  completeCortexTask,
  dismissCortexTask,
  runSellerOptimization,
  rejectRecommendation,
  CommandCenterFull,
  BusinessDoubleResponse,
  CortexTask,
  IntelligenceReadiness,
  OmsRecommendation,
  SellerOptimizationSummary,
} from '../../../lib/oms';
import { sparkFrom, deltaDir, severityTone, severityIcon, timeAgo } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';
import { DecisionComparison, isActionableDecisionRecommendation } from '../DecisionComparison';

type Range = 'today' | '7d' | '30d';

export const CommandCenter = ({ onNavigate }: ScreenProps) => {
  const [range, setRange] = useState<Range>('7d');
  const [data, setData] = useState<CommandCenterFull | null>(null);
  const [bd, setBd] = useState<BusinessDoubleResponse | null>(null);
  const [readiness, setReadiness] = useState<IntelligenceReadiness | null>(null);
  const [latestOpt, setLatestOpt] = useState<SellerOptimizationSummary | null>(null);
  const [recommendations, setRecommendations] = useState<OmsRecommendation[]>([]);
  const [tasks, setTasks] = useState<CortexTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  const load = (r: Range) => {
    setLoading(true);
    setErr(null);
    fetchCommandCenter(r)
      .then((d) => setData(d))
      .catch((e) => setErr(e.message || 'Failed to load command center'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(range);
  }, [range]);
  useEffect(() => {
    fetchBusinessDouble().then(setBd).catch(() => {});
    fetchLatestOptimization()
      .then((r) => {
        setReadiness(r.readiness);
        setLatestOpt(r.latest || null);
        setRecommendations(r.recommendations || []);
      })
      .catch(() => {});
    fetchCortexTasks({ status: 'open', refresh: true, limit: 10 })
      .then((r) => setTasks(r.tasks || []))
      .catch(() => setTasks([]));
  }, []);

  const triggerOptimization = async () => {
    setOptimizing(true);
    try {
      const response = await runSellerOptimization({ source: 'command_center' });
      setReadiness(response.readiness);
      setLatestOpt(response.optimization);
      setRecommendations(response.recommendations || []);
      fetchBusinessDouble().then(setBd).catch(() => {});
      load(range);
    } catch (e: any) {
      setErr(e.message || 'Seller Optimization failed');
    } finally {
      setOptimizing(false);
    }
  };

  const decideRecommendation = async (rec: OmsRecommendation, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') await approveRecommendation(rec.id, { source: 'command_center' });
      else await rejectRecommendation(rec.id, 'Denied from Command Center');
    } finally {
      const r = await fetchLatestOptimization().catch(() => null);
      if (r) setRecommendations(r.recommendations || []);
    }
  };

  const decideTask = async (task: CortexTask, action: 'done' | 'dismiss') => {
    try {
      if (action === 'done') await completeCortexTask(task.id);
      else await dismissCortexTask(task.id);
      const r = await fetchCortexTasks({ status: 'open', limit: 10 }).catch(() => null);
      if (r) setTasks(r.tasks || []);
    } catch {
      /* keep command center stable */
    }
  };

  const m = data?.metrics;
  const tiles = m
    ? [
        { label: 'Revenue', value: fmt.money(m.revenue, { compact: true }), delta: m.revenueDeltaPct, spark: sparkFrom(m.revenue, m.revenueDeltaPct), color: 'var(--accent)', tone: '' },
        { label: 'Orders', value: fmt.num(m.orders), delta: m.ordersDeltaPct, spark: sparkFrom(m.orders, m.ordersDeltaPct), color: 'var(--blue)', tone: '' },
        { label: 'Avg order value', value: `$${(m.aov || 0).toFixed(2)}`, delta: m.revenueDeltaPct - m.ordersDeltaPct, spark: sparkFrom(m.aov, 2), color: 'var(--text-secondary)', tone: '' },
        { label: 'Gross profit', value: fmt.money(m.grossProfit, { compact: true }), delta: m.revenueDeltaPct, spark: sparkFrom(m.grossProfit, m.revenueDeltaPct), color: 'var(--green)', tone: 'good' },
        { label: 'Units shipped', value: fmt.num(m.units), delta: m.unitsDeltaPct, spark: sparkFrom(m.units, m.unitsDeltaPct), color: 'var(--accent)', tone: '' },
      ]
    : [];

  const savings = bd?.plan?.savings || {};
  const upside = Number(savings.revenue ?? savings.revenueUpside ?? 0);
  const costRed = Number(savings.costPct ?? savings.costReductionPct ?? 0);
  const slaImp = Number(savings.sla ?? savings.slaDays ?? 0);
  const decisionRecommendations = useMemo(
    () => recommendations.filter(isActionableDecisionRecommendation),
    [recommendations]
  );

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Command Center</h1>
          <p className="page-subtitle">
            {data?.generatedAt ? `Last full sync ${timeAgo(data.generatedAt)}` : 'Live operating cockpit'}
            {data?.counts ? ` across ${data.counts.facilities ?? 0} warehouses and ${data.counts.channels ?? 0} channels.` : '.'}
          </p>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button className={range === 'today' ? 'active' : ''} onClick={() => setRange('today')}>Today</button>
            <button className={range === '7d' ? 'active' : ''} onClick={() => setRange('7d')}>7 days</button>
            <button className={range === '30d' ? 'active' : ''} onClick={() => setRange('30d')}>30 days</button>
          </div>
          <button className="btn"><Icon name="download" size={13} /> Export</button>
          <button className="btn" onClick={triggerOptimization} disabled={optimizing}>
            <Icon name="sparkle" size={13} /> {optimizing ? 'Running...' : 'Run Seller Optimization'}
          </button>
          <button className="btn primary" onClick={() => onNavigate('double')}>
            <Icon name="double" size={13} /> Review optimized plan
          </button>
        </div>
      </div>

      {err ? (
        <div className="card"><ErrorState message={err} onRetry={() => load(range)} /></div>
      ) : loading || !data ? (
        <div className="card"><Loading rows={4} /></div>
      ) : (
        <>
          <div className="stat-grid cols-5">
            {tiles.map((t) => (
              <div key={t.label} className={`stat ${t.tone}`}>
                <div className="stat-label">{t.label}</div>
                <div className="stat-value">{t.value}</div>
                <div className={`stat-delta ${deltaDir(t.delta)}`}>
                  <span className="arrow">{t.delta >= 0 ? '▲' : '▼'}</span>
                  {t.delta >= 0 ? '+' : ''}
                  {t.delta.toFixed(1)}% vs prior
                </div>
                <div className="stat-spark">
                  <Sparkline data={t.spark} color={t.color} width={80} height={28} fill />
                </div>
              </div>
            ))}
          </div>

          <div className="command-decision-row" style={{ marginBottom: 16 }}>
            <OptimizationImpactPanel recommendations={decisionRecommendations} onNavigate={onNavigate} onDecision={decideRecommendation} />
            <RevenueTrendCard data={data} bd={bd} compact />
          </div>

          <div className="command-task-plan-row" style={{ marginBottom: 16 }}>
            <CortexTasksPanel tasks={tasks} onNavigate={onNavigate} onDecision={decideTask} />
            <AiPlanCard
              bd={bd}
              upside={upside}
              costRed={costRed}
              slaImp={slaImp}
              optimizing={optimizing}
              onRun={triggerOptimization}
              onNavigate={onNavigate}
            />
          </div>

          <div className="row-2" style={{ marginBottom: 16 }}>
            <IntelligenceReadinessPanel readiness={readiness} latest={latestOpt} recommendations={decisionRecommendations} onNavigate={onNavigate} />
            <ChannelMixCard data={data} />
          </div>

          <div className="row-2" style={{ marginBottom: 16 }}>
            <WarningsPanel warnings={data.warnings} />
            <AutonomousActivityRail activity={data.autonomousActivity} />
          </div>

        </>
      )}
    </div>
  );
};

const AiPlanCard = ({
  bd,
  upside,
  costRed,
  slaImp,
  optimizing,
  onRun,
  onNavigate,
}: {
  bd: BusinessDoubleResponse | null;
  upside: number;
  costRed: number;
  slaImp: number;
  optimizing: boolean;
  onRun: () => void;
  onNavigate: (target: string, payload?: string) => void;
}) => {
  const staged = bd?.plan?.autonomousAfterApproval?.length || 0;
  const approvals = bd?.plan?.approvalRequiredFor?.length || 0;
  const status = bd?.plan?.status === 'approved' ? 'active' : 'proposed';
  const hasModeledImpact = Boolean(upside || costRed || slaImp);
  const horizon = bd?.plan?.forecastHorizonMonths || 6;
  return (
    <div className="card ai-plan-card">
      <div className="card-header">
        <div>
          <div className="card-title"><Icon name="double" size={15} /> AI plan</div>
          <div className="card-subtitle">{bd?.plan?.title || 'Six-month multi-warehouse operating plan'}</div>
        </div>
        <Chip tone={status === 'active' ? 'green' : 'purple'} dot={false}>{status}</Chip>
      </div>
      <div className="card-body ai-plan-body">
        <div>
          <div className="ai-plan-title">Your business, optimized for the next 30 days</div>
          <div className="ai-plan-summary">
            {bd?.plan?.summary || 'Cortex models seller demand, WMS truth, pallet economics, and transport consolidation to lower cost while improving delivery speed.'}
          </div>
        </div>
        <div className="ai-plan-metrics">
          <MiniMetric label="Revenue upside" value={upside ? fmt.money(upside, { compact: true, sign: true }) : '—'} sub="modeled gain" tone={upside ? 'green' : undefined} />
          <MiniMetric label="Cost reduction" value={costRed ? `−${Math.abs(costRed).toFixed(1)}%` : '—'} sub="network cost" tone={costRed ? 'green' : undefined} />
          <MiniMetric label="SLA improvement" value={slaImp ? `−${Math.abs(slaImp).toFixed(1)}d` : '—'} sub="delivery speed" tone={slaImp ? 'green' : undefined} />
        </div>
        <div className="ai-plan-readiness">
          <Chip tone={hasModeledImpact ? 'green' : 'amber'} dot={false}>
            {hasModeledImpact ? 'Impact modeled' : 'Needs optimization run'}
          </Chip>
          <span>{horizon}-month plan · {approvals} approval gates · {staged} staged actions</span>
        </div>
        <div className="ai-plan-footer">
          <button className="btn ghost sm" onClick={onRun} disabled={optimizing}>
            <Icon name="sparkle" size={12} /> {optimizing ? 'Running...' : 'Run optimization'}
          </button>
          <button className="btn primary sm" onClick={() => onNavigate('double')}>
            Open Business Double <Icon name="arrowRight" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

const RevenueTrendCard = ({ data, bd, compact = false }: { data: CommandCenterFull; bd: BusinessDoubleResponse | null; compact?: boolean }) => {
  const revenue = data.metrics.revenue || 0;
  const optMult = 1 + Math.abs(Number(bd?.plan?.savings?.costPct ?? 8)) / 100;
  const N = data.range === 'today' ? 24 : data.range === '7d' ? 8 : 6;
  const labels =
    data.range === 'today'
      ? Array.from({ length: 8 }, (_, i) => `${i * 3}:00`)
      : data.range === '7d'
      ? ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed']
      : Array.from({ length: 6 }, (_, i) => `W${i + 1}`);
  const actualRaw = sparkFrom(revenue / N, data.metrics.revenueDeltaPct, N).map((v) => Math.max(0, v));
  const actual = actualRaw.length >= 2 ? actualRaw : Array.from({ length: N }, () => 0);
  const optimized = actual.map((v) => v * optMult);

  const W = 720;
  const H = compact ? 170 : 220;
  const P = { l: 50, r: 12, t: 16, b: 28 };
  const max = Math.max(1, ...optimized.filter(Number.isFinite)) * 1.05;
  const xStep = (W - P.l - P.r) / Math.max(1, N - 1);
  const yScale = (v: number) => {
    const n = Number.isFinite(v) ? v : 0;
    return H - P.b - (n / max) * (H - P.t - P.b);
  };
  const linePath = (vals: number[]) =>
    vals.length >= 2 ? vals.map((v, i) => `${i ? 'L' : 'M'}${P.l + i * xStep} ${yScale(v)}`).join(' ') : '';
  const areaPath = (vals: number[]) => {
    const line = linePath(vals);
    return line ? `${line} L${P.l + (N - 1) * xStep} ${H - P.b} L${P.l} ${H - P.b} Z` : '';
  };
  const totalActual = revenue;
  const totalOpt = revenue * optMult;

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Revenue trend</div>
          <div className="card-subtitle">
            Actual <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmt.money(totalActual, { compact: true })}</span>
            {' · '}Projected if optimized plan applied{' '}
            <span style={{ color: 'var(--green-text)', fontWeight: 600 }}>{fmt.money(totalOpt, { compact: true })}</span>
            <span style={{ color: 'var(--green-text)', marginLeft: 6 }}>+{fmt.money(totalOpt - totalActual, { compact: true })}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 2, background: 'var(--accent)', borderRadius: 1 }} /> Actual
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 2, background: 'var(--green)', borderRadius: 1 }} /> If optimized
          </span>
        </div>
      </div>
      <div style={{ padding: compact ? '4px 0 0' : '8px 0 0' }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }} preserveAspectRatio="none">
          {[0, 0.25, 0.5, 0.75, 1].map((p) => {
            const y = yScale(max * p);
            return (
              <g key={p}>
                <line x1={P.l} x2={W - P.r} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="0.5" />
                <text x={P.l - 8} y={y + 3} textAnchor="end" fontSize="9.5" fill="var(--text-tertiary)" fontFamily="var(--mono)">
                  {fmt.money(max * p, { compact: true }).replace('$', '')}
                </text>
              </g>
            );
          })}
          <path d={areaPath(optimized)} fill="var(--green)" opacity="0.08" />
          <path d={linePath(optimized)} fill="none" stroke="var(--green)" strokeWidth="1.5" strokeDasharray="4 3" />
          <path d={areaPath(actual)} fill="var(--accent)" opacity="0.12" />
          <path d={linePath(actual)} fill="none" stroke="var(--accent)" strokeWidth="2" />
          {labels.map((l, i) => {
            const x = P.l + (i / (labels.length - 1)) * (W - P.l - P.r);
            return (
              <text key={i} x={x} y={H - 10} textAnchor="middle" fontSize="9.5" fill="var(--text-tertiary)">
                {l}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

const CortexTasksPanel = ({
  tasks,
  onNavigate,
  onDecision,
}: {
  tasks: CortexTask[];
  onNavigate: (target: string, payload?: string) => void;
  onDecision: (task: CortexTask, action: 'done' | 'dismiss') => void;
}) => {
  const highPriority = tasks.filter((task) => task.priority === 'high').length;
  const screens = Array.from(new Set(tasks.map((task) => task.screen || task.actionTarget || 'command'))).slice(0, 4);
  const sources = Array.from(new Set(tasks.map((task) => task.source || 'readiness'))).slice(0, 3);
  return (
    <div className="card cortex-task-panel">
      <div className="card-header">
        <div>
          <div className="card-title"><Icon name="sparkle" size={15} /> Cortex task inbox</div>
          <div className="card-subtitle">Readiness work that improves account intelligence. Approval decisions stay in the decision panel.</div>
        </div>
        <Chip tone={tasks.length ? 'purple' : 'green'} dot={false}>{tasks.length} open</Chip>
      </div>
      {tasks.length === 0 ? (
        <div className="card-body"><EmptyState>No open Cortex tasks. Readiness blockers and recommendations will appear here.</EmptyState></div>
      ) : (
        <>
          <div className="cortex-task-summary">
            <MiniMetric label="High priority" value={String(highPriority)} sub="needs action" tone={highPriority ? 'red' : 'green'} />
            <MiniMetric label="Work areas" value={String(screens.length)} sub={screens.map((s) => s.replace(/-/g, ' ')).join(', ') || 'none'} />
            <MiniMetric label="Sources" value={String(sources.length)} sub={sources.join(', ')} />
          </div>
          <div className="table-wrap">
            <table className="data-table cortex-task-table">
              <thead>
                <tr>
                  <th>Task and reason</th>
                  <th>Priority</th>
                  <th>Where</th>
                  <th>Source</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <strong>{task.title}</strong>
                      {task.detail && <div className="muted">{task.detail}</div>}
                    </td>
                    <td><span className={`task-priority ${task.priority}`}>{task.priority}</span></td>
                    <td>{(task.screen || task.actionTarget || 'command').replace(/-/g, ' ')}</td>
                    <td><Chip dot={false}>{task.source}</Chip></td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn ghost sm task-open-btn"
                          title={task.actionLabel || 'Open'}
                          onClick={() => onNavigate(task.actionTarget || task.screen || 'command', task.entityId || undefined)}
                        >
                          <Icon name="arrowRight" size={12} /> {task.actionLabel || 'Open'}
                        </button>
                        <button className="icon-btn" data-hint="Mark done" onClick={() => onDecision(task, 'done')}><Icon name="check" size={13} /></button>
                        <button className="icon-btn" data-hint="Dismiss" onClick={() => onDecision(task, 'dismiss')}><Icon name="x" size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

const ChannelMixCard = ({ data }: { data: CommandCenterFull }) => {
  // Backend exposes channel count only; render the design card with an
  // honest empty/derived state rather than fabricating per-channel revenue.
  const channels = data.counts?.channels ?? 0;
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Channel mix</div>
        <Chip dot={false}>{data.range === 'today' ? 'Today' : data.range === '7d' ? 'Last 7d' : 'Last 30d'}</Chip>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <MiniMetric label="Connected channels" value={String(channels)} sub="marketplace feeds" />
          <MiniMetric label="Orders" value={fmt.num(data.metrics.orders)} sub={`${data.range}`} tone="green" />
          <MiniMetric label="Refunds" value={fmt.money(data.metrics.refunds || 0, { compact: true })} sub="captured" tone={data.metrics.refunds ? 'red' : undefined} />
        </div>
        <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
          <EmptyState>Per-channel revenue split is not yet exposed by the orders feed.</EmptyState>
        </div>
      </div>
    </div>
  );
};

const MiniMetric = ({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) => (
  <div>
    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3, color: tone ? `var(--${tone}-text)` : 'var(--text)' }}>{value}</div>
    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sub}</div>
  </div>
);

const IntelligenceReadinessPanel = ({
  readiness,
  latest,
  recommendations,
  onNavigate,
}: {
  readiness: IntelligenceReadiness | null;
  latest: SellerOptimizationSummary | null;
  recommendations: OmsRecommendation[];
  onNavigate: (target: string) => void;
}) => {
  const score = readiness?.score || 0;
  const tone = score >= 78 ? 'green' : score >= 50 ? 'amber' : 'red';
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title"><Icon name="sparkle" size={15} /> AI readiness</div>
          <div className="card-subtitle">Marketplace first, CSV fallback, WMS truth for execution.</div>
        </div>
        <Chip tone={tone as any} dot={false}>{score}%</Chip>
      </div>
      <div className="card-body" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <MiniMetric label="Primary feed" value={(readiness?.sourceMode || 'manual').replace(/_/g, ' ')} sub={readiness?.primarySource?.replace(/_/g, ' ') || 'setup needed'} />
          <MiniMetric label="Open recs" value={String(recommendations.length)} sub="current vs optimized" tone="green" />
          <MiniMetric label="Last run" value={latest ? 'Available' : 'Not run'} sub={latest?.publicId || 'run optimization'} tone={latest ? 'green' : 'red'} />
        </div>
        {readiness?.blockers?.length ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {readiness.blockers.slice(0, 3).map((blocker) => <Chip key={blocker} tone="amber" dot={false}>{blocker}</Chip>)}
          </div>
        ) : (
          <Chip tone="green" dot={false}>Ready for high-confidence optimization</Chip>
        )}
        <button className="btn sm" onClick={() => onNavigate('connections')}>
          <Icon name="plug" size={12} /> Improve data sources
        </button>
      </div>
    </div>
  );
};

const OptimizationImpactPanel = ({
  recommendations,
  onNavigate,
  onDecision,
}: {
  recommendations: OmsRecommendation[];
  onNavigate: (target: string, payload?: string) => void;
  onDecision: (rec: OmsRecommendation, action: 'approve' | 'reject') => void;
}) => (
  <div className="card">
    <div className="card-header">
      <div>
        <div className="card-title">Current vs suggested decisions</div>
        <div className="card-subtitle">Current state, Cortex suggestion, traceable impact, and the action to take. Approvals are reserved for concrete changes.</div>
      </div>
      <Chip tone="purple" dot={false}>{recommendations.length} open</Chip>
    </div>
    <div style={{ padding: 12, maxHeight: 360, overflow: 'auto' }}>
      {recommendations.length === 0 ? (
        <EmptyState>Run Seller Optimization to generate account-level opportunities.</EmptyState>
      ) : recommendations.slice(0, 5).map((rec) => (
        <DecisionComparison
          key={rec.id}
          rec={rec}
          compact
          onOpen={() => onNavigate(rec.entityType === 'sku' ? 'sku-detail' : rec.entityType === 'business_double' ? 'double' : 'ledger', rec.entityId)}
          onApprove={() => onDecision(rec, 'approve')}
          onDeny={() => onDecision(rec, 'reject')}
        />
      ))}
    </div>
  </div>
);

const WarningsPanel = ({ warnings }: { warnings: CommandCenterFull['warnings'] }) => (
  <div className="card">
    <div className="card-header">
      <div className="card-title">
        <Icon name="warning" size={15} style={{ color: 'var(--amber)' }} />
        Warnings
        <Chip dot={false}>{warnings.length}</Chip>
      </div>
      <div className="seg">
        <button className="active">All</button>
        <button>Critical</button>
        <button>Need attention</button>
      </div>
    </div>
    <div style={{ maxHeight: 420, overflowY: 'auto' }}>
      {warnings.length === 0 && <EmptyState>No active warnings — operations within thresholds.</EmptyState>}
      {warnings.map((w, idx) => {
        const tone = severityTone(w.severity);
        return (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: `var(--${tone}-soft)`, color: `var(--${tone})`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon name={severityIcon(w.severity)} size={14} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <Chip tone={tone} dot={false}>
                  {w.severity}
                </Chip>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{w.title}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{w.detail}</div>
            </div>
            <button className="btn ghost sm" style={{ alignSelf: 'center' }}>
              <Icon name="chevron" size={11} />
            </button>
          </div>
        );
      })}
    </div>
  </div>
);

const AutonomousActivityRail = ({ activity }: { activity: CommandCenterFull['autonomousActivity'] }) => (
  <div className="card">
    <div className="card-header">
      <div>
        <div className="card-title">
          <Icon name="bolt" size={15} style={{ color: 'var(--purple)' }} />
          Autonomous activity
        </div>
        <div className="card-subtitle">WMS, TMS, and Cortex actions executed without operator input.</div>
      </div>
      <Chip tone="purple" dot={false}>{activity.length} actions</Chip>
    </div>
    <div style={{ maxHeight: 420, overflowY: 'auto' }}>
      {activity.length === 0 && <EmptyState>No autonomous actions in this window.</EmptyState>}
      {activity.map((e, i) => {
        const tone = e.status === 'complete' ? 'green' : e.status === 'pending' ? 'amber' : 'blue';
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 24px 1fr auto', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{timeAgo(e.at)}</span>
            <div style={{ width: 22, height: 22, borderRadius: 4, background: `var(--${tone}-soft)`, color: `var(--${tone})`, display: 'grid', placeItems: 'center' }}>
              <Icon name="bolt" size={12} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text)' }}>{e.action}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{e.system}</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: `var(--${tone}-text)` }}>
              {e.impact || (e.confidence ? `${Math.round(e.confidence * 100)}%` : 'auto')}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);
