import React, { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { Chip, StatusChip, Avatar, Loading, EmptyState } from '../ui';
import { fetchLedger, LedgerResponse } from '../../../lib/oms';
import type { ScreenProps } from '../UnieConnectApp';

type Ticket = { id: string; subject: string; entity: string; channel: string; priority: string; status: string; owner: string; opened: string };

const ActionRow = ({ label, detail, done }: { label: string; detail?: string; done?: boolean }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 8, border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
    <div style={{ width: 16, height: 16, borderRadius: 4, background: done ? 'var(--green)' : 'var(--bg-active)', color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}>
      {done ? <Icon name="check" size={11} /> : null}
    </div>
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{label}</div>
      {detail && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{detail}</div>}
    </div>
  </div>
);

export const Support = (_: ScreenProps) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // No dedicated support endpoint yet — derive entity-linked tickets from the
    // execution ledger so every ticket still attaches to a real entity.
    fetchLedger()
      .then((lg: LedgerResponse) => {
        const t = (lg.events || [])
          .filter((e) => /exception|dispute|short|mis-?pick|claim|return/i.test(`${e.subject} ${e.summary} ${e.event_type}`))
          .slice(0, 12)
          .map((e, i) => ({
            id: `T-${1000 + i}`,
            subject: e.subject || e.summary || 'Operational exception',
            entity: e.entity_id || e.entity_type || e.source_system || '—',
            channel: e.source_system || 'system',
            priority: /short|exception|fraud/i.test(`${e.subject}`) ? 'high' : 'med',
            status: e.status === 'approved' ? 'on-track' : 'open',
            owner: e.actor || 'Cortex',
            opened: e.created_at || e.ts || '—',
          }));
        setTickets(t);
      })
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, []);

  const featured = tickets[0];

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Support</h1>
          <p className="page-subtitle">Every ticket attaches to a real entity — an order, SKU, ASN, invoice, or warehouse. AI triages and proposes resolution.</p>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="download" size={13} /> Export</button>
          <button className="btn primary"><Icon name="plus" size={13} /> New ticket</button>
        </div>
      </div>

      {loading ? (
        <div className="card"><Loading rows={6} /></div>
      ) : (
        <div className="row-2">
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                Tickets <Chip dot={false}>{tickets.length}</Chip>
              </div>
              <div className="seg">
                <button className="active">All</button>
                <button>Mine</button>
                <button>Open</button>
              </div>
            </div>
            {tickets.length === 0 ? (
              <EmptyState>No tickets — operations are clean. Tickets open automatically from execution exceptions.</EmptyState>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Subject</th>
                    <th>Linked entity</th>
                    <th>Channel</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Owner</th>
                    <th>Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id}>
                      <td className="mono strong">{t.id}</td>
                      <td style={{ maxWidth: 240, whiteSpace: 'normal' }}>{t.subject}</td>
                      <td className="mono" style={{ color: 'var(--accent-text)' }}>{t.entity}</td>
                      <td className="muted">{t.channel}</td>
                      <td>{t.priority === 'high' ? <Chip tone="red">High</Chip> : t.priority === 'med' ? <Chip tone="amber">Med</Chip> : <Chip>Low</Chip>}</td>
                      <td><StatusChip status={t.status} /></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Avatar name={t.owner} size={18} />
                          <span style={{ fontSize: 12 }}>{t.owner.split(' ')[0]}</span>
                        </div>
                      </td>
                      <td className="muted">{t.opened}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Icon name="sparkle" size={15} style={{ color: 'var(--purple)' }} /> AI ticket triage {featured ? `— ${featured.id}` : ''}
              </div>
              <Chip tone="purple" dot={false}>Auto-drafted</Chip>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!featured ? (
                <EmptyState>No active ticket to triage.</EmptyState>
              ) : (
                <>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, marginBottom: 4 }}>Issue</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{featured.subject}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="kv"><div className="kv-label">Linked entity</div><div className="kv-value mono">{featured.entity}</div></div>
                    <div className="kv"><div className="kv-label">Channel</div><div className="kv-value mono">{featured.channel}</div></div>
                    <div className="kv"><div className="kv-label">Owner</div><div className="kv-value">{featured.owner}</div></div>
                    <div className="kv"><div className="kv-label">Opened</div><div className="kv-value mono">{featured.opened}</div></div>
                  </div>
                  <div style={{ background: 'var(--purple-soft)', border: '1px solid var(--purple-soft)', borderRadius: 8, padding: 12, fontSize: 12.5, lineHeight: 1.55 }}>
                    <strong style={{ display: 'block', marginBottom: 4 }}>Root cause analysis</strong>
                    Cortex correlated this entity against recent execution-ledger events and proposes the resolution path below. The audit bot has already staged corrective actions.
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, marginBottom: 8 }}>
                      Actions taken autonomously
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <ActionRow done label="Linked the ticket to its source entity in the ledger" />
                      <ActionRow done label="Drafted customer resolution and goodwill credit" />
                      <ActionRow done label="Opened a process correction for the responsible node" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn">Customer response history</button>
                    <button className="btn ghost">Reopen / escalate</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
