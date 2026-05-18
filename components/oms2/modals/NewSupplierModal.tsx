import React, { useMemo, useState } from 'react';
import { Modal } from '../ui';
import { createSupplier, createShipFromLocation, updateSupplier } from '../../../lib/amazon-fba';
import type { OmsSupplier } from '../../../lib/oms';

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

const vehicleOptions = [
  ['sprinter_van', 'Sprinter / cargo van'],
  ['box_truck_16', '16 ft box truck'],
  ['box_truck_24', '24 ft box truck'],
  ['box_truck_26', '26 ft box truck'],
  ['53_dry_van', '53 ft dry van'],
  ['flatbed', 'Flatbed'],
  ['container', 'Container drayage'],
  ['other', 'Other / confirm before booking'],
];

const equipmentOptions = [
  ['forklift', 'Forklift'],
  ['pallet_jack', 'Pallet jack'],
  ['dock_plate', 'Dock plate'],
  ['liftgate', 'Liftgate'],
  ['straps', 'Straps/load bars'],
  ['appointment', 'Appointment'],
  ['hazmat_docs', 'Hazmat docs'],
  ['temp_control', 'Temperature control'],
];

type SupplierForm = {
  name: string;
  email: string;
  phone: string;
  website: string;
  notes: string;
  contactName: string;
  hoursOfOperation: string;
  maxVehicleSize: string;
  dockAppointmentLeadTimeHours: string;
  pickupInstructions: string;
};

const boolFromProfile = (value: unknown) => (value === null || value === undefined ? null : Boolean(value));

export const NewSupplierModal = ({
  onClose,
  onSuccess,
  supplier,
}: {
  onClose: () => void;
  onSuccess: () => void;
  supplier?: OmsSupplier | null;
}) => {
  const profile = supplier?.pickupProfile || {};
  const [f, setF] = useState<SupplierForm>({
    name: supplier?.name || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    website: supplier?.website || String(supplier?.metadata?.website || ''),
    notes: supplier?.notes || String(supplier?.metadata?.notes || ''),
    contactName: profile.contactName || supplier?.contact || '',
    hoursOfOperation: profile.hoursOfOperation || String(supplier?.metadata?.hoursOfOperation || ''),
    maxVehicleSize: profile.maxVehicleSize || '',
    dockAppointmentLeadTimeHours: profile.dockAppointmentLeadTimeHours == null ? '' : String(profile.dockAppointmentLeadTimeHours),
    pickupInstructions: profile.pickupInstructions || '',
  });
  const [loadingDock, setLoadingDock] = useState<boolean | null>(boolFromProfile(profile.loadingDock));
  const [equipmentRequired, setEquipmentRequired] = useState<string[]>(profile.equipmentRequired || []);
  const [appointmentRequired, setAppointmentRequired] = useState(Boolean(profile.appointmentRequired));
  const [liftgateRequired, setLiftgateRequired] = useState(Boolean(profile.liftgateRequired));
  const [insidePickup, setInsidePickup] = useState(Boolean(profile.insidePickup));
  const [palletExchange, setPalletExchange] = useState(Boolean(profile.palletExchange));
  const [addLoc, setAddLoc] = useState(false);
  const [loc, setLoc] = useState({ label: '', addressLine1: '', city: '', state: '', postal: '', country: 'US' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const editing = Boolean(supplier?.id);
  const dockReadiness = useMemo(() => {
    const missing = [
      !f.hoursOfOperation.trim() ? 'hours' : null,
      !f.maxVehicleSize ? 'vehicle limit' : null,
      loadingDock == null ? 'dock answer' : null,
    ].filter(Boolean);
    return missing.length ? `Missing ${missing.join(', ')}` : 'Ready for Cortex pickup planning';
  }, [f.hoursOfOperation, f.maxVehicleSize, loadingDock]);

  const set = (k: keyof SupplierForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const setL = (k: keyof typeof loc) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setLoc((p) => ({ ...p, [k]: e.target.value }));
  const toggleEquipment = (id: string) =>
    setEquipmentRequired((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const submit = async () => {
    if (!f.name.trim()) {
      setErr('Supplier name is required');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const leadHours = Number(f.dockAppointmentLeadTimeHours);
      const pickupProfile = {
        contactName: f.contactName.trim(),
        loadingDock,
        maxVehicleSize: f.maxVehicleSize || null,
        hoursOfOperation: f.hoursOfOperation.trim(),
        equipmentRequired,
        appointmentRequired,
        dockAppointmentLeadTimeHours: Number.isFinite(leadHours) && f.dockAppointmentLeadTimeHours !== '' ? leadHours : null,
        liftgateRequired,
        insidePickup,
        palletExchange,
        pickupInstructions: f.pickupInstructions.trim(),
      };
      const body = {
        name: f.name.trim(),
        email: f.email.trim() || undefined,
        phone: f.phone.trim() || undefined,
        website: f.website.trim() || undefined,
        notes: f.notes.trim() || undefined,
        ...pickupProfile,
        metadata: {
          ...(supplier?.metadata || {}),
          website: f.website.trim() || undefined,
          notes: f.notes.trim() || undefined,
          hoursOfOperation: f.hoursOfOperation.trim() || undefined,
          pickupProfile,
        },
      };
      const s = editing && supplier?.id ? await updateSupplier(supplier.id, body) : await createSupplier(body);
      if (addLoc && loc.label.trim() && loc.addressLine1.trim()) {
        await createShipFromLocation({
          supplierId: s.id,
          name: loc.label.trim(),
          label: loc.label.trim(),
          contactName: f.contactName.trim() || undefined,
          email: f.email.trim() || undefined,
          phone: f.phone.trim() || undefined,
          isDefault: true,
          address: {
            addressLine1: loc.addressLine1.trim(),
            city: loc.city.trim(),
            stateOrProvinceCode: loc.state.trim(),
            postalCode: loc.postal.trim(),
            countryCode: loc.country.trim() || 'US',
          },
          metadata: { pickupProfile },
        });
      }
      onSuccess();
    } catch (e: any) {
      setErr(e.message || `Failed to ${editing ? 'update' : 'create'} supplier`);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? 'Edit supplier' : 'Add supplier'}
      subtitle="Capture supplier pickup rules so Cortex can book the right truck, equipment, and appointment flow."
      onClose={onClose}
      fullscreen
      footer={
        <>
          <div style={{ fontSize: 12, color: err ? 'var(--red-text)' : dockReadiness.startsWith('Missing') ? 'var(--amber-text)' : 'var(--green-text)' }}>
            {err || dockReadiness}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save supplier' : 'Create supplier'}
            </button>
          </div>
        </>
      }
    >
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Supplier identity</div>
              <div className="card-subtitle">Business contact and notes used by purchase, inbound, and support workflows.</div>
            </div>
          </div>
          <div className="card-body">
            <Row>
              <div>
                <label style={label}>Name *</label>
                <input style={field} value={f.name} onChange={set('name')} placeholder="Cascade Supply Co." />
              </div>
              <div>
                <label style={label}>Primary pickup contact</label>
                <input style={field} value={f.contactName} onChange={set('contactName')} placeholder="Dock supervisor or traffic contact" />
              </div>
            </Row>
            <Row>
              <div>
                <label style={label}>Email</label>
                <input style={field} value={f.email} onChange={set('email')} placeholder="ops@supplier.com" />
              </div>
              <div>
                <label style={label}>Phone</label>
                <input style={field} value={f.phone} onChange={set('phone')} placeholder="+1 555 0100" />
              </div>
            </Row>
            <Row>
              <div>
                <label style={label}>Website</label>
                <input style={field} value={f.website} onChange={set('website')} />
              </div>
              <div>
                <label style={label}>Hours of operation</label>
                <input style={field} value={f.hoursOfOperation} onChange={set('hoursOfOperation')} placeholder="Mon-Fri 08:00-16:00, closed 12:00-13:00" />
              </div>
            </Row>
            <div>
              <label style={label}>Supplier notes</label>
              <textarea style={{ ...field, height: 64, padding: '8px 10px' }} value={f.notes} onChange={set('notes')} placeholder="Commercial notes, lead-time expectations, exceptions, escalation path." />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Pickup and truck booking intelligence</div>
              <div className="card-subtitle">These rules feed Cortex when it evaluates LTL, parcel, courier, and dock appointment decisions.</div>
            </div>
          </div>
          <div className="card-body">
            <Row>
              <div>
                <label style={label}>Loading dock</label>
                <div className="seg" style={{ width: '100%' }}>
                  {[
                    ['yes', 'Yes'],
                    ['no', 'No'],
                    ['unknown', 'Unknown'],
                  ].map(([id, text]) => (
                    <button
                      key={id}
                      className={(id === 'yes' && loadingDock === true) || (id === 'no' && loadingDock === false) || (id === 'unknown' && loadingDock == null) ? 'active' : ''}
                      onClick={() => setLoadingDock(id === 'unknown' ? null : id === 'yes')}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={label}>Maximum vehicle accepted</label>
                <select style={field} value={f.maxVehicleSize} onChange={set('maxVehicleSize')}>
                  <option value="">Select vehicle limit</option>
                  {vehicleOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select>
              </div>
            </Row>
            <Row>
              <div>
                <label style={label}>Dock appointment lead time</label>
                <input style={field} type="number" min="0" value={f.dockAppointmentLeadTimeHours} onChange={set('dockAppointmentLeadTimeHours')} placeholder="24" />
              </div>
              <div>
                <label style={label}>Operational requirements</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 2 }}>
                  {[
                    ['appointmentRequired', 'Appointment required', appointmentRequired, setAppointmentRequired],
                    ['liftgateRequired', 'Liftgate required', liftgateRequired, setLiftgateRequired],
                    ['insidePickup', 'Inside pickup', insidePickup, setInsidePickup],
                    ['palletExchange', 'Pallet exchange', palletExchange, setPalletExchange],
                  ].map(([id, text, checked, setter]: any) => (
                    <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" className="row-check" checked={checked} onChange={(e) => setter(e.target.checked)} />
                      {text}
                    </label>
                  ))}
                </div>
              </div>
            </Row>
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Equipment required at pickup</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: 8 }}>
                {equipmentOptions.map(([id, text]) => (
                  <button
                    key={id}
                    type="button"
                    className={`btn sm ${equipmentRequired.includes(id) ? 'primary' : 'ghost'}`}
                    onClick={() => toggleEquipment(id)}
                    style={{ justifyContent: 'center' }}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={label}>Pickup instructions for Cortex / carrier</label>
              <textarea
                style={{ ...field, height: 74, padding: '8px 10px' }}
                value={f.pickupInstructions}
                onChange={set('pickupInstructions')}
                placeholder="Gate code, check-in process, staging location, driver notes, no-go vehicle types, contact sequence."
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Default ship-from location</div>
              <div className="card-subtitle">Optional, but recommended for ASNs, BOLs, labels, and pickup routing.</div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" className="row-check" checked={addLoc} onChange={(e) => setAddLoc(e.target.checked)} />
              {editing ? 'Add another location' : 'Add now'}
            </label>
          </div>
          {addLoc && (
            <div className="card-body">
              <Row>
                <div>
                  <label style={label}>Label *</label>
                  <input style={field} value={loc.label} onChange={setL('label')} placeholder="Main dock" />
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
