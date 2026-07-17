import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, EmptyState, ErrorState, fmt, Loading, StatusChip, useCloseOnOmsNavigation } from '../ui';
import {
  fetchWarehouseDetail,
  fetchWarehouseOverview,
  fetchReplenishmentTuning,
  updateReplenishmentTuning,
  fetchReplenishmentQuietTimes,
  OmsWarehouseDetail,
  OmsWarehouseOverview,
  ReplenishmentTuning,
  ReplenishmentWindow,
} from '../../../lib/oms';
import { fmtDate, num } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';

type Tab = 'overview' | 'inventory' | 'orders' | 'asns' | 'events' | 'activity' | 'cortex' | 'replenishment';

export const Warehouses = ({ onNavigate }: ScreenProps) => {
  const [data, setData] = useState<{ warehouses: OmsWarehouseOverview[]; total: number } | null>(null);
  const [selected, setSelected] = useState<OmsWarehouseOverview | null>(null);
  const [detail, setDetail] = useState<OmsWarehouseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr(null);
    fetchWarehouseOverview()
      .then(setData)
      .catch((e) => setErr(e.message || 'Failed to load warehouses'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openWarehouse = (warehouse: OmsWarehouseOverview) => {
    setSelected(warehouse);
    setDetail(null);
    setDetailLoading(true);
    fetchWarehouseDetail(warehouse.warehouseCode)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  };

  const warehouses = data?.warehouses || [];
  const totals = useMemo(
    () => ({
      inventoryUnits: warehouses.reduce((sum, wh) => sum + num(wh.inventoryUnits), 0),
      activeSkus: warehouses.reduce((sum, wh) => sum + num(wh.activeSkus), 0),
      orders: warehouses.reduce((sum, wh) => sum + num(wh.orders), 0),
      asns: warehouses.reduce((sum, wh) => sum + num(wh.asns), 0),
    }),
    [warehouses]
  );

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Warehouses</h1>
          <p className="page-subtitle">Connected warehouse nodes, inventory snapshots, orders, ASNs, WMS events, and Cortex signals.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={load}><Icon name="refresh" size={13} /> Refresh</button>
          <button className="btn primary" onClick={() => onNavigate('connections')}><Icon name="plus" size={13} /> Connect warehouse</button>
        </div>
      </div>

      {err ? (
        <div className="card"><ErrorState message={err} onRetry={load} /></div>
      ) : loading ? (
        <div className="card"><Loading rows={6} /></div>
      ) : (
        <>
          <div className="stat-grid cols-4" style={{ marginBottom: 16 }}>
            <div className="stat"><div className="stat-label">Warehouses</div><div className="stat-value">{warehouses.length}</div></div>
            <div className="stat"><div className="stat-label">Inventory units</div><div className="stat-value">{fmt.num(totals.inventoryUnits)}</div></div>
            <div className="stat good"><div className="stat-label">Active SKUs</div><div className="stat-value">{fmt.num(totals.activeSkus)}</div></div>
            <div className="stat ai"><div className="stat-label">Orders / ASNs</div><div className="stat-value">{fmt.num(totals.orders)} / {fmt.num(totals.asns)}</div></div>
          </div>

          <div className="table-wrap">
            <div className="table-toolbar">
              <span style={{ fontSize: 12, fontWeight: 800 }}>Warehouse network</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Real connected WMS/user-linked warehouses only</span>
              <div className="spacer" />
              <button className="btn ghost sm"><Icon name="columns" size={12} /> Columns</button>
            </div>
            {warehouses.length === 0 ? (
              <EmptyState>
                No warehouses connected yet.
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 8 }}>
                  <button className="btn sm" onClick={() => onNavigate('connections')}><Icon name="plug" size={12} /> Open Connections</button>
                  <button className="btn primary sm" onClick={() => onNavigate('connections')}><Icon name="plus" size={12} /> Connect warehouse</button>
                </div>
              </EmptyState>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Warehouse</th>
                    <th>Status</th>
                    <th className="num">Inventory units</th>
                    <th className="num">Active SKUs</th>
                    <th className="num">Orders</th>
                    <th className="num">ASNs</th>
                    <th>Last WMS event</th>
                    <th className="num">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.map((wh) => (
                    <tr key={wh.id || wh.warehouseCode} className="clickable" onClick={() => openWarehouse(wh)}>
                      <td>
                        <div className="mono strong">{wh.warehouseCode}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{wh.name || wh.facilityName || 'Warehouse'}{wh.region ? ` · ${wh.region}` : ''}</div>
                      </td>
                      <td><StatusChip status={wh.status || 'connected'} /></td>
                      <td className="num mono strong">{fmt.num(wh.inventoryUnits || 0)}</td>
                      <td className="num mono">{fmt.num(wh.activeSkus || 0)}</td>
                      <td className="num mono">{fmt.num(wh.orders || 0)}</td>
                      <td className="num mono">{fmt.num(wh.asns || 0)}</td>
                      <td>
                        {wh.lastWmsEventAt ? (
                          <div>
                            <div style={{ fontSize: 12 }}>{String(wh.lastWmsEventType || 'wms_event').replace(/_/g, ' ')}</div>
                            <div className="muted mono" style={{ fontSize: 10.5 }}>{fmtDate(wh.lastWmsEventAt)}</div>
                          </div>
                        ) : <span className="muted">Waiting for WMS</span>}
                      </td>
                      <td className="num">
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); openWarehouse(wh); }}><Icon name="panelRight" size={12} /> Open</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {selected && (
        <WarehouseDrawer
          warehouse={selected}
          detail={detail}
          loading={detailLoading}
          onClose={() => {
            setSelected(null);
            setDetail(null);
          }}
        />
      )}
    </div>
  );
};

const WarehouseDrawer = ({
  warehouse,
  detail,
  loading,
  onClose,
}: {
  warehouse: OmsWarehouseOverview;
  detail: OmsWarehouseDetail | null;
  loading: boolean;
  onClose: () => void;
}) => {
  const [tab, setTab] = useState<Tab>('overview');
  useCloseOnOmsNavigation(onClose);
  const wh = detail?.warehouse || warehouse;
  const tabs: Array<[Tab, string, number | undefined]> = [
    ['overview', 'Overview', undefined],
    ['inventory', 'Inventory', detail?.inventory?.length],
    ['orders', 'Orders', detail?.orders?.length],
    ['asns', 'ASNs', detail?.asns?.length],
    ['events', 'WMS Events', detail?.wmsEvents?.length],
    ['activity', 'Activity', detail?.ledger?.length],
    ['cortex', 'Cortex', detail?.cortex?.signals?.length],
    ['replenishment', 'Replenishment', undefined],
  ];
  return (
    <div className="modal-overlay" style={{ placeItems: 'stretch end' }} onClick={onClose}>
      <div className="modal" style={{ width: 'min(72vw, 1080px)', minWidth: 720, maxHeight: '100vh', height: '100vh', borderRadius: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="inventory" size={17} style={{ color: 'var(--purple)' }} />
              <span style={{ fontSize: 17, fontWeight: 800 }}>{wh.warehouseCode}</span>
              <StatusChip status={wh.status || 'connected'} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{wh.name || wh.facilityName || 'Warehouse'}{wh.region ? ` · ${wh.region}` : ''}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="modal-body" style={{ display: 'grid', gap: 14 }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
            {tabs.map(([id, label, count]) => (
              <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                {label}{count != null ? <Chip dot={false}>{count}</Chip> : null}
              </button>
            ))}
          </div>
          {tab === 'replenishment' ? (
            <ReplenishmentTab warehouseCode={wh.warehouseCode} />
          ) : loading ? (
            <Loading rows={6} />
          ) : !detail ? (
            <EmptyState>Warehouse detail is unavailable.</EmptyState>
          ) : tab === 'overview' ? (
            <Overview detail={detail} />
          ) : tab === 'inventory' ? (
            <InventoryRows detail={detail} />
          ) : tab === 'orders' ? (
            <OrdersRows detail={detail} />
          ) : tab === 'asns' ? (
            <AsnRows detail={detail} />
          ) : tab === 'events' ? (
            <EventRows detail={detail} />
          ) : tab === 'activity' ? (
            <ActivityRows detail={detail} />
          ) : (
            <CortexRows detail={detail} />
          )}
        </div>
      </div>
    </div>
  );
};

const Overview = ({ detail }: { detail: OmsWarehouseDetail }) => {
  const wh = detail.warehouse;
  return (
    <>
      <div className="stat-grid cols-4">
        <div className="stat"><div className="stat-label">Inventory units</div><div className="stat-value">{fmt.num(wh.inventoryUnits)}</div></div>
        <div className="stat"><div className="stat-label">Active SKUs</div><div className="stat-value">{fmt.num(wh.activeSkus)}</div></div>
        <div className="stat"><div className="stat-label">Orders</div><div className="stat-value">{fmt.num(wh.orders)}</div></div>
        <div className="stat ai"><div className="stat-label">WMS events</div><div className="stat-value">{fmt.num(detail.wmsEvents.length)}</div></div>
      </div>
      <div className="row-2">
        <Panel title="Warehouse identity">
          <Kv label="Code" value={wh.warehouseCode} />
          <Kv label="Facility" value={wh.facilityName || wh.facilityCode || '—'} />
          <Kv label="Region" value={wh.region || '—'} />
          <Kv label="Connected" value={fmtDate(wh.connectedAt)} />
        </Panel>
        <Panel title="Operational state">
          <Kv label="Last WMS event" value={wh.lastWmsEventType ? String(wh.lastWmsEventType).replace(/_/g, ' ') : 'Waiting for WMS'} />
          <Kv label="Last event date" value={fmtDate(wh.lastWmsEventAt || undefined)} />
          <Kv label="Ledger activity" value={String(wh.activityCount || detail.ledger.length)} />
          <Kv label="Cortex readiness" value={String(detail.cortex?.readiness || 'pending').replace(/_/g, ' ')} />
        </Panel>
      </div>
    </>
  );
};

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="card">
    <div className="card-header"><div className="card-title">{title}</div></div>
    <div className="card-body" style={{ display: 'grid', gap: 10 }}>{children}</div>
  </div>
);

// Replenishment tuning (P3): the warehouse-wide knobs the WMS forward-pick replenishment
// engine consumes — lead time, demand window, sizing buffer, per-sweep cap, and the TIME
// WINDOWS during which replenishment may run (warehouse-local; empty = anytime). Stored
// canonically in the WMS; read/written here via the OMS backend proxy → WMS internal API.
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ReplenishmentTab = ({ warehouseCode }: { warehouseCode: string }) => {
  const [tuning, setTuning] = useState<ReplenishmentTuning | null>(null);
  const [leadTimeDays, setLeadTimeDays] = useState<string>('');
  const [windowDays, setWindowDays] = useState<string>('');
  const [safetyBufferDays, setSafetyBufferDays] = useState<string>('');
  const [maxTasksPerSweep, setMaxTasksPerSweep] = useState<string>('');
  const [windows, setWindows] = useState<ReplenishmentWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [quiet, setQuiet] = useState<string | null>(null);
  const [quietLoading, setQuietLoading] = useState(false);

  const applyTuning = (t: ReplenishmentTuning) => {
    setTuning(t);
    setLeadTimeDays(String(t.leadTimeDays));
    setWindowDays(String(t.demandTrailingWindowDays));
    setSafetyBufferDays(String(t.safetyBufferDays ?? 1));
    setMaxTasksPerSweep(String(t.maxTasksPerSweep ?? 50));
    setWindows(Array.isArray(t.windows) ? t.windows.map((w) => ({ ...w, days: w.days ? [...w.days] : undefined })) : []);
  };

  const load = () => {
    setLoading(true);
    setErr(null);
    setSaved(false);
    fetchReplenishmentTuning(warehouseCode)
      .then(applyTuning)
      .catch((e) => setErr(e.message || 'Failed to load replenishment tuning'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [warehouseCode]);

  const addWindow = () => { setWindows((w) => [...w, { start: '06:00', end: '10:00' }]); setSaved(false); };
  const removeWindow = (idx: number) => { setWindows((w) => w.filter((_, i) => i !== idx)); setSaved(false); };
  const setWindowField = (idx: number, field: 'start' | 'end', val: string) => {
    setWindows((w) => w.map((win, i) => (i === idx ? { ...win, [field]: val } : win))); setSaved(false);
  };
  const toggleDay = (idx: number, day: number) => {
    setWindows((w) => w.map((win, i) => {
      if (i !== idx) return win;
      const days = new Set(win.days || []);
      if (days.has(day)) days.delete(day); else days.add(day);
      const arr = Array.from(days).sort((a, b) => a - b);
      return { ...win, days: arr.length ? arr : undefined };
    }));
    setSaved(false);
  };

  const save = () => {
    setSaving(true);
    setErr(null);
    setSaved(false);
    updateReplenishmentTuning(warehouseCode, {
      leadTimeDays: Number(leadTimeDays),
      demandTrailingWindowDays: Number(windowDays),
      safetyBufferDays: Number(safetyBufferDays),
      maxTasksPerSweep: Number(maxTasksPerSweep),
      windows,
    })
      .then((t) => { applyTuning(t); setSaved(true); })
      .catch((e) => setErr(e.message || 'Failed to save replenishment tuning'))
      .finally(() => setSaving(false));
  };

  const suggestQuiet = () => {
    setQuietLoading(true);
    setQuiet(null);
    fetchReplenishmentQuietTimes(warehouseCode)
      .then((r) => {
        if (r.suggestedWindows?.length) {
          // Adopt the suggested windows into the editable list (operator still Saves).
          setWindows(r.suggestedWindows.map((w) => ({ start: w.start, end: w.end })));
          setSaved(false);
          setQuiet(`Suggested ${r.suggestedWindows.length} quiet window(s) from ${r.sampleSize} pick/pack events (${r.timezone}). Review and Save to apply.`);
        } else {
          setQuiet(r.note || 'No activity yet to infer quiet times.');
        }
      })
      .catch((e) => setQuiet(e.message || 'Quiet-time suggestion unavailable'))
      .finally(() => setQuietLoading(false));
  };

  if (loading) return <Loading rows={5} />;
  if (err && !tuning) return <ErrorState message={err} onRetry={load} />;

  return (
    <div className="row-2">
      <Panel title="Replenishment tuning">
        <p className="muted" style={{ fontSize: 12, marginTop: -2 }}>
          Controls the WMS forward-pick replenishment engine for {warehouseCode}. Refill tasks
          trigger when a pick face would run dry within the lead time, based on demand over the
          trailing window.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 12.5 }}>
            <span className="muted">Lead time (days)</span>
            <input type="number" min={0} step={0.25} value={leadTimeDays} onChange={(e) => { setLeadTimeDays(e.target.value); setSaved(false); }} className="input" />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12.5 }}>
            <span className="muted">Demand window (days)</span>
            <input type="number" min={1} step={1} value={windowDays} onChange={(e) => { setWindowDays(e.target.value); setSaved(false); }} className="input" />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12.5 }}>
            <span className="muted">Sizing buffer (days)</span>
            <input type="number" min={0} step={0.25} value={safetyBufferDays} onChange={(e) => { setSafetyBufferDays(e.target.value); setSaved(false); }} className="input" />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12.5 }}>
            <span className="muted">Max tasks / sweep</span>
            <input type="number" min={0} step={1} value={maxTasksPerSweep} onChange={(e) => { setMaxTasksPerSweep(e.target.value); setSaved(false); }} className="input" />
          </label>
        </div>

        <div style={{ borderTop: '1px solid var(--border, #eee)', marginTop: 8, paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>Replenishment windows</span>
            <span className="muted" style={{ fontSize: 11 }}>{windows.length === 0 ? 'Empty = run anytime' : 'Warehouse-local time'}</span>
            <div style={{ flex: 1 }} />
            <button className="btn ghost sm" onClick={addWindow}>+ Window</button>
          </div>
          {windows.map((w, idx) => (
            <div key={idx} style={{ display: 'grid', gap: 4, padding: '8px 0', borderBottom: '1px dashed var(--border, #eee)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <input type="time" value={w.start} onChange={(e) => setWindowField(idx, 'start', e.target.value)} className="input" style={{ width: 110 }} />
                <span className="muted">to</span>
                <input type="time" value={w.end} onChange={(e) => setWindowField(idx, 'end', e.target.value)} className="input" style={{ width: 110 }} />
                <div style={{ flex: 1 }} />
                <button className="btn ghost sm" onClick={() => removeWindow(idx)}>Remove</button>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {DAY_LABELS.map((lbl, d) => {
                  const on = !w.days || w.days.includes(d);
                  const explicit = !!w.days;
                  return (
                    <button
                      key={d}
                      className={`btn sm ${explicit && on ? 'primary' : 'ghost'}`}
                      style={{ opacity: explicit ? 1 : 0.6, padding: '2px 8px', fontSize: 11 }}
                      title={w.days ? '' : 'All days (click to restrict)'}
                      onClick={() => toggleDay(idx, d)}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {windows.some((w) => w.start > w.end) && (
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>A window where start &gt; end crosses midnight (e.g. 22:00 → 02:00).</div>
          )}
        </div>

        {err ? <div style={{ color: 'var(--danger, #c0392b)', fontSize: 12 }}>{err}</div> : null}
        {saved ? <div style={{ color: 'var(--good, #2e7d32)', fontSize: 12 }}>Saved.</div> : null}
        {quiet ? <div className="muted" style={{ fontSize: 11.5 }}>{quiet}</div> : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save tuning'}</button>
          <button className="btn ghost" disabled={saving} onClick={load}>Reset</button>
          <button className="btn ghost" disabled={quietLoading} onClick={suggestQuiet}>{quietLoading ? 'Analyzing…' : 'Suggest quiet windows'}</button>
        </div>
      </Panel>
      <Panel title="How it's used">
        <Kv label="Lead time" value={tuning ? `${tuning.leadTimeDays} day(s)` : '—'} />
        <Kv label="Demand window" value={tuning ? `${tuning.demandTrailingWindowDays} day(s)` : '—'} />
        <Kv label="Sizing buffer" value={tuning ? `${tuning.safetyBufferDays} day(s)` : '—'} />
        <Kv label="Max tasks / sweep" value={tuning ? String(tuning.maxTasksPerSweep) : '—'} />
        <Kv label="Windows" value={windows.length ? `${windows.length} configured` : 'Anytime'} />
        <p className="muted" style={{ fontSize: 11.5 }}>
          Reorder point ≈ SKU velocity × lead time (never below the configured pick-face minimum).
          The sizing buffer adds cover to the fast-mover pick-face recommendation. Windows limit
          when refill tasks are created so replenishment doesn&apos;t clash with peak picking.
        </p>
      </Panel>
    </div>
  );
};

const Kv = ({ label, value }: { label: string; value?: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
    <span className="muted">{label}</span>
    <span style={{ fontWeight: 700, textAlign: 'right' }}>{value || '—'}</span>
  </div>
);

const InventoryRows = ({ detail }: { detail: OmsWarehouseDetail }) => (
  <SimpleTable empty="No SKU inventory snapshots for this warehouse." headers={['SKU', 'Product', 'Available', 'Inbound', 'Orders', 'Receiving', 'Updated']}>
    {detail.inventory.map((row) => (
      <tr key={row.id}>
        <td className="mono strong">{row.sku}</td>
        <td>{row.title || row.sku}</td>
        <td className="num mono strong">{fmt.num(row.available)}</td>
        <td className="num mono">{fmt.num(row.inbound)}</td>
        <td className="num mono">{fmt.num(row.orders)}</td>
        <td className="num mono">{fmt.num(row.receiving)}</td>
        <td className="mono muted">{fmtDate(row.updatedAt)}</td>
      </tr>
    ))}
  </SimpleTable>
);

const OrdersRows = ({ detail }: { detail: OmsWarehouseDetail }) => (
  <SimpleTable empty="No orders tied to this warehouse yet." headers={['Order', 'Customer', 'Channel', 'Status', 'Total', 'Placed']}>
    {detail.orders.map((row) => (
      <tr key={row.id}>
        <td className="mono strong">{row.publicId || row.orderNumber || row.id}</td>
        <td>{row.customer || '—'}</td>
        <td>{row.channel || '—'}</td>
        <td><StatusChip status={row.status || 'open'} /></td>
        <td className="num mono">{fmt.money(row.total || 0)}</td>
        <td className="mono muted">{fmtDate(row.placedAt || row.createdAt)}</td>
      </tr>
    ))}
  </SimpleTable>
);

const AsnRows = ({ detail }: { detail: OmsWarehouseDetail }) => (
  <SimpleTable empty="No ASNs or shipment plans tied to this warehouse yet." headers={['ASN / Plan', 'Title', 'Status', 'Units', 'Updated']}>
    {[...detail.asns, ...detail.shipmentPlans].map((row: any) => (
      <tr key={`${row.publicId || row.id}`}>
        <td className="mono strong">{row.publicId || row.asnNumber || row.id}</td>
        <td>{row.shipmentTitle || row.title || 'Inbound shipment'}</td>
        <td><StatusChip status={row.status || 'created'} /></td>
        <td className="num mono">{fmt.num(row.units || 0)}</td>
        <td className="mono muted">{fmtDate(row.updatedAt || row.estimatedArrivalDate)}</td>
      </tr>
    ))}
  </SimpleTable>
);

const EventRows = ({ detail }: { detail: OmsWarehouseDetail }) => (
  <SimpleTable empty="No WMS events received for this warehouse yet." headers={['Event', 'Entity', 'Status', 'Received']}>
    {detail.wmsEvents.map((row) => (
      <tr key={row.id}>
        <td className="strong">{String(row.eventType || 'wms_event').replace(/_/g, ' ')}</td>
        <td className="mono muted">{[row.entityType, row.entityId].filter(Boolean).join(' · ') || '—'}</td>
        <td><StatusChip status={row.status || 'accepted'} /></td>
        <td className="mono muted">{fmtDate(row.receivedAt)}</td>
      </tr>
    ))}
  </SimpleTable>
);

const ActivityRows = ({ detail }: { detail: OmsWarehouseDetail }) => (
  <SimpleTable empty="No ledger activity tied to this warehouse yet." headers={['Event', 'Source', 'Summary', 'Created']}>
    {detail.ledger.map((row) => (
      <tr key={row.id}>
        <td>{String(row.event_type || 'activity').replace(/_/g, ' ')}</td>
        <td>{row.source_system || 'oms'}</td>
        <td>{row.summary || '—'}</td>
        <td className="mono muted">{fmtDate(row.createdAt)}</td>
      </tr>
    ))}
  </SimpleTable>
);

const CortexRows = ({ detail }: { detail: OmsWarehouseDetail }) => (
  <div className="row-2">
    <Panel title="Signals">
      {(detail.cortex.signals || []).map((signal) => <Kv key={signal} label="Signal" value={signal} />)}
    </Panel>
    <Panel title="Recommendations">
      {(detail.cortex.recommendations || []).map((rec) => <Kv key={rec} label="Cortex" value={rec} />)}
    </Panel>
  </div>
);

const SimpleTable = ({ headers, empty, children }: { headers: string[]; empty: string; children: React.ReactNode }) => {
  const count = React.Children.count(children);
  return count === 0 ? (
    <EmptyState>{empty}</EmptyState>
  ) : (
    <div className="table-wrap">
      <table className="data">
        <thead><tr>{headers.map((h) => <th key={h} className={['Available', 'Inbound', 'Orders', 'Units', 'Total', 'Receiving'].includes(h) ? 'num' : undefined}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
};
