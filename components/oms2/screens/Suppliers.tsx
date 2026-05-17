import React, { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { Chip, StatusChip, fmt, Loading, ErrorState, EmptyState } from '../ui';
import { fetchOmsSuppliers, fetchOmsSkus, OmsSupplier, OmsSku } from '../../../lib/oms';
import { num, docTone } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';
import type { SelSku } from '../SelectionBar';

const initials = (n: string) =>
  (n || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

const DetailKv2 = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <div>
    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 15, fontWeight: 700, color: tone ? `var(--${tone}-text)` : 'var(--text)', marginTop: 2 }}>{value}</div>
  </div>
);

export const Suppliers = ({ onCreateShipmentWithSupplier, onNewSupplier }: ScreenProps) => {
  const [suppliers, setSuppliers] = useState<OmsSupplier[]>([]);
  const [skus, setSkus] = useState<OmsSku[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr(null);
    Promise.all([fetchOmsSuppliers(), fetchOmsSkus().catch(() => ({ skus: [], total: 0 }))])
      .then(([d, s]) => {
        setSuppliers(d.suppliers || []);
        setSkus(s.skus || []);
        if (d.suppliers?.length) setSelected(d.suppliers[0].id);
      })
      .catch((e) => setErr(e.message || 'Failed to load suppliers'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const supplier = suppliers.find((s) => s.id === selected) || suppliers[0];

  if (err) return <div className="page fade-in"><div className="card"><ErrorState message={err} onRetry={load} /></div></div>;
  if (loading) return <div className="page fade-in"><div className="card"><Loading rows={6} /></div></div>;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Suppliers</h1>
          <p className="page-subtitle">Vendor relationships, lead times, terms, quality, and shipment plans. AI flags terms negotiation opportunities.</p>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="download" size={13} /> Export</button>
          <button className="btn primary" onClick={onNewSupplier}><Icon name="plus" size={13} /> Add supplier</button>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <div className="card"><EmptyState>No suppliers connected yet.</EmptyState></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 360px) 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                Suppliers <Chip dot={false}>{suppliers.length}</Chip>
              </div>
              <button className="btn ghost sm"><Icon name="filter" size={12} /></button>
            </div>
            <div>
              {suppliers.map((s) => (
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</span>
                        {s.relationship && (
                          <Chip tone={s.relationship === 'Strategic' ? 'purple' : s.relationship === 'Preferred' ? 'blue' : 'default'} dot={false}>
                            {s.relationship}
                          </Chip>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {[s.region, s.leadTime ? `${s.leadTime}d lead` : null, s.skuCount ? `${s.skuCount} SKUs` : null].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {supplier && (
            <SupplierDetail
              supplier={supplier}
              skus={skus}
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
  onCreateShipment,
}: {
  supplier: OmsSupplier;
  skus: OmsSku[];
  onCreateShipment: () => void;
}) => {
  const supplierSkus = skus.filter((s) => s.supplierId === supplier.id || (supplier.skus || []).includes(s.sku));
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
                {supplier.rating != null && <Chip tone="purple" dot={false}>★ {supplier.rating}</Chip>}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {[supplier.region, supplier.country].filter(Boolean).join(', ')}
                {supplier.contact ? ` · ${supplier.contact}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn ghost"><Icon name="support" size={13} /> Email</button>
            <button className="btn"><Icon name="ledger" size={13} /> View terms</button>
            <button className="btn primary" onClick={onCreateShipment}>
              <Icon name="shipments" size={13} /> Create shipment plan
            </button>
          </div>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, paddingTop: 16 }}>
          <DetailKv2 label="Lead time" value={supplier.leadTime != null ? `${supplier.leadTime} days` : '—'} />
          <DetailKv2 label="On-time rate" value={supplier.onTime != null ? `${Math.round(num(supplier.onTime) * 100)}%` : '—'} tone={num(supplier.onTime) > 0.92 ? 'green' : 'amber'} />
          <DetailKv2 label="Quality pass" value={supplier.qualityPass != null ? `${(num(supplier.qualityPass) * 100).toFixed(1)}%` : '—'} />
          <DetailKv2 label="Terms" value={supplier.paymentTerms || '—'} />
          <DetailKv2 label="Spend 90d" value={supplier.spend90d != null ? fmt.money(num(supplier.spend90d), { compact: true }) : '—'} />
          <DetailKv2 label="Spend YTD" value={supplier.spendYTD != null ? fmt.money(num(supplier.spendYTD), { compact: true }) : '—'} />
        </div>
      </div>

      {supplier.spendYTD != null && (
        <div className="card" style={{ background: 'linear-gradient(180deg, var(--purple-soft) 0%, var(--bg-elev) 60%)', border: '1px solid var(--purple-soft)' }}>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'center', padding: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--purple)', color: 'white', display: 'grid', placeItems: 'center' }}>
              <Icon name="sparkle" size={18} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>Negotiation opportunity — terms compression</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Based on YTD spend ({fmt.money(num(supplier.spendYTD), { compact: true })}), Cortex models a COGS reduction by moving{' '}
                {supplier.paymentTerms || 'current terms'} → Net 60 + a 2/10 prompt-pay discount.
              </div>
            </div>
            <button className="btn primary">Draft email</button>
          </div>
        </div>
      )}

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
                  <tr key={s.id}>
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
            <div className="card-title">Shipment history</div>
          </div>
          <div className="card-body">
            <EmptyState>Per-supplier inbound history will appear here as ASNs are received.</EmptyState>
          </div>
        </div>
      </div>
    </div>
  );
};
