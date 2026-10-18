import React, { useEffect, useState } from 'react';
import { approveRecommendation, fetchRecommendations, OmsRecommendation, rejectRecommendation } from '../../lib/oms';
import { Icon } from './icons';
import { Chip, EmptyState, Loading } from './ui';
import { DecisionComparison, isActionableDecisionRecommendation } from './DecisionComparison';

export const OptimizationImpact = ({
  screen,
  title = 'Current vs suggested',
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
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetchRecommendations({ screen, status: 'open', limit });
      setItems((response.recommendations || []).filter(isActionableDecisionRecommendation));
    } catch (error: any) {
      setLoadError(error?.message || 'Cortex decisions could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [limit, screen]);

  const act = async (rec: OmsRecommendation, action: 'approve' | 'reject') => {
    setBusyId(rec.id);
    setFeedback(null);
    try {
      if (action === 'approve') await approveRecommendation(rec.id, { source: screen });
      else await rejectRecommendation(rec.id, 'Rejected from OMS screen context');
      setFeedback({
        tone: 'success',
        text: action === 'approve' ? `Approved: ${rec.title}` : `Denied: ${rec.title}`,
      });
      await load();
    } catch (error: any) {
      setFeedback({
        tone: 'error',
        text: error?.message || `The recommendation could not be ${action === 'approve' ? 'approved' : 'denied'}.`,
      });
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
          <div className="card-subtitle">Current state, Cortex suggestion, traceable impact, and the action to take. Missing-data items show as tasks, not approvals.</div>
        </div>
        <Chip tone={loadError ? 'red' : 'purple'} dot={false}>{loadError ? 'Unavailable' : `${items.length} signals`}</Chip>
      </div>
      {feedback && (
        <div className={`decision-feedback ${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>
          <Icon name={feedback.tone === 'success' ? 'check' : 'warning'} size={13} /> {feedback.text}
        </div>
      )}
      {loadError && (
        <div className="inline-banner danger" role="alert" style={{ margin: '0 14px 12px' }}>
          <Icon name="warning" size={13} />
          <span style={{ flex: 1 }}>{loadError} Previously loaded decisions are preserved.</span>
          <button className="btn ghost sm" onClick={() => void load()}><Icon name="refresh" size={12} /> Retry decisions</button>
        </div>
      )}
      {loading && items.length === 0 ? (
        <Loading rows={3} />
      ) : items.length === 0 && !loadError ? (
        <EmptyState>Run Seller Optimization to populate this view with current-vs-optimized impact.</EmptyState>
      ) : items.length > 0 ? (
        <div style={{ padding: 14 }}>
          {items.slice(0, limit).map((rec) => (
            <DecisionComparison
              key={rec.id}
              rec={rec}
              busy={busyId === rec.id}
              onOpen={() => {
                if (!onNavigate) return;
                if (rec.entityType === 'sku') onNavigate('sku-detail', rec.entityId);
                else if (rec.entityType === 'business_double') onNavigate('double');
                else onNavigate('ledger');
              }}
              onApprove={() => act(rec, 'approve')}
              onDeny={() => act(rec, 'reject')}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};
