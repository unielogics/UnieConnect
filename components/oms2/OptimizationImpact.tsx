import React, { useEffect, useState } from 'react';
import { fetchRecommendations, OmsRecommendation } from '../../lib/oms';
import { Icon } from './icons';
import { Chip, EmptyState, fmt } from './ui';

const impactLabel = (impact: Record<string, unknown>) => {
  const monthly = Number(impact.monthlySavings || 0);
  const annualized = Number(impact.annualizedSavings || 0);
  const fill = Number(impact.fillPercent || 0);
  const confidenceGain = Number(impact.confidenceGain || 0);
  if (annualized) return `${fmt.money(annualized, { compact: true })}/yr`;
  if (monthly) return `${fmt.money(monthly, { compact: true })}/mo`;
  if (fill) return `${Math.round(fill)}% fill`;
  if (confidenceGain) return `+${Math.round(confidenceGain)} pts`;
  return 'impact';
};

export const OptimizationImpact = ({
  screen,
  title = 'Current vs optimized',
  limit = 3,
  onNavigate,
}: {
  screen: string;
  title?: string;
  limit?: number;
  onNavigate?: (target: string, payload?: string) => void;
}) => {
  const [items, setItems] = useState<OmsRecommendation[]>([]);

  useEffect(() => {
    fetchRecommendations({ screen, status: 'open', limit })
      .then((response) => setItems(response.recommendations || []))
      .catch(() => setItems([]));
  }, [limit, screen]);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div>
          <div className="card-title"><Icon name="sparkle" size={15} /> {title}</div>
          <div className="card-subtitle">Optimize Suite recommendations shown in the working context.</div>
        </div>
        <Chip tone="purple" dot={false}>{items.length} signals</Chip>
      </div>
      {items.length === 0 ? (
        <EmptyState>Run Seller Optimization to populate this view with current-vs-optimized impact.</EmptyState>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, minmax(0, 1fr))`, gap: 12, padding: 14 }}>
          {items.slice(0, limit).map((rec) => (
            <button
              key={rec.id}
              onClick={() => {
                if (!onNavigate) return;
                if (rec.entityType === 'sku') onNavigate('sku-detail', rec.entityId);
                else if (rec.entityType === 'business_double') onNavigate('double');
                else onNavigate('ledger');
              }}
              style={{
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-subtle)',
                borderRadius: 10,
                padding: 12,
                textAlign: 'left',
                cursor: onNavigate ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
                <Chip tone={rec.approvalState === 'waiting_approval' ? 'amber' : 'purple'} dot={false}>
                  {rec.wmsTruthState.replace(/_/g, ' ')}
                </Chip>
                <span className="mono" style={{ fontSize: 11, color: 'var(--green-text)', fontWeight: 800 }}>
                  {impactLabel(rec.estimatedImpact || {})}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{rec.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{rec.summary}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
