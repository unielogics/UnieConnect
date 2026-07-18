import React from 'react';
import { Icon } from './icons';
import { Modal, Chip, StatusChip, Loading } from './ui';
import type { OmsAsnDetail } from '../../lib/oms';
import { num } from '../../lib/oms-adapters';
import type { NavFn } from './UnieConnectApp';

const AsnStat = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 3 }}>{value}</div>
  </div>
);

export const AsnModal = ({
  asn,
  loading,
  onClose,
  onNavigate,
}: {
  asn: OmsAsnDetail | null;
  loading?: boolean;
  onClose: () => void;
  onNavigate: NavFn;
}) => {
  if (loading || !asn) {
    return (
      <Modal title="Loading ASN…" onClose={onClose} width={720}>
        <Loading rows={5} />
      </Modal>
    );
  }

  const items = Array.isArray((asn as any).items) ? ((asn as any).items as any[]) : [];
  const status = asn.status || 'created';

  return (
    <Modal
      title={`ASN ${asn.asnNumber || asn.publicId || asn.id}`}
      subtitle={`${asn.facilityName || asn.facilityCode || 'Warehouse'} · ${asn.shipmentTitle || 'Inbound shipment'}`}
      onClose={onClose}
      width={1040}
      footer={
        <>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
            <span className="mono">{asn.publicId || asn.id}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {asn.shipmentPlanId && (
              <button className="btn" onClick={() => { onNavigate('shipments'); onClose(); }}>
                <Icon name="shipments" size={13} /> View shipment
              </button>
            )}
            <button className="btn"><Icon name="refresh" size={13} /> Re-sync</button>
          </div>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16, padding: 14, background: 'var(--bg-sunken)', borderRadius: 10 }}>
        <AsnStat label="Units" value={num(asn.units)} />
        <AsnStat label="Line items" value={items.length || '—'} />
        <AsnStat label="Supplier" value={asn.supplierName || '—'} />
        <AsnStat label="ETA" value={asn.estimatedArrivalDate ? asn.estimatedArrivalDate.slice(0, 10) : '—'} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <StatusChip status={status} />
        {asn.shipmentStatus && <StatusChip status={asn.shipmentStatus} />}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {asn.supplierId && (
            <button className="btn sm" onClick={() => { onNavigate('suppliers'); onClose(); }}>View supplier →</button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Contents</div>
          <Chip dot={false}>{items.length} line items</Chip>
        </div>
        <div style={{ padding: 0 }}>
          {items.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12.5, color: 'var(--text-tertiary)' }}>No line items recorded for this ASN.</div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th className="num">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td className="mono strong">{it.sku || it.itemId || `Line ${i + 1}`}</td>
                    <td className="num mono">{num(it.quantity ?? it.units)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
};
