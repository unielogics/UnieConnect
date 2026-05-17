import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui';
import { Icon } from '../icons';
import {
  fetchOmsCustomers,
  fetchOmsSkus,
  createManualOrder,
  OmsCustomer,
  OmsSku,
  CreateOrderLine,
} from '../../../lib/oms';
import { NewCustomerModal } from './NewCustomerModal';

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

type Line = { key: number; skuId: string; sku: string; title: string; quantity: number; unitPrice: number };

export const NewOrderModal = ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) => {
  const [customers, setCustomers] = useState<OmsCustomer[]>([]);
  const [skus, setSkus] = useState<OmsSku[]>([]);
  const [custSearch, setCustSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [channel, setChannel] = useState('manual');
  const [lines, setLines] = useState<Line[]>([{ key: 1, skuId: '', sku: '', title: '', quantity: 1, unitPrice: 0 }]);
  const [ship, setShip] = useState({ line1: '', city: '', state: '', postal: '', country: 'US' });
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reloadCustomers = () =>
    fetchOmsCustomers().then((d) => setCustomers(d.customers || [])).catch(() => setCustomers([]));
  useEffect(() => {
    reloadCustomers();
    fetchOmsSkus().then((d) => setSkus(d.skus || [])).catch(() => setSkus([]));
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

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () =>
    setLines((ls) => [...ls, { key: Date.now(), skuId: '', sku: '', title: '', quantity: 1, unitPrice: 0 }]);
  const removeLine = (key: number) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  const pickSku = (key: number, skuId: string) => {
    const s = skus.find((x) => x.id === skuId);
    setLine(key, { skuId, sku: s?.sku || '', title: s?.title || '' });
  };

  const submit = async () => {
    if (!customerId) {
      setErr('Select or create a customer');
      return;
    }
    const validLines = lines.filter((l) => l.skuId && l.quantity > 0);
    if (validLines.length === 0) {
      setErr('Add at least one line item');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const body = {
        customerId,
        channel,
        status: 'new',
        total,
        lines: validLines.map<CreateOrderLine>((l) => ({
          itemId: l.skuId,
          sku: l.sku,
          title: l.title,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        shippingAddress: ship.line1
          ? { line1: ship.line1, city: ship.city, state: ship.state, postalCode: ship.postal, country: ship.country }
          : undefined,
      };
      await createManualOrder(body);
      onSuccess();
    } catch (e: any) {
      setErr(e.message || 'Failed to create order');
      setSaving(false);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <>
      <Modal
        title="Manual order"
        subtitle="Build an order: pick a customer, add line items, set channel and shipping."
        onClose={onClose}
        fullscreen
        footer={
          <>
            <div style={{ fontSize: 12, color: err ? 'var(--red-text)' : 'var(--text-tertiary)' }}>
              {err || `${lines.length} line${lines.length > 1 ? 's' : ''} · order total $${total.toFixed(2)}`}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn ghost" onClick={onClose}>Cancel</button>
              <button className="btn primary" onClick={submit} disabled={saving}>
                {saving ? 'Creating…' : 'Create order'}
              </button>
            </div>
          </>
        }
      >
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Customer</div>
              <button className="btn sm" onClick={() => setShowNewCustomer(true)}>
                <Icon name="plus" size={11} /> New customer
              </button>
            </div>
            <div className="card-body">
              {selectedCustomer ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{selectedCustomer.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                      {selectedCustomer.email || ''} {selectedCustomer.city ? `· ${selectedCustomer.city}` : ''}
                    </div>
                  </div>
                  <button className="btn ghost sm" onClick={() => setCustomerId('')}>Change</button>
                </div>
              ) : (
                <>
                  <input
                    style={{ ...field, marginBottom: 10 }}
                    placeholder="Search customers by name or email"
                    value={custSearch}
                    onChange={(e) => setCustSearch(e.target.value)}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 200, overflowY: 'auto' }}>
                    {filteredCustomers.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 8 }}>
                        No matches — create a new customer.
                      </div>
                    )}
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCustomerId(c.id)}
                        style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-elev)',
                          marginBottom: 6,
                          cursor: 'pointer',
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

          <div className="card">
            <div className="card-header">
              <div className="card-title">Line items</div>
              <button className="btn sm" onClick={addLine}>
                <Icon name="plus" size={11} /> Add line
              </button>
            </div>
            <table className="data">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th className="num" style={{ width: 110 }}>Qty</th>
                  <th className="num" style={{ width: 130 }}>Unit price</th>
                  <th className="num" style={{ width: 110 }}>Line total</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key}>
                    <td>
                      <select style={{ ...field, height: 30 }} value={l.skuId} onChange={(e) => pickSku(l.key, e.target.value)}>
                        <option value="">Select SKU…</option>
                        {skus.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.sku} — {s.title}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        min={1}
                        style={{ ...field, height: 30, textAlign: 'right' }}
                        value={l.quantity}
                        onChange={(e) => setLine(l.key, { quantity: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        style={{ ...field, height: 30, textAlign: 'right' }}
                        value={l.unitPrice}
                        onChange={(e) => setLine(l.key, { unitPrice: Math.max(0, parseFloat(e.target.value || '0')) })}
                      />
                    </td>
                    <td className="num mono strong">${(l.quantity * l.unitPrice).toFixed(2)}</td>
                    <td>
                      <button className="btn ghost sm" onClick={() => removeLine(l.key)} data-hint="Remove">
                        <Icon name="x" size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="card-footer">
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Order total</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Channel &amp; shipping</div>
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
                  <input style={field} value={ship.line1} onChange={(e) => setShip((p) => ({ ...p, line1: e.target.value }))} />
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
      </Modal>

      {showNewCustomer && (
        <NewCustomerModal
          onClose={() => setShowNewCustomer(false)}
          onSuccess={(created) => {
            setShowNewCustomer(false);
            reloadCustomers().then(() => {
              if (created?.id) setCustomerId(created.id);
            });
          }}
        />
      )}
    </>
  );
};
