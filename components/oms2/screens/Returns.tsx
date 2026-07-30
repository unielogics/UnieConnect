import React, { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { StatusChip, Loading, ErrorState, EmptyState } from '../ui';
import { fetchOmsReturns, fetchOmsReturn, OmsReturn } from '../../../lib/oms';
import type { ScreenProps } from '../UnieConnectApp';

function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Media playback is a WMS-hosted S3 object -- OMS never stores or re-hosts the bytes, it just
// relays whatever URL the WMS's LocalCameraCapture presign returns. Until that relay endpoint
// exists, show the capture's metadata (kind + timestamp) as proof evidence WAS captured, without
// a broken/unauthenticated video tag pointed at a private WMS S3 key.
const RETURN_MEDIA_NOTE =
  'Playback for condition-on-arrival video/photos is served directly from the warehouse -- contact support if you need the file.';

export const Returns = ({ onNavigate }: ScreenProps) => {
  const [returns, setReturns] = useState<OmsReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<OmsReturn | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setErr(null);
    fetchOmsReturns()
      .then((d) => setReturns(d.returns || []))
      .catch((e) => setErr(e.message || 'Failed to load returns'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openDetail = (r: OmsReturn) => {
    setSelected(r);
    setDetailLoading(true);
    fetchOmsReturn(r.id)
      .then((d) => setSelected(d.return))
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  };

  const openCount = returns.filter((r) => !['closed', 'cancelled'].includes(r.status)).length;
  const withMedia = returns.filter((r) => (r.mediaCaptures || []).length > 0).length;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Returns</h1>
          <p className="page-subtitle">
            Customer returns (RMAs) synced from the warehouse, including condition-on-arrival evidence captured at scan.{' '}
            {returns.length} returns, {openCount} open.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn ghost" onClick={load}>
            <Icon name="refresh" size={13} /> Refresh
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Open returns</div>
          <div className="stat-value">{openCount}</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>of {returns.length} total</div>
        </div>
        <div className="stat">
          <div className="stat-label">With captured evidence</div>
          <div className="stat-value">{withMedia}</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>condition-on-arrival</div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <Loading rows={5} />
        ) : err ? (
          <ErrorState message={err} onRetry={load} />
        ) : returns.length === 0 ? (
          <EmptyState>No returns yet. RMAs created or scanned at the warehouse will appear here.</EmptyState>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>RMA</th>
                <th>Order</th>
                <th>Status</th>
                <th>Items</th>
                <th>Evidence</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => openDetail(r)}>
                  <td>{r.rmaNumber || r.displayId || r.id}</td>
                  <td>{r.originalOrderNumber || '—'}</td>
                  <td><StatusChip status={r.status} /></td>
                  <td>{r.totals?.quantity ?? r.lineItems.reduce((sum, li) => sum + (li.quantityExpected || 0), 0)}</td>
                  <td>
                    {(r.mediaCaptures || []).length > 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', fontSize: 12 }}>
                        <Icon name="eye" size={12} /> {r.mediaCaptures.length}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td>{formatDate(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div style={{ fontSize: 16, fontWeight: 700 }}>RMA {selected.rmaNumber || selected.displayId}</div>
              <button className="icon-btn" onClick={() => setSelected(null)}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div><strong>Status:</strong> <StatusChip status={selected.status} /></div>
                {selected.originalOrderNumber && <div><strong>Order:</strong> {selected.originalOrderNumber}</div>}
                {selected.reason && <div><strong>Reason:</strong> {selected.reason}</div>}
              </div>

              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Line items</h3>
                <table className="data">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Item</th>
                      <th>Expected</th>
                      <th>Received</th>
                      <th>Restocked</th>
                      <th>Disposition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.lineItems.map((li, i) => (
                      <tr key={i}>
                        <td>{li.sku}</td>
                        <td>{li.itemName}</td>
                        <td>{li.quantityExpected}</td>
                        <td>{li.quantityReceived}</td>
                        <td>{li.quantityRestocked}</td>
                        <td>{li.disposition || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Condition-on-arrival evidence</h3>
                {detailLoading ? (
                  <Loading rows={1} />
                ) : (selected.mediaCaptures || []).length === 0 ? (
                  <EmptyState>No video or photo was captured for this return.</EmptyState>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selected.mediaCaptures.map((m, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <Icon name={m.kind === 'video' ? 'play' : 'eye'} size={14} />
                        <span>{m.kind === 'video' ? 'Video' : 'Photo'} captured {formatDate(m.capturedAt)}</span>
                      </div>
                    ))}
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{RETURN_MEDIA_NOTE}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
