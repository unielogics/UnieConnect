import React from 'react';
import { OmsRecommendation } from '../../lib/oms';
import { Icon } from './icons';
import { Chip, fmt } from './ui';

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const labelize = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const humanLabel = (key: string) => {
  const normalized = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  const labels: Record<string, string> = {
    data_completeness: 'Product data complete',
    marketplace_readiness: 'Marketplace data',
    warehouse_fit: 'Warehouse data',
    opportunity_score: 'Opportunity score',
    confidence: 'Cortex confidence',
    confidence_gain: 'Confidence gain',
    pallet_units: 'Pallet estimate',
    evidence_path: 'Evidence',
    action: 'Next action',
    priority: 'Priority',
    current_monthly_cost: 'Current monthly cost',
    optimized_monthly_cost: 'Suggested monthly cost',
    monthly_savings: 'Monthly savings',
    annualized_savings: 'Annual savings',
    fill_percent: 'Pallet fill',
    readiness_score: 'Readiness score',
  };
  return labels[normalized] || labelize(key);
};

const humanText = (value: unknown, key = ''): string => {
  if (value == null || value === '') return 'Missing';
  const normalizedKey = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  if (typeof value === 'number') {
    if (normalizedKey.includes('confidence') && value <= 1) return `${Math.round(value * 100)}%`;
    if (normalizedKey.includes('pct') || normalizedKey.includes('percent')) return `${Math.round(value)}%`;
    if (normalizedKey.includes('cost') || normalizedKey.includes('savings') || normalizedKey.includes('revenue')) return fmt.money(value, { compact: true });
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map((v) => humanText(v)).join(', ') : 'None';
  if (isObject(value)) return formatValue(value);
  return String(value).replace(/_/g, ' ');
};

const formatValue = (value: unknown): string => {
  if (value == null || value === '') return '-';
  if (typeof value === 'number') return humanText(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(', ') : '-';
  if (!isObject(value)) return String(value);
  const entries = Object.entries(value).filter(([, v]) => v != null && v !== '');
  if (!entries.length) return '-';
  return entries
    .slice(0, 5)
    .map(([key, v]) => `${humanLabel(key)}: ${humanText(v, key)}`)
    .join('\n');
};

const impactLabel = (impact: Record<string, unknown>) => {
  const monthly = Number(impact.monthlySavings || 0);
  const annualized = Number(impact.annualizedSavings || 0);
  const fill = Number(impact.fillPercent || 0);
  const confidenceGain = Number(impact.confidenceGain || 0);
  const confidence = Number(impact.confidence || 0);
  const palletUnits = Number(impact.palletUnits || 0);
  if (annualized) return `${fmt.money(annualized, { compact: true })}/yr`;
  if (monthly) return `${fmt.money(monthly, { compact: true })}/mo`;
  if (fill) return `${Math.round(fill)}% fill`;
  if (confidenceGain) return `+${Math.round(confidenceGain)} pts`;
  if (confidence) return `${Math.round(confidence * 100)}% confidence${palletUnits ? ` · ${palletUnits.toLocaleString()} units/pallet` : ''}`;
  return formatValue(impact);
};

export const decisionTone = (state?: string): 'green' | 'red' | 'default' => {
  const normalized = String(state || '').toLowerCase();
  if (['approved', 'accepted', 'complete', 'executed'].some((s) => normalized.includes(s))) return 'green';
  if (['rejected', 'denied', 'declined'].some((s) => normalized.includes(s))) return 'red';
  return 'default';
};

export const isActionableDecisionRecommendation = (rec?: OmsRecommendation | null) => {
  if (!rec) return false;
  const state = String(rec.approvalState || '').toLowerCase();
  const type = String(rec.recommendationType || '').toLowerCase();
  const action = String(rec.requiredAction || '').toLowerCase();
  const title = String(rec.title || '').toLowerCase();
  const summary = String(rec.summary || '').toLowerCase();
  const current = rec.currentValue || {};
  const suggested = rec.optimizedValue || {};
  const impact = rec.estimatedImpact || {};

  if (['blocked', 'not_required', 'not required'].includes(state)) return false;
  if (type.includes('data_readiness')) return false;

  const text = `${type} ${action} ${title} ${summary}`;
  const looksLikeTask =
    /(upload|connect|complete|missing|readiness|evidence|feed completeness|data source|baseline incomplete|enrichment baseline)/.test(text);
  if (looksLikeTask) return false;

  const hasComparison = Object.keys(current).length > 0 && Object.keys(suggested).length > 0;
  if (!hasComparison) return false;

  const meaningfulImpact = Object.entries(impact).some(([key, value]) => {
    const normalized = key.toLowerCase();
    if (/^(confidence|palletunits|priority|severity)$/.test(normalized)) return false;
    if (value == null || value === '') return false;
    if (typeof value === 'number') return value !== 0;
    return true;
  });

  const concreteDomain = /(cost|saving|margin|refund|carrier|label|shipment|supplier|inventory|order|warehouse|routing|placement|price|revenue|billing|fulfillment|business_double)/.test(text);
  return concreteDomain && meaningfulImpact;
};

const decisionLabel = (state?: string) => {
  const tone = decisionTone(state);
  if (tone === 'green') return 'Approved';
  if (tone === 'red') return 'Denied';
  const normalized = String(state || '').toLowerCase();
  if (normalized === 'waiting_approval' || normalized === 'draft') return 'Needs decision';
  if (normalized === 'blocked') return 'Blocked by missing data';
  if (normalized === 'not_required' || normalized === 'not required') return 'Task, not approval';
  return String(state || 'No decision').replace(/_/g, ' ');
};

const decisionContext = (rec: OmsRecommendation) => {
  const current = rec.currentValue || {};
  const suggested = rec.optimizedValue || {};
  const impact = rec.estimatedImpact || {};
  const recType = String(rec.recommendationType || '').toLowerCase();
  const action = String(rec.requiredAction || '').replace(/_/g, ' ');
  const missingFields = Array.isArray((rec.sourceSummary as any)?.blockers) ? (rec.sourceSummary as any).blockers : [];

  if (recType.includes('product_research')) {
    const completeness = Number((current as any).dataCompleteness ?? 0);
    const score = Number((suggested as any).opportunityScore ?? 0);
    return {
      current: [
        `${completeness}% of baseline product data is complete.`,
        `Marketplace signal: ${humanText((current as any).marketplaceReadiness)}.`,
      ],
      suggested: [
        action.includes('complete missing') ? 'Complete title, description, images, weight, dimensions, cost, and selling price before treating this as an optimization decision.' : 'Use this SKU as an input for Cortex optimization after the baseline is complete.',
        score ? `Opportunity score: ${score}/100.` : '',
      ].filter(Boolean),
      impact: [
        impactLabel(impact),
        'Traceability: SKU enrichment -> Product Research -> Optimize Suite.',
      ],
    };
  }

  if (recType.includes('data_readiness') || action.includes('readiness') || action.includes('missing')) {
    return {
      current: [
        formatValue(current),
        missingFields.length ? `Open blocker: ${missingFields[0]}` : '',
      ].filter(Boolean),
      suggested: [
        formatValue(suggested),
        action ? `Next action: ${action}.` : '',
      ].filter(Boolean),
      impact: [impactLabel(impact), 'Improves Cortex confidence before execution.'],
    };
  }

  return {
    current: [formatValue(current)],
    suggested: [formatValue(suggested)],
    impact: [impactLabel(impact)],
  };
};

export const DecisionComparison = ({
  rec,
  busy,
  compact = false,
  onOpen,
  onApprove,
  onDeny,
}: {
  rec: OmsRecommendation;
  busy?: boolean;
  compact?: boolean;
  onOpen?: () => void;
  onApprove?: () => void;
  onDeny?: () => void;
}) => {
  const tone = decisionTone(rec.approvalState);
  const normalizedState = String(rec.approvalState || '').toLowerCase();
  const isNotice = ['blocked', 'not_required', 'not required'].includes(normalizedState);
  const canDecide = tone === 'default' && !isNotice;
  const context = decisionContext(rec);
  return (
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (!onOpen || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        onOpen();
      }}
      className={`decision-row decision-${tone} ${compact ? 'compact' : ''}`}
    >
      <div className="decision-main">
        <div className="decision-title">{rec.title}</div>
        {!compact && <div className="decision-summary">{rec.summary}</div>}
      </div>
      <div className="decision-cell">
        <div className="decision-label">Current</div>
        <div className="decision-readable">
          {context.current.map((line, idx) => <p key={idx}>{line}</p>)}
        </div>
      </div>
      <div className="decision-cell suggested">
        <div className="decision-label">Suggested</div>
        <div className="decision-readable">
          {context.suggested.map((line, idx) => <p key={idx}>{line}</p>)}
        </div>
      </div>
      <div className="decision-impact">
        <div className="decision-label">Impact</div>
        <div className="decision-readable impact">
          {context.impact.map((line, idx) => <p key={idx}>{line}</p>)}
        </div>
      </div>
      <div className="decision-actions" onClick={(e) => e.stopPropagation()}>
        <Chip tone={tone === 'default' ? 'default' : tone} dot={false}>{decisionLabel(rec.approvalState)}</Chip>
        {(onApprove || onDeny) && (
          <>
          {isNotice ? (
            <span className="decision-notice">{normalizedState === 'blocked' ? 'Complete the missing data first.' : 'Open the related task.'}</span>
          ) : (
            <>
              <button className="btn sm primary" disabled={!canDecide || busy} onClick={onApprove}>
                <Icon name="check" size={11} /> Accept
              </button>
              <button className="btn sm" disabled={!canDecide || busy} onClick={onDeny}>
                Deny
              </button>
            </>
          )}
          </>
        )}
      </div>
    </div>
  );
};
