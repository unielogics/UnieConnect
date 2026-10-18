import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiUrl, authFetch } from '../../../lib/api';
import { canManageUsers, fetchCurrentUser } from '../../../lib/user';
import type { ScreenProps } from '../UnieConnectApp';
import { Icon } from '../icons';
import { Chip, EmptyState, ErrorState, Loading, useCloseOnOmsNavigation, useModalOverlayKeyboard } from '../ui';

type OmsAccount = { id: string; companyName: string; email: string; status: string; createdAt: string };
type Facility = { id: string; name: string; code: string; city?: string; state?: string };
type DrawerMode = 'create' | 'warehouse' | 'key';

const formatDate = (value?: string) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString();
};

export const OmsAdministration = (_props: ScreenProps) => {
  const [accounts, setAccounts] = useState<OmsAccount[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState<DrawerMode | null>(null);
  const [selected, setSelected] = useState<OmsAccount | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const current = await fetchCurrentUser();
      const permitted = canManageUsers(current?.role);
      setAllowed(permitted);
      if (!permitted) return;
      const [accountResponse, facilityResponse] = await Promise.all([
        authFetch(apiUrl('/api/v1/oms/accounts')),
        authFetch(apiUrl('/api/v1/oms/facilities')),
      ]);
      const [accountBody, facilityBody] = await Promise.all([
        accountResponse.json().catch(() => ({})),
        facilityResponse.json().catch(() => ({})),
      ]);
      if (!accountResponse.ok) throw new Error(accountBody?.error || 'OMS accounts could not be loaded.');
      if (!facilityResponse.ok) throw new Error(facilityBody?.error || 'Warehouse facilities could not be loaded.');
      setAccounts(Array.isArray(accountBody?.accounts) ? accountBody.accounts : []);
      setFacilities(Array.isArray(facilityBody?.facilities) ? facilityBody.facilities : []);
    } catch (loadError: any) {
      setError(loadError?.message || 'OMS administration could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return accounts;
    return accounts.filter((account) => [account.companyName, account.email, account.id, account.status].some((value) => value.toLowerCase().includes(query)));
  }, [accounts, search]);

  const openDrawer = (mode: DrawerMode, account: OmsAccount | null = null) => { setSelected(account); setDrawer(mode); };
  const closeDrawer = () => { setDrawer(null); setSelected(null); };

  if (loading) return <div className="page fade-in"><div className="card"><Loading rows={6} /></div></div>;
  if (allowed === false) return <div className="page fade-in"><div className="page-header"><div><h1 className="page-title">OMS Administration</h1><p className="page-subtitle">Management access is required.</p></div></div><div className="card"><EmptyState>You do not have permission to administer OMS accounts.</EmptyState></div></div>;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div><h1 className="page-title">OMS Administration</h1><p className="page-subtitle">Accounts, warehouse links, and scoped API credentials.</p></div>
        <div className="page-actions"><button className="btn primary" onClick={() => openDrawer('create')}><Icon name="plus" size={13} /> Create account</button></div>
      </div>
      {error ? <div className="card"><ErrorState message={error} onRetry={load} /></div> : (
        <div className="table-wrap">
          <div className="table-toolbar">
            <div style={{ position: 'relative', flex: '0 1 340px' }}><Icon name="search" size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search accounts" aria-label="Search OMS accounts" style={{ width: '100%', height: 28, padding: '0 10px 0 28px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }} /></div>
            <div className="spacer" /><span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{filtered.length} accounts · {facilities.length} facilities</span>
          </div>
          {filtered.length === 0 ? <EmptyState>No OMS accounts match this search.</EmptyState> : (
            <table className="data">
              <thead><tr><th>Account</th><th>Status</th><th>Created</th><th>Account ID</th><th className="num">Actions</th></tr></thead>
              <tbody>{filtered.map((account) => <tr key={account.id}><td><div style={{ fontWeight: 700 }}>{account.companyName}</div><div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{account.email}</div></td><td><Chip tone={account.status === 'active' ? 'green' : 'outline'} dot={false}>{account.status}</Chip></td><td className="muted">{formatDate(account.createdAt)}</td><td className="mono muted">{account.id.slice(-12)}</td><td className="num"><div style={{ display: 'inline-flex', gap: 6 }}><button className="btn ghost sm" onClick={() => openDrawer('warehouse', account)}><Icon name="inventory" size={12} /> Link warehouse</button><button className="btn ghost sm" onClick={() => openDrawer('key', account)}><Icon name="settings" size={12} /> API key</button></div></td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}
      {drawer && <AdminDrawer mode={drawer} account={selected} accounts={accounts} facilities={facilities} onClose={closeDrawer} onChanged={load} />}
    </div>
  );
};

const AdminDrawer = ({ mode, account, accounts, facilities, onClose, onChanged }: { mode: DrawerMode; account: OmsAccount | null; accounts: OmsAccount[]; facilities: Facility[]; onClose: () => void; onChanged: () => Promise<void> }) => {
  useCloseOnOmsNavigation(onClose);
  const overlayRef = useModalOverlayKeyboard(onClose);
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState(account?.id || '');
  const [facilityId, setFacilityId] = useState('');
  const [keyName, setKeyName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const title = mode === 'create' ? 'Create OMS account' : mode === 'warehouse' ? 'Link receiving warehouse' : 'Create scoped API key';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage(null); setApiKey('');
    try {
      let response: Response;
      if (mode === 'create') response = await authFetch(apiUrl('/api/v1/oms/accounts'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyName: companyName.trim(), email: email.trim().toLowerCase() }) });
      else if (mode === 'warehouse') response = await authFetch(apiUrl(`/api/v1/oms/accounts/${encodeURIComponent(accountId)}/link-warehouse`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ facilityId }) });
      else response = await authFetch(apiUrl(`/api/v1/oms/accounts/${encodeURIComponent(accountId)}/api-keys`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: keyName.trim() || 'OMS API Key' }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || `${title} failed.`);
      if (mode === 'key') setApiKey(String(body?.apiKey || ''));
      await onChanged();
      setMessage({ tone: 'success', text: mode === 'create' ? 'OMS account created.' : mode === 'warehouse' ? 'Warehouse linked to this account.' : (body?.warning || 'API key created. Save it now.') });
      if (mode === 'create') { setCompanyName(''); setEmail(''); }
    } catch (submitError: any) {
      setMessage({ tone: 'error', text: submitError?.message || `${title} failed.` });
    } finally { setSaving(false); }
  };

  return <div ref={overlayRef} className="modal-overlay" style={{ placeItems: 'stretch end' }} onClick={onClose}><div className="modal oms-side-drawer" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} style={{ width: 'min(100vw, 500px)', minWidth: 0, maxHeight: '100vh', height: '100vh', borderRadius: 0 }} onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div><div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{mode === 'create' ? 'Create a managed OMS account.' : mode === 'warehouse' ? 'Connect an existing facility as the receiving warehouse.' : 'The key is shown once and cannot be recovered.'}</div></div><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button></div><form className="modal-body" onSubmit={submit} style={{ display: 'grid', gap: 13 }}>
    {message && <div className={`inline-banner ${message.tone === 'error' ? 'danger' : 'success'}`}>{message.text}</div>}
    {mode === 'create' ? <><Field label="Company name" value={companyName} required onChange={setCompanyName} /><Field label="Account email" type="email" value={email} required onChange={setEmail} /></> : <label style={labelStyle}>OMS account<select value={accountId} required onChange={(event) => setAccountId(event.target.value)} style={inputStyle}><option value="">Select account</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.companyName} ({item.email})</option>)}</select></label>}
    {mode === 'warehouse' && <label style={labelStyle}>Receiving warehouse<select value={facilityId} required onChange={(event) => setFacilityId(event.target.value)} style={inputStyle}><option value="">Select facility</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name} ({facility.code}){facility.city || facility.state ? ` · ${[facility.city, facility.state].filter(Boolean).join(', ')}` : ''}</option>)}</select></label>}
    {mode === 'key' && <Field label="Key name" value={keyName} onChange={setKeyName} placeholder="Production integration" />}
    {apiKey && <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', padding: 12, display: 'grid', gap: 8 }}><div style={{ fontWeight: 800 }}>Save this key now</div><code style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{apiKey}</code><button className="btn ghost sm" type="button" onClick={() => void navigator.clipboard.writeText(apiKey)}><Icon name="copy" size={12} /> Copy key</button></div>}
    <button className="btn primary" type="submit" disabled={saving}>{saving ? 'Saving...' : mode === 'create' ? 'Create account' : mode === 'warehouse' ? 'Link warehouse' : 'Create API key'}</button>
  </form></div></div>;
};

const labelStyle: React.CSSProperties = { display: 'grid', gap: 5, fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase' };
const inputStyle: React.CSSProperties = { height: 34, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', padding: '0 10px', fontSize: 13, textTransform: 'none', fontWeight: 500 };
const Field = ({ label, value, onChange, type = 'text', required = false, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string }) => <label style={labelStyle}>{label}<input type={type} value={value} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} style={inputStyle} /></label>;
