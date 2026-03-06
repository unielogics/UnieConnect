import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { TOKEN_KEY, apiUrl } from '../lib/api';
import { FiLock, FiCreditCard, FiPackage, FiLink, FiUser } from 'react-icons/fi';

type TabId = 'account' | 'billing' | 'cards' | 'security';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'account', label: 'Account', icon: <FiUser size={16} /> },
  { id: 'billing', label: 'Billing', icon: <FiCreditCard size={16} /> },
  { id: 'cards', label: 'Payment methods', icon: <FiLink size={16} /> },
  { id: 'security', label: 'Security', icon: <FiLock size={16} /> },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<TabId>('account');
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
      setName('Account name');
      setEmail('user@example.com');
    }
  }, []);

  const handleSaveProfile = () => {
    setProfileMsg(null);
    setProfileMsg('Profile saved (demo).');
    setTimeout(() => setProfileMsg(null), 3000);
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
            <div className="title">Account</div>
            <div className="muted">Update your display name and email.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="muted" style={{ fontSize: 13 }}>Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="muted" style={{ fontSize: 13 }}>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </label>
              <button className="button-primary" onClick={handleSaveProfile} style={{ alignSelf: 'flex-start' }}>
                Save changes
              </button>
              {profileMsg && (
                <div className="muted" style={{ color: 'var(--accent)', fontSize: 13 }}>{profileMsg}</div>
              )}
            </div>
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
              <div className="muted">Shipping and fulfillment charges. (Dummy — coming soon.)</div>
              <div className="profile-dummy-block">
                <div className="muted">No logistics invoices yet.</div>
                <button className="button-secondary" disabled>View logistics history</button>
              </div>
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
