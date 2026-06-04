import React, { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { Chip, Loading } from '../ui';
import { TOKEN_KEY, apiUrl } from '../../../lib/api';
import { uploadProfileAvatar } from '../../../lib/user';
import type { ScreenProps } from '../UnieConnectApp';

type Tab = 'account' | 'billing' | 'security';

const emptyBilling = () => ({
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'United States',
});

const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export const ProfileSettings = ({ onNavigate }: ScreenProps) => {
  const [tab, setTab] = useState<Tab>('account');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [msg, setMsg] = useState('');
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    avatarUrl: '',
    llcName: '',
    billingAddress: emptyBilling(),
  });
  const [password, setPassword] = useState({ oldPwd: '', newPwd: '' });

  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  const load = () => {
    if (!token) return;
    setLoading(true);
    fetch(apiUrl('/api/v1/auth/me'), { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load profile'))))
      .then((data) => {
        setProfile({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          phone: data.phone || '',
          avatarUrl: data.avatarUrl || '',
          llcName: data.llcName || '',
          billingAddress: { ...emptyBilling(), ...(data.billingAddress || {}) },
        });
      })
      .catch((e) => setMsg(e.message || 'Could not load profile.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const saveProfile = async () => {
    if (!token) return;
    setSaving('profile');
    setMsg('');
    try {
      const res = await fetch(apiUrl('/api/v1/auth/me'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify(profile),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || body?.message || 'Save failed');
      setMsg('Profile saved.');
    } catch (e: any) {
      setMsg(e.message || 'Save failed');
    } finally {
      setSaving('');
    }
  };

  const savePassword = async () => {
    if (!token) return;
    setSaving('password');
    setMsg('');
    try {
      const res = await fetch(apiUrl('/api/v1/auth/change-password'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ oldPassword: password.oldPwd, newPassword: password.newPwd }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || body?.message || 'Password update failed');
      setPassword({ oldPwd: '', newPwd: '' });
      setMsg('Password updated.');
    } catch (e: any) {
      setMsg(e.message || 'Password update failed');
    } finally {
      setSaving('');
    }
  };

  const uploadAvatar = async (file: File | null) => {
    if (!file) return;
    setSaving('avatar');
    setMsg('');
    try {
      const uploaded = await uploadProfileAvatar(file);
      setProfile((p) => ({ ...p, avatarUrl: uploaded.url }));
      setMsg('Profile image saved.');
    } catch (e: any) {
      setMsg(e.message || 'Image upload failed');
    } finally {
      setSaving('');
    }
  };

  const initials = `${profile.firstName?.[0] || profile.email?.[0] || 'U'}${profile.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile Settings</h1>
          <p className="page-subtitle">Account, billing profile, and access settings.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => onNavigate('command')}><Icon name="chevron" size={12} style={{ transform: 'rotate(180deg)' }} /> Back</button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {(['account', 'billing', 'security'] as Tab[]).map((id) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{id === 'account' ? 'Account' : id === 'billing' ? 'Billing' : 'Security'}</button>
        ))}
      </div>

      {msg && <div className="card" style={{ padding: 10, marginBottom: 14, color: msg.includes('failed') || msg.includes('Could') ? 'var(--red-text)' : 'var(--green-text)' }}>{msg}</div>}

      {loading ? <div className="card"><Loading rows={6} /></div> : (
        <div className="card">
          {tab === 'account' && (
            <div className="card-body" style={{ maxWidth: 720, display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, var(--accent), var(--purple))', color: 'white', fontWeight: 800 }}>
                  {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                </div>
                <label className="btn" style={{ cursor: saving === 'avatar' ? 'not-allowed' : 'pointer' }}>
                  <Icon name="download" size={13} style={{ transform: 'rotate(180deg)' }} /> {saving === 'avatar' ? 'Uploading...' : 'Upload image'}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} disabled={saving === 'avatar'} onChange={(e) => uploadAvatar(e.target.files?.[0] || null)} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="First name" value={profile.firstName} onChange={(v) => setProfile((p) => ({ ...p, firstName: v }))} />
                <Field label="Last name" value={profile.lastName} onChange={(v) => setProfile((p) => ({ ...p, lastName: v }))} />
              </div>
              <Field label="Email" value={profile.email} readOnly onChange={() => {}} />
              <Field label="Phone" value={profile.phone} onChange={(v) => setProfile((p) => ({ ...p, phone: v }))} />
              <Field label="LLC / legal name" value={profile.llcName} onChange={(v) => setProfile((p) => ({ ...p, llcName: v }))} />
              <button className="btn primary" style={{ justifySelf: 'start' }} onClick={saveProfile} disabled={saving === 'profile'}>{saving === 'profile' ? 'Saving...' : 'Save profile'}</button>
            </div>
          )}
          {tab === 'billing' && (
            <div className="card-body" style={{ maxWidth: 720, display: 'grid', gap: 12 }}>
              <Chip tone="purple" dot={false}>Billing profile</Chip>
              <Field label="Address line 1" value={profile.billingAddress.addressLine1} onChange={(v) => setProfile((p) => ({ ...p, billingAddress: { ...p.billingAddress, addressLine1: v } }))} />
              <Field label="Address line 2" value={profile.billingAddress.addressLine2} onChange={(v) => setProfile((p) => ({ ...p, billingAddress: { ...p.billingAddress, addressLine2: v } }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px', gap: 12 }}>
                <Field label="City" value={profile.billingAddress.city} onChange={(v) => setProfile((p) => ({ ...p, billingAddress: { ...p.billingAddress, city: v } }))} />
                <label style={labelStyle}>State<select value={profile.billingAddress.state} onChange={(e) => setProfile((p) => ({ ...p, billingAddress: { ...p.billingAddress, state: e.target.value } }))} style={inputStyle}><option value="">State</option>{STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
                <Field label="ZIP" value={profile.billingAddress.zipCode} onChange={(v) => setProfile((p) => ({ ...p, billingAddress: { ...p.billingAddress, zipCode: v } }))} />
              </div>
              <Field label="Country" value={profile.billingAddress.country} onChange={(v) => setProfile((p) => ({ ...p, billingAddress: { ...p.billingAddress, country: v } }))} />
              <button className="btn primary" style={{ justifySelf: 'start' }} onClick={saveProfile} disabled={saving === 'profile'}>{saving === 'profile' ? 'Saving...' : 'Save billing profile'}</button>
            </div>
          )}
          {tab === 'security' && (
            <div className="card-body" style={{ maxWidth: 520, display: 'grid', gap: 12 }}>
              <Field label="Current password" type="password" value={password.oldPwd} onChange={(v) => setPassword((p) => ({ ...p, oldPwd: v }))} />
              <Field label="New password" type="password" value={password.newPwd} onChange={(v) => setPassword((p) => ({ ...p, newPwd: v }))} />
              <button className="btn primary" style={{ justifySelf: 'start' }} onClick={savePassword} disabled={saving === 'password'}>{saving === 'password' ? 'Updating...' : 'Update password'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const labelStyle: React.CSSProperties = { display: 'grid', gap: 5, fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase' };
const inputStyle: React.CSSProperties = { height: 34, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', padding: '0 10px', fontSize: 13, textTransform: 'none', fontWeight: 500 };

const Field = ({ label, value, onChange, readOnly, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; readOnly?: boolean; type?: string }) => (
  <label style={labelStyle}>
    {label}
    <input type={type} value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, opacity: readOnly ? 0.7 : 1 }} />
  </label>
);
