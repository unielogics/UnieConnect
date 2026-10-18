import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Icon } from '../icons';
import { Chip, Sparkline, ProgressBar, confidencePercent, fmt, Loading, ErrorState, EmptyState, downloadCsv } from '../ui';
import {
  CORTEX_TASKS_CHANGED_EVENT,
  approveRecommendation,
  fetchCommandCenter,
  fetchCortexTasks,
  fetchBusinessDouble,
  fetchLatestOptimization,
  completeCortexTask,
  dismissCortexTask,
  notifyCortexTasksChanged,
  runSellerOptimization,
  waitForSellerOptimization,
  rejectRecommendation,
  CommandCenterFull,
  BusinessDoubleResponse,
  CortexTask,
  CortexTaskSummary,
  IntelligenceReadiness,
  OmsRecommendation,
  SellerOptimizationSummary,
} from '../../../lib/oms';
import { deltaDir, severityTone, severityIcon, timeAgo } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';
import { DecisionComparison, isActionableDecisionRecommendation } from '../DecisionComparison';

type Range = 'today' | '7d' | '30d';

export const CommandCenter = ({ onNavigate }: ScreenProps) => {
  const router = useRouter();
  const [range, setRange] = useState<Range>('7d');
  const [data, setData] = useState<CommandCenterFull | null>(null);
  const [bd, setBd] = useState<BusinessDoubleResponse | null>(null);
  const [readiness, setReadiness] = useState<IntelligenceReadiness | null>(null);
  const [latestOpt, setLatestOpt] = useState<SellerOptimizationSummary | null>(null);
  const [recommendations, setRecommendations] = useState<OmsRecommendation[]>([]);
  const [tasks, setTasks] = useState<CortexTask[]>([]);
  const [taskTotal, setTaskTotal] = useState(0);
  const [taskSummary, setTaskSummary] = useState<CortexTaskSummary>({ highPriority: 0, workAreas: [], sources: [] });
  const [intelligenceLoading, setIntelligenceLoading] = useState(true);
  const [intelligenceErrors, setIntelligenceErrors] = useState<{ plan?: string; readiness?: string; tasks?: string }>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationNotice, setOptimizationNotice] = useState<string | null>(null);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const optimizationAbortRef = useRef<AbortController | null>(null);
  const [taskFeedback, setTaskFeedback] = useState<{ tone: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [taskUpdatingId, setTaskUpdatingId] = useState<string | null>(null);
  const [decisionFeedback, setDecisionFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [decisionUpdatingId, setDecisionUpdatingId] = useState<string | null>(null);
  const commandRequestRef = useRef(0);
  const intelligenceRequestRef = useRef(0);
  const suppressNextTaskEventRef = useRef(false);

  const refreshIntelligencePanels = useCallback(async (refreshTasks = false) => {
    const requestId = ++intelligenceRequestRef.current;
    setIntelligenceLoading(true);
    const [planResult, latestResult, tasksResult] = await Promise.allSettled([
      fetchBusinessDouble(),
      fetchLatestOptimization(),
      fetchCortexTasks({ status: 'open', refresh: refreshTasks, limit: 10 }),
    ]);
    if (intelligenceRequestRef.current !== requestId) return;
    const nextErrors: { plan?: string; readiness?: string; tasks?: string } = {};
    if (planResult.status === 'fulfilled') setBd(planResult.value);
    else nextErrors.plan = planResult.reason?.message || 'The AI plan could not be loaded.';
    if (latestResult.status === 'fulfilled') {
      setReadiness(latestResult.value.readiness);
      setLatestOpt(latestResult.value.latest || null);
      setRecommendations(latestResult.value.recommendations || []);
    } else nextErrors.readiness = latestResult.reason?.message || 'Current Cortex decisions could not be loaded.';
    if (tasksResult.status === 'fulfilled') {
      setTasks(tasksResult.value.tasks || []);
      setTaskTotal(tasksResult.value.total ?? tasksResult.value.tasks?.length ?? 0);
      setTaskSummary(tasksResult.value.summary || { highPriority: 0, workAreas: [], sources: [] });
    } else nextErrors.tasks = tasksResult.reason?.message || 'Cortex tasks could not be loaded.';
    setIntelligenceErrors(nextErrors);
    if (intelligenceRequestRef.current === requestId) setIntelligenceLoading(false);
  }, []);

  const load = useCallback(async (r: Range) => {
    const requestId = ++commandRequestRef.current;
    setLoading(true);
    setErr(null);
    try {
      const next = await fetchCommandCenter(r);
      if (commandRequestRef.current === requestId) setData(next);
    } catch (error: any) {
      if (commandRequestRef.current === requestId) setErr(error?.message || 'Failed to load command center');
    } finally {
      if (commandRequestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);
  useEffect(() => {
    void refreshIntelligencePanels(true);
  }, [refreshIntelligencePanels]);
  useEffect(() => {
    let cancelled = false;
    const onTasksChanged = () => {
      if (suppressNextTaskEventRef.current) {
        suppressNextTaskEventRef.current = false;
        return;
      }
      fetchCortexTasks({ status: 'open', limit: 10 })
        .then((result) => {
          if (!cancelled) {
            setTasks(result.tasks || []);
            setTaskTotal(result.total ?? result.tasks?.length ?? 0);
            setTaskSummary(result.summary || { highPriority: 0, workAreas: [], sources: [] });
            setIntelligenceErrors((current) => ({ ...current, tasks: undefined }));
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setIntelligenceErrors((current) => ({
              ...current,
              tasks: error?.message || 'Cortex tasks could not be refreshed.',
            }));
          }
        });
    };
    window.addEventListener(CORTEX_TASKS_CHANGED_EVENT, onTasksChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(CORTEX_TASKS_CHANGED_EVENT, onTasksChanged);
    };
  }, []);
  useEffect(() => () => {
    commandRequestRef.current += 1;
    intelligenceRequestRef.current += 1;
    optimizationAbortRef.current?.abort();
  }, []);
  useEffect(() => {
    if (!router.isReady || router.query.focus !== 'cortex-tasks') return;
    const timer = window.setTimeout(() => {
      const inbox = document.getElementById('cortex-task-inbox');
      if (!inbox) return;
      inbox.scrollIntoView({ behavior: 'smooth', block: 'start' });
      inbox.focus({ preventScroll: true });
      void router.replace({ pathname: '/oms', query: { view: 'command' } }, undefined, { shallow: true });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [router, router.isReady, router.query.focus]);

  const triggerOptimization = async () => {
    optimizationAbortRef.current?.abort();
    const controller = new AbortController();
    optimizationAbortRef.current = controller;
    setOptimizing(true);
    setOptimizationError(null);
    setOptimizationNotice('Preparing account evidence...');
    try {
      const response = await runSellerOptimization({ source: 'command_center' });
      setReadiness(response.readiness);
      setLatestOpt(response.optimization);
      setRecommendations(response.recommendations || []);
      setOptimizationNotice('Cortex is modeling demand, placement, and fulfillment cost...');
      const final = await waitForSellerOptimization(response.run.id, { signal: controller.signal });
      setReadiness(final.readiness);
      setLatestOpt(final.latest || response.optimization);
      setRecommendations(final.recommendations || []);
      setOptimizationNotice(final.completed
        ? 'Plan updated with the latest Cortex model.'
        : 'Cortex is still processing. The plan will refresh from the latest completed run.');
      await refreshIntelligencePanels(true);
      suppressNextTaskEventRef.current = true;
      notifyCortexTasksChanged();
      await load(range);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setOptimizationError(e.message || 'Cortex optimization could not be completed.');
      setOptimizationNotice(null);
    } finally {
      if (optimizationAbortRef.current === controller) {
        optimizationAbortRef.current = null;
        setOptimizing(false);
      }
    }
  };

  const decideRecommendation = async (rec: OmsRecommendation, action: 'approve' | 'reject') => {
    setDecisionUpdatingId(rec.id);
    setDecisionFeedback(null);
    try {
      if (action === 'approve') await approveRecommendation(rec.id, { source: 'command_center' });
      else await rejectRecommendation(rec.id, 'Denied from Command Center');
      setDecisionFeedback({
        tone: 'success',
        text: action === 'approve' ? `Approved: ${rec.title}` : `Denied: ${rec.title}`,
      });
    } catch (error: any) {
      setDecisionFeedback({
        tone: 'error',
        text: error?.message || `The recommendation could not be ${action === 'approve' ? 'approved' : 'denied'}.`,
      });
    } finally {
      await refreshIntelligencePanels(true);
      setDecisionUpdatingId(null);
    }
  };

  const decideTask = async (task: CortexTask, action: 'done' | 'dismiss') => {
    setTaskUpdatingId(task.id);
    setTaskFeedback(null);
    try {
      if (action === 'done') {
        const result = await completeCortexTask(task.id);
        setTaskFeedback({
          tone: result.verified ? 'success' : 'info',
          text: result.verified
            ? (result.message || 'Cortex verified the account evidence and completed this task.')
            : `${result.message || 'Cortex still detects this blocker.'}${task.actionLabel ? ` Next: ${task.actionLabel}.` : ''}`,
        });
      } else {
        await dismissCortexTask(task.id);
        setTaskFeedback({ tone: 'success', text: 'Task dismissed from the active inbox.' });
      }
      await refreshIntelligencePanels(true);
      suppressNextTaskEventRef.current = true;
      notifyCortexTasksChanged();
    } catch (error: any) {
      setTaskFeedback({ tone: 'error', text: error?.message || 'The task could not be updated. Try again.' });
    } finally {
      setTaskUpdatingId(null);
    }
  };

  const m = data?.metrics;
  const revenueSpark = m?.revenueSeries?.map((point) => point.revenue) || [];
  const tiles = m
    ? [
        { label: 'Revenue', value: fmt.money(m.revenue, { compact: true }), delta: m.revenueDeltaPct, spark: revenueSpark, color: 'var(--accent)', tone: '', note: '' },
        { label: 'Orders', value: fmt.num(m.orders), delta: m.ordersDeltaPct, spark: [], color: 'var(--blue)', tone: '', note: '' },
        { label: 'Avg order value', value: `$${(m.aov || 0).toFixed(2)}`, delta: m.aovDeltaPct ?? null, spark: [], color: 'var(--text-secondary)', tone: '', note: '' },
        {
          label: 'Product gross profit',
          value: m.grossProfitAvailable ? fmt.money(m.grossProfit, { compact: true }) : '—',
          delta: m.grossProfitAvailable ? (m.grossProfitDeltaPct ?? null) : null,
          spark: [],
          color: 'var(--green)',
          tone: m.grossProfitAvailable ? 'good' : '',
          note: m.grossProfitAvailable
            ? ''
            : (m.grossProfitSoldLines || 0) === 0
              ? 'No sold lines in this range'
              : `${m.grossProfitMissingCostLines || 0} sold line${m.grossProfitMissingCostLines === 1 ? '' : 's'} missing cost`,
        },
        { label: 'Units shipped', value: fmt.num(m.units), delta: m.unitsDeltaPct, spark: [], color: 'var(--accent)', tone: '', note: '' },
      ]
    : [];

  const savings = bd?.plan?.savings || {};
  const upside = Number(savings.revenue ?? savings.revenueUpside ?? 0);
  const costRed = Number(savings.costPct ?? savings.costReductionPct ?? savings.pct ?? 0);
  const costRedAmount = Number(savings.monthly ?? savings.total ?? 0);
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
          <button className="btn" disabled={!data} onClick={() => data && downloadCsv(`unieconnect-command-center-${range}.csv`, [
            ...Object.entries(data.metrics || {}).map(([metric, value]) => ({ Section: 'Metric', Name: metric, Value: value })),
            ...Object.entries(data.counts || {}).map(([metric, value]) => ({ Section: 'Count', Name: metric, Value: value })),
            ...(data.warnings || []).map((warning) => ({ Section: 'Warning', Name: warning.title, Value: warning.detail, Severity: warning.severity })),
            ...(data.autonomousActivity || []).map((activity) => ({ Section: 'Activity', Name: activity.action, Value: activity.impact || '', Status: activity.status, System: activity.system, Confidence: activity.confidence, At: activity.at })),
          ])}><Icon name="download" size={13} /> Export</button>
        </div>
      </div>

      {err && (
        <div className="card" style={{ marginBottom: 16 }}><ErrorState message={err} onRetry={() => load(range)} /></div>
      )}
      {optimizationError && (
        <div className="inline-banner danger" role="alert" style={{ marginBottom: 16 }}>
          <Icon name="warning" size={13} />
          <span style={{ flex: 1 }}>{optimizationError}</span>
          <button className="btn ghost sm" onClick={triggerOptimization} disabled={optimizing}>
            <Icon name="refresh" size={12} /> Retry optimization
          </button>
        </div>
      )}

      <div className="command-decision-row" style={{ marginBottom: 16 }}>
        <OptimizationImpactPanel
          recommendations={decisionRecommendations}
          onNavigate={onNavigate}
          onDecision={decideRecommendation}
          feedback={decisionFeedback}
          updatingId={decisionUpdatingId}
          loading={intelligenceLoading}
          error={intelligenceErrors.readiness}
          onRetry={() => void refreshIntelligencePanels(true)}
        />
        <IntelligenceReadinessPanel
          readiness={readiness}
          latest={latestOpt}
          recommendations={decisionRecommendations}
          loading={intelligenceLoading}
          error={intelligenceErrors.readiness}
          onRetry={() => void refreshIntelligencePanels(true)}
          onNavigate={onNavigate}
        />
      </div>

      <div className="command-task-plan-row" style={{ marginBottom: 16 }}>
        <CortexTasksPanel
          tasks={tasks}
          total={taskTotal}
          summary={taskSummary}
          onNavigate={onNavigate}
          onDecision={decideTask}
          feedback={taskFeedback}
          updatingId={taskUpdatingId}
          loading={intelligenceLoading}
          error={intelligenceErrors.tasks}
          onRetry={() => void refreshIntelligencePanels(true)}
        />
        <AiPlanCard
          bd={bd}
          upside={upside}
          costRed={costRed}
          costRedAmount={costRedAmount}
          slaImp={slaImp}
          taskTotal={taskTotal}
          taskSummary={taskSummary}
          optimizing={optimizing}
          optimizationNotice={optimizationNotice}
          loading={intelligenceLoading}
          error={intelligenceErrors.plan}
          onRetry={() => void refreshIntelligencePanels(true)}
          onRun={triggerOptimization}
          onNavigate={onNavigate}
        />
      </div>

      {loading ? (
        <div className="card"><Loading rows={4} /></div>
      ) : !data ? null : (
        <>
          <div className="stat-grid cols-5">
            {tiles.map((t) => (
              <div key={t.label} className={`stat ${t.tone}`}>
                <div className="stat-label">{t.label}</div>
                <div className="stat-value">{t.value}</div>
                {t.delta == null ? (
                  <div className="stat-delta">{t.note || 'No comparable prior data'}</div>
                ) : (
                  <div className={`stat-delta ${deltaDir(t.delta)}`}>
                    <span className="arrow">{t.delta >= 0 ? '▲' : '▼'}</span>
                    {t.delta >= 0 ? '+' : ''}
                    {t.delta.toFixed(1)}% vs prior
                  </div>
                )}
                {t.spark.length >= 2 && (
                  <div className="stat-spark">
                    <Sparkline data={t.spark} color={t.color} width={80} height={28} fill />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="row-2" style={{ marginBottom: 16 }}>
            <RevenueTrendCard data={data} bd={bd} />
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

const IntelligencePanelNotice = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="intelligence-panel-notice" role="alert">
    <Icon name="warning" size={13} />
    <span>{message} Showing the last available data.</span>
    {onRetry && <button className="btn ghost sm" onClick={onRetry}>Retry</button>}
  </div>
);

const AiPlanCard = ({
  bd,
  upside,
  costRed,
  costRedAmount,
  slaImp,
  taskTotal,
  taskSummary,
  optimizing,
  optimizationNotice,
  loading,
  error,
  onRetry,
  onRun,
  onNavigate,
}: {
  bd: BusinessDoubleResponse | null;
  upside: number;
  costRed: number;
  costRedAmount: number;
  slaImp: number;
  taskTotal: number;
  taskSummary: CortexTaskSummary;
  optimizing: boolean;
  optimizationNotice: string | null;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onRun: () => void;
  onNavigate: (target: string, payload?: string) => void;
}) => {
  const staged = bd?.plan?.autonomousAfterApproval?.length || 0;
  const approvals = bd?.plan?.approvalRequiredFor?.length || 0;
  const modeled = bd?.plan?.modelStatus === 'modeled';
  const noChangeRecommended = modeled && bd?.plan?.noChangeRecommended === true;
  const decisionReady = modeled && !noChangeRecommended && bd?.plan?.decisionReady === true;
  const groundedNoChange = modeled && noChangeRecommended && bd?.plan?.decisionReady === true;
  const status = bd?.plan?.status === 'approved' ? 'active' : modeled ? 'proposed' : 'needs data';
  const hasModeledImpact = decisionReady && Boolean(upside || costRed || costRedAmount || slaImp);
  const horizon = bd?.plan?.forecastHorizonMonths || 6;
  const highPriorityTasks = taskSummary.highPriority;
  const planStateLabel = groundedNoChange
    ? 'No change recommended'
    : !modeled
    ? 'Needs optimization run'
    : !decisionReady
      ? 'Scenario modeled · baseline mismatch'
      : hasModeledImpact
        ? 'Impact traceable'
        : 'No measurable improvement';
  const planStateTone = groundedNoChange ? 'green' : decisionReady ? (hasModeledImpact ? 'green' : 'default') : 'amber';
  const grounding = bd?.plan?.grounding;
  const warehouseNodes = Number(grounding?.connectedWarehouseNodes ?? bd?.plan?.currentMetrics?.warehouseNodes ?? 0);
  const modeledWarehouseNodes = Number(grounding?.modelBaselineWarehouseNodes ?? 0);
  const observedMonthlyCost = Number(grounding?.observedMonthlyCost ?? 0);
  const modeledMonthlyCost = Number(grounding?.modelBaselineMonthlyCost ?? 0);
  const costVariancePct = Number(grounding?.costVariancePct ?? 0);
  const costBaselineMismatch = modeled && bd?.plan?.decisionReady !== true && (
    observedMonthlyCost <= 0
    || modeledMonthlyCost <= 0
    || costVariancePct > 20
  );
  const warehouseBaselineMismatch = modeled && bd?.plan?.decisionReady !== true && (
    warehouseNodes <= 0
    || modeledWarehouseNodes <= 0
    || warehouseNodes !== modeledWarehouseNodes
  );
  const sourceConfidence = Number(bd?.plan?.source?.confidence || 0);
  const sourceConfidencePct = sourceConfidence > 1 ? sourceConfidence : sourceConfidence * 100;
  const sourceGeneratedAt = bd?.plan?.source?.generatedAt;
  return (
    <div className="card ai-plan-card">
      <div className="card-header">
        <div>
          <div className="card-title"><Icon name="double" size={15} /> AI plan</div>
          <div className="card-subtitle">{bd?.plan?.title || 'Six-month multi-warehouse operating plan'}</div>
        </div>
        <Chip tone={status === 'active' ? 'green' : status === 'proposed' ? 'purple' : 'amber'} dot={false}>{status}</Chip>
      </div>
      {loading && !bd ? (
        <div className="card-body"><Loading rows={4} /></div>
      ) : error && !bd ? (
        <div className="card-body"><ErrorState message={error} onRetry={onRetry} /></div>
      ) : (
        <>
          {error && <IntelligencePanelNotice message={error} onRetry={onRetry} />}
          <div className="card-body ai-plan-body">
            <div>
              <div className="ai-plan-title">Your business, optimized for the next 30 days</div>
              <div className="ai-plan-summary">
                {bd?.plan?.summary || 'Cortex models seller demand, WMS truth, pallet economics, and transport consolidation to lower cost while improving delivery speed.'}
              </div>
            </div>
            <div className="ai-plan-metrics">
              <MiniMetric label="Revenue upside" value={hasModeledImpact && upside ? fmt.money(upside, { compact: true, sign: true }) : '—'} sub={groundedNoChange ? 'no change modeled' : decisionReady ? 'modeled gain' : 'awaiting traceable baseline'} tone={hasModeledImpact && upside ? 'green' : undefined} />
              <MiniMetric
                label="Cost reduction"
                value={hasModeledImpact
                  ? costRed
                    ? `−${Math.abs(costRed).toFixed(1)}%`
                    : costRedAmount
                      ? `${fmt.money(Math.abs(costRedAmount), { compact: true })}/mo`
                      : '—'
                  : '—'}
                sub={groundedNoChange ? 'current network retained' : decisionReady ? (costRed ? 'network cost' : costRedAmount ? 'monthly modeled savings' : 'no measurable change') : 'awaiting traceable baseline'}
                tone={hasModeledImpact && (costRed || costRedAmount) ? 'green' : undefined}
              />
              <MiniMetric label="SLA improvement" value={hasModeledImpact && slaImp ? `−${Math.abs(slaImp).toFixed(1)}d` : '—'} sub={groundedNoChange ? 'no change modeled' : decisionReady ? 'delivery speed' : 'awaiting traceable baseline'} tone={hasModeledImpact && slaImp ? 'green' : undefined} />
            </div>
        <div className="ai-plan-readiness">
          <Chip tone={planStateTone} dot={false}>
            {planStateLabel}
          </Chip>
          <span>
            {groundedNoChange
              ? `${horizon}-month model complete · current network retained · no approval required`
              : decisionReady
              ? `${horizon}-month plan · ${approvals} approval gates · ${staged} staged actions`
              : modeled
                ? 'Approval is blocked until modeled costs and warehouse count reconcile with account truth.'
              : taskTotal
                ? `${taskTotal} open readiness task${taskTotal === 1 ? '' : 's'}${highPriorityTasks ? ` · ${highPriorityTasks} high priority` : ''}`
                : 'Run optimization to establish a traceable baseline'}
          </span>
          <span className="ai-plan-evidence">
            {warehouseNodes} connected warehouse node{warehouseNodes === 1 ? '' : 's'}
            {sourceConfidence ? ` · ${Math.round(sourceConfidencePct)}% latest-run confidence` : ''}
            {sourceGeneratedAt ? ` · ${timeAgo(sourceGeneratedAt)}` : ''}
          </span>
        </div>
        {modeled && bd?.plan?.decisionReady !== true && (costBaselineMismatch || warehouseBaselineMismatch) && (
          <div className="ai-plan-blockers" aria-label="AI plan approval blockers">
            <div className="ai-plan-blockers-title">Resolve before approval</div>
            {costBaselineMismatch && (
              <div className="ai-plan-blocker-row">
                <div>
                  <strong>Cost baseline</strong>
                  <span>
                    Model {modeledMonthlyCost > 0 ? `${fmt.money(modeledMonthlyCost)}/mo` : 'missing'}
                    {' · '}Observed {observedMonthlyCost > 0 ? `${fmt.money(observedMonthlyCost)}/mo` : 'missing'}
                    {costVariancePct > 0 ? ` · ${costVariancePct.toFixed(2)}% apart` : ''}
                  </span>
                </div>
                <button className="btn ghost sm" onClick={() => onNavigate('billing')}>
                  Review billing <Icon name="arrowRight" size={12} />
                </button>
              </div>
            )}
            {warehouseBaselineMismatch && (
              <div className="ai-plan-blocker-row">
                <div>
                  <strong>Warehouse baseline</strong>
                  <span>
                    Model {modeledWarehouseNodes || 'missing'}
                    {' · '}Connected {warehouseNodes}
                  </span>
                </div>
                <button className="btn ghost sm" onClick={() => onNavigate('warehouses')}>
                  Review network <Icon name="arrowRight" size={12} />
                </button>
              </div>
            )}
          </div>
        )}
        <div className="ai-plan-footer">
          <button className="btn ghost sm" onClick={onRun} disabled={optimizing}>
            <Icon name="sparkle" size={12} /> {optimizing ? 'Running...' : modeled && bd?.plan?.decisionReady !== true ? 'Rerun after fixes' : groundedNoChange ? 'Run again' : 'Run optimization'}
          </button>
          <button className="btn primary sm" onClick={() => onNavigate('double')}>
            Open Business Double <Icon name="arrowRight" size={12} />
          </button>
        </div>
            {optimizationNotice && <div className={`ai-plan-run-status ${optimizing ? 'running' : 'complete'}`} role="status"><Icon name={optimizing ? 'refresh' : 'check'} size={12} /> {optimizationNotice}</div>}
          </div>
        </>
      )}
    </div>
  );
};

const RevenueTrendCard = ({ data, bd, compact = false }: { data: CommandCenterFull; bd: BusinessDoubleResponse | null; compact?: boolean }) => {
  const revenue = data.metrics.revenue || 0;
  const series = data.metrics.revenueSeries || [];
  const actual = series.map((point) => Math.max(0, Number(point.revenue) || 0));
  const N = actual.length;
  const labels = series.map((point) => {
    const date = new Date(point.at);
    if (Number.isNaN(date.getTime())) return '';
    if (data.range === 'today') return date.toLocaleTimeString('en-US', { hour: 'numeric' });
    if (data.range === '7d') return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const traceable = bd?.plan?.modelStatus === 'modeled' && bd?.plan?.decisionReady === true;
  const revenueUpside = traceable ? Number(bd?.plan?.savings?.revenue ?? bd?.plan?.savings?.revenueUpside ?? 0) : 0;
  const revenueUpsidePct = traceable ? Number(bd?.plan?.savings?.revenuePct ?? 0) : 0;
  const totalOpt = revenue + (revenueUpside || (revenue * revenueUpsidePct) / 100);
  const hasOptimizedRevenue = traceable && revenue > 0 && totalOpt > revenue;
  const optMult = hasOptimizedRevenue ? totalOpt / revenue : 1;
  const optimized = actual.map((v) => v * optMult);

  const W = 720;
  const H = compact ? 170 : 220;
  const P = { l: 50, r: 12, t: 16, b: 28 };
  const max = Math.max(1, ...actual.filter(Number.isFinite), ...(hasOptimizedRevenue ? optimized.filter(Number.isFinite) : [])) * 1.05;
  const xStep = (W - P.l - P.r) / Math.max(1, N - 1);
  const yScale = (v: number) => {
    const n = Number.isFinite(v) ? v : 0;
    return H - P.b - (n / max) * (H - P.t - P.b);
  };
  const linePath = (vals: number[]) =>
    vals.length >= 2 ? vals.map((v, i) => `${i ? 'L' : 'M'}${P.l + i * xStep} ${yScale(v)}`).join(' ') : '';
  const areaPath = (vals: number[]) => {
    const line = linePath(vals);
    return line ? `${line} L${P.l + Math.max(0, N - 1) * xStep} ${H - P.b} L${P.l} ${H - P.b} Z` : '';
  };
  const totalActual = revenue;

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Revenue trend</div>
          <div className="card-subtitle">
            Actual <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmt.money(totalActual, { compact: true })}</span>
            {hasOptimizedRevenue ? (
              <>
                {' · '}Cortex projection <span style={{ color: 'var(--green-text)', fontWeight: 600 }}>{fmt.money(totalOpt, { compact: true })}</span>
                <span style={{ color: 'var(--green-text)', marginLeft: 6 }}>+{fmt.money(totalOpt - totalActual, { compact: true })}</span>
              </>
            ) : ' · No modeled revenue uplift yet'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 2, background: 'var(--accent)', borderRadius: 1 }} /> Actual
          </span>
          {hasOptimizedRevenue && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 2, background: 'var(--green)', borderRadius: 1 }} /> Cortex projection
            </span>
          )}
        </div>
      </div>
      {actual.length < 2 ? (
        <div className="card-body"><EmptyState>No revenue activity is available for this range.</EmptyState></div>
      ) : <div style={{ padding: compact ? '4px 0 0' : '8px 0 0' }}>
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
          {hasOptimizedRevenue && <path d={areaPath(optimized)} fill="var(--green)" opacity="0.08" />}
          {hasOptimizedRevenue && <path d={linePath(optimized)} fill="none" stroke="var(--green)" strokeWidth="1.5" strokeDasharray="4 3" />}
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
      </div>}
    </div>
  );
};

const CortexTasksPanel = ({
  tasks,
  total,
  summary,
  onNavigate,
  onDecision,
  feedback,
  updatingId,
  loading,
  error,
  onRetry,
}: {
  tasks: CortexTask[];
  total: number;
  summary: CortexTaskSummary;
  onNavigate: (target: string, payload?: string) => void;
  onDecision: (task: CortexTask, action: 'done' | 'dismiss') => void;
  feedback?: { tone: 'info' | 'success' | 'error'; text: string } | null;
  updatingId?: string | null;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}) => {
  const screens = summary.workAreas.slice(0, 4);
  const sources = summary.sources.slice(0, 3);
  const completionLabel = (task: CortexTask) =>
    task.source === 'readiness' || task.source === 'connection_health' ? 'Verify completion' : 'Mark done';
  const taskNavigationPayload = (task: CortexTask) => {
    if (task.navigationPayload) return task.navigationPayload;
    if (task.dedupeKey === 'readiness:sku-unit-cost') return 'filter:missing-cost';
    if (task.dedupeKey === 'readiness:sku-dimensions-weight') return 'filter:missing-dimensions';
    if (task.dedupeKey === 'readiness:supplier-pickup-profiles') return 'filter:missing-pickup';
    return task.entityId || undefined;
  };
  const displayWorkArea = (value: string) => {
    const normalized = String(value || 'command').replace(/-/g, ' ');
    if (normalized.toLowerCase() === 'skus') return 'SKUs';
    return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
  };
  const displayTaskSource = (source: string) => {
    if (source === 'readiness') return 'Account readiness';
    if (source === 'connection_health') return 'Connection health';
    if (source === 'recommendation') return 'Cortex recommendation';
    return source.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  };
  return (
    <div id="cortex-task-inbox" className="card cortex-task-panel" tabIndex={-1}>
      <div className="card-header">
        <div className="cortex-task-heading">
          <div className="card-title"><Icon name="sparkle" size={15} /> Cortex task inbox</div>
          <div className="card-subtitle">Readiness work that improves account intelligence. Approval decisions stay in the decision panel.</div>
        </div>
        <Chip tone={total ? 'purple' : 'green'} dot={false}>{total} open</Chip>
      </div>
      {loading && tasks.length === 0 ? (
        <div className="card-body"><Loading rows={5} /></div>
      ) : error && tasks.length === 0 ? (
        <div className="card-body"><ErrorState message={error} onRetry={onRetry} /></div>
      ) : tasks.length === 0 ? (
        <div className="card-body"><EmptyState>No open Cortex tasks. Readiness and connection work will appear here when evidence needs attention.</EmptyState></div>
      ) : (
        <>
          {error && <IntelligencePanelNotice message={error} onRetry={onRetry} />}
          {feedback && (
            <div className={`cortex-task-feedback ${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>
              <Icon name={feedback.tone === 'success' ? 'check' : feedback.tone === 'info' ? 'info' : 'warning'} size={13} /> {feedback.text}
            </div>
          )}
          <div className="cortex-task-summary">
            <MiniMetric label="High priority" value={String(summary.highPriority)} sub="needs action" tone={summary.highPriority ? 'red' : 'green'} />
            <MiniMetric label="Work areas" value={String(summary.workAreas.length)} sub={screens.map((s) => s.replace(/-/g, ' ')).join(', ') || 'none'} />
            <MiniMetric label="Sources" value={String(summary.sources.length)} sub={sources.map((source) => source.replace(/_/g, ' ')).join(', ')} />
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
                    <td data-label="Priority"><span className={`task-priority ${task.priority}`}>{task.priority}</span></td>
                    <td data-label="Where">{displayWorkArea(task.actionTarget || task.screen || 'command')}</td>
                    <td data-label="Source"><Chip dot={false}>{displayTaskSource(task.source)}</Chip></td>
                    <td data-label="Actions">
                      <div className="row-actions">
                        <button
                          className="btn ghost sm task-open-btn"
                          title={task.actionLabel || 'Open'}
                          onClick={() => onNavigate(task.actionTarget || task.screen || 'command', taskNavigationPayload(task))}
                          disabled={updatingId === task.id}
                        >
                          <Icon name="arrowRight" size={12} /> {task.actionLabel || 'Open'}
                        </button>
                        <div className="task-decision-actions" aria-label="Task decision actions">
                          <button className="icon-btn" data-hint={completionLabel(task)} aria-label={completionLabel(task)} disabled={updatingId === task.id} onClick={() => onDecision(task, 'done')}><Icon name="check" size={13} /></button>
                          <button className="icon-btn" data-hint="Dismiss" aria-label="Dismiss task" disabled={updatingId === task.id} onClick={() => onDecision(task, 'dismiss')}><Icon name="x" size={13} /></button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > tasks.length && (
            <div className="cortex-task-overflow-note" role="status">
              Showing the {tasks.length} highest-priority tasks of {total} open. Resolve or dismiss these to reveal the next items.
            </div>
          )}
        </>
      )}
    </div>
  );
};

const ChannelMixCard = ({ data }: { data: CommandCenterFull }) => {
  const channelMix = data.metrics.channelMix || [];
  const totalRevenue = channelMix.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  const totalOrders = channelMix.reduce((sum, row) => sum + Number(row.orders || 0), 0);
  const displayChannel = (channel: string) => {
    const normalized = String(channel || 'manual').toLowerCase();
    if (normalized === 'shopify') return 'Shopify';
    if (normalized === 'amazon') return 'Amazon';
    if (normalized === 'ebay') return 'eBay';
    if (normalized === 'csv') return 'CSV';
    return normalized.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  };
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Channel mix</div>
          <div className="card-subtitle">Orders and recognized revenue by source.</div>
        </div>
        <Chip dot={false}>{data.range === 'today' ? 'Today' : data.range === '7d' ? 'Last 7d' : 'Last 30d'}</Chip>
      </div>
      {channelMix.length === 0 ? (
        <div className="card-body"><EmptyState>No channel activity is recorded for this range.</EmptyState></div>
      ) : (
        <>
          <div className="command-mini-metrics" style={{ gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <MiniMetric label="Active channels" value={String(channelMix.length)} sub={`${data.counts?.channels ?? 0} connected`} />
            <MiniMetric label="Orders" value={fmt.num(totalOrders)} sub={`${data.range}`} tone="green" />
            <MiniMetric label="Revenue" value={fmt.money(totalRevenue, { compact: true })} sub="recognized" tone="green" />
          </div>
          <div className="table-wrap">
            <table className="data-table command-channel-table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th className="num">Orders</th>
                  <th className="num">Units</th>
                  <th className="num">Revenue</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {channelMix.map((row) => (
                  <tr key={row.channel}>
                    <td><strong>{displayChannel(row.channel)}</strong></td>
                    <td className="num">{fmt.num(row.orders)}</td>
                    <td className="num">{fmt.num(row.units)}</td>
                    <td className="num">{fmt.money(row.revenue, { compact: true })}</td>
                    <td>
                      <div className="channel-share-cell">
                        <span>{row.revenueSharePct.toFixed(1)}%</span>
                        <span className="channel-share-track" aria-hidden="true">
                          <span style={{ width: `${Math.max(0, Math.min(100, row.revenueSharePct))}%` }} />
                        </span>
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
  loading,
  error,
  onRetry,
  onNavigate,
}: {
  readiness: IntelligenceReadiness | null;
  latest: SellerOptimizationSummary | null;
  recommendations: OmsRecommendation[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
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
        <Chip tone={readiness ? tone as any : 'default'} dot={false}>{readiness ? `${score}%` : loading ? 'Loading' : 'Unavailable'}</Chip>
      </div>
      {loading && !readiness ? (
        <div className="card-body"><Loading rows={3} /></div>
      ) : error && !readiness ? (
        <div className="card-body"><ErrorState message={error} onRetry={onRetry} /></div>
      ) : (
        <>
        {error && <IntelligencePanelNotice message={error} onRetry={onRetry} />}
      <div className="card-body" style={{ display: 'grid', gap: 12 }}>
        <div className="command-mini-metrics" style={{ gap: 10 }}>
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
        </>
      )}
    </div>
  );
};

const OptimizationImpactPanel = ({
  recommendations,
  onNavigate,
  onDecision,
  feedback,
  updatingId,
  loading,
  error,
  onRetry,
}: {
  recommendations: OmsRecommendation[];
  onNavigate: (target: string, payload?: string) => void;
  onDecision: (rec: OmsRecommendation, action: 'approve' | 'reject') => void;
  feedback?: { tone: 'success' | 'error'; text: string } | null;
  updatingId?: string | null;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}) => (
  <div className="card">
    <div className="card-header">
      <div>
        <div className="card-title">Current vs suggested decisions</div>
        <div className="card-subtitle">Current state, Cortex suggestion, traceable impact, and the action to take. Approvals are reserved for concrete changes.</div>
      </div>
      <Chip tone="purple" dot={false}>{recommendations.length} open</Chip>
    </div>
    {feedback && (
      <div className={`decision-feedback ${feedback.tone}`} role="status">
        <Icon name={feedback.tone === 'success' ? 'check' : 'warning'} size={13} /> {feedback.text}
      </div>
    )}
    {error && recommendations.length > 0 && <IntelligencePanelNotice message={error} onRetry={onRetry} />}
    <div style={{ padding: 12, maxHeight: 360, overflow: 'auto' }}>
      {loading && recommendations.length === 0 ? (
        <Loading rows={4} />
      ) : error && recommendations.length === 0 ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : recommendations.length === 0 ? (
        <EmptyState>Run Seller Optimization to generate account-level opportunities.</EmptyState>
      ) : recommendations.slice(0, 5).map((rec) => (
        <DecisionComparison
          key={rec.id}
          rec={rec}
          compact
          busy={updatingId === rec.id}
          onOpen={() => onNavigate(rec.entityType === 'sku' ? 'sku-detail' : rec.entityType === 'business_double' ? 'double' : 'ledger', rec.entityId)}
          onApprove={() => onDecision(rec, 'approve')}
          onDeny={() => onDecision(rec, 'reject')}
        />
      ))}
    </div>
  </div>
);

const WarningsPanel = ({ warnings }: { warnings: CommandCenterFull['warnings'] }) => {
  const [filter, setFilter] = useState<'all' | 'critical' | 'attention'>('all');
  const visibleWarnings = warnings.filter((warning) => {
    const severity = String(warning.severity || '').toLowerCase();
    if (filter === 'critical') return ['critical', 'high'].includes(severity);
    if (filter === 'attention') return !['critical', 'high'].includes(severity);
    return true;
  });

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <Icon name="warning" size={15} style={{ color: 'var(--amber)' }} />
          Warnings
          <Chip dot={false}>{visibleWarnings.length}</Chip>
        </div>
        <div className="seg">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'critical' ? 'active' : ''} onClick={() => setFilter('critical')}>Critical</button>
          <button className={filter === 'attention' ? 'active' : ''} onClick={() => setFilter('attention')}>Need attention</button>
        </div>
      </div>
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {visibleWarnings.length === 0 && <EmptyState>No warnings in this view.</EmptyState>}
        {visibleWarnings.map((w, idx) => {
        const tone = severityTone(w.severity);
        return (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
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
          </div>
        );
      })}
      </div>
    </div>
  );
};

const AutonomousActivityRail = ({ activity }: { activity: CommandCenterFull['autonomousActivity'] }) => {
  const eventCount = activity.reduce((total, event) => total + Math.max(1, Number(event.occurrences || 1)), 0);
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <Icon name="bolt" size={15} style={{ color: 'var(--purple)' }} />
            System activity
          </div>
          <div className="card-subtitle">Recorded OMS, warehouse, marketplace, and Cortex events for this account.</div>
        </div>
        <Chip tone="purple" dot={false}>{eventCount} events</Chip>
      </div>
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {activity.length === 0 && <EmptyState>No autonomous actions in this window.</EmptyState>}
        {activity.map((e, i) => {
          const tone = e.status === 'complete' ? 'green' : e.status === 'pending' ? 'amber' : 'blue';
          return (
            <div key={i} className="command-activity-row" style={{ gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{timeAgo(e.at)}</span>
              <div style={{ width: 22, height: 22, borderRadius: 4, background: `var(--${tone}-soft)`, color: `var(--${tone})`, display: 'grid', placeItems: 'center' }}>
                <Icon name="bolt" size={12} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text)' }}>{e.action}</div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {e.system}{Number(e.occurrences || 1) > 1 ? ` · repeated ${e.occurrences} times` : ''}
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: `var(--${tone}-text)` }}>
                {e.impact || (e.confidence ? `${confidencePercent(e.confidence)}%` : 'auto')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
