import React, { useEffect, useMemo, useState } from 'react';
import { fetchRecommendations, OmsRecommendation } from '../../lib/oms';
import { Icon } from './icons';
import { Chip } from './ui';
import { RecommendationDrawer } from './screens/InventoryNetwork';
import { isActionableDecisionRecommendation } from './DecisionComparison';

export const useInlineRecommendations = (screen: string, limit = 100) => {
  const [recommendations, setRecommendations] = useState<OmsRecommendation[]>([]);
  const [selectedRec, setSelectedRec] = useState<OmsRecommendation | null>(null);
  const loadRecommendations = () => {
    fetchRecommendations({ screen, status: 'open', limit })
      .then((res) => setRecommendations((res.recommendations || []).filter(isActionableDecisionRecommendation)))
      .catch(() => setRecommendations([]));
  };
  useEffect(loadRecommendations, [screen, limit]);

  const byEntity = useMemo(() => {
    const map = new Map<string, OmsRecommendation>();
    recommendations.forEach((rec) => {
      [rec.entityId, rec.publicId, rec.runId].filter(Boolean).forEach((id) => {
        if (!map.has(String(id))) map.set(String(id), rec);
      });
    });
    return map;
  }, [recommendations]);

  const recFor = (...ids: Array<string | null | undefined>) => {
    for (const id of ids) {
      if (id && byEntity.has(String(id))) return byEntity.get(String(id)) || null;
    }
    return null;
  };

  const screenRec = recommendations.find((rec) => !rec.entityId) || recommendations[0] || null;
  const drawer = selectedRec ? (
    <RecommendationDrawer
      rec={selectedRec}
      onClose={() => setSelectedRec(null)}
      onChanged={loadRecommendations}
    />
  ) : null;

  return { recommendations, recFor, screenRec, setSelectedRec, drawer, reloadRecommendations: loadRecommendations };
};

export const CortexRowAction = ({
  rec,
  onOpen,
  label = false,
}: {
  rec?: OmsRecommendation | null;
  onOpen: () => void;
  label?: boolean;
}) => {
  if (!rec) return null;
  return (
    <button className="btn ghost sm cortex-row-action" onClick={onOpen} data-hint="Review Cortex optimization">
      <Icon name="sparkle" size={12} style={{ color: 'var(--purple)' }} />
      {label ? 'Cortex' : null}
    </button>
  );
};

export const CortexInlineBadge = ({ count }: { count: number }) => {
  if (!count) return null;
  return <Chip tone="purple" dot={false}>{count} Cortex</Chip>;
};
