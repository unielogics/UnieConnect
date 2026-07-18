import React, { useEffect, useState } from 'react';
import { fetchCortexPlans, approveCortexPlan, declineCortexPlan, type CortexPlan } from '../../lib/oms';

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

  const load = async () => {
    try {
      const res = await fetchCortexPlans('pending_client_approval');
      setPlans(res?.plans || []);
    } catch {
      setPlans([]);
    }
  };

  useEffect(() => { load(); }, []);

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

  if (plans.length === 0) return null;

  return (
    <div style={{ border: '1px solid var(--oms-violet-border, #c4b5fd)', background: 'var(--oms-violet-bg, #f5f3ff)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#5b21b6' }}>AI placement plans awaiting your approval</span>
        <span style={{ fontSize: 12, color: '#7c3aed' }}>{plans.length} pending</span>
      </div>
      {msg && (
        <div style={{ fontSize: 13, marginBottom: 10, color: msg.tone === 'ok' ? '#047857' : '#b91c1c' }}>{msg.text}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plans.map((p) => {
          const legs = p.plan?.legs || p.plan?.after?.legs || p.plan?.transfer_set || [];
          return (
            <div key={p.id} style={{ background: '#fff', border: '1px solid #ede9fe', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{p.summary || 'Cross-warehouse placement plan'}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
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
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#047857', marginTop: 4 }}>
                      Projected savings ~${Number(p.total_savings_usd).toFixed(0)}/mo
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <button
                    onClick={() => decline(p)}
                    disabled={busyId === p.id}
                    style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => approve(p)}
                    disabled={busyId === p.id}
                    style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {busyId === p.id ? 'Working…' : 'Approve & execute'}
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                Approving triggers a warehouse-to-warehouse transfer. Your warehouse completes the physical move.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
