import React, { useState } from 'react';
import { Modal } from '../ui';
import { createCustomer, CreateCustomerBody } from '../../../lib/oms';

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
const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>{children}</div>
);

export const NewCustomerModal = ({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (created?: { id: string; name: string }) => void;
}) => {
  const [f, setF] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    channel: '',
    line1: '',
    city: '',
    state: '',
    postal: '',
    country: 'US',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (!f.name.trim()) {
      setErr('Customer name is required');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const body: CreateCustomerBody = {
        name: f.name.trim(),
        email: f.email.trim() || undefined,
        phone: f.phone.trim() || undefined,
        company: f.company.trim() || undefined,
        channel: f.channel.trim() || undefined,
      };
      if (f.line1.trim()) {
        body.addresses = [
          {
            line1: f.line1.trim(),
            city: f.city.trim(),
            state: f.state.trim(),
            postalCode: f.postal.trim(),
            country: f.country.trim() || 'US',
          },
        ];
      }
      const r = await createCustomer(body);
      onSuccess({ id: r.customer.id, name: f.name.trim() });
    } catch (e: any) {
      setErr(e.message || 'Failed to create customer');
      setSaving(false);
    }
  };

  return (
    <Modal
      title="New customer"
      subtitle="Create a buyer record. Used for manual orders and customer analytics."
      onClose={onClose}
      fullscreen
      footer={
        <>
          <div style={{ fontSize: 12, color: err ? 'var(--red-text)' : 'var(--text-tertiary)' }}>
            {err || 'Unified by email + address fingerprint across channels.'}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : 'Create customer'}
            </button>
          </div>
        </>
      }
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Customer details</div>
          </div>
          <div className="card-body">
            <Row>
              <div>
                <label style={label}>Name *</label>
                <input style={field} value={f.name} onChange={set('name')} placeholder="Jane Buyer" />
              </div>
              <div>
                <label style={label}>Email</label>
                <input style={field} value={f.email} onChange={set('email')} />
              </div>
            </Row>
            <Row>
              <div>
                <label style={label}>Phone</label>
                <input style={field} value={f.phone} onChange={set('phone')} />
              </div>
              <div>
                <label style={label}>Company</label>
                <input style={field} value={f.company} onChange={set('company')} />
              </div>
            </Row>
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Primary channel</label>
              <select style={{ ...field, height: 34 }} value={f.channel} onChange={set('channel')}>
                <option value="">—</option>
                <option value="amazon">Amazon</option>
                <option value="shopify">Shopify</option>
                <option value="ebay">eBay</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-header">
            <div className="card-title">Address (optional)</div>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Address line 1</label>
              <input style={field} value={f.line1} onChange={set('line1')} />
            </div>
            <Row>
              <div>
                <label style={label}>City</label>
                <input style={field} value={f.city} onChange={set('city')} />
              </div>
              <div>
                <label style={label}>State</label>
                <input style={field} value={f.state} onChange={set('state')} />
              </div>
            </Row>
            <Row>
              <div>
                <label style={label}>Postal code</label>
                <input style={field} value={f.postal} onChange={set('postal')} />
              </div>
              <div>
                <label style={label}>Country</label>
                <input style={field} value={f.country} onChange={set('country')} />
              </div>
            </Row>
          </div>
        </div>
      </div>
    </Modal>
  );
};
