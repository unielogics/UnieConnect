import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons';
import { Modal, Chip } from './ui';
import type { SelSku } from './SelectionBar';
import { fetchOmsSuppliers, createShipmentDraft, confirmShipmentDraft, OmsSupplier } from '../../lib/oms';

type Cfg = Record<string, { unitsPerCarton: number; cartons: number; palletize: boolean }>;

const anyNum = (s: any, k: string, d: number) => {
  const v = s?.[k];
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : d;
};

const StepBar = ({ step }: { step: number }) => {
  const steps = ['Supplier', 'Logistics', 'Configure', 'Review'];
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 22 }}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const current = step === n;
        return (
          <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: done ? 'var(--green)' : current ? 'var(--accent)' : 'var(--bg-active)',
                color: done || current ? 'white' : 'var(--text-tertiary)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {done ? <Icon name="check" size={12} /> : n}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: current ? 'var(--text)' : 'var(--text-tertiary)' }}>{label}</span>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: done ? 'var(--green)' : 'var(--border)' }} />}
          </div>
        );
      })}
    </div>
  );
};

const YesNoCard = ({
  question,
  detail,
  value,
  setValue,
  yesNote,
  noNote,
}: {
  question: string;
  detail: string;
  value: boolean | null;
  setValue: (v: boolean) => void;
  yesNote: string;
  noNote: string;
}) => (
  <div style={{ marginBottom: 14, padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-elev)' }}>
    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{question}</div>
    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 10 }}>{detail}</div>
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={() => setValue(true)}
        style={{
          flex: 1,
          padding: '10px 14px',
          border: value === true ? '2px solid var(--green)' : '1px solid var(--border)',
          background: value === true ? 'var(--green-soft)' : 'var(--bg-elev)',
          borderRadius: 8,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
          {value === true && <Icon name="check" size={13} style={{ color: 'var(--green)' }} />}
          Yes
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{yesNote}</div>
      </button>
      <button
        onClick={() => setValue(false)}
        style={{
          flex: 1,
          padding: '10px 14px',
          border: value === false ? '2px solid var(--accent)' : '1px solid var(--border)',
          background: value === false ? 'var(--accent-soft)' : 'var(--bg-elev)',
          borderRadius: 8,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
          {value === false && <Icon name="check" size={13} style={{ color: 'var(--accent)' }} />}
          No
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{noNote}</div>
      </button>
    </div>
  </div>
);

const NumberInput = ({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <button onClick={() => onChange(Math.max(min, value - 1))} style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>−</button>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Math.min(max, Math.max(min, parseInt(e.target.value || '0', 10))))}
      style={{ width: 56, height: 22, padding: '0 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-elev)', fontSize: 12, textAlign: 'center', fontFamily: 'var(--mono)' }}
    />
    <button onClick={() => onChange(Math.min(max, value + 1))} style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>+</button>
  </div>
);

const SummaryStat2 = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <div>
    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 3, color: tone ? `var(--${tone}-text)` : 'var(--text)' }}>{value}</div>
  </div>
);

const ReviewCard = ({ title, children, tone }: { title: string; children: React.ReactNode; tone?: string }) => (
  <div
    style={{
      padding: 14,
      borderRadius: 10,
      background: tone === 'green' ? 'var(--green-soft)' : tone === 'purple' ? 'var(--purple-soft)' : 'var(--bg-sunken)',
      border: tone === 'green' ? '1px solid var(--green-soft)' : tone === 'purple' ? '1px solid var(--purple-soft)' : '1px solid var(--border-subtle)',
    }}
  >
    <div style={{ fontSize: 10.5, color: tone === 'purple' ? 'var(--purple-text)' : 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 6 }}>
      {title}
    </div>
    <div style={{ fontSize: 13 }}>{children}</div>
  </div>
);

export const ShipmentWizard = ({
  skus,
  forcedSupplierId,
  onNewSupplier,
  onClose,
  onComplete,
}: {
  skus: SelSku[];
  forcedSupplierId?: string | null;
  onNewSupplier?: () => void;
  onClose: () => void;
  onComplete: () => void;
}) => {
  const list = skus.length ? skus : [];
  const [step, setStep] = useState(1);
  const [suppliers, setSuppliers] = useState<OmsSupplier[]>([]);
  const [supplierId, setSupplierId] = useState<string | null>(forcedSupplierId || null);
  const [needsLTL, setNeedsLTL] = useState<boolean | null>(null);
  const [needsLabels, setNeedsLabels] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [config, setConfig] = useState<Cfg>(() =>
    list.reduce((acc, s) => ({ ...acc, [s.id]: { unitsPerCarton: 24, cartons: 20, palletize: true } }), {})
  );

  useEffect(() => {
    fetchOmsSuppliers()
      .then((d) => {
        setSuppliers(d.suppliers || []);
        if (!supplierId && d.suppliers?.length) {
          const match = d.suppliers.find((sp) => list.some((sk) => (sp.skus || []).includes(sk.id) || (sk as any).supplierId === sp.id));
          if (match) setSupplierId(match.id);
        }
      })
      .catch(() => {});
  }, []);

  const routedDestinations = useMemo(() => {
    const acc: Record<string, string> = {};
    list.forEach((s) => {
      acc[s.id] = (s as any).primaryWh || (s as any).primaryWarehouse || 'AUTO';
    });
    return acc;
  }, [list]);

  const destSummary = useMemo(() => {
    const groups: Record<string, number> = {};
    list.forEach((s) => {
      const d = routedDestinations[s.id];
      groups[d] = (groups[d] || 0) + (config[s.id]?.cartons || 0) * (config[s.id]?.unitsPerCarton || 0);
    });
    return Object.entries(groups).map(([wh, units]) => ({ wh, units }));
  }, [list, routedDestinations, config]);

  const totals = useMemo(() => {
    let units = 0;
    let cartons = 0;
    let weight = 0;
    let cube = 0;
    for (const sku of list) {
      const c = config[sku.id] || { unitsPerCarton: 24, cartons: 10, palletize: true };
      const u = c.cartons * c.unitsPerCarton;
      units += u;
      cartons += c.cartons;
      weight += u * anyNum(sku, 'palletWeightLbs', 0.5);
      cube += c.cartons * Math.max(0.3, anyNum(sku, 'palletCubeFt', 0.02) * c.unitsPerCarton);
    }
    const pallets = Math.ceil(cube / 50) || 1;
    const freightCost = needsLTL ? cube * 3.2 + 240 : cartons * 8.4;
    const labelCost = needsLabels ? cartons * 1.2 + 35 : 0;
    return {
      units,
      cartons,
      weight: weight.toFixed(0),
      cube: cube.toFixed(1),
      pallets,
      freightCost: freightCost.toFixed(0),
      labelCost: labelCost.toFixed(0),
      totalCost: (freightCost + labelCost).toFixed(0),
    };
  }, [config, needsLTL, needsLabels, list]);

  const supplier = suppliers.find((s) => s.id === supplierId);
  const supplierMatchCount = supplier ? list.filter((sk) => (supplier.skus || []).includes(sk.id) || (sk as any).supplierId === supplier.id).length : 0;
  const hasAnySupplierMatch = suppliers.some((sp) => list.some((sk) => (sp.skus || []).includes(sk.id) || (sk as any).supplierId === sp.id));
  const canAdvance = step === 1 ? !!supplierId : step === 2 ? needsLTL !== null && needsLabels !== null : true;

  const submit = async () => {
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const body = {
        supplierId,
        requiresBol: !!needsLTL,
        requiresLabels: !!needsLabels,
        selectedItems: list.map((s) => ({
          itemId: s.id,
          sku: (s as any).sku || s.name,
          unitsPerCarton: config[s.id].unitsPerCarton,
          cartons: config[s.id].cartons,
          palletize: config[s.id].palletize,
        })),
        packagePlan: { pallets: totals.pallets, totalUnits: totals.units, totalCartons: totals.cartons },
      };
      const { draft } = await createShipmentDraft(body);
      await confirmShipmentDraft(draft.id, body);
      onComplete();
    } catch (e: any) {
      setSubmitErr(e.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Create shipment plan"
      subtitle={`${list.length} SKU${list.length > 1 ? 's' : ''} · ${totals.units.toLocaleString()} units · AI-routed across ${destSummary.length} warehouse${destSummary.length > 1 ? 's' : ''}`}
      onClose={onClose}
      fullscreen
      chrome={
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Chip tone="purple" dot={false}>
            AI-routed
          </Chip>
        </div>
      }
      footer={
        <>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Step {step} of 4 · An ASN is automatically created on submit
            {submitErr ? <span style={{ color: 'var(--red-text)', marginLeft: 10 }}>{submitErr}</span> : null}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {step > 1 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            {step < 4 ? (
              <button className="btn primary" disabled={!canAdvance} onClick={() => setStep(step + 1)}>
                Continue <Icon name="arrowRight" size={12} />
              </button>
            ) : (
              <button className="btn primary lg" onClick={submit} disabled={submitting}>
                <Icon name="check" size={13} /> {submitting ? 'Submitting…' : 'Submit shipment plan'}
              </button>
            )}
          </div>
        </>
      }
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <StepBar step={step} />

        {step === 1 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Supplier required before shipment creation</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Every shipment plan must be tied to one supplier so UnieConnect can create the ASN, pickup context, and warehouse handoff correctly.
              </div>
            </div>
            {suppliers.length === 0 ? (
              <div className="card" style={{ padding: 18, background: 'var(--bg-sunken)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--amber-soft)', color: 'var(--amber-text)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon name="warning" size={17} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>No suppliers exist yet</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Create a supplier first, then return to this shipment plan. Supplier data is required for pickup rules, labels, BOL context, and ASN routing.
                    </div>
                  </div>
                  <button className="btn primary" onClick={onNewSupplier}>
                    <Icon name="plus" size={13} /> Create supplier
                  </button>
                </div>
              </div>
            ) : (
              <>
                {!hasAnySupplierMatch && (
                  <div className="card" style={{ padding: 12, marginBottom: 12, background: 'var(--amber-soft)', color: 'var(--amber-text)', borderColor: 'var(--amber)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700 }}>
                      <Icon name="warning" size={14} />
                      No supplier assigned to these SKUs. Choose one below or create a supplier.
                    </div>
                  </div>
                )}
                {supplierId && supplierMatchCount > 0 && (
                  <div className="card" style={{ padding: 10, marginBottom: 12, color: 'var(--purple-text)', background: 'var(--purple-soft)', borderColor: 'var(--purple-soft)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700 }}>
                      <Icon name="sparkle" size={14} />
                      Auto-selected from SKU supplier history.
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                  <button className="btn" onClick={onNewSupplier}>
                    <Icon name="plus" size={13} /> Create supplier
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {suppliers.map((s) => {
                const matchCount = list.filter((sk) => (s.skus || []).includes(sk.id) || (sk as any).supplierId === s.id).length;
                const sel = supplierId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSupplierId(s.id)}
                    style={{
                      textAlign: 'left',
                      padding: 14,
                      border: sel ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: sel ? 'var(--accent-soft)' : 'var(--bg-elev)',
                      borderRadius: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent), #5b3bcc)', color: 'white', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {(s.name || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</span>
                        {matchCount > 0 && <Chip tone="purple" dot={false}>Match · {matchCount}</Chip>}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                        {[s.region, s.country].filter(Boolean).join(', ')}
                        {s.leadTime ? ` · ${s.leadTime}d lead` : ''}
                        {s.onTime != null ? ` · ${Math.round(s.onTime * 100)}% on-time` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                        {s.paymentTerms || '—'}
                        {s.rating != null ? ` · ★ ${s.rating}` : ''}
                      </div>
                    </div>
                    {sel && <Icon name="check" size={16} style={{ color: 'var(--accent)' }} />}
                  </button>
                );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>How is this shipment moving?</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Tell us whether you need a Bill of Lading (BOL) for LTL freight pickup, and whether you need carton/pallet labels. The destination is auto-routed.
              </div>
            </div>
            <div className="card" style={{ marginBottom: 18, background: 'var(--purple-soft)', border: '1px solid var(--purple-soft)' }}>
              <div className="card-body" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--purple)', color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon name="sparkle" size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Destination auto-routed</span>
                    <Chip tone="purple" dot={false}>AI</Chip>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Routed based on per-SKU demand region, current WMS capacity, and freight lane cost. You don't need to choose.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {destSummary.map((d) => (
                      <span key={d.wh} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'var(--bg-elev)', border: '1px solid var(--border)', fontSize: 11.5, fontWeight: 600 }}>
                        <span className="mono" style={{ color: 'var(--purple-text)' }}>{d.wh}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{d.units.toLocaleString()}u</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <YesNoCard
              question="Do you need a BOL for LTL/freight pickup at the supplier?"
              detail="A Bill of Lading lets the supplier hand the shipment to your carrier. If yes, we generate the BOL and book the pickup."
              value={needsLTL}
              setValue={setNeedsLTL}
              yesNote="BOL generated · pickup booked"
              noNote="Supplier handles outbound freight"
            />
            <YesNoCard
              question="Do you need shipping/pallet labels?"
              detail="If yes, we'll generate carton barcodes and master pallet labels. If no, the supplier prints their own."
              value={needsLabels}
              setValue={setNeedsLabels}
              yesNote="Labels generated post-confirmation"
              noNote="Supplier labels per spec"
            />
            <div style={{ marginTop: 18, padding: 14, background: 'var(--green-soft)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="check" size={14} style={{ color: 'var(--green)' }} />
              <div style={{ fontSize: 12.5 }}>
                <strong>ASN auto-generated.</strong> An Advance Ship Notice is created on submit regardless of your BOL/label choices, and pushed to the destination WMS.
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Configure cartons &amp; pallets</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Enter units per carton and total cartons for each SKU. Pallets are computed from cube.</div>
            </div>
            <div className="table-wrap" style={{ marginBottom: 16 }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th className="num">Units / carton</th>
                    <th className="num">Cartons</th>
                    <th className="num">Total units</th>
                    <th>Palletize</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((sku) => {
                    const c = config[sku.id];
                    return (
                      <tr key={sku.id}>
                        <td className="mono strong">{(sku as any).sku || sku.id}</td>
                        <td>{sku.name}</td>
                        <td className="num">
                          <NumberInput value={c.unitsPerCarton} onChange={(v) => setConfig((p) => ({ ...p, [sku.id]: { ...p[sku.id], unitsPerCarton: v } }))} min={1} max={500} />
                        </td>
                        <td className="num">
                          <NumberInput value={c.cartons} onChange={(v) => setConfig((p) => ({ ...p, [sku.id]: { ...p[sku.id], cartons: v } }))} min={1} max={2000} />
                        </td>
                        <td className="num mono strong">{(c.cartons * c.unitsPerCarton).toLocaleString()}</td>
                        <td>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                            <input type="checkbox" checked={c.palletize} onChange={(e) => setConfig((p) => ({ ...p, [sku.id]: { ...p[sku.id], palletize: e.target.checked } }))} className="row-check" />
                            Yes
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: 16, background: 'var(--bg-sunken)', borderRadius: 10 }}>
              <SummaryStat2 label="Total units" value={totals.units.toLocaleString()} />
              <SummaryStat2 label="Total cartons" value={totals.cartons.toLocaleString()} />
              <SummaryStat2 label="Est. weight" value={`${(+totals.weight).toLocaleString()} lb`} />
              <SummaryStat2 label="Pallets" value={totals.pallets} tone="purple" />
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Review &amp; submit</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Submitting notifies the supplier, generates the ASN, and (if requested) the BOL and labels.
              </div>
            </div>
            <div className="row-2-eq" style={{ marginBottom: 14 }}>
              <ReviewCard title="Supplier">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent), #5b3bcc)', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
                    {(supplier?.name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{supplier?.name || '—'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                      {supplier?.region || ''}
                      {supplier?.leadTime ? ` · ${supplier.leadTime}d lead` : ''}
                    </div>
                  </div>
                </div>
              </ReviewCard>
              <ReviewCard title="Destinations · AI-routed" tone="purple">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {destSummary.map((d) => (
                    <span key={d.wh} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'var(--bg-elev)', border: '1px solid var(--purple-soft)', fontSize: 11.5, fontWeight: 600 }}>
                      <span className="mono" style={{ color: 'var(--purple-text)' }}>{d.wh}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{d.units.toLocaleString()}u</span>
                    </span>
                  ))}
                </div>
              </ReviewCard>
            </div>
            <div className="row-3" style={{ marginBottom: 14 }}>
              <ReviewCard title="BOL & freight" tone={needsLTL ? 'green' : undefined}>
                {needsLTL ? (
                  <>
                    BOL generated · LTL pickup booked · est. <strong>${totals.freightCost}</strong>
                  </>
                ) : (
                  <>Supplier-arranged (no BOL)</>
                )}
              </ReviewCard>
              <ReviewCard title="Labels" tone={needsLabels ? 'green' : undefined}>
                {needsLabels ? (
                  <>
                    Carton + pallet labels generated · est. <strong>${totals.labelCost}</strong>
                  </>
                ) : (
                  <>Supplier-printed</>
                )}
              </ReviewCard>
              <ReviewCard title="ASN" tone="green">
                <strong>Auto-generated</strong> on submit · pushed to destination WMS
              </ReviewCard>
            </div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-header">
                <div className="card-title">SKUs in this plan ({list.length})</div>
              </div>
              <table className="data">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Routed to</th>
                    <th className="num">U/Ctn</th>
                    <th className="num">Cartons</th>
                    <th className="num">Units</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((sku) => {
                    const c = config[sku.id];
                    return (
                      <tr key={sku.id}>
                        <td className="mono strong">{(sku as any).sku || sku.id}</td>
                        <td>{sku.name}</td>
                        <td className="mono" style={{ color: 'var(--purple-text)' }}>{routedDestinations[sku.id]}</td>
                        <td className="num mono">{c.unitsPerCarton}</td>
                        <td className="num mono">{c.cartons}</td>
                        <td className="num mono strong">{(c.cartons * c.unitsPerCarton).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: 16, background: 'var(--green-soft)', borderRadius: 10, border: '1px solid var(--green-soft)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
              <SummaryStat2 label="Units" value={totals.units.toLocaleString()} />
              <SummaryStat2 label="Cartons" value={totals.cartons} />
              <SummaryStat2 label="Pallets" value={totals.pallets} />
              <SummaryStat2 label="Cube" value={`${totals.cube} ft³`} />
              <SummaryStat2 label="Est. all-in cost" value={`$${(+totals.totalCost).toLocaleString()}`} tone="green" />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
