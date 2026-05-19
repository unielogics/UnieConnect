import React, { useEffect, useState } from 'react';
import { approveRecommendation, fetchRecommendations, OmsRecommendation, rejectRecommendation } from '../../lib/oms';
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
  const [busyId, setBusyId] = useState('');

  const load = () => {
    fetchRecommendations({ screen, status: 'open', limit })
      .then((response) => setItems(response.recommendations || []))
      .catch(() => setItems([]));
  };

  useEffect(() => {
    load();
  }, [limit, screen]);

  const act = async (rec: OmsRecommendation, action: 'approve' | 'reject') => {
    setBusyId(rec.id);
    try {
      if (action === 'approve') await approveRecommendation(rec.id, { source: screen });
      else await rejectRecommendation(rec.id, 'Rejected from OMS screen context');
      await load();
    } catch {
      await load();
    } finally {
      setBusyId('');
    }
  };

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
            <div
              key={rec.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!onNavigate) return;
                if (rec.entityType === 'sku') onNavigate('sku-detail', rec.entityId);
                else if (rec.entityType === 'business_double') onNavigate('double');
                else onNavigate('ledger');
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
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
                  {String(rec.wmsTruthState || 'forecast_only').replace(/_/g, ' ')}
                </Chip>
                <span className="mono" style={{ fontSize: 11, color: 'var(--green-text)', fontWeight: 800 }}>
                  {impactLabel(rec.estimatedImpact || {})}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{rec.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{rec.summary}</div>
              {['waiting_approval', 'draft'].includes(String(rec.approvalState || '')) && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    className="btn sm primary"
                    disabled={busyId === rec.id || rec.approvalState === 'blocked'}
                    onClick={(e) => {
                      e.stopPropagation();
                      act(rec, 'approve');
                    }}
                  >
                    <Icon name="check" size={11} /> Approve
                  </button>
                  <button
                    className="btn sm"
                    disabled={busyId === rec.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      act(rec, 'reject');
                    }}
                  >
                  Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
