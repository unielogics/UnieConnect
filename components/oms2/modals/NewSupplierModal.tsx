import React, { useState } from 'react';
import { Modal } from '../ui';
import { createSupplier, createShipFromLocation } from '../../../lib/amazon-fba';

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

export const NewSupplierModal = ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) => {
  const [f, setF] = useState({ name: '', email: '', phone: '', website: '', notes: '' });
  const [addLoc, setAddLoc] = useState(false);
  const [loc, setLoc] = useState({ label: '', addressLine1: '', city: '', state: '', postal: '', country: 'US' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const setL = (k: keyof typeof loc) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setLoc((p) => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (!f.name.trim()) {
      setErr('Supplier name is required');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const s = await createSupplier({
        name: f.name.trim(),
        email: f.email.trim() || undefined,
        phone: f.phone.trim() || undefined,
        website: f.website.trim() || undefined,
        notes: f.notes.trim() || undefined,
      });
      if (addLoc && loc.label.trim() && loc.addressLine1.trim()) {
        await createShipFromLocation({
          supplierId: s.id,
          label: loc.label.trim(),
          isDefault: true,
          address: {
            addressLine1: loc.addressLine1.trim(),
            city: loc.city.trim(),
            stateOrProvinceCode: loc.state.trim(),
            postalCode: loc.postal.trim(),
            countryCode: loc.country.trim() || 'US',
          },
        });
      }
      onSuccess();
    } catch (e: any) {
      setErr(e.message || 'Failed to create supplier');
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add supplier"
      subtitle="Create a vendor. Optionally add a default ship-from location for shipment plans."
      onClose={onClose}
      fullscreen
      footer={
        <>
          <div style={{ fontSize: 12, color: err ? 'var(--red-text)' : 'var(--text-tertiary)' }}>
            {err || 'Suppliers appear in My Suppliers and the shipment wizard.'}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : 'Create supplier'}
            </button>
          </div>
        </>
      }
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Supplier details</div>
          </div>
          <div className="card-body">
            <Row>
              <div>
                <label style={label}>Name *</label>
                <input style={field} value={f.name} onChange={set('name')} placeholder="Cascade Supply Co." />
              </div>
              <div>
                <label style={label}>Email</label>
                <input style={field} value={f.email} onChange={set('email')} placeholder="ops@cascade.com" />
              </div>
            </Row>
            <Row>
              <div>
                <label style={label}>Phone</label>
                <input style={field} value={f.phone} onChange={set('phone')} />
              </div>
              <div>
                <label style={label}>Website</label>
                <input style={field} value={f.website} onChange={set('website')} />
              </div>
            </Row>
            <div>
              <label style={label}>Notes</label>
              <textarea style={{ ...field, height: 64, padding: '8px 10px' }} value={f.notes} onChange={set('notes')} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-header">
            <div className="card-title">Default ship-from location</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" className="row-check" checked={addLoc} onChange={(e) => setAddLoc(e.target.checked)} />
              Add now
            </label>
          </div>
          {addLoc && (
            <div className="card-body">
              <Row>
                <div>
                  <label style={label}>Label *</label>
                  <input style={field} value={loc.label} onChange={setL('label')} placeholder="Shenzhen DC" />
                </div>
                <div>
                  <label style={label}>Address line 1 *</label>
                  <input style={field} value={loc.addressLine1} onChange={setL('addressLine1')} />
                </div>
              </Row>
              <Row>
                <div>
                  <label style={label}>City</label>
                  <input style={field} value={loc.city} onChange={setL('city')} />
                </div>
                <div>
                  <label style={label}>State / province</label>
                  <input style={field} value={loc.state} onChange={setL('state')} />
                </div>
              </Row>
              <Row>
                <div>
                  <label style={label}>Postal code</label>
                  <input style={field} value={loc.postal} onChange={setL('postal')} />
                </div>
                <div>
                  <label style={label}>Country code</label>
                  <input style={field} value={loc.country} onChange={setL('country')} />
                </div>
              </Row>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
