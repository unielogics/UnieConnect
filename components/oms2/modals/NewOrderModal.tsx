import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Thumb, RecentStrip } from '../ui';
import { Icon } from '../icons';

// Order money always shows cents (unlike ui.fmt.money which rounds to whole dollars).
const money = (n: number) =>
  `$${(Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
import {
  fetchOmsCustomers,
  fetchOmsSkus,
  fetchOmsOrders,
  createManualOrder,
  OmsCustomer,
  OmsCustomerAddress,
  OmsSku,
  OmsOrder,
  CreateOrderLine,
} from '../../../lib/oms';
import { NewCustomerModal } from './NewCustomerModal';
import { SkuPicker } from '../SkuPicker';

const field: React.CSSProperties = {
  width: '100%',
  height: 34,
  padding: '0 10px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  fontSize: 12.5,
  color: 'var(--text)',
  outline: 'none',
};
const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 4,
  display: 'block',
};

type Line = { key: number; skuId: string; sku: string; title: string; image: string | null; available: number; quantity: number; unitPrice: number };

type ShipState = { line1: string; line2: string; city: string; state: string; postal: string; country: string };

// Carrier service levels the warehouse understands. `days` mirrors the server-side
// deriveShipByDate offset so the UI can preview the ship-by date the server will compute.
const SERVICE_LEVELS: { value: string; label: string; days: number; hint: string }[] = [
  { value: 'next_day', label: 'Next Day', days: 1, hint: 'Urgent · picks first' },
  { value: 'two_day', label: '2-Day', days: 2, hint: 'High priority' },
  { value: 'express', label: 'Express', days: 1, hint: 'Urgent · picks first' },
  { value: 'ground', label: 'Ground', days: 5, hint: 'Standard priority' },
  { value: 'standard', label: 'Standard', days: 7, hint: 'Standard priority' },
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}
function formatShipBy(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Normalize a saved customer address (loose key names) into the modal's flat ship state. */
function addressToShip(addr: OmsCustomerAddress | undefined): ShipState | null {
  if (!addr || typeof addr !== 'object') return null;
  const line1 = addr.addressLine1 || addr.line1 || addr.address || '';
  const city = addr.city || '';
  const state = addr.state || addr.stateOrProvinceCode || addr.region || '';
  const postal = addr.zipCode || addr.postalCode || addr.postal || addr.zip || '';
  const country = addr.country || 'US';
  if (!line1 && !city && !state && !postal) return null;
  return { line1, line2: addr.addressLine2 || addr.line2 || '', city, state, postal, country };
}

const EMPTY_SHIP: ShipState = { line1: '', line2: '', city: '', state: '', postal: '', country: 'US' };

// SkuPicker (searchable SKU dropdown with thumbnails + ASIN search + on-hand) is now
// shared from ../SkuPicker so the shipment-plan flow can reuse it.

export const NewOrderModal = ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) => {
  const [customers, setCustomers] = useState<OmsCustomer[]>([]);
  const [skus, setSkus] = useState<OmsSku[]>([]);
  const [recentOrders, setRecentOrders] = useState<OmsOrder[]>([]);
  const [custSearch, setCustSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [channel, setChannel] = useState('manual');
  const [serviceLevel, setServiceLevel] = useState('standard');
  const [lines, setLines] = useState<Line[]>([]);
  const [ship, setShip] = useState<ShipState>(EMPTY_SHIP);
  const [shipAutoFilled, setShipAutoFilled] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reloadCustomers = () =>
    fetchOmsCustomers().then((d) => setCustomers(d.customers || [])).catch(() => setCustomers([]));
  useEffect(() => {
    reloadCustomers();
    fetchOmsSkus().then((d) => setSkus(d.skus || [])).catch(() => setSkus([]));
    fetchOmsOrders().then((d) => setRecentOrders((d.orders || []).slice(0, 3))).catch(() => setRecentOrders([]));
  }, []);

  const filteredCustomers = useMemo(
    () =>
      customers
        .filter(
          (c) =>
            !custSearch ||
            (c.name || '').toLowerCase().includes(custSearch.toLowerCase()) ||
            (c.email || '').toLowerCase().includes(custSearch.toLowerCase())
        )
        .slice(0, 8),
    [customers, custSearch]
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const itemCount = lines.reduce((s, l) => s + (l.skuId ? l.quantity : 0), 0);
  const validLines = lines.filter((l) => l.skuId && l.quantity > 0);
  const canSubmit = Boolean(customerId) && validLines.length > 0 && !saving;
  const shipByPreview = useMemo(() => {
    const sl = SERVICE_LEVELS.find((s) => s.value === serviceLevel);
    return sl ? formatShipBy(addDays(new Date(), sl.days)) : '';
  }, [serviceLevel]);

  // Pick a customer → auto-fill shipping from their first saved address (editable, not locked).
  const chooseCustomer = (c: OmsCustomer) => {
    setCustomerId(c.id);
    const filled = addressToShip(c.addresses && c.addresses[0]);
    if (filled) {
      setShip(filled);
      setShipAutoFilled(true);
    }
  };
  const clearCustomer = () => {
    setCustomerId('');
    setShip(EMPTY_SHIP);
    setShipAutoFilled(false);
  };

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () =>
    setLines((ls) => [...ls, { key: Date.now(), skuId: '', sku: '', title: '', image: null, available: 0, quantity: 1, unitPrice: 0 }]);
  const removeLine = (key: number) => setLines((ls) => ls.filter((l) => l.key !== key));

  const pickSku = (key: number, skuId: string) => {
    const s = skus.find((x) => x.id === skuId);
    // Prefer true physical warehouse on-hand; fall back to channel available.
    const avail = Number((s as any)?.networkOnHand ?? s?.available ?? 0);
    setLine(key, { skuId, sku: s?.sku || '', title: s?.title || '', image: s?.image || null, available: avail });
  };

  const submit = async () => {
    if (!customerId) return setErr('Select or create a customer');
    if (validLines.length === 0) return setErr('Add at least one line item');
    setSaving(true);
    setErr(null);
    try {
      const shipping = ship.line1 || ship.city || ship.postal
        ? {
            line1: ship.line1,
            line2: ship.line2 || undefined,
            city: ship.city,
            state: ship.state,
            postalCode: ship.postal,
            country: ship.country,
          }
        : undefined;
      await createManualOrder({
        customerId,
        channel,
        status: 'new',
        total,
        serviceLevel,
        lines: validLines.map<CreateOrderLine>((l) => ({
          itemId: l.skuId,
          sku: l.sku,
          title: l.title,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        shippingAddress: shipping,
      });
      onSuccess();
    } catch (e: any) {
      setErr(e.message || 'Failed to create order');
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        title="New order"
        subtitle="Build an order: pick a customer, add line items, choose a service level."
        onClose={onClose}
        fullscreen
        footer={
          <>
            <div style={{ fontSize: 12, color: err ? 'var(--red-text)' : 'var(--text-tertiary)' }}>
              {err || `${validLines.length} line${validLines.length === 1 ? '' : 's'} · ${itemCount} item${itemCount === 1 ? '' : 's'} · ${money(total)}`}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn ghost" onClick={onClose}>Cancel</button>
              <button className="btn primary" onClick={submit} disabled={!canSubmit}>
                {saving ? 'Creating…' : 'Create order'}
              </button>
            </div>
          </>
        }
      >
        <div
          style={{
            maxWidth: 1120,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 320px',
            gap: 16,
            alignItems: 'start',
          }}
        >
          {/* ---------- Main column ---------- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            {/* Recent context: last 3 orders */}
            <RecentStrip
              label="Recent orders"
              items={recentOrders.map((o) => ({
                id: o.id,
                number: o.displayId || o.publicId || o.chOrderId || o.id,
                status: o.status || o.state,
                units: o.qty ?? o.itemCount ?? o.items,
                date: o.date,
                images: o.image ? [o.image] : [],
              }))}
            />
            {/* Customer */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Customer</div>
                <button className="btn sm" onClick={() => setShowNewCustomer(true)}>
                  <Icon name="plus" size={11} /> New customer
                </button>
              </div>
              <div className="card-body">
                {selectedCustomer ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div
                        style={{
                          width: 34, height: 34, borderRadius: 999, flexShrink: 0,
                          background: 'var(--accent-soft, var(--bg-elev))', color: 'var(--accent, var(--text))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13,
                        }}
                      >
                        {(selectedCustomer.name || '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedCustomer.name}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                          {selectedCustomer.email || ''}{selectedCustomer.city ? ` · ${selectedCustomer.city}` : ''}
                        </div>
                      </div>
                    </div>
                    <button className="btn ghost sm" onClick={clearCustomer}>Change</button>
                  </div>
                ) : (
                  <>
                    <input
                      style={{ ...field, marginBottom: 10 }}
                      placeholder="Search customers by name or email"
                      value={custSearch}
                      onChange={(e) => setCustSearch(e.target.value)}
                      autoFocus
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 220, overflowY: 'auto', gap: 6 }}>
                      {filteredCustomers.length === 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 8 }}>
                          No matches — create a new customer.
                        </div>
                      )}
                      {filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => chooseCustomer(c)}
                          style={{
                            textAlign: 'left', padding: '8px 10px', borderRadius: 6,
                            border: '1px solid var(--border-subtle)', background: 'var(--bg-elev)', cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.email || c.city || ''}</div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Line items */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Line items</div>
                <button className="btn sm" onClick={addLine}>
                  <Icon name="plus" size={11} /> Add line
                </button>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lines.length === 0 && (
                  <button
                    onClick={addLine}
                    style={{
                      border: '1px dashed var(--border)', borderRadius: 8, padding: '18px 12px',
                      background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12.5,
                    }}
                  >
                    <Icon name="plus" size={12} /> Add the first line item
                  </button>
                )}
                {lines.map((l) => (
                  <div
                    key={l.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: 10,
                      borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elev)',
                    }}
                  >
                    <Thumb image={l.image} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <SkuPicker skus={skus} value={l.skuId} onPick={(id) => pickSku(l.key, id)} />
                      {l.skuId && (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="chip" style={{ fontSize: 10 }}>{l.sku}</span>
                          <span>{l.available} on-hand</span>
                          {l.quantity > l.available && (
                            <span style={{ color: 'var(--warn, #b45309)', fontWeight: 600 }}>
                              Exceeds on-hand by {l.quantity - l.available} — accepted only if this client allows backorders
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ width: 78 }}>
                      <label style={label}>Qty</label>
                      <input
                        type="number" min={1}
                        style={{ ...field, height: 30, textAlign: 'right' }}
                        value={l.quantity}
                        onChange={(e) => setLine(l.key, { quantity: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                      />
                    </div>
                    <div style={{ width: 100 }}>
                      <label style={label}>Unit price</label>
                      <input
                        type="number" min={0} step="0.01"
                        style={{ ...field, height: 30, textAlign: 'right' }}
                        value={l.unitPrice}
                        onChange={(e) => setLine(l.key, { unitPrice: Math.max(0, parseFloat(e.target.value || '0')) })}
                      />
                    </div>
                    <div style={{ width: 84, textAlign: 'right' }}>
                      <label style={label}>Total</label>
                      <div className="mono strong" style={{ fontSize: 13, paddingTop: 6 }}>{money(l.quantity * l.unitPrice)}</div>
                    </div>
                    <button className="btn ghost sm" onClick={() => removeLine(l.key)} data-hint="Remove" style={{ alignSelf: 'center' }}>
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Channel & shipping */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Channel &amp; shipping</div>
                {shipAutoFilled && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="check" size={11} /> from customer
                  </span>
                )}
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={label}>Channel</label>
                    <select style={field} value={channel} onChange={(e) => setChannel(e.target.value)}>
                      <option value="manual">Manual</option>
                      <option value="amazon">Amazon</option>
                      <option value="shopify">Shopify</option>
                      <option value="ebay">eBay</option>
                    </select>
                  </div>
                  <div>
                    <label style={label}>Ship to — address line 1</label>
                    <input style={field} value={ship.line1} onChange={(e) => { setShip((p) => ({ ...p, line1: e.target.value })); setShipAutoFilled(false); }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <div>
                    <label style={label}>City</label>
                    <input style={field} value={ship.city} onChange={(e) => setShip((p) => ({ ...p, city: e.target.value }))} />
                  </div>
                  <div>
                    <label style={label}>State</label>
                    <input style={field} value={ship.state} onChange={(e) => setShip((p) => ({ ...p, state: e.target.value }))} />
                  </div>
                  <div>
                    <label style={label}>Postal</label>
                    <input style={field} value={ship.postal} onChange={(e) => setShip((p) => ({ ...p, postal: e.target.value }))} />
                  </div>
                  <div>
                    <label style={label}>Country</label>
                    <input style={field} value={ship.country} onChange={(e) => setShip((p) => ({ ...p, country: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ---------- Sticky summary rail ---------- */}
          <div style={{ position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Service level</div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {SERVICE_LEVELS.map((sl) => {
                    const active = sl.value === serviceLevel;
                    return (
                      <button
                        key={sl.value}
                        onClick={() => setServiceLevel(sl.value)}
                        style={{
                          textAlign: 'left', padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                          border: `1px solid ${active ? 'var(--accent, var(--text))' : 'var(--border-subtle)'}`,
                          background: active ? 'var(--accent-soft, var(--bg-elev))' : 'var(--bg-elev)',
                          boxShadow: active ? '0 0 0 1px var(--accent, var(--text)) inset' : 'none',
                        }}
                      >
                        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{sl.label}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{sl.hint}</div>
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Icon name="bolt" size={12} /> Ships by <strong style={{ color: 'var(--text)' }}>{shipByPreview}</strong>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Summary</div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)' }}>
                  <span>Customer</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600, maxWidth: 170, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedCustomer?.name || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)' }}>
                  <span>Items</span>
                  <span style={{ color: 'var(--text)' }}>{itemCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)' }}>
                  <span>Channel</span>
                  <span style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{channel}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)' }}>
                  <span>Service</span>
                  <span style={{ color: 'var(--text)' }}>{SERVICE_LEVELS.find((s) => s.value === serviceLevel)?.label}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 700 }}>Order total</span>
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{money(total)}</span>
                </div>
                <button className="btn primary" onClick={submit} disabled={!canSubmit} style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}>
                  {saving ? 'Creating…' : 'Create order'}
                </button>
                {!canSubmit && !saving && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                    {!customerId ? 'Select a customer to continue' : 'Add at least one line item'}
                  </div>
                )}
                {err && <div style={{ fontSize: 11.5, color: 'var(--red-text)', textAlign: 'center' }}>{err}</div>}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {showNewCustomer && (
        <NewCustomerModal
          onClose={() => setShowNewCustomer(false)}
          onSuccess={(created) => {
            setShowNewCustomer(false);
            reloadCustomers().then(() => {
              if (created?.id) {
                setCustomerId(created.id);
              }
            });
          }}
        />
      )}
    </>
  );
};
