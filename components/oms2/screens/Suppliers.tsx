import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, StatusChip, fmt, Loading, ErrorState, EmptyState } from '../ui';
import {
  fetchOmsSupplierActivity,
  fetchOmsSuppliers,
  fetchOmsSkus,
  OmsSupplier,
  OmsSku,
  SupplierActivityRecord,
  SupplierActivityResponse,
} from '../../../lib/oms';
import { num, docTone } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';
import type { SelSku } from '../SelectionBar';
import { NewSupplierModal } from '../modals/NewSupplierModal';
import { OptimizationImpact } from '../OptimizationImpact';

const initials = (n: string) =>
  (n || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

const DetailKv2 = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <div>
    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 15, fontWeight: 700, color: tone ? `var(--${tone}-text)` : 'var(--text)', marginTop: 2 }}>{value}</div>
  </div>
);

const pickupVehicleLabels: Record<string, string> = {
  sprinter_van: 'Sprinter / cargo van',
  box_truck_16: '16 ft box truck',
  box_truck_24: '24 ft box truck',
  box_truck_26: '26 ft box truck',
  '53_dry_van': '53 ft dry van',
  flatbed: 'Flatbed',
  container: 'Container drayage',
  other: 'Confirm before booking',
};

const equipmentLabels: Record<string, string> = {
  forklift: 'Forklift',
  pallet_jack: 'Pallet jack',
  dock_plate: 'Dock plate',
  liftgate: 'Liftgate',
  straps: 'Straps/load bars',
  appointment: 'Appointment',
  hazmat_docs: 'Hazmat docs',
  temp_control: 'Temperature control',
};

const recordTone: Record<string, 'default' | 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'outline'> = {
  sku: 'blue',
  shipment_plan: 'purple',
  asn: 'green',
  bol: 'amber',
  label: 'blue',
  order: 'purple',
  invoice: 'amber',
  activity: 'default',
  ledger: 'outline',
};

const recordLabel: Record<string, string> = {
  sku: 'SKU',
  shipment_plan: 'Shipment',
  asn: 'ASN',
  bol: 'BOL',
  label: 'Label',
  order: 'Order',
  invoice: 'Invoice',
  activity: 'Activity',
  ledger: 'Ledger',
};

const dateText = (value?: string) => {
  if (!value) return 'No date';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const boolText = (value: boolean | null | undefined) => (value == null ? 'Unknown' : value ? 'Yes' : 'No');

const InfoTile = ({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }) => (
  <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)', borderRadius: 10, padding: 12, minHeight: 86 }}>
    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 750, color: tone ? `var(--${tone}-text)` : 'var(--text)', marginTop: 5 }}>{value}</div>
    {sub ? <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>{sub}</div> : null}
  </div>
);

const readiness = (supplier: OmsSupplier, activity?: SupplierActivityResponse | null) => {
  const profile = supplier.pickupProfile || {};
  const missing = [
    !profile.hoursOfOperation ? 'hours' : null,
    !profile.maxVehicleSize ? 'vehicle limit' : null,
    profile.loadingDock == null ? 'dock answer' : null,
  ].filter(Boolean);
  if (missing.length) return { tone: 'amber', label: 'Needs pickup profile', detail: `Missing ${missing.join(', ')}` };
  if ((activity?.summary.shipmentPlans || 0) > 0) return { tone: 'green', label: 'Cortex-ready', detail: 'Pickup rules and shipment history are available.' };
  return { tone: 'blue', label: 'Profile ready', detail: 'Ready for first Cortex pickup plan.' };
};

export const Suppliers = ({
  onNavigate,
  onCreateShipmentWithSupplier,
  onNewSupplier,
  onImportCsv,
}: ScreenProps) => {
  const [suppliers, setSuppliers] = useState<OmsSupplier[]>([]);
  const [skus, setSkus] = useState<OmsSku[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr(null);
    Promise.all([fetchOmsSuppliers(), fetchOmsSkus().catch(() => ({ skus: [], total: 0 }))])
      .then(([d, s]) => {
        const nextSuppliers = d.suppliers || [];
        setSuppliers(nextSuppliers);
        setSkus(s.skus || []);
        setSelected((current) => (current && nextSuppliers.some((supplier) => supplier.id === current) ? current : nextSuppliers[0]?.id || null));
      })
      .catch((e) => setErr(e.message || 'Failed to load suppliers'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      [s.name, s.email, s.phone, s.region, s.country, s.pickupProfile?.hoursOfOperation]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [query, suppliers]);

  const supplier = suppliers.find((s) => s.id === selected) || filtered[0] || suppliers[0];

  if (err) return <div className="page fade-in"><div className="card"><ErrorState message={err} onRetry={load} /></div></div>;
  if (loading) return <div className="page fade-in"><div className="card"><Loading rows={6} /></div></div>;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Suppliers</h1>
          <p className="page-subtitle">Supplier pickup intelligence, order demand, shipment documents, ASNs, labels, and Cortex truck-booking readiness.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => onImportCsv?.('suppliers')}>
            <Icon name="download" size={13} style={{ transform: 'rotate(180deg)' }} /> Import CSV
          </button>
          <button className="btn"><Icon name="download" size={13} /> Export</button>
          <button className="btn primary" onClick={onNewSupplier}><Icon name="plus" size={13} /> Add supplier</button>
        </div>
      </div>

      <OptimizationImpact screen="suppliers" title="Supplier pickup and replenishment optimization" onNavigate={onNavigate} />

      {suppliers.length === 0 ? (
        <div className="card">
          <EmptyState>Add a supplier manually or by CSV before creating inbound shipment plans.</EmptyState>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: 16, alignItems: 'start' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                Suppliers <Chip dot={false}>{suppliers.length}</Chip>
              </div>
              <button className="btn ghost sm"><Icon name="filter" size={12} /></button>
            </div>
            <div style={{ padding: '0 14px 12px' }}>
              <div style={{ position: 'relative' }}>
                <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-tertiary)' }} />
                <input
                  className="input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search supplier, region, contact..."
                  style={{ width: '100%', paddingLeft: 30 }}
                />
              </div>
            </div>
            <div>
              {filtered.length === 0 ? (
                <EmptyState>No suppliers match that search.</EmptyState>
              ) : filtered.map((s) => {
                const profile = s.pickupProfile || {};
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: selected === s.id ? 'var(--accent-soft)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent), #5b3bcc)', color: 'white', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700 }}>
                        {initials(s.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                          <Chip tone={profile.loadingDock === true ? 'green' : profile.loadingDock === false ? 'amber' : 'default'} dot={false}>
                            {profile.loadingDock === true ? 'Dock' : profile.loadingDock === false ? 'No dock' : 'Profile'}
                          </Chip>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {[s.region, profile.maxVehicleSize ? pickupVehicleLabels[profile.maxVehicleSize] || profile.maxVehicleSize : null, s.skuCount ? `${s.skuCount} SKUs` : null].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {supplier && (
            <SupplierDetail
              supplier={supplier}
              skus={skus}
              onNavigate={onNavigate}
              onRefresh={load}
              onCreateShipment={() => {
                const sel: SelSku[] = skus
                  .filter((sk) => sk.supplierId === supplier.id || (supplier.skus || []).includes(sk.sku))
                  .slice(0, 3)
                  .map((sk) => ({ id: sk.id, name: sk.title || sk.sku }));
                onCreateShipmentWithSupplier && onCreateShipmentWithSupplier(supplier.id, sel);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

const SupplierDetail = ({
  supplier,
  skus,
  onNavigate,
  onRefresh,
  onCreateShipment,
}: {
  supplier: OmsSupplier;
  skus: OmsSku[];
  onNavigate: ScreenProps['onNavigate'];
  onRefresh: () => void;
  onCreateShipment: () => void;
}) => {
  const [activity, setActivity] = useState<SupplierActivityResponse | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityErr, setActivityErr] = useState<string | null>(null);
  const [activeRecord, setActiveRecord] = useState<SupplierActivityRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setActivityLoading(true);
    setActivityErr(null);
    setActiveRecord(null);
    fetchOmsSupplierActivity(supplier.id)
      .then((data) => {
        if (cancelled) return;
        setActivity(data);
        setActiveRecord(data.records?.[0] || null);
      })
      .catch((e) => {
        if (!cancelled) setActivityErr(e.message || 'Failed to load supplier activity');
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supplier.id]);

  const supplierSkus = skus.filter((s) => s.supplierId === supplier.id || (supplier.skus || []).includes(s.sku));
  const profile = supplier.pickupProfile || {};
  const ready = readiness(supplier, activity);
  const equipment = profile.equipmentRequired || [];
  const summary = activity?.summary;

  const openRecordTarget = (record?: SupplierActivityRecord | null) => {
    if (!record?.target) return;
    if (record.target === 'sku-detail') onNavigate('sku-detail', record.targetId || record.id);
    else onNavigate(record.target, record.targetId || record.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent), #5b3bcc)', color: 'white', display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 700 }}>
              {initials(supplier.name)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{supplier.name}</span>
                <Chip tone={ready.tone as any} dot={false}>{ready.label}</Chip>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {[supplier.region, supplier.country].filter(Boolean).join(', ') || 'Supplier profile'}
                {supplier.contact ? ` · ${supplier.contact}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn ghost" onClick={() => setEditOpen(true)}><Icon name="settings" size={13} /> Edit</button>
            <button className="btn"><Icon name="ledger" size={13} /> Terms</button>
            <button className="btn primary" onClick={onCreateShipment}>
              <Icon name="shipments" size={13} /> Create shipment plan
            </button>
          </div>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, paddingTop: 16 }}>
          <InfoTile label="Pickup readiness" value={ready.label} sub={ready.detail} tone={ready.tone} />
          <InfoTile label="Vehicle limit" value={profile.maxVehicleSize ? pickupVehicleLabels[profile.maxVehicleSize] || profile.maxVehicleSize : 'Unknown'} sub={`Loading dock: ${boolText(profile.loadingDock)}`} />
          <InfoTile label="Supplier units" value={fmt.num(summary?.shipmentUnits || 0)} sub={`${fmt.num(summary?.orderUnits || 0)} order units linked`} />
          <InfoTile label="Documents" value={fmt.num(summary?.documents || 0)} sub={`${fmt.num(summary?.asns || 0)} ASNs · ${fmt.num(summary?.shipmentPlans || 0)} plans`} />
        </div>
      </div>

      <div className="row-2-eq">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Supplier summary</div>
            <button className="btn ghost sm" onClick={() => setEditOpen(true)}>Edit profile</button>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            <DetailKv2 label="Email" value={supplier.email || '—'} />
            <DetailKv2 label="Phone" value={supplier.phone || '—'} />
            <DetailKv2 label="Hours" value={profile.hoursOfOperation || '—'} />
            <DetailKv2 label="Last activity" value={dateText(summary?.lastActivityAt || supplier.updatedAt)} />
            <DetailKv2 label="SKUs linked" value={summary?.skus ?? supplierSkus.length} />
            <DetailKv2 label="Invoice amount" value={summary?.invoiceAmount != null ? fmt.money(summary.invoiceAmount, { compact: true }) : '—'} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Cortex pickup rules</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <InfoTile label="Dock" value={boolText(profile.loadingDock)} />
              <InfoTile label="Appointment" value={profile.appointmentRequired ? 'Required' : 'Not required'} sub={profile.dockAppointmentLeadTimeHours ? `${profile.dockAppointmentLeadTimeHours}h lead time` : 'No lead time set'} />
              <InfoTile label="Liftgate" value={profile.liftgateRequired ? 'Required' : 'Not required'} sub={profile.insidePickup ? 'Inside pickup' : 'Standard pickup'} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, marginBottom: 8 }}>Equipment</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {equipment.length ? equipment.map((e) => <Chip key={e} tone="blue" dot={false}>{equipmentLabels[e] || e}</Chip>) : <Chip dot={false}>No equipment rules</Chip>}
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
              {profile.pickupInstructions || 'No pickup instructions yet. Add gate process, staging location, contact sequence, and truck restrictions so Cortex can book pickups correctly.'}
            </div>
          </div>
        </div>
      </div>

      <div className="row-2-eq">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              SKUs supplied <Chip dot={false}>{supplierSkus.length}</Chip>
            </div>
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th className="num">Available</th>
                <th className="num">DOC</th>
              </tr>
            </thead>
            <tbody>
              {supplierSkus.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty">No SKUs mapped to this supplier yet</td>
                </tr>
              ) : (
                supplierSkus.slice(0, 8).map((s) => (
                  <tr key={s.id} className="clickable" onClick={() => onNavigate('sku-detail', s.id)}>
                    <td className="mono strong">{s.sku}</td>
                    <td>{s.title || '—'}</td>
                    <td className="num mono">{num(s.available).toLocaleString()}</td>
                    <td className="num mono" style={{ color: `var(--${docTone(num(s.daysOfCover))}-text)` }}>
                      {Math.round(num(s.daysOfCover))}d
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Selected record summary</div>
            {activeRecord?.target ? <button className="btn ghost sm" onClick={() => openRecordTarget(activeRecord)}>Open</button> : null}
          </div>
          <div className="card-body">
            {activeRecord ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <Chip tone={recordTone[activeRecord.type] || 'default'} dot={false}>{recordLabel[activeRecord.type] || activeRecord.type}</Chip>
                    <div style={{ fontSize: 16, fontWeight: 750, marginTop: 8 }}>{activeRecord.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{activeRecord.subtitle || dateText(activeRecord.date)}</div>
                  </div>
                  {activeRecord.status ? <StatusChip status={activeRecord.status} /> : null}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <InfoTile label="Units" value={fmt.num(activeRecord.units || 0)} />
                  <InfoTile label="Amount" value={activeRecord.amount != null ? fmt.money(activeRecord.amount, { compact: true }) : '—'} />
                  <InfoTile label="Date" value={dateText(activeRecord.date)} />
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {activeRecord.summary || 'This record is tied to the selected supplier and can be used as supporting context for planning, receiving, or disputes.'}
                </div>
              </div>
            ) : (
              <EmptyState>Select a supplier activity record to review the linked summary.</EmptyState>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Supplier activity</div>
          {activityLoading ? <Chip dot={false}>Loading</Chip> : <Chip dot={false}>{activity?.records.length || 0} records</Chip>}
        </div>
        <div className="card-body">
          {activityErr ? (
            <ErrorState message={activityErr} />
          ) : activityLoading ? (
            <Loading rows={4} />
          ) : !activity?.records.length ? (
            <EmptyState>Shipment plans, ASNs, labels, BOLs, orders, and billing events will appear here once linked to this supplier.</EmptyState>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {activity.records.slice(0, 24).map((record) => (
                <button
                  key={`${record.type}-${record.id}`}
                  onClick={() => setActiveRecord(record)}
                  onDoubleClick={() => openRecordTarget(record)}
                  style={{
                    textAlign: 'left',
                    border: `1px solid ${activeRecord?.id === record.id && activeRecord?.type === record.type ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    background: activeRecord?.id === record.id && activeRecord?.type === record.type ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                    borderRadius: 10,
                    padding: 12,
                    cursor: 'pointer',
                    minHeight: 104,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                    <Chip tone={recordTone[record.type] || 'default'} dot={false}>{recordLabel[record.type] || record.type}</Chip>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{dateText(record.date)}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 750, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.subtitle || record.summary || 'Supplier related record'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                    {record.status ? <StatusChip status={record.status} /> : null}
                    <span>{record.units != null ? `${fmt.num(record.units)} units` : record.amount != null ? fmt.money(record.amount, { compact: true }) : 'Linked'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {editOpen && (
        <NewSupplierModal
          supplier={activity?.supplier || supplier}
          onClose={() => setEditOpen(false)}
          onSuccess={() => {
            setEditOpen(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
