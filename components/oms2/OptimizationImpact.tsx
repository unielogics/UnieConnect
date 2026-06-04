import React, { useEffect, useState } from 'react';
import { approveRecommendation, fetchRecommendations, OmsRecommendation, rejectRecommendation } from '../../lib/oms';
import { Icon } from './icons';
import { Chip, EmptyState } from './ui';
import { DecisionComparison } from './DecisionComparison';

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
          <div className="card-subtitle">Column 1 is current state. Column 2 is the suggested action. Accept or deny each decision.</div>
        </div>
        <Chip tone="purple" dot={false}>{items.length} signals</Chip>
      </div>
      {items.length === 0 ? (
        <EmptyState>Run Seller Optimization to populate this view with current-vs-optimized impact.</EmptyState>
      ) : (
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
      )}
    </div>
  );
};
