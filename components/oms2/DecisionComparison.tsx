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

const formatValue = (value: unknown): string => {
  if (value == null || value === '') return '-';
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(', ') : '-';
  if (!isObject(value)) return String(value);
  const entries = Object.entries(value).filter(([, v]) => v != null && v !== '');
  if (!entries.length) return '-';
  return entries
    .slice(0, 5)
    .map(([key, v]) => `${labelize(key)}: ${formatValue(v)}`)
    .join('\n');
};

const impactLabel = (impact: Record<string, unknown>) => {
  const monthly = Number(impact.monthlySavings || 0);
  const annualized = Number(impact.annualizedSavings || 0);
  const fill = Number(impact.fillPercent || 0);
  const confidenceGain = Number(impact.confidenceGain || 0);
  if (annualized) return `${fmt.money(annualized, { compact: true })}/yr`;
  if (monthly) return `${fmt.money(monthly, { compact: true })}/mo`;
  if (fill) return `${Math.round(fill)}% fill`;
  if (confidenceGain) return `+${Math.round(confidenceGain)} pts`;
  return formatValue(impact);
};

export const decisionTone = (state?: string): 'green' | 'red' | 'default' => {
  const normalized = String(state || '').toLowerCase();
  if (['approved', 'accepted', 'complete', 'executed'].some((s) => normalized.includes(s))) return 'green';
  if (['rejected', 'denied', 'declined'].some((s) => normalized.includes(s))) return 'red';
  return 'default';
};

const decisionLabel = (state?: string) => {
  const tone = decisionTone(state);
  if (tone === 'green') return 'Approved';
  if (tone === 'red') return 'Denied';
  return String(state || 'No decision').replace(/_/g, ' ');
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
        <pre>{formatValue(rec.currentValue)}</pre>
      </div>
      <div className="decision-cell suggested">
        <div className="decision-label">Suggested</div>
        <pre>{formatValue(rec.optimizedValue)}</pre>
      </div>
      <div className="decision-impact">
        <div className="decision-label">Impact</div>
        <strong>{impactLabel(rec.estimatedImpact || {})}</strong>
      </div>
      <div className="decision-status">
        <Chip tone={tone === 'default' ? 'default' : tone} dot={false}>{decisionLabel(rec.approvalState)}</Chip>
      </div>
      {(onApprove || onDeny) && (
        <div className="decision-actions" onClick={(e) => e.stopPropagation()}>
          {isNotice ? (
            <span className="decision-notice">Action required outside approval</span>
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
        </div>
      )}
    </div>
  );
};
