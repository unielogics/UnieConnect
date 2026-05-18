import React, { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { Chip, StatusChip, fmt, Loading, ErrorState, EmptyState } from '../ui';
import {
  cancelAsn,
  fetchCopilotContext,
  fetchInventoryPlan,
  fetchOmsAsns,
  InventoryPlanFull,
  CopilotContext,
  OmsAsn,
  publicEntityId,
  stopAsn,
} from '../../../lib/oms';
import { num, monthShort } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';

export const Shipments = ({ onNavigate }: ScreenProps) => {
  const [plan, setPlan] = useState<InventoryPlanFull | null>(null);
  const [asns, setAsns] = useState<OmsAsn[]>([]);
  const [ctx, setCtx] = useState<CopilotContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr(null);
    Promise.all([fetchInventoryPlan('6m'), fetchOmsAsns().catch(() => ({ asns: [] }))])
      .then(([nextPlan, asnPayload]) => {
        setPlan(nextPlan);
        setAsns(asnPayload.asns || []);
      })
      .catch((e) => setErr(e.message || 'Failed to load shipments'))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    fetchCopilotContext('shipments').then(setCtx).catch(() => {});
  }, []);

  const inbound = (plan?.skus || []).filter((s) => num(s.inbound) > 0 || num(s.proposedUnits) > 0);
  const months = plan?.months || [];
  const maxUnits = Math.max(1, ...months.map((m) => num(m.projectedUnits)));
  const openAsns = asns.filter((a) => !['cancelled', 'stopped', 'received', 'closed'].includes(String(a.status || '').toLowerCase()));
  const mutateAsn = async (asn: OmsAsn, action: 'cancel' | 'stop') => {
    const reason = action === 'stop' ? 'Stopped before warehouse execution from OMS' : 'Cancelled from OMS shipment screen';
    setActing(`${action}:${asn.id}`);
    try {
      if (action === 'stop') await stopAsn(asn.id, reason);
      else await cancelAsn(asn.id, reason);
      await load();
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Shipment Plans</h1>
          <p className="page-subtitle">Inbound shipment plans, dock dates, pallet forecasts, and WMS receiving status.</p>
        </div>
        <div className="page-actions">
          <button className="btn ghost"><Icon name="filter" size={13} /> Filter</button>
          <button className="btn"><Icon name="download" size={13} /> Export</button>
          <button className="btn primary" onClick={() => onNavigate('skus')}><Icon name="plus" size={13} /> Create ASN</button>
        </div>
      </div>

      {err ? (
        <div className="card"><ErrorState message={err} onRetry={load} /></div>
      ) : loading || !plan ? (
        <div className="card"><Loading rows={6} /></div>
      ) : (
        <>
          <div className="stat-grid cols-5">
            <div className="stat"><div className="stat-label">SKUs inbound</div><div className="stat-value">{inbound.length}</div></div>
            <div className="stat warn"><div className="stat-label">Active ASNs</div><div className="stat-value">{openAsns.length}</div></div>
            <div className="stat"><div className="stat-label">Planned periods</div><div className="stat-value">{months.length}</div></div>
            <div className="stat"><div className="stat-label">Shared pallets</div><div className="stat-value">{num(plan.proposed?.sharedPalletCandidates)}</div></div>
            <div className="stat warn"><div className="stat-label">Stockout-risk</div><div className="stat-value">{num(plan.proposed?.stockoutRiskSkus)}</div></div>
          </div>

          <div className="row-2" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  Planned inbound <Chip dot={false}>{inbound.length}</Chip>
                </div>
                <div className="seg">
                  <button className="active">All</button>
                  <button>Open</button>
                  <button>Received</button>
                </div>
              </div>
              {inbound.length === 0 ? (
                <EmptyState>No inbound shipments in the current plan.</EmptyState>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product</th>
                      <th className="num">Inbound</th>
                      <th className="num">Proposed</th>
                      <th className="num">Pallet ft³</th>
                      <th>Tier</th>
                      <th>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inbound.map((s) => (
                      <tr key={s.id} className="clickable" onClick={() => onNavigate('sku-detail', s.id)}>
                        <td className="mono strong">{s.sku}</td>
                        <td>{s.title || '—'}</td>
                        <td className="num mono">{num(s.inbound).toLocaleString()}</td>
                        <td className="num mono strong">{num(s.proposedUnits).toLocaleString()}</td>
                        <td className="num mono">{num(s.palletCubeFt)}</td>
                        <td className="mono muted" style={{ textTransform: 'capitalize' }}>{s.serviceTier}</td>
                        <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.recommendation || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    ASN control <Chip dot={false}>{asns.length}</Chip>
                  </div>
                  <button className="btn ghost sm" onClick={load}><Icon name="refresh" size={12} /> Sync</button>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  {asns.length === 0 ? (
                    <EmptyState>No ASNs created yet. Create one from selected SKUs or a shipment plan.</EmptyState>
                  ) : (
                    <table className="data">
                      <thead>
                        <tr>
                          <th>ASN</th>
                          <th>Supplier</th>
                          <th>Warehouse</th>
                          <th className="num">Units</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asns.map((asn) => {
                          const locked = ['cancelled', 'stopped', 'received', 'closed'].includes(String(asn.status || '').toLowerCase());
                          return (
                            <tr key={asn.id}>
                              <td>
                                <div className="mono strong">{asn.displayId || asn.publicId || publicEntityId('AS', asn.id)}</div>
                                <div className="mono muted" style={{ fontSize: 10.5 }}>{asn.asnNumber || asn.shipmentDisplayId || ''}</div>
                              </td>
                              <td>
                                <div>{asn.supplierName || '—'}</div>
                                <div className="mono muted" style={{ fontSize: 10.5 }}>{asn.supplierDisplayId || ''}</div>
                              </td>
                              <td>
                                <div>{asn.facilityCode || 'Auto'}</div>
                                <div className="muted" style={{ fontSize: 10.5 }}>{asn.facilityName || 'Cortex-routed'}</div>
                              </td>
                              <td className="num mono">{num(asn.units).toLocaleString()}</td>
                              <td><StatusChip status={asn.status || 'created'} /></td>
                              <td>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  <button className="btn ghost sm" disabled={locked || acting === `stop:${asn.id}`} onClick={() => mutateAsn(asn, 'stop')}>
                                    Stop
                                  </button>
                                  <button className="btn ghost sm" disabled={locked || acting === `cancel:${asn.id}`} onClick={() => mutateAsn(asn, 'cancel')}>
                                    <Icon name="x" size={12} /> Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Icon name="box" size={15} /> Replenishment forecast
                  </div>
                </div>
                <div className="card-body">
                  {months.length === 0 ? (
                    <EmptyState>No forecast periods.</EmptyState>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
                        {months.map((m, i) => (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                              <div style={{ flex: 1, height: `${(num(m.projectedUnits) / maxUnits) * 100}%`, background: 'var(--accent)', borderRadius: '3px 3px 0 0', minHeight: 1 }} />
                              <div style={{ flex: 1, height: `${(num(m.proposedReplenishment) / maxUnits) * 100}%`, background: 'var(--purple)', borderRadius: '3px 3px 0 0', minHeight: 1 }} />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{monthShort(m.month)}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 8, height: 8, background: 'var(--accent)', borderRadius: 2 }} />
                          Projected demand
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 8, height: 8, background: 'var(--purple)', borderRadius: 2 }} />
                          Replenishment
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Icon name="sparkle" size={15} style={{ color: 'var(--purple)' }} /> AI suggestions
                  </div>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!ctx?.recommendedPrompts?.length && !ctx?.latestSignals?.length && (
                    <EmptyState>No AI suggestions for this screen.</EmptyState>
                  )}
                  {(ctx?.latestSignals || []).map((s, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 10,
                        border: '1px solid var(--border-subtle)',
                        borderLeft: '3px solid var(--green)',
                        borderRadius: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{s.title || 'Suggestion'}</div>
                      {s.detail && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{s.detail}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
