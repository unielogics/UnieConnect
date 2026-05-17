import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { StatusChip, Confidence, fmt, Loading, ErrorState, EmptyState } from '../ui';
import { fetchLedger, LedgerResponse } from '../../../lib/oms';
import { num } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';

type LE = LedgerResponse['events'][number];

const classify = (e: LE): 'cortex' | 'autonomous' | 'operator' => {
  const a = (e.actor || e.source_system || '').toLowerCase();
  if (a.includes('cortex') || a.includes('demand') || a.includes('net-opt')) return 'cortex';
  if (a.includes('operator') || a.includes('user') || a.includes('admin')) return 'operator';
  return 'autonomous';
};

export const Ledger = (_: ScreenProps) => {
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'cortex' | 'autonomous' | 'operator'>('all');

  const load = () => {
    setLoading(true);
    setErr(null);
    fetchLedger()
      .then(setData)
      .catch((e) => setErr(e.message || 'Failed to load ledger'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const events = data?.events || [];
  const filtered = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => classify(e) === filter)),
    [events, filter]
  );

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Intelligence Ledger</h1>
          <p className="page-subtitle">Every Cortex finding, autonomous action, and operator decision — human-readable, sourced, and immutable.</p>
        </div>
        <div className="page-actions">
          <div className="seg">
            {(['all', 'cortex', 'autonomous', 'operator'] as const).map((f) => (
              <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>
                {f}
              </button>
            ))}
          </div>
          <button className="btn"><Icon name="download" size={13} /> Export</button>
        </div>
      </div>

      {err ? (
        <div className="card"><ErrorState message={err} onRetry={load} /></div>
      ) : loading ? (
        <div className="card"><Loading rows={6} /></div>
      ) : (
        <div className="table-wrap">
          <div className="table-toolbar">
            <button className="filter-chip">Type</button>
            <button className="filter-chip">Actor</button>
            <button className="filter-chip applied">Recent <Icon name="x" size={10} /></button>
            <button className="filter-chip">Confidence ≥ 0.7</button>
            <div className="spacer" />
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{filtered.length} events</span>
          </div>
          {filtered.length === 0 ? (
            <EmptyState>No ledger events recorded yet.</EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Type</th>
                  <th>Subject</th>
                  <th>Confidence</th>
                  <th className="num">Impact</th>
                  <th className="num">Evidence</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.id || i}>
                    <td className="mono muted">{e.created_at || e.ts || '—'}</td>
                    <td className="mono">{e.actor || e.source_system || '—'}</td>
                    <td>{e.type || e.event_type ? <StatusChip status={e.type || e.event_type!} /> : '—'}</td>
                    <td style={{ maxWidth: 360, whiteSpace: 'normal' }}>{e.subject || e.summary || '—'}</td>
                    <td>{e.confidence != null ? <Confidence value={num(e.confidence)} /> : <span className="muted">—</span>}</td>
                    <td className="num mono strong" style={{ color: num(e.impact) >= 1000 ? 'var(--green-text)' : 'var(--text-secondary)' }}>
                      {e.impact != null ? fmt.money(num(e.impact), { compact: true }) : '—'}
                    </td>
                    <td className="num mono muted">{e.evidence != null ? `${num(e.evidence)} sources` : '—'}</td>
                    <td>{e.status ? <StatusChip status={e.status} /> : '—'}</td>
                    <td>
                      <button className="btn ghost sm">
                        <Icon name="eye" size={11} /> Trace
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
