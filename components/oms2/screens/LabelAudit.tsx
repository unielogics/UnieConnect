import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, StatusChip, fmt, Loading, ErrorState, EmptyState } from '../ui';
import { useCtxMenu } from '../ContextMenu';
import {
  createLabelAuditRun,
  fetchLabelAudit,
  fetchLabelAuditRun,
  fetchLabelAuditRuns,
  LabelAuditCsvRow,
  LabelAuditResponse,
  LabelAuditRun,
} from '../../../lib/oms';
import { num } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';
import { CortexInlineBadge, CortexRowAction, useInlineRecommendations } from '../InlineRecommendation';

type F = LabelAuditResponse['findings'][number];

const splitCsvLine = (line: string) => {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
};

const parseCsv = (text: string): LabelAuditCsvRow[] => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return headers.reduce<LabelAuditCsvRow>((acc, h, i) => {
      acc[h] = cells[i]?.trim() || '';
      return acc;
    }, {});
  });
};

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
  const [runs, setRuns] = useState<LabelAuditRun[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [runDetail, setRunDetail] = useState<{ run: LabelAuditRun; findings: LabelAuditResponse['findings'] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'late' | 'refund' | 'ontime'>('all');
  const ctx = useCtxMenu();
  const { recommendations, recFor, screenRec, setSelectedRec, drawer: recDrawer } = useInlineRecommendations('labels');

  const load = () => {
    setLoading(true);
    setErr(null);
    Promise.all([
      fetchLabelAudit(),
      fetchLabelAuditRuns().catch(() => ({ runs: [] })),
    ])
      .then(([audit, runData]) => {
        setData(audit);
        setRuns(runData.runs || []);
      })
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
  const latestRun = runs[0];
  const cortexAvailable = data?.cortex?.available !== false;
  const cortexMessage = data?.cortex?.message || 'Cortex Intelligence is not available for this account. Contact support or your account manager to enable Cortex shipment label audit.';

  const submitCsv = async (filename: string, rows: LabelAuditCsvRow[]) => {
    setUploading(true);
    setErr(null);
    try {
      const res = await createLabelAuditRun({ filename, rows });
      if (res.run) {
        setRunDetail({ run: res.run, findings: res.findings || [] });
      }
      setUploadOpen(false);
      await load();
    } catch (e: any) {
      setErr(e.message || 'CSV audit failed');
    } finally {
      setUploading(false);
    }
  };

  const openRun = async (run: LabelAuditRun) => {
    setRunDetail({ run, findings: [] });
    try {
      const detail = await fetchLabelAuditRun(run.id);
      setRunDetail(detail);
    } catch {
      setRunDetail({ run, findings: [] });
    }
  };

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
          <button className="btn primary" disabled={!cortexAvailable} title={!cortexAvailable ? cortexMessage : undefined} onClick={() => setUploadOpen(true)}>
            <Icon name="download" size={13} style={{ transform: 'rotate(180deg)' }} /> Upload CSV
          </button>
          <button className="btn" onClick={load}><Icon name="refresh" size={13} /> Re-scan all labels</button>
          <button className="btn"><Icon name="audit" size={13} /> File all refundable</button>
        </div>
      </div>

      {err ? (
        <div className="card"><ErrorState message={err} onRetry={load} /></div>
      ) : loading || !data ? (
        <div className="card"><Loading rows={6} /></div>
      ) : (
        <>
          {!cortexAvailable && (
            <div className="card" style={{ borderColor: 'rgba(245, 158, 11, .35)', background: 'rgba(245, 158, 11, .07)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Icon name="sparkle" size={16} style={{ color: 'var(--amber)', marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 800 }}>Cortex shipment audit unavailable</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{cortexMessage}</div>
                </div>
              </div>
            </div>
          )}
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

          {latestRun && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div>
                  <div className="card-title">Latest CSV audit run</div>
                  <div className="card-subtitle">{latestRun.filename || 'Uploaded CSV'} · {latestRun.rowCount.toLocaleString()} rows analyzed</div>
                </div>
                <button className="btn sm" onClick={() => openRun(latestRun)}><Icon name="eye" size={12} /> View run</button>
              </div>
              <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <MiniRunStat label="Findings" value={latestRun.findingsCount} />
                <MiniRunStat label="Refunds" value={fmt.money(latestRun.estimatedRefunds)} />
                <MiniRunStat label="Service savings" value={fmt.money(latestRun.optimizedServiceSavings)} />
                <MiniRunStat label="Missing evidence" value={latestRun.missingEvidenceCount} />
              </div>
            </div>
          )}

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
              <CortexInlineBadge count={recommendations.length} />
              {screenRec && <CortexRowAction rec={screenRec} label onOpen={() => setSelectedRec(screenRec)} />}
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
                    const rec = recFor(l.id, l.order, l.trackingNumber, l.tracking, l.runId);
                    return (
                      <tr
                        key={l.id}
                        style={{
                          background: rec ? 'var(--purple-soft)' : undefined,
                          boxShadow: rec ? 'inset 3px 0 0 var(--purple)' : undefined,
                        }}
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
                        <td>
                          {l.auditStatus || l.status ? <StatusChip status={l.auditStatus || l.status!} /> : <span className="muted">—</span>}
                          {l.source === 'csv_upload' && <div style={{ marginTop: 3 }}><Chip dot={false}>CSV</Chip></div>}
                        </td>
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
                          {rec && <div style={{ marginTop: 5 }}><CortexRowAction rec={rec} label onOpen={() => setSelectedRec(rec)} /></div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <div className="card-title">CSV audit runs</div>
              <button className="btn ghost sm" onClick={() => setUploadOpen(true)}><Icon name="plus" size={12} /> New upload</button>
            </div>
            {runs.length === 0 ? (
              <EmptyState>No CSV audit runs yet.</EmptyState>
            ) : (
              <table className="data">
                <thead><tr><th>Run</th><th>File</th><th className="num">Rows</th><th className="num">Findings</th><th className="num">Refunds</th><th className="num">Savings</th><th>Status</th></tr></thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="clickable" onClick={() => openRun(run)}>
                      <td className="mono strong">{run.publicId}</td>
                      <td>{run.filename || 'CSV upload'}</td>
                      <td className="num mono">{run.rowCount.toLocaleString()}</td>
                      <td className="num mono">{run.findingsCount.toLocaleString()}</td>
                      <td className="num mono strong">{fmt.money(run.estimatedRefunds)}</td>
                      <td className="num mono">{fmt.money(run.optimizedServiceSavings)}</td>
                      <td><StatusChip status={run.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
      {uploadOpen && <LabelAuditUploadModal busy={uploading} onClose={() => setUploadOpen(false)} onSubmit={submitCsv} />}
      {runDetail && <RunDetailDrawer detail={runDetail} onClose={() => setRunDetail(null)} />}
      {recDrawer}
    </div>
  );
};

const MiniRunStat = ({ label, value }: { label: string; value: string | number }) => (
  <div>
    <div className="stat-label">{label}</div>
    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 3 }}>{value}</div>
  </div>
);

const LabelAuditUploadModal = ({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (filename: string, rows: LabelAuditCsvRow[]) => void;
}) => {
  const [filename, setFilename] = useState('');
  const [rows, setRows] = useState<LabelAuditCsvRow[]>([]);
  const [message, setMessage] = useState('');
  const handleFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    setFilename(file.name);
    setRows(parsed);
    setMessage(parsed.length ? `${parsed.length.toLocaleString()} rows ready for Cortex-style audit.` : 'CSV needs a header row and at least one data row.');
  };
  const sample = rows.slice(0, 5);
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 'min(760px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Upload label audit CSV</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Recommended columns: order, tracking number, carrier, service, shipped, delivered, promised, weight, dimensions, zone, cost, state, ZIP.</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="modal-body" style={{ display: 'grid', gap: 14 }}>
          <label style={{ padding: 18, border: '1px dashed var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', cursor: 'pointer' }}>
            <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} disabled={busy} onChange={(e) => handleFile(e.target.files?.[0] || null)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="download" size={18} style={{ transform: 'rotate(180deg)' }} />
              <div>
                <div style={{ fontWeight: 800 }}>{filename || 'Choose CSV file'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{message || 'Rows are audited for refunds, late delivery, evidence gaps, and optimized carrier/service alternatives.'}</div>
              </div>
            </div>
          </label>
          {sample.length > 0 && (
            <div className="table-wrap">
              <table className="data">
                <thead><tr>{columns.slice(0, 8).map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {sample.map((row, i) => (
                    <tr key={i}>{columns.slice(0, 8).map((c) => <td key={c}>{String(row[c] ?? '')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || rows.length === 0} onClick={() => onSubmit(filename || 'label-audit.csv', rows)}>
            <Icon name="sparkle" size={13} /> {busy ? 'Auditing...' : 'Run audit'}
          </button>
        </div>
      </div>
    </div>
  );
};

const RunDetailDrawer = ({ detail, onClose }: { detail: { run: LabelAuditRun; findings: LabelAuditResponse['findings'] }; onClose: () => void }) => (
  <div className="modal-overlay" style={{ placeItems: 'stretch end' }} onClick={onClose}>
    <div className="modal" style={{ width: 'min(52vw, 820px)', minWidth: 560, maxHeight: '100vh', height: '100vh', borderRadius: 0 }} onClick={(e) => e.stopPropagation()}>
      <div className="modal-head">
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{detail.run.publicId} · {detail.run.filename || 'CSV upload'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{detail.run.rowCount.toLocaleString()} rows · {detail.run.findingsCount.toLocaleString()} findings · {fmt.money(detail.run.estimatedRefunds)} refunds</div>
        </div>
        <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="modal-body">
        {detail.findings.length === 0 ? (
          <Loading rows={4} />
        ) : (
          <table className="data">
            <thead><tr><th>Tracking</th><th>Order</th><th>Issue</th><th className="num">Refund</th><th>Recommendation</th></tr></thead>
            <tbody>
              {detail.findings.map((f) => (
                <tr key={f.id}>
                  <td className="mono strong">{f.trackingNumber || f.tracking || '—'}</td>
                  <td className="mono">{f.order || '—'}</td>
                  <td>{issueChip(f)}</td>
                  <td className="num mono strong">{num(f.refundAmount ?? f.refund) ? fmt.money(num(f.refundAmount ?? f.refund)) : '—'}</td>
                  <td>{f.recommendation || 'Review carrier evidence.'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  </div>
);
