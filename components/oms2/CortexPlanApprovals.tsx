import React, { useEffect, useState } from 'react';
import { fetchCortexPlans, approveCortexPlan, declineCortexPlan, type CortexPlan } from '../../lib/oms';
import { Icon } from './icons';

/**
 * Client-facing approval surface for Cortex placement plans relayed by the owning warehouse.
 * The client sees each pending plan (before/after legs, box-snapped quantities, projected
 * savings) and gives the FINAL approval — which is the only thing that triggers real stock
 * movement (an approval-gated WMS transfer). Renders nothing when there are no pending plans.
 */
export function CortexPlanApprovals() {
  const [plans, setPlans] = useState<CortexPlan[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoadError(null);
    try {
      const res = await fetchCortexPlans('pending_client_approval');
      setPlans(res?.plans || []);
    } catch (error: any) {
      setLoadError(error?.message || 'Pending Cortex placement plans could not be loaded.');
    }
  };

  useEffect(() => { void load(); }, []);

  const approve = async (p: CortexPlan) => {
    setBusyId(p.id); setMsg(null);
    try {
      await approveCortexPlan(p.id);
      setMsg({ tone: 'ok', text: 'Approved. Your warehouse will execute the transfer.' });
      await load();
    } catch (e: any) {
      setMsg({ tone: 'err', text: e?.message || 'Approve failed' });
    } finally { setBusyId(null); }
  };

  const decline = async (p: CortexPlan) => {
    setBusyId(p.id); setMsg(null);
    try {
      await declineCortexPlan(p.id);
      await load();
    } catch (e: any) {
      setMsg({ tone: 'err', text: e?.message || 'Decline failed' });
    } finally { setBusyId(null); }
  };

  if (plans.length === 0 && !loadError) return null;

  return (
    <div style={{ border: '1px solid var(--purple-border, var(--border))', background: 'var(--purple-soft)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: loadError || plans.length ? 10 : 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--purple-text)' }}>Cortex placement plans awaiting approval</span>
        {plans.length > 0 && <span style={{ fontSize: 12, color: 'var(--purple-text)' }}>{plans.length} pending</span>}
      </div>
      {loadError && (
        <div className="inline-banner danger" role="alert" style={{ marginBottom: plans.length ? 10 : 0 }}>
          <Icon name="warning" size={13} />
          <span style={{ flex: 1 }}>{loadError} Previously loaded plans are preserved.</span>
          <button className="btn ghost sm" onClick={load}><Icon name="refresh" size={12} /> Retry plans</button>
        </div>
      )}
      {msg && (
        <div style={{ fontSize: 13, marginBottom: 10, color: msg.tone === 'ok' ? 'var(--green-text)' : 'var(--red-text)' }}>{msg.text}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plans.map((p) => {
          const legs = p.plan?.legs || p.plan?.after?.legs || p.plan?.transfer_set || [];
          return (
            <div key={p.id} style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.summary || 'Cross-warehouse placement plan'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {Array.isArray(legs) && legs.length
                      ? legs.slice(0, 4).map((l: any, i: number) => (
                          <span key={i}>
                            {(l.from || l.from_warehouse)}→{(l.to || l.to_warehouse)} · {l.sku} · <b>{l.units ?? l.quantity}</b>
                            {l.boxes != null ? ` (${l.boxes} case${l.boxes === 1 ? '' : 's'})` : ''}
                            {i < Math.min(4, legs.length) - 1 ? ' · ' : ''}
                          </span>
                        ))
                      : 'Placement adjustments across your network'}
                    {Array.isArray(legs) && legs.length > 4 ? ` +${legs.length - 4} more` : ''}
                  </div>
                  {p.total_savings_usd != null && (
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green-text)', marginTop: 4 }}>
                      Projected savings ~${Number(p.total_savings_usd).toFixed(0)}/mo
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <button
                    onClick={() => decline(p)}
                    disabled={busyId === p.id}
                    style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elev)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => approve(p)}
                    disabled={busyId === p.id}
                    style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: 'var(--purple)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {busyId === p.id ? 'Working…' : 'Approve & execute'}
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
                Approving triggers a warehouse-to-warehouse transfer. Your warehouse completes the physical move.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
