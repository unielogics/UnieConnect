import React, { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { Chip, StatusChip, fmt, Loading, ErrorState, EmptyState } from '../ui';
import { fetchLedger, fetchLabelAudit, LedgerResponse, LabelAuditResponse } from '../../../lib/oms';
import { num } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';

type Claim = {
  id: string;
  type: string;
  counterparty: string;
  basis: string;
  amount: number;
  filed: string;
  status: string;
};

export const Audits = (_: ScreenProps) => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr(null);
    Promise.all([
      fetchLabelAudit().catch(() => ({ findings: [], summary: {} } as LabelAuditResponse)),
      fetchLedger().catch(() => ({ events: [] } as LedgerResponse)),
    ])
      .then(([la, lg]) => {
        const fromLabels: Claim[] = (la.findings || [])
          .filter((f) => num(f.refundAmount ?? f.refund) > 0)
          .map((f) => ({
            id: f.id,
            type: f.findingType || f.issue || 'Carrier overcharge',
            counterparty: f.carrier || '—',
            basis: f.recommendation || `${f.issue || 'Refund'} on ${f.order || f.id}`,
            amount: num(f.refundAmount ?? f.refund),
            filed: f.shipped || '—',
            status: f.auditStatus || f.status || 'evidence-ready',
          }));
        const fromLedger: Claim[] = (lg.events || [])
          .filter((e) => /finding|dispute|claim|audit|reclass/i.test(`${e.event_type} ${e.type} ${e.subject} ${e.summary}`))
          .map((e) => ({
            id: e.id || e.entity_id || 'CLM',
            type: e.event_type || e.type || 'Finding',
            counterparty: e.source_system || e.actor || 'Cortex',
            basis: e.subject || e.summary || '—',
            amount: num(e.impact),
            filed: e.created_at || e.ts || '—',
            status: e.status || 'submitted',
          }));
        setClaims([...fromLabels, ...fromLedger]);
      })
      .catch((e) => setErr(e.message || 'Failed to load audits'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const recovered = claims.filter((c) => c.status === 'approved').reduce((s, c) => s + c.amount, 0);
  const inFlight = claims.filter((c) => c.status === 'submitted' || c.status === 'evidence-ready');
  const expected = inFlight.reduce((s, c) => s + c.amount, 0);
  const approvalRate = claims.length ? Math.round((claims.filter((c) => c.status === 'approved').length / claims.length) * 100) : 0;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audits &amp; Claims</h1>
          <p className="page-subtitle">Cortex audit bot files claims autonomously. You see the recovery, the evidence, and the cycle time.</p>
        </div>
        <div className="page-actions">
          <Chip tone="purple" dot={false}>Audit bot · 24/7 active</Chip>
          <button className="btn" onClick={load}><Icon name="refresh" size={13} /> Re-scan invoices</button>
        </div>
      </div>

      {err ? (
        <div className="card"><ErrorState message={err} onRetry={load} /></div>
      ) : loading ? (
        <div className="card"><Loading rows={6} /></div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat good">
              <div className="stat-label">Refunds recovered</div>
              <div className="stat-value">{fmt.money(recovered)}</div>
              <div className="stat-delta up"><span className="arrow">▲</span> {claims.filter((c) => c.status === 'approved').length} approved</div>
            </div>
            <div className="stat ai">
              <div className="stat-label">Auto-filed (in flight)</div>
              <div className="stat-value">{inFlight.length}</div>
              <div className="stat-delta">{fmt.money(expected)} expected</div>
            </div>
            <div className="stat">
              <div className="stat-label">Approval rate</div>
              <div className="stat-value">{approvalRate}%</div>
              <div className="stat-delta up"><span className="arrow">▲</span> vs hand-filed</div>
            </div>
            <div className="stat">
              <div className="stat-label">Claims tracked</div>
              <div className="stat-value">{claims.length}</div>
              <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>auto-evidenced</div>
            </div>
          </div>

          <div className="table-wrap">
            <div className="table-toolbar">
              <button className="filter-chip applied">Recent <Icon name="x" size={10} /></button>
              <button className="filter-chip">Counterparty</button>
              <button className="filter-chip">Status</button>
              <div className="spacer" />
              <button className="btn ghost sm"><Icon name="download" size={12} /> Export</button>
            </div>
            {claims.length === 0 ? (
              <EmptyState>No audit claims recorded yet. The audit bot files automatically as overcharges are detected.</EmptyState>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Claim ID</th>
                    <th>Type</th>
                    <th>Counterparty</th>
                    <th>Basis</th>
                    <th className="num">Amount</th>
                    <th>Filed</th>
                    <th>Status</th>
                    <th>Filed by</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((a, i) => (
                    <tr key={`${a.id}-${i}`}>
                      <td className="mono strong">{a.id}</td>
                      <td>{a.type}</td>
                      <td className="mono">{a.counterparty}</td>
                      <td style={{ maxWidth: 360, color: 'var(--text-secondary)', whiteSpace: 'normal' }}>{a.basis}</td>
                      <td className="num mono strong" style={{ color: 'var(--green-text)' }}>+{fmt.money(a.amount)}</td>
                      <td className="muted">{a.filed}</td>
                      <td><StatusChip status={a.status} /></td>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                          <span style={{ width: 16, height: 16, borderRadius: 3, background: 'linear-gradient(135deg, var(--purple), #c026d3)', color: 'white', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700 }}>AI</span>
                          Audit bot
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};
