import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Icon } from '../icons';
import { Chip, StatusChip, fmt, Loading, ErrorState, EmptyState, downloadCsv, useCloseOnOmsNavigation, useModalOverlayKeyboard } from '../ui';
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
import { CortexInlineBadge, CortexRowAction, useInlineRecommendations } from '../InlineRecommendation';
import { useCtxMenu, type CtxItem } from '../ContextMenu';

type AsnActionTarget = { asn: OmsAsn; action: 'cancel' | 'stop' };

export const Shipments = ({ onNavigate, onOpenAsnById, toggleSelect, isSelected, selectedSkus = [] }: ScreenProps) => {
  const router = useRouter();
  const openedAsnRef = useRef<string | null>(null);
  const [plan, setPlan] = useState<InventoryPlanFull | null>(null);
  const [asns, setAsns] = useState<OmsAsn[]>([]);
  const [ctx, setCtx] = useState<CopilotContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const [asnActionTarget, setAsnActionTarget] = useState<AsnActionTarget | null>(null);
  useCloseOnOmsNavigation(() => {
    if (!acting) setAsnActionTarget(null);
  }, !!asnActionTarget);
  const asnActionOverlayRef = useModalOverlayKeyboard(() => {
    if (!acting) setAsnActionTarget(null);
  }, !!asnActionTarget);
  const ctxMenu = useCtxMenu();
  const { recommendations, recFor, screenRec, setSelectedRec, drawer: recDrawer, recommendationStatus } = useInlineRecommendations('shipments');

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [nextPlan, asnPayload] = await Promise.all([fetchInventoryPlan('6m'), fetchOmsAsns()]);
      setPlan(nextPlan);
      setAsns(asnPayload.asns || []);
    } catch (error: any) {
      setErr(error?.message || 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  };
  const loadGuidance = () => {
    setCtxLoading(true);
    setCtxError(null);
    fetchCopilotContext('shipments')
      .then(setCtx)
      .catch((error: any) => setCtxError(error?.message || 'Cortex shipment guidance could not be loaded.'))
      .finally(() => setCtxLoading(false));
  };
  useEffect(() => {
    void load();
    loadGuidance();
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const requested = String(router.query.asn || '').trim();
    if (!requested) {
      openedAsnRef.current = null;
      return;
    }
    const asn = asns.find((candidate) => [
      candidate.id,
      candidate.publicId,
      candidate.displayId,
      candidate.asnNumber,
      candidate.shipmentPlanId,
    ].some((value) => String(value || '') === requested));
    if (!asn || openedAsnRef.current === requested) return;
    openedAsnRef.current = requested;
    onOpenAsnById?.(asn.id);
  }, [asns, onOpenAsnById, router.isReady, router.query.asn]);

  const inbound = (plan?.skus || []).filter((s) => num(s.inbound) > 0 || num(s.proposedUnits) > 0);
  const months = plan?.months || [];
  const maxUnits = Math.max(1, ...months.map((m) => num(m.projectedUnits)));
  const openAsns = asns.filter((a) => !['cancelled', 'stopped', 'received', 'closed'].includes(String(a.status || '').toLowerCase()));
  const selectedSupplierKey = (() => {
    const keys = selectedSkus.map((s) => s.supplierId || '__unassigned__');
    return keys.length ? keys[0] : null;
  })();
  const selectedInboundCount = inbound.filter((s) => isSelected(s.id)).length;
  const selectInboundSku = (s: InventoryPlanFull['skus'][number]) => {
    setSelectionNotice(null);
    if (!isSelected(s.id) && selectedSupplierKey) {
      const nextKey = s.supplierId || '__unassigned__';
      if (nextKey !== selectedSupplierKey) {
        setSelectionNotice(
          s.supplierId
            ? 'Shipment plans can only group SKUs from the same supplier. Clear the current selection or choose another SKU from that supplier.'
            : 'This SKU has no supplier assigned. Clear the current supplier selection or assign a supplier before grouping it.'
        );
        return;
      }
    }
    toggleSelect({ id: s.id, name: s.title || s.sku, ...(s as any) });
  };
  const mutateAsn = async (asn: OmsAsn, action: 'cancel' | 'stop') => {
    const reason = action === 'stop' ? 'Stopped before warehouse execution from OMS' : 'Cancelled from OMS shipment screen';
    setActing(`${action}:${asn.id}`);
    setActionFeedback(null);
    try {
      if (action === 'stop') await stopAsn(asn.id, reason);
      else await cancelAsn(asn.id, reason);
      await load();
      setActionFeedback({
        tone: 'success',
        text: `${asn.displayId || asn.publicId || asn.asnNumber || 'ASN'} ${action === 'stop' ? 'stopped' : 'cancelled'} successfully.`,
      });
      setAsnActionTarget(null);
    } catch (error: any) {
      setActionFeedback({
        tone: 'error',
        text: error?.message || `The ASN could not be ${action === 'stop' ? 'stopped' : 'cancelled'}.`,
      });
    } finally {
      setActing(null);
    }
  };

  const asnMenuItems = (asn: OmsAsn, rec: ReturnType<typeof recFor>, locked: boolean): CtxItem[] => [
    { label: 'ASN' },
    { icon: 'ledger', title: 'View activity in ledger', onClick: () => onNavigate('ledger', asn.id) },
    ...(rec ? [{ icon: 'sparkle', title: 'Review Cortex decision', onClick: () => setSelectedRec(rec) } as CtxItem] : []),
    { divider: true },
    {
      icon: 'x',
      title: locked ? 'ASN can no longer be stopped' : 'Stop before warehouse execution',
      disabled: locked || Boolean(acting),
      onClick: () => setAsnActionTarget({ asn, action: 'stop' }),
    },
    {
      icon: 'archive',
      title: locked ? 'ASN can no longer be cancelled' : 'Cancel ASN',
      danger: true,
      disabled: locked || Boolean(acting),
      onClick: () => setAsnActionTarget({ asn, action: 'cancel' }),
    },
  ];

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Shipment Plans</h1>
          <p className="page-subtitle">Inbound shipment plans, dock dates, pallet forecasts, and WMS receiving status.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => downloadCsv('unieconnect-shipment-plans.csv', [
            ...asns.map((asn) => ({ Type: 'ASN', ID: asn.displayId || asn.publicId || asn.asnNumber || asn.id, Status: asn.status, Supplier: asn.supplierName || asn.supplierId || '', Warehouse: asn.facilityName || asn.facilityCode || '', Units: asn.units ?? '', 'Estimated arrival': asn.estimatedArrivalDate || '', Created: asn.createdAt || '' })),
            ...inbound.map((sku) => ({ Type: 'Planned inbound SKU', ID: sku.sku, Title: sku.title || '', Status: sku.risk, Supplier: sku.supplierId || '', Units: sku.proposedUnits, Inbound: sku.inbound, 'Service tier': sku.serviceTier, Recommendation: sku.recommendation })),
          ])}><Icon name="download" size={13} /> Export</button>
          <button className="btn primary" onClick={() => onNavigate('skus')}><Icon name="plus" size={13} /> Create ASN</button>
        </div>
      </div>

      {recommendationStatus}

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
                <div>
                  <div className="card-title">
                    Planned inbound <Chip dot={false}>{inbound.length}</Chip>
                    <CortexInlineBadge count={recommendations.length} />
                  </div>
                  <div className="card-subtitle">Click rows to stage SKUs for a shipment plan. Multi-select requires the same supplier.</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {screenRec && <CortexRowAction rec={screenRec} label onOpen={() => setSelectedRec(screenRec)} />}
                </div>
              </div>
              {selectionNotice && (
                <div className="inline-banner warn" style={{ margin: '0 16px 12px' }}>
                  <Icon name="warning" size={13} /> {selectionNotice}
                </div>
              )}
              {selectedInboundCount > 0 && (
                <div className="inline-banner" style={{ margin: '0 16px 12px' }}>
                  <Icon name="shipments" size={13} /> {selectedInboundCount} planned inbound SKU{selectedInboundCount === 1 ? '' : 's'} staged. Use the bottom selection bar to create the shipment plan.
                </div>
              )}
              {inbound.length === 0 ? (
                <EmptyState>No inbound shipments in the current plan.</EmptyState>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th style={{ width: 28 }} />
                      <th>SKU</th>
                      <th>Product</th>
                      <th>Supplier</th>
                      <th className="num">Inbound</th>
                      <th className="num">Proposed</th>
                      <th className="num">Pallet ft³</th>
                      <th>Tier</th>
                      <th>Recommendation</th>
                      <th className="num">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inbound.map((s) => {
                      const sel = isSelected(s.id);
                      const rec = recFor(s.id, s.sku);
                      return (
                        <tr
                          key={s.id}
                          className="clickable"
                          onClick={() => selectInboundSku(s)}
                          style={{
                            background: sel ? 'var(--accent-soft)' : undefined,
                            boxShadow: sel ? 'inset 3px 0 0 var(--accent)' : undefined,
                            outline: rec ? '1px solid rgba(109,40,217,0.22)' : undefined,
                          }}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="row-check"
                              checked={sel}
                              onChange={() => selectInboundSku(s)}
                            />
                          </td>
                          <td className="mono strong">{s.sku}</td>
                          <td>{s.title || '—'}</td>
                          <td className="mono muted">{s.supplierId || 'Unassigned'}</td>
                          <td className="num mono">{num(s.inbound).toLocaleString()}</td>
                          <td className="num mono strong">{num(s.proposedUnits).toLocaleString()}</td>
                          <td className="num mono">{num(s.palletCubeFt)}</td>
                          <td className="mono muted" style={{ textTransform: 'capitalize' }}>{s.serviceTier}</td>
                          <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {rec ? <span style={{ color: 'var(--purple-text)', fontWeight: 700 }}>{rec.summary || rec.title}</span> : s.recommendation || '—'}
                          </td>
                          <td className="num" onClick={(e) => e.stopPropagation()}>
                            <CortexRowAction rec={rec} onOpen={() => rec && setSelectedRec(rec)} />
                            <button className="btn ghost sm" onClick={() => onNavigate('sku-detail', s.id)} data-hint="Open SKU detail">
                              <Icon name="eye" size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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
                  <button className="btn ghost sm" onClick={() => void load()}><Icon name="refresh" size={12} /> Sync</button>
                </div>
                {actionFeedback && (
                  <div className={`decision-feedback ${actionFeedback.tone}`} role={actionFeedback.tone === 'error' ? 'alert' : 'status'}>
                    <Icon name={actionFeedback.tone === 'success' ? 'check' : 'warning'} size={13} /> {actionFeedback.text}
                  </div>
                )}
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
                          const rec = recFor(asn.id, asn.publicId, asn.asnNumber, asn.shipmentPlanId);
                          return (
                            <tr
                              key={asn.id}
                              className="clickable"
                              style={{ boxShadow: rec ? 'inset 3px 0 0 var(--purple)' : undefined, background: rec ? 'var(--purple-soft)' : undefined }}
                              onClick={() => onOpenAsnById?.(asn.id)}
                              onContextMenu={(event) => ctxMenu.open(event, asnMenuItems(asn, rec, locked))}
                            >
                              <td>
                                <div className="mono strong">{asn.displayId || asn.publicId || publicEntityId('AS', asn.id)}</div>
                                <div className="mono muted" style={{ fontSize: 10.5 }}>{asn.asnNumber || asn.shipmentDisplayId || ''}</div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>{asn.supplierName || '—'}</span>
                                  {asn.supplierOnline && <Chip tone="blue" dot={false}>Online</Chip>}
                                </div>
                                <div className="mono muted" style={{ fontSize: 10.5 }}>
                                  {asn.supplierOnline
                                    ? asn.supplierDisplayId || ''
                                    : [asn.supplierCity, asn.supplierState].filter(Boolean).join(', ') || asn.supplierDisplayId || ''}
                                </div>
                                <div className="muted" style={{ fontSize: 10.5 }}>
                                  {asn.supplierLastOrderAt ? `Last order ${new Date(asn.supplierLastOrderAt).toLocaleDateString()}` : 'No orders yet'}
                                </div>
                              </td>
                              <td>
                                <div>{asn.facilityCode || 'Auto'}</div>
                                <div className="muted" style={{ fontSize: 10.5 }}>{asn.facilityName || 'Cortex-routed'}</div>
                              </td>
                              <td className="num mono">{num(asn.units).toLocaleString()}</td>
                              <td><StatusChip status={asn.status || 'created'} /></td>
                              <td onClick={(event) => event.stopPropagation()}>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  <CortexRowAction rec={rec} onOpen={() => rec && setSelectedRec(rec)} />
                                  <button
                                    className="icon-btn"
                                    data-hint="ASN actions"
                                    aria-label="ASN actions"
                                    disabled={Boolean(acting)}
                                    onClick={(event) => ctxMenu.open(event, asnMenuItems(asn, rec, locked))}
                                  >
                                    <Icon name="more" size={14} />
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
                  {ctxLoading ? (
                    <Loading rows={2} />
                  ) : ctxError ? (
                    <div className="inline-banner danger" role="alert">
                      <Icon name="warning" size={13} />
                      <span style={{ flex: 1 }}>{ctxError}</span>
                      <button className="btn ghost sm" onClick={loadGuidance}><Icon name="refresh" size={12} /> Retry</button>
                    </div>
                  ) : !ctx?.recommendedPrompts?.length && !ctx?.latestSignals?.length ? (
                    <EmptyState>No AI suggestions for this screen.</EmptyState>
                  ) : null}
                  {!ctxLoading && !ctxError && (ctx?.latestSignals || []).map((s, i) => (
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
          {recDrawer}
          {asnActionTarget && (
            <div ref={asnActionOverlayRef} className="modal-overlay" onClick={() => !acting && setAsnActionTarget(null)}>
              <div className="modal" role="dialog" aria-modal="true" aria-label={asnActionTarget.action === 'stop' ? 'Stop ASN' : 'Cancel ASN'} tabIndex={-1} style={{ width: 460 }} onClick={(event) => event.stopPropagation()}>
                <div className="modal-head">
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>
                      {asnActionTarget.action === 'stop' ? 'Stop ASN' : 'Cancel ASN'}
                    </div>
                    <div className="mono muted" style={{ fontSize: 11, marginTop: 3 }}>
                      {asnActionTarget.asn.displayId || asnActionTarget.asn.publicId || asnActionTarget.asn.asnNumber || publicEntityId('AS', asnActionTarget.asn.id)}
                    </div>
                  </div>
                  <button className="icon-btn" aria-label="Close" disabled={Boolean(acting)} onClick={() => setAsnActionTarget(null)}><Icon name="x" /></button>
                </div>
                <div className="modal-body">
                  <div className="inline-banner warn">
                    <Icon name="warning" size={14} />
                    {asnActionTarget.action === 'stop'
                      ? 'Stop this ASN before warehouse execution. The status change and reason will be written to the ledger.'
                      : 'Cancel this ASN. The cancellation will be written to the ledger and the ASN will no longer be actionable.'}
                  </div>
                </div>
                <div className="modal-foot">
                  <button className="btn ghost" disabled={Boolean(acting)} onClick={() => setAsnActionTarget(null)}>Back</button>
                  <button
                    className="btn primary"
                    disabled={Boolean(acting)}
                    onClick={() => mutateAsn(asnActionTarget.asn, asnActionTarget.action)}
                  >
                    {acting
                      ? asnActionTarget.action === 'stop' ? 'Stopping...' : 'Cancelling...'
                      : asnActionTarget.action === 'stop' ? 'Stop ASN' : 'Cancel ASN'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
