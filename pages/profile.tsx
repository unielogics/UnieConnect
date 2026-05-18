import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { TOKEN_KEY, apiUrl } from '../lib/api';
import { fetchInvoices, type InvoiceLine } from '../lib/invoices';
import { uploadProfileAvatar } from '../lib/user';
import { FiLock, FiCreditCard, FiPackage, FiLink, FiUser } from 'react-icons/fi';

type TabId = 'account' | 'billing' | 'cards' | 'security';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'account', label: 'Account', icon: <FiUser size={16} /> },
  { id: 'billing', label: 'Billing', icon: <FiCreditCard size={16} /> },
  { id: 'cards', label: 'Payment methods', icon: <FiLink size={16} /> },
  { id: 'security', label: 'Security', icon: <FiLock size={16} /> },
];

type BillingAddress = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
};

const emptyBilling = (): BillingAddress => ({
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'United States',
});

const US_STATES = [
  { abbr: 'AL', name: 'Alabama' },
  { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' },
  { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' },
  { abbr: 'DE', name: 'Delaware' },
  { abbr: 'DC', name: 'District of Columbia' },
  { abbr: 'FL', name: 'Florida' },
  { abbr: 'GA', name: 'Georgia' },
  { abbr: 'HI', name: 'Hawaii' },
  { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' },
  { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' },
  { abbr: 'KS', name: 'Kansas' },
  { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' },
  { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' },
  { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' },
  { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' },
  { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' },
  { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NH', name: 'New Hampshire' },
  { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' },
  { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' },
  { abbr: 'ND', name: 'North Dakota' },
  { abbr: 'OH', name: 'Ohio' },
  { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' },
  { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'RI', name: 'Rhode Island' },
  { abbr: 'SC', name: 'South Carolina' },
  { abbr: 'SD', name: 'South Dakota' },
  { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' },
  { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' },
  { abbr: 'VA', name: 'Virginia' },
  { abbr: 'WA', name: 'Washington' },
  { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' },
  { abbr: 'WY', name: 'Wyoming' },
  { abbr: 'AA', name: 'Armed Forces Americas' },
  { abbr: 'AE', name: 'Armed Forces Europe' },
  { abbr: 'AP', name: 'Armed Forces Pacific' },
  { abbr: 'AS', name: 'American Samoa' },
  { abbr: 'GU', name: 'Guam' },
  { abbr: 'MP', name: 'Northern Mariana Islands' },
  { abbr: 'PR', name: 'Puerto Rico' },
  { abbr: 'VI', name: 'U.S. Virgin Islands' },
];

function LogisticsInvoiceLines() {
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchInvoices(filter ? { shipmentPlanId: filter } : undefined)
      .then(({ lines }) => { if (!cancelled) setLines(lines); })
      .catch(() => { if (!cancelled) setLines([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter]);

  return (
    <div className="profile-dummy-block" style={{ gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by Shipment Plan ID"
          style={{ maxWidth: 280, padding: '6px 10px', fontSize: 14 }}
        />
      </div>
      {loading && <div className="muted">Loading…</div>}
      {!loading && lines.length === 0 && <div className="muted">No logistics invoice lines yet.</div>}
      {!loading && lines.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
              <th style={{ padding: 8 }}>Type</th>
              <th style={{ padding: 8 }}>Amount</th>
              <th style={{ padding: 8 }}>Shipment Plan</th>
              <th style={{ padding: 8 }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line._id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{line.lineType}</td>
                <td style={{ padding: 8 }}>{line.amount} {line.currency}</td>
                <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 12 }}>{line.shipmentPlanId}</td>
                <td style={{ padding: 8 }}>{new Date(line.linkedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<TabId>('account');
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [llcName, setLlcName] = useState('');
  const [billingAddress, setBillingAddress] = useState<BillingAddress>(emptyBilling());
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedToken) setToken(savedToken);
    else window.location.href = '/login';
  }, []);

  useEffect(() => {
    if (!mounted || !token) return;
    setProfileLoading(true);
    fetch(apiUrl('/api/v1/auth/me'), {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load profile'))))
      .then((data: { firstName?: string; lastName?: string; email?: string; phone?: string; avatarUrl?: string; llcName?: string; billingAddress?: BillingAddress }) => {
        setFirstName(data.firstName ?? '');
        setLastName(data.lastName ?? '');
        setEmail(data.email ?? '');
        setPhone(data.phone ?? '');
        setAvatarUrl(data.avatarUrl ?? '');
        setLlcName(data.llcName ?? '');
        setBillingAddress(
          data.billingAddress
            ? {
                ...emptyBilling(),
                ...data.billingAddress,
                country: data.billingAddress.country?.trim() || 'United States',
              }
            : emptyBilling()
        );
      })
      .catch(() => setProfileMsg('Could not load profile.'))
      .finally(() => setProfileLoading(false));
  }, [mounted, token]);

  const handleSaveProfile = () => {
    if (!token) return;
    setProfileMsg(null);
    const auth: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    fetch(apiUrl('/api/v1/auth/me'), {
      method: 'PATCH',
      headers: auth,
      credentials: 'include',
      body: JSON.stringify({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        llcName: llcName.trim() || undefined,
        billingAddress: {
          addressLine1: billingAddress.addressLine1.trim() || undefined,
          addressLine2: billingAddress.addressLine2.trim() || undefined,
          city: billingAddress.city.trim() || undefined,
          state: billingAddress.state.trim() || undefined,
          zipCode: billingAddress.zipCode.trim() || undefined,
          country: billingAddress.country.trim() || undefined,
        },
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || err?.message || 'Save failed');
        }
        setProfileMsg('Profile saved.');
        setTimeout(() => setProfileMsg(null), 3000);
      })
      .catch((err: unknown) => setProfileMsg(err instanceof Error ? err.message : 'Save failed'));
  };

  const handleAvatarUpload = (file: File | null) => {
    if (!file) return;
    setProfileMsg(null);
    setAvatarUploading(true);
    uploadProfileAvatar(file)
      .then((uploaded) => {
        setAvatarUrl(uploaded.url);
        setProfileMsg('Profile image saved.');
        setTimeout(() => setProfileMsg(null), 3000);
      })
      .catch((err: unknown) => setProfileMsg(err instanceof Error ? err.message : 'Image upload failed'))
      .finally(() => setAvatarUploading(false));
  };

  const handleChangePassword = () => {
    setPwdMsg(null);
    const auth: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    fetch(apiUrl('/api/v1/auth/change-password'), {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Change password failed');
        }
        setPwdMsg('Password updated');
        setOldPwd('');
        setNewPwd('');
      })
      .catch((err: unknown) =>
        setPwdMsg(err instanceof Error ? err.message : 'Change password failed')
      );
  };

  if (!mounted) return null;

  return (
    <DashboardLayout title="Profile" subtitle="Customize your account and billing">
      <div className="profile-sections">
        <div className="profile-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'account' && (
          <section className="card">
            <div className="title">Account &amp; billing</div>
            <div className="muted">
              Complete your profile to connect to warehouses. First name, last name, email, phone, LLC name, and billing address are required for warehouse connections and invoicing.
            </div>
            {profileLoading ? (
              <div className="muted">Loading profile…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      display: 'grid',
                      placeItems: 'center',
                      background: 'linear-gradient(135deg, #3157f6, #6d28d9)',
                      color: '#fff',
                      fontWeight: 800,
                    }}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      `${firstName?.[0] || email?.[0] || 'U'}${lastName?.[0] || ''}`.toUpperCase()
                    )}
                  </div>
                  <label className="button-secondary" style={{ cursor: avatarUploading ? 'not-allowed' : 'pointer' }}>
                    {avatarUploading ? 'Uploading...' : 'Upload profile image'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      style={{ display: 'none' }}
                      disabled={avatarUploading}
                      onChange={(e) => handleAvatarUpload(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="muted" style={{ fontSize: 13 }}>First name *</span>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="muted" style={{ fontSize: 13 }}>Last name *</span>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                    />
                  </label>
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted" style={{ fontSize: 13 }}>Email *</span>
                  <input
                    type="email"
                    value={email}
                    readOnly
                    style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-muted, #f5f5f5)' }}
                  />
                  <span className="muted" style={{ fontSize: 12 }}>Email cannot be changed here.</span>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted" style={{ fontSize: 13 }}>Phone *</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 234 567 8900"
                    style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="muted" style={{ fontSize: 13 }}>LLC / legal name *</span>
                  <input
                    type="text"
                    value={llcName}
                    onChange={(e) => setLlcName(e.target.value)}
                    placeholder="Company or LLC name for invoicing"
                    style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                  />
                </label>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Billing address *</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <input
                      type="text"
                      value={billingAddress.addressLine1}
                      onChange={(e) => setBillingAddress((b) => ({ ...b, addressLine1: e.target.value }))}
                      placeholder="Address line 1"
                      style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                    />
                    <input
                      type="text"
                      value={billingAddress.addressLine2}
                      onChange={(e) => setBillingAddress((b) => ({ ...b, addressLine2: e.target.value }))}
                      placeholder="Address line 2 (optional)"
                      style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <input
                        type="text"
                        value={billingAddress.city}
                        onChange={(e) => setBillingAddress((b) => ({ ...b, city: e.target.value }))}
                        placeholder="City"
                        style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                      />
                      <select
                        value={billingAddress.state}
                        onChange={(e) => setBillingAddress((b) => ({ ...b, state: e.target.value }))}
                        style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                      >
                        <option value="">Select state</option>
                        {US_STATES.map((s) => (
                          <option key={s.abbr} value={s.abbr}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <input
                        type="text"
                        value={billingAddress.zipCode}
                        onChange={(e) => setBillingAddress((b) => ({ ...b, zipCode: e.target.value }))}
                        placeholder="ZIP / Postal code"
                        style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                      />
                      <input
                        type="text"
                        value={billingAddress.country}
                        onChange={(e) => setBillingAddress((b) => ({ ...b, country: e.target.value }))}
                        placeholder="Country"
                        style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                      />
                    </div>
                  </div>
                </div>
                <button className="button-primary" onClick={handleSaveProfile} style={{ alignSelf: 'flex-start' }}>
                  Save changes
                </button>
                {profileMsg && (
                  <div className="muted" style={{ color: profileMsg.includes('saved') ? 'var(--success, #15803d)' : 'var(--error, #b91c1c)', fontSize: 13 }}>
                    {profileMsg}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === 'billing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiCreditCard size={20} />
                <div className="title">SaaS Billing</div>
              </div>
              <div className="muted">Subscription and plan billing. (Dummy — coming soon.)</div>
              <div className="profile-dummy-block">
                <div className="muted">No invoices yet.</div>
                <button className="button-secondary" disabled>View billing history</button>
              </div>
            </section>
            <section className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiPackage size={20} />
                <div className="title">Logistics Billing</div>
              </div>
              <div className="muted">Shipping and fulfillment charges. Shipment-plan-linked line items appear here.</div>
              <LogisticsInvoiceLines />
            </section>
          </div>
        )}

        {activeTab === 'cards' && (
          <section className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiLink size={20} />
              <div className="title">Payment methods</div>
            </div>
            <div className="muted">Link cards to your account for billing.</div>
            <div className="profile-dummy-block">
              <div className="muted">No payment methods linked.</div>
              <button className="button-secondary" disabled>Add card</button>
            </div>
          </section>
        )}

        {activeTab === 'security' && (
          <section className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiLock size={20} />
              <div className="title">Change password</div>
            </div>
            <div className="muted">Update your password to keep your account secure.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
              <input
                type="password"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                placeholder="Current password"
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', minWidth: 160 }}
              />
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="New password"
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', minWidth: 160 }}
              />
              <button className="button-primary" onClick={handleChangePassword}>
                Update password
              </button>
            </div>
            {pwdMsg && (
              <div
                className="muted"
                style={{
                  color: pwdMsg.includes('failed') ? 'var(--error, #b91c1c)' : 'var(--success, #15803d)',
                  marginTop: 6,
                  fontSize: 13,
                }}
              >
                {pwdMsg}
              </div>
            )}
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
