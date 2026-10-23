import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { apiUrl, authFetch } from '../../../lib/api';
import { canManageUsers, fetchCurrentUser, type CurrentUser, type UserRole } from '../../../lib/user';
import type { ScreenProps } from '../UnieConnectApp';
import { Icon } from '../icons';
import { Chip, EmptyState, ErrorState, Loading, useCloseOnOmsNavigation, useModalOverlayKeyboard } from '../ui';

type TeamUser = { id: string; email: string; role: UserRole; firstName?: string; lastName?: string; phone?: string; lastLoginAt?: string; createdAt: string };
type ActivityEvent = { action: string; metadata?: Record<string, unknown>; createdAt: string };

const ROLES: UserRole[] = ['super_admin', 'management', 'ecommerce_client', 'billing'];
const ROLE_LABELS: Record<UserRole, string> = { super_admin: 'Super admin', management: 'Management', ecommerce_client: 'Ecommerce client', billing: 'Billing' };
const ACTION_LABELS: Record<string, string> = { login: 'Signed in', password_change: 'Changed password', invite_signup: 'Joined by invitation', user_created: 'Account created' };
const displayName = (user: TeamUser) => [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;
const initials = (user: TeamUser) => ([user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email.split('@')[0]).split(/[\s._-]+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'UC';
const formatDate = (value?: string, withTime = false) => {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : withTime ? date.toLocaleString() : date.toLocaleDateString();
};

export const TeamAccess = (_props: ScreenProps) => {
  const router = useRouter();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [activityUser, setActivityUser] = useState<TeamUser | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const current = await fetchCurrentUser();
      setCurrentUser(current);
      const permitted = canManageUsers(current?.role);
      setAllowed(permitted);
      if (!permitted) return;
      const response = await authFetch(apiUrl('/api/v1/users'));
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Team members could not be loaded.');
      setUsers(Array.isArray(body?.users) ? body.users : []);
    } catch (loadError: any) {
      setError(loadError?.message || 'Team members could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const openActivity = useCallback(async (user: TeamUser) => {
    setActivityUser(user);
    setActivity([]);
    setActivityError('');
    setActivityLoading(true);
    void router.replace({ pathname: '/oms', query: { view: 'team', user: user.id } }, undefined, { shallow: true });
    try {
      const response = await authFetch(apiUrl(`/api/v1/users/${encodeURIComponent(user.id)}/activity`));
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'User activity could not be loaded.');
      setActivity(Array.isArray(body?.events) ? body.events : []);
    } catch (loadError: any) {
      setActivityError(loadError?.message || 'User activity could not be loaded.');
    } finally {
      setActivityLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!router.isReady || loading || activityUser) return;
    const userId = typeof router.query.user === 'string' ? router.query.user.trim() : '';
    const user = userId ? users.find((item) => item.id === userId) : null;
    if (user) void openActivity(user);
  }, [activityUser, loading, openActivity, router.isReady, router.query.user, users]);

  const closeActivity = useCallback(async () => {
    if (router.query.user) {
      await router.replace({ pathname: '/oms', query: { view: 'team' } }, undefined, { shallow: true });
    }
    setActivityUser(null);
    setActivity([]);
    setActivityError('');
  }, [router]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => [displayName(user), user.email, user.phone, ROLE_LABELS[user.role]].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [search, users]);

  if (loading) return <div className="page fade-in"><div className="card"><Loading rows={6} /></div></div>;
  if (allowed === false) return <div className="page fade-in"><div className="page-header"><div><h1 className="page-title">Team & Access</h1><p className="page-subtitle">Account access is limited to management.</p></div></div><div className="card"><EmptyState>You do not have permission to manage team access.</EmptyState></div></div>;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Team & Access</h1><p className="page-subtitle">Manage account members, roles, invitations, and access history.</p></div>
        <div className="page-actions"><button className="btn primary" onClick={() => setCreateOpen(true)}><Icon name="plus" size={13} /> Add member</button></div>
      </div>
      {error ? <div className="card"><ErrorState message={error} onRetry={loadUsers} /></div> : (
        <div className="table-wrap">
          <div className="table-toolbar">
            <div style={{ position: 'relative', flex: '0 1 320px' }}><Icon name="search" size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search members" aria-label="Search team members" style={{ width: '100%', height: 28, padding: '0 10px 0 28px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }} /></div>
            <div className="spacer" /><span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{filtered.length} members</span>
          </div>
          {filtered.length === 0 ? <EmptyState>No team members match this search.</EmptyState> : (
            <table className="data">
              <thead><tr><th>Member</th><th>Role</th><th>Last access</th><th>Joined</th><th className="num">Actions</th></tr></thead>
              <tbody>{filtered.map((user) => <tr key={user.id} className="clickable" onClick={() => void openActivity(user)}><td><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="avatar sm" aria-hidden="true">{initials(user)}</span><div><div style={{ fontWeight: 700 }}>{displayName(user)}</div><div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{user.email}{user.phone ? ` · ${user.phone}` : ''}</div></div></div></td><td><Chip tone={user.role === 'super_admin' ? 'purple' : 'outline'} dot={false}>{ROLE_LABELS[user.role] || user.role}</Chip></td><td className="muted">{formatDate(user.lastLoginAt, true)}</td><td className="muted">{formatDate(user.createdAt)}</td><td className="num"><button className="btn ghost sm" onClick={(event) => { event.stopPropagation(); void openActivity(user); }}><Icon name="ledger" size={12} /> Activity</button></td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}
      {createOpen && <CreateMemberDrawer onClose={() => setCreateOpen(false)} onCreated={loadUsers} />}
      {activityUser && <ActivityDrawer user={activityUser} events={activity} loading={activityLoading} error={activityError} canDestroy={currentUser?.role === 'super_admin' && currentUser.userId !== activityUser.id} onClose={() => void closeActivity()} onRetry={() => void openActivity(activityUser)} onAccountChanged={async () => { await closeActivity(); await loadUsers(); }} />}
    </div>
  );
};

const CreateMemberDrawer = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) => {
  useCloseOnOmsNavigation(onClose);
  const overlayRef = useModalOverlayKeyboard(onClose);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', role: 'ecommerce_client' as UserRole });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [inviteRole, setInviteRole] = useState<UserRole>('ecommerce_client');
  const [inviteLink, setInviteLink] = useState('');
  const [inviting, setInviting] = useState(false);

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      const response = await authFetch(apiUrl('/api/v1/users'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Member could not be created.');
      await onCreated(); setMessage({ tone: 'success', text: 'Member created and added to this account.' });
      setForm({ firstName: '', lastName: '', email: '', phone: '', password: '', role: 'ecommerce_client' });
    } catch (createError: any) { setMessage({ tone: 'error', text: createError?.message || 'Member could not be created.' }); }
    finally { setSaving(false); }
  };

  const createInvite = async () => {
    setInviting(true); setMessage(null);
    try {
      const response = await authFetch(apiUrl('/api/v1/users/invites'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: inviteRole }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Invitation could not be created.');
      const link = String(body?.inviteLink || ''); setInviteLink(link.startsWith('http') ? link : `${window.location.origin}${link}`);
    } catch (inviteError: any) { setMessage({ tone: 'error', text: inviteError?.message || 'Invitation could not be created.' }); }
    finally { setInviting(false); }
  };

  return <div ref={overlayRef} className="modal-overlay" style={{ placeItems: 'stretch end' }} onClick={onClose}><div className="modal oms-side-drawer" role="dialog" aria-modal="true" aria-label="Add team member" tabIndex={-1} style={{ width: 'min(100vw, 520px)', minWidth: 0, maxHeight: '100vh', height: '100vh', borderRadius: 0 }} onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><div style={{ fontSize: 16, fontWeight: 800 }}>Add team member</div><div className="muted" style={{ fontSize: 12, marginTop: 3 }}>Create an account now or generate an invitation link.</div></div><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button></div><div className="modal-body" style={{ display: 'grid', gap: 18 }}>
    {message && <div className={`inline-banner ${message.tone === 'error' ? 'danger' : 'success'}`}>{message.text}</div>}
    <form onSubmit={create} style={{ display: 'grid', gap: 12 }}><div className="section-label">Create member</div><div className="modal-form-grid"><TeamField label="First name" value={form.firstName} onChange={(value) => setForm((current) => ({ ...current, firstName: value }))} /><TeamField label="Last name" value={form.lastName} onChange={(value) => setForm((current) => ({ ...current, lastName: value }))} /><TeamField label="Email" type="email" required value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} /><TeamField label="Phone" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} /><TeamField label="Temporary password" type="password" required value={form.password} onChange={(value) => setForm((current) => ({ ...current, password: value }))} /><label style={fieldLabelStyle}>Role<select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))} style={fieldInputStyle}>{ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label></div><button className="btn primary" type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create member'}</button></form>
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, display: 'grid', gap: 10 }}><div><div className="section-label">Invitation link</div><div className="muted" style={{ fontSize: 12, marginTop: 3 }}>Let the recipient create their own password.</div></div><label style={fieldLabelStyle}>Role<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as UserRole)} style={fieldInputStyle}>{ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label><button className="btn" type="button" disabled={inviting} onClick={createInvite}>{inviting ? 'Generating...' : 'Generate invitation link'}</button>{inviteLink && <div style={{ display: 'grid', gap: 8 }}><input readOnly value={inviteLink} style={fieldInputStyle} aria-label="Invitation link" /><button className="btn ghost sm" type="button" onClick={() => void navigator.clipboard.writeText(inviteLink)}><Icon name="copy" size={12} /> Copy link</button></div>}</div>
  </div></div></div>;
};

const ActivityDrawer = ({ user, events, loading, error, canDestroy, onClose, onRetry, onAccountChanged }: { user: TeamUser; events: ActivityEvent[]; loading: boolean; error: string; canDestroy: boolean; onClose: () => void; onRetry: () => void; onAccountChanged: () => Promise<void> }) => {
  useCloseOnOmsNavigation(onClose);
  const overlayRef = useModalOverlayKeyboard(onClose);
  return <div ref={overlayRef} className="modal-overlay" style={{ placeItems: 'stretch end' }} onClick={onClose}>
    <div className="modal oms-side-drawer" role="dialog" aria-modal="true" aria-label={`${displayName(user)} activity`} tabIndex={-1} style={{ width: 'min(100vw, 520px)', minWidth: 0, maxHeight: '100vh', height: '100vh', borderRadius: 0 }} onClick={(event) => event.stopPropagation()}>
      <div className="modal-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="avatar sm">{initials(user)}</span><div><div style={{ fontSize: 16, fontWeight: 800 }}>{displayName(user)}</div><div className="muted" style={{ fontSize: 11.5 }}>{user.email} · {ROLE_LABELS[user.role]}</div></div></div>
        <button className="icon-btn" type="button" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
      </div>
      <div className="modal-body" style={{ display: 'grid', alignContent: 'start', gap: 22 }}>
        <section><div className="section-label" style={{ marginBottom: 12 }}>Access history</div>{loading ? <Loading rows={6} /> : error ? <ErrorState message={error} onRetry={onRetry} /> : events.length === 0 ? <EmptyState>No activity has been recorded for this member.</EmptyState> : <div style={{ display: 'grid' }}>{events.map((event, index) => <div key={`${event.action}-${event.createdAt}-${index}`} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', gap: 10, padding: '12px 0', borderBottom: index < events.length - 1 ? '1px solid var(--border)' : 'none' }}><span className="sb-panel-icon"><Icon name={event.action === 'login' ? 'login' : 'ledger'} size={13} /></span><div><div style={{ fontWeight: 700 }}>{ACTION_LABELS[event.action] || event.action.replace(/_/g, ' ')}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>{formatDate(event.createdAt, true)}</div></div></div>)}</div>}</section>
        {canDestroy && <AccountControls user={user} onChanged={onAccountChanged} />}
      </div>
    </div>
  </div>;
};

const AccountControls = ({ user, onChanged }: { user: TeamUser; onChanged: () => Promise<void> }) => {
  const [mode, setMode] = useState<'reset' | 'delete' | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const exactMatch = confirmation.trim().toLowerCase() === user.email.trim().toLowerCase();

  const execute = async () => {
    if (!mode || !exactMatch) return;
    setBusy(true);
    setError('');
    try {
      const response = await authFetch(apiUrl(`/api/v1/users/${encodeURIComponent(user.id)}${mode === 'reset' ? '/reset' : ''}`), {
        method: mode === 'reset' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationEmail: confirmation.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || body?.error || `Account ${mode} failed.`);
      await onChanged();
    } catch (actionError: any) {
      setError(actionError?.message || `Account ${mode} failed.`);
    } finally {
      setBusy(false);
    }
  };

  return <section style={{ borderTop: '1px solid var(--border)', paddingTop: 18, display: 'grid', gap: 10 }}>
    <div><div className="section-label">Account controls</div><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Super administrator actions. Reset preserves login and profile; delete removes the account permanently.</div></div>
    {!mode ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><button className="btn sm" type="button" onClick={() => setMode('reset')}><Icon name="refresh" size={12} /> Reset account data</button><button className="btn sm" type="button" style={{ color: 'var(--red-text)' }} onClick={() => setMode('delete')}><Icon name="warning" size={12} /> Delete account</button></div> : <div className="inline-banner danger" style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontWeight: 800 }}>{mode === 'reset' ? 'Reset all account data?' : 'Delete this account permanently?'}</div>
      <div style={{ fontSize: 12 }}>{mode === 'reset' ? 'Connections, catalog, orders, shipments, credentials, and activity will be removed. The login and profile remain.' : 'The login and all account-owned data will be permanently removed.'}</div>
      <label style={{ display: 'grid', gap: 5, fontSize: 11, fontWeight: 800 }}>Type {user.email} to confirm<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" style={fieldInputStyle} /></label>
      {error && <div style={{ color: 'var(--red-text)', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}><button className="btn sm" type="button" onClick={() => { setMode(null); setConfirmation(''); setError(''); }} disabled={busy}>Cancel</button><button className="btn primary sm" type="button" onClick={() => void execute()} disabled={!exactMatch || busy}>{busy ? 'Working...' : mode === 'reset' ? 'Reset account data' : 'Delete account'}</button></div>
    </div>}
  </section>;
};

const fieldLabelStyle: React.CSSProperties = { display: 'grid', gap: 5, fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase' };
const fieldInputStyle: React.CSSProperties = { height: 34, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', padding: '0 10px', fontSize: 13, textTransform: 'none', fontWeight: 500 };
const TeamField = ({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) => <label style={fieldLabelStyle}>{label}<input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} style={fieldInputStyle} /></label>;
