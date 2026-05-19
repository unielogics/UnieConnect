import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, StatusChip, fmt, Loading, ErrorState, EmptyState } from '../ui';
import { useCtxMenu } from '../ContextMenu';
import { fetchLabelAudit, LabelAuditResponse } from '../../../lib/oms';
import { num } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';
import { OptimizationImpact } from '../OptimizationImpact';

type F = LabelAuditResponse['findings'][number];

const issueChip = (f: F) => {
  const issue = f.issue || f.findingType || '—';
  const sev = (f.severity || '').toLowerCase();
  if (/on.?time|none|ok/.test(issue.toLowerCase())) return <Chip tone="green">On-time</Chip>;
  if (sev === 'high') return <Chip tone="red">{issue}</Chip>;
  if (sev === 'med' || sev === 'medium') return <Chip tone="amber">{issue}</Chip>;
  return <Chip>{issue}</Chip>;
};

export const LabelAudit = (_: ScreenProps) => {
  const [data, setData] = useState<LabelAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'late' | 'refund' | 'ontime'>('all');
  const ctx = useCtxMenu();

  const load = () => {
    setLoading(true);
    setErr(null);
    fetchLabelAudit()
      .then(setData)
      .catch((e) => setErr(e.message || 'Failed to load label audit'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const findings = data?.findings || [];
  const ref = (f: F) => num(f.refundAmount ?? f.refund);
  const cost = (f: F) => num(f.cost);
  const optCost = (f: F) => num(f.optimizedCost);

  const filtered = useMemo(
    () =>
      findings.filter((f) => {
        if (filter === 'all') return true;
        if (filter === 'refund') return ref(f) > 0;
        if (filter === 'late') return /late/i.test(f.issue || f.findingType || '');
        if (filter === 'ontime') return /on.?time/i.test(f.issue || f.findingType || '');
        return true;
      }),
    [findings, filter]
  );

  const totalRefunds = num(data?.summary?.estimatedRefunds) || findings.reduce((s, f) => s + ref(f), 0);
  const currentTotal = findings.reduce((s, f) => s + cost(f), 0);
  const optimizedTotal = findings.reduce((s, f) => s + (optCost(f) || cost(f)), 0);
  const labelSavings = currentTotal - optimizedTotal;
  const lateCount = num(data?.summary?.lateDeliveries) || findings.filter((f) => /late/i.test(f.issue || f.findingType || '')).length;
  const refundable = findings.filter((f) => ref(f) > 0).length;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Carrier Label Audit</h1>
          <p className="page-subtitle">
            Every outbound label — late, refunds, dim-weight reclass, and optimized carrier/service alternatives with the AI plan.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={load}><Icon name="refresh" size={13} /> Re-scan all labels</button>
          <button className="btn primary"><Icon name="audit" size={13} /> File all refundable</button>
        </div>
      </div>

      <OptimizationImpact screen="labels" title="Carrier audit optimization" />

      {err ? (
        <div className="card"><ErrorState message={err} onRetry={load} /></div>
      ) : loading || !data ? (
        <div className="card"><Loading rows={6} /></div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat">
              <div className="stat-label">Labels audited</div>
              <div className="stat-value">{fmt.num(findings.length)}</div>
              <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>in sample</div>
            </div>
            <div className="stat warn">
              <div className="stat-label">Late deliveries</div>
              <div className="stat-value">{lateCount}</div>
              <div className="stat-delta">{findings.length ? ((lateCount / findings.length) * 100).toFixed(1) : 0}% of volume</div>
            </div>
            <div className="stat good">
              <div className="stat-label">Refunds available</div>
              <div className="stat-value">${totalRefunds.toFixed(0)}</div>
              <div className="stat-delta up"><span className="arrow">▲</span> {refundable} eligible</div>
            </div>
            <div className="stat ai">
              <div className="stat-label">Plan savings on labels</div>
              <div className="stat-value">{fmt.money(labelSavings, { compact: true })}</div>
              <div className="stat-delta">{currentTotal ? ((labelSavings / currentTotal) * 100).toFixed(1) : 0}% lower / label</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(180deg, var(--purple-soft) 0%, var(--bg-elev) 60%)' }}>
            <div className="card-body" style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 60px 1fr 1fr', gap: 20, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>CURRENT — AVG LABEL COST</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>${findings.length ? (currentTotal / findings.length).toFixed(2) : '0.00'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>across {findings.length} labels in sample</div>
              </div>
              <div style={{ display: 'grid', placeItems: 'center' }}>
                <Icon name="arrowRight" size={28} style={{ color: 'var(--purple)' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--purple-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>WITH PLAN — OPTIMIZED</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--purple-text)', marginTop: 4 }}>
                  ${findings.length ? (optimizedTotal / findings.length).toFixed(2) : '0.00'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>carrier/service swaps suggested by AI</div>
              </div>
              <div style={{ background: 'var(--green-soft)', padding: 14, borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--green-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>OPT. SERVICE SAVINGS</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green-text)', marginTop: 4 }}>
                  {fmt.money(num(data.summary?.optimizedServiceSavings) || labelSavings, { compact: true })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>modeled by Cortex</div>
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <div className="table-toolbar">
              {(['all', 'late', 'refund', 'ontime'] as const).map((f) => (
                <button key={f} className={`filter-chip ${filter === f ? 'applied' : ''}`} onClick={() => setFilter(f)} style={{ cursor: 'pointer', textTransform: 'capitalize' }}>
                  {f === 'ontime' ? 'On-time' : f}
                </button>
              ))}
              <button className="filter-chip">Carrier</button>
              <button className="filter-chip">Date</button>
              <div className="spacer" />
              <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{filtered.length} labels</span>
            </div>
            {filtered.length === 0 ? (
              <EmptyState>No label findings in this view.</EmptyState>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Order</th>
                    <th>Carrier · Service</th>
                    <th>Weight · Dim</th>
                    <th className="num">Zone</th>
                    <th>Shipped → Delivered</th>
                    <th className="num">Cost</th>
                    <th>Issue</th>
                    <th className="num">Refund</th>
                    <th>Audit</th>
                    <th>AI alternative</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => {
                    const delta = cost(l) - (optCost(l) || cost(l));
                    return (
                      <tr
                        key={l.id}
                        onContextMenu={(e) =>
                          ctx.open(e, [
                            { label: 'Label' },
                            { icon: 'eye', title: 'Open label' },
                            { icon: 'orders', title: `Open order ${l.order || ''}` },
                            { icon: 'audit', title: 'Build refund evidence' },
                            { divider: true },
                            { icon: 'sparkle', title: `Switch to ${l.optimizedCarrier || 'AI alternative'}` },
                            { icon: 'refresh', title: 'Rescan', shortcut: '⌘R', onClick: load },
                          ])
                        }
                      >
                        <td className="mono strong">{l.id}</td>
                        <td className="mono">{l.order || '—'}</td>
                        <td>
                          <div style={{ fontSize: 12 }}>{l.carrier}</div>
                          <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                            {l.service || l.trackingNumber || l.tracking || ''}
                          </div>
                        </td>
                        <td className="muted mono">
                          {l.weight != null ? `${l.weight}${typeof l.weight === 'number' ? 'lb' : ''}` : '—'}
                          {l.dim ? ` · ${l.dim}` : ''}
                        </td>
                        <td className="num mono">{l.zone ?? '—'}</td>
                        <td>
                          <div style={{ fontSize: 12 }}>
                            {(l.shipped || '—').slice(5)} → {(l.delivered || '—').slice(5)}
                          </div>
                          <div style={{ fontSize: 10.5, color: l.delivered && l.promised && new Date(l.delivered) > new Date(l.promised) ? 'var(--red-text)' : 'var(--text-tertiary)' }}>
                            promised {(l.promised || '—').slice(5)}
                          </div>
                        </td>
                        <td className="num mono">${cost(l).toFixed(2)}</td>
                        <td>{issueChip(l)}</td>
                        <td className="num mono strong" style={{ color: ref(l) > 0 ? 'var(--green-text)' : 'var(--text-tertiary)' }}>
                          {ref(l) > 0 ? `+$${ref(l).toFixed(2)}` : '—'}
                        </td>
                        <td>{l.auditStatus || l.status ? <StatusChip status={l.auditStatus || l.status!} /> : <span className="muted">—</span>}</td>
                        <td>
                          {l.optimizedCarrier ? (
                            <div>
                              <div style={{ fontSize: 11.5, color: 'var(--purple-text)', fontWeight: 600 }}>{l.optimizedCarrier}</div>
                              <div className="mono" style={{ fontSize: 10.5, color: 'var(--green-text)', fontWeight: 600 }}>
                                ${optCost(l).toFixed(2)} {delta > 0 ? `−$${delta.toFixed(2)}` : ''}
                              </div>
                            </div>
                          ) : (
                            <span className="muted">{l.recommendation || '—'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};
