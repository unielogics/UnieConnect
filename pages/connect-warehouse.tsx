import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Activity, Trash2, Check, Loader2, Plus } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { Modal } from '../components/Modal';
import { apiUrl, TOKEN_KEY } from '../lib/api';

type Warehouse = {
  warehouseCode: string;
  name: string;
  state: string | null;
  city: string | null;
  address: string | null;
  connectedAt?: string;
};

const missingFieldLabels: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  phone: 'Phone',
  llcName: 'LLC / legal name',
  billingAddressLine1: 'Billing address line 1',
  billingCity: 'Billing city',
  billingState: 'Billing state',
  billingZipCode: 'Billing ZIP',
  billingCountry: 'Billing country',
};

export default function ConnectWarehousePage() {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [connectionCode, setConnectionCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectSuccess, setConnectSuccess] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [removeModal, setRemoveModal] = useState<Warehouse | null>(null);
  const [removeConfirming, setRemoveConfirming] = useState(false);
  const [testResult, setTestResult] = useState<{ code: string; ok: boolean } | null>(null);

  const fetchWarehouses = async () => {
    if (!token) return;
    setWarehousesLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/oms/warehouses'), {
        headers: { Authorization: `Bearer ${token.trim()}` },
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) setWarehouses(data.warehouses || []);
    } catch {
      setWarehouses([]);
    } finally {
      setWarehousesLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) setToken(saved);
    else window.location.href = '/login';
  }, []);

  useEffect(() => {
    if (!mounted || !token) return;
    fetchWarehouses();
  }, [mounted, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !connectionCode.trim()) return;
    setLoading(true);
    setMessage(null);
    setError(false);
    setProfileIncomplete(false);
    setMissingFields([]);
    setConnectSuccess(false);
    setTestResult(null);
    try {
      const res = await fetch(apiUrl('/api/v1/oms/connect'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.trim()}`,
        },
        credentials: 'include',
        body: JSON.stringify({ connectionCode: connectionCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setConnectSuccess(true);
        setMessage(data.message || 'Successfully connected.');
        setConnectionCode('');
        await fetchWarehouses();
        setTimeout(() => {
          setConnectSuccess(false);
          setAddModalOpen(false);
          setMessage(null);
        }, 1200);
      } else {
        const isProfileIncomplete = res.status === 400 && data.error === 'profile_incomplete';
        setMissingFields(Array.isArray(data.missingFields) ? data.missingFields.map(String) : []);
        setMessage(isProfileIncomplete ? (data.message || 'Complete your profile before connecting.') : (data.message || data.error || 'Connection failed.'));
        setError(true);
        setProfileIncomplete(!!isProfileIncomplete);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Connection failed.');
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!token) return;
    setActionBusy('refresh');
    setTestResult(null);
    try {
      await fetchWarehouses();
    } finally {
      setActionBusy(null);
    }
  };

  const handleTest = async (warehouseCode: string) => {
    if (!token) return;
    setActionBusy(warehouseCode);
    setTestResult(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/oms/warehouses/${encodeURIComponent(warehouseCode)}/test`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.trim()}` },
        credentials: 'include',
      });
      const data = await res.json();
      setTestResult({ code: warehouseCode, ok: data.ok === true });
    } catch {
      setTestResult({ code: warehouseCode, ok: false });
    } finally {
      setActionBusy(null);
    }
  };

  const handleRemove = async () => {
    if (!token || !removeModal) return;
    setRemoveConfirming(true);
    try {
      const res = await fetch(apiUrl(`/api/v1/oms/warehouses/${encodeURIComponent(removeModal.warehouseCode)}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token.trim()}` },
        credentials: 'include',
      });
      if (res.ok) {
        setRemoveModal(null);
        await fetchWarehouses();
      } else {
        const data = await res.json();
        setMessage(data.error || 'Failed to remove connection');
        setError(true);
      }
    } catch {
      setMessage('Failed to remove connection');
      setError(true);
    } finally {
      setRemoveConfirming(false);
    }
  };

  const openAddModal = () => {
    setConnectionCode('');
    setMessage(null);
    setError(false);
    setMissingFields([]);
    setAddModalOpen(true);
  };

  if (!mounted) {
    return (
      <DashboardLayout title="My 3PLs" subtitle="Loading...">
        <div className="card">
          <div className="muted">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="My 3PLs"
      subtitle="Manage your third-party logistics partners"
    >
      {profileIncomplete && message && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: 18,
            borderRadius: 12,
            background: '#fff7ed',
            border: '1px solid #fdba74',
            color: 'var(--error, #b91c1c)',
            fontSize: 14,
          }}
        >
          <div style={{ fontWeight: 900, color: '#9a3412', marginBottom: 6 }}>Profile required before warehouse connection</div>
          <div style={{ color: '#7c2d12' }}>{message}</div>
          {missingFields.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {missingFields.map((field) => (
                <span key={field} style={{ padding: '5px 8px', borderRadius: 999, background: '#ffedd5', border: '1px solid #fed7aa', color: '#9a3412', fontSize: 12, fontWeight: 700 }}>
                  {missingFieldLabels[field] || field}
                </span>
              ))}
            </div>
          )}
          <Link href="/profile" className="button-primary" style={{ display: 'inline-flex', marginTop: 12, textDecoration: 'none' }}>
            Open Profile Settings
          </Link>
        </div>
      )}
      <section className="card users-table-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            className="button-primary"
            onClick={openAddModal}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}
          >
            <Plus size={16} />
            Add new 3PL
          </button>
          <button
              type="button"
              className="button-secondary"
              onClick={handleRefresh}
              disabled={warehousesLoading || actionBusy === 'refresh'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13 }}
            >
              {actionBusy === 'refresh' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Refresh
          </button>
        </div>

        {warehousesLoading ? (
          <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 24 }}>
            <Loader2 size={18} className="animate-spin" />
            Loading?
          </div>
        ) : warehouses.length === 0 ? (
          <div className="muted" style={{ padding: 24, textAlign: 'center', fontSize: 14 }}>
            No 3PLs connected. Click Add new 3PL to connect one.
          </div>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Shipping address</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((wh) => (
                  <tr key={wh.warehouseCode}>
                    <td>
                      <strong>{wh.name || wh.warehouseCode}</strong>
                    </td>
                    <td>
                      <span className="muted">{wh.warehouseCode}</span>
                    </td>
                    <td>
                      <span className="muted" style={{ fontSize: 13 }}>
                        {wh.address || '?'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--success, #15803d)' }}>Connected</span>
                      {testResult?.code === wh.warehouseCode && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 12,
                            color: testResult.ok ? 'var(--success)' : 'var(--error, #b91c1c)',
                          }}
                        >
                          {testResult.ok ? 'Test passed' : 'Test failed'}
                        </span>
                      )}
                    </td>
                    <td className="users-table-actions">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          className="wh-action-btn"
                          onClick={() => handleTest(wh.warehouseCode)}
                          disabled={!!actionBusy}
                          title="Test connection"
                        >
                          {actionBusy === wh.warehouseCode ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Activity size={16} />
                          )}
                        </button>
                        <button
                          type="button"
                          className="wh-action-btn wh-action-btn-remove"
                          onClick={() => setRemoveModal(wh)}
                          disabled={!!actionBusy}
                          title="Remove connection"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        isOpen={addModalOpen}
        onClose={() => !loading && setAddModalOpen(false)}
        title="Add new 3PL"
        size="sm"
        footer={
          <button className="button-secondary" onClick={() => !loading && setAddModalOpen(false)}>
            Close
          </button>
        }
      >
        <p className="muted" style={{ marginBottom: 16, fontSize: 14 }}>
          Enter the connection code provided by your 3PL to link your account.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              Connection code
            </span>
            <input
              type="text"
              value={connectionCode}
              onChange={(e) => setConnectionCode(e.target.value)}
              placeholder="e.g. NJ-472221"
              disabled={loading}
              style={{
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 16,
              }}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="submit"
              className="button-primary"
              disabled={loading || !connectionCode.trim()}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Loader2 className="animate-spin" size={18} strokeWidth={2} />
                  Connecting?
                </span>
              ) : connectSuccess ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={18} strokeWidth={2.5} />
                  Connected
                </span>
              ) : (
                'Connect'
              )}
            </button>
            {message && (
              <div
                role={error ? 'alert' : 'status'}
                style={{
                  width: '100%',
                  padding: 14,
                  borderRadius: 10,
                  border: `1px solid ${error ? '#fecaca' : '#86efac'}`,
                  background: error ? '#fef2f2' : '#dcfce7',
                  fontSize: 14,
                  color: error ? '#991b1b' : '#166534',
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 4 }}>
                  {error ? 'Connection needs attention' : 'Warehouse connection saved'}
                </div>
                <div>{message}</div>
                {missingFields.length > 0 && (
                  <>
                    <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800 }}>Missing profile fields:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {missingFields.map((field) => (
                        <span key={field} style={{ padding: '5px 8px', borderRadius: 999, background: '#fee2e2', border: '1px solid #fecaca', fontSize: 12, fontWeight: 700 }}>
                          {missingFieldLabels[field] || field}
                        </span>
                      ))}
                    </div>
                    <Link href="/profile" className="button-primary" style={{ display: 'inline-flex', marginTop: 12, textDecoration: 'none' }}>
                      Open Profile Settings
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!removeModal}
        onClose={() => !removeConfirming && setRemoveModal(null)}
        title="Remove 3PL connection"
        size="sm"
        footer={
          <>
            <button
              className="button-secondary"
              onClick={() => setRemoveModal(null)}
              disabled={removeConfirming}
            >
              Cancel
            </button>
            <button
              className="button-primary"
              onClick={handleRemove}
              disabled={removeConfirming}
              style={{ background: 'var(--error, #b91c1c)' }}
            >
              {removeConfirming ? 'Removing?' : 'Remove'}
            </button>
          </>
        }
      >
        {removeModal && (
          <p className="muted" style={{ fontSize: 14 }}>
            Remove connection to <strong>{removeModal.name || removeModal.warehouseCode}</strong> (
            {removeModal.warehouseCode})? You can reconnect later with the same connection code.
          </p>
        )}
      </Modal>

      <style jsx>{`
        :global(.animate-spin) {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        :global(.wh-action-btn) {
          padding: 8px;
          border: none;
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          color: var(--text-muted, #6b7280);
          transition: color 0.15s, background 0.15s;
        }
        :global(.wh-action-btn:disabled) {
          cursor: not-allowed;
          opacity: 0.5;
        }
        :global(.wh-action-btn:not(:disabled):hover) {
          background: rgba(0, 0, 0, 0.06);
          color: var(--text, #111);
        }
        :global(.wh-action-btn-remove:not(:disabled):hover) {
          background: rgba(185, 28, 28, 0.08);
          color: var(--error, #b91c1c);
        }
      `}</style>
    </DashboardLayout>
  );
}
