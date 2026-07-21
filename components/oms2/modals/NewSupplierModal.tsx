import React, { useMemo, useState } from 'react';
import { Modal } from '../ui';
import { createSupplier, createShipFromLocation, updateSupplier } from '../../../lib/amazon-fba';
import { AddressInput } from '../../AddressInput';
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
  onSuccess: (supplier?: OmsSupplier) => void;
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

  // Online supplier (no physical pickup address) + the ship-from address for everyone else —
  // required server-side unless onlineSupplier is checked (see supplierAddressSatisfiesOnlineRule
  // in the backend). This is the canonical place a supplier is created/edited, so this is the ONE
  // form that must capture both — previously this modal had neither field at all.
  const existingAddress = (supplier?.address || {}) as Record<string, any>;
  const [onlineSupplier, setOnlineSupplier] = useState(Boolean(supplier?.onlineSupplier));
  const [addressSearch, setAddressSearch] = useState('');
  const [addr, setAddr] = useState({
    street: String(existingAddress.street || existingAddress.addressLine1 || ''),
    city: String(existingAddress.city || ''),
    state: String(existingAddress.state || existingAddress.stateOrProvinceCode || ''),
    zip: String(existingAddress.zip || existingAddress.zipCode || existingAddress.postalCode || ''),
    country: String(existingAddress.country || existingAddress.countryCode || 'US'),
    latitude: typeof existingAddress.latitude === 'number' ? existingAddress.latitude : undefined,
    longitude: typeof existingAddress.longitude === 'number' ? existingAddress.longitude : undefined,
  });
  const addressComplete = Boolean(addr.street.trim() && addr.city.trim() && addr.state.trim());
  const addressMissing = !onlineSupplier && !addressComplete;

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
    if (addressMissing) {
      setErr('A ship-from address (street, city, state) is required. Check "Online supplier" if this supplier has no physical pickup address.');
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
      const address = onlineSupplier
        ? {}
        : {
            street: addr.street.trim(),
            city: addr.city.trim(),
            state: addr.state.trim(),
            zip: addr.zip.trim(),
            country: (addr.country.trim() || 'US').toUpperCase(),
            ...(addr.latitude != null ? { latitude: addr.latitude } : {}),
            ...(addr.longitude != null ? { longitude: addr.longitude } : {}),
          };
      const body = {
        name: f.name.trim(),
        email: f.email.trim() || undefined,
        phone: f.phone.trim() || undefined,
        website: f.website.trim() || undefined,
        notes: f.notes.trim() || undefined,
        onlineSupplier,
        address,
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
      onSuccess(s as unknown as OmsSupplier);
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
              <div className="card-title">Pickup address</div>
              <div className="card-subtitle">Required for freight, distance-based warehouse routing, and pickup planning — unless this supplier ships digitally with no physical origin.</div>
            </div>
          </div>
          <div className="card-body">
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, cursor: 'pointer', marginBottom: 12 }}>
              <input type="checkbox" className="row-check" checked={onlineSupplier} onChange={(e) => setOnlineSupplier(e.target.checked)} />
              Online supplier (no physical pickup address — inbound routes to your primary warehouse)
            </label>
            {!onlineSupplier && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={label}>Search address</label>
                  <AddressInput
                    value={addressSearch}
                    onChange={setAddressSearch}
                    onSelectSuggestion={(s) => {
                      setAddr((p) => ({
                        ...p,
                        street: s.street || p.street,
                        city: s.city || p.city,
                        state: s.stateCode || s.state || p.state,
                        zip: s.postalCode || p.zip,
                        country: s.countryCode || s.country || p.country,
                        latitude: typeof s.latitude === 'number' ? s.latitude : p.latitude,
                        longitude: typeof s.longitude === 'number' ? s.longitude : p.longitude,
                      }));
                      setAddressSearch(s.street || '');
                    }}
                  />
                </div>
                <Row>
                  <div>
                    <label style={label}>Street *</label>
                    <input style={field} value={addr.street} onChange={(e) => setAddr((p) => ({ ...p, street: e.target.value }))} placeholder="123 Warehouse Way" />
                  </div>
                  <div>
                    <label style={label}>City *</label>
                    <input style={field} value={addr.city} onChange={(e) => setAddr((p) => ({ ...p, city: e.target.value }))} />
                  </div>
                </Row>
                <Row>
                  <div>
                    <label style={label}>State / province *</label>
                    <input style={field} value={addr.state} onChange={(e) => setAddr((p) => ({ ...p, state: e.target.value }))} />
                  </div>
                  <div>
                    <label style={label}>Postal code</label>
                    <input style={field} value={addr.zip} onChange={(e) => setAddr((p) => ({ ...p, zip: e.target.value }))} />
                  </div>
                </Row>
                <Row>
                  <div>
                    <label style={label}>Country code</label>
                    <input style={field} value={addr.country} onChange={(e) => setAddr((p) => ({ ...p, country: e.target.value }))} />
                  </div>
                  <div />
                </Row>
                {addressMissing && (
                  <div style={{ fontSize: 11.5, color: 'var(--amber-text)' }}>Street, city, and state are required unless this supplier is marked online.</div>
                )}
              </>
            )}
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
