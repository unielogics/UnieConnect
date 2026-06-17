import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, EmptyState, ErrorState, fmt, Loading, StatusChip, useCloseOnOmsNavigation } from '../ui';
import {
  fetchWarehouseDetail,
  fetchWarehouseOverview,
  OmsWarehouseDetail,
  OmsWarehouseOverview,
} from '../../../lib/oms';
import { fmtDate, num } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';

type Tab = 'overview' | 'inventory' | 'orders' | 'asns' | 'events' | 'activity' | 'cortex';

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
          {loading ? (
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
