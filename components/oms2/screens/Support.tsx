import React, { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { Chip, StatusChip, Avatar, Loading, EmptyState, Modal } from '../ui';
import {
  addTicketMessage,
  entityPrefix,
  fetchLedger,
  fetchTicketDetail,
  fetchTickets,
  LedgerResponse,
  publicEntityId,
  SupportTicket,
  SupportTicketMessage,
  updateTicketStatus,
  uploadSupportAttachment,
  UploadedAttachment,
} from '../../../lib/oms';
import type { ScreenProps } from '../UnieConnectApp';

type TicketRow = SupportTicket & { opened?: string };

const field: React.CSSProperties = {
  width: '100%',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  outline: 'none',
  padding: '9px 10px',
  fontSize: 12.5,
};

const displayTicketId = (ticket: Pick<SupportTicket, 'id' | 'displayId' | 'publicId'>) =>
  ticket.displayId || ticket.publicId || publicEntityId('TI', ticket.id);

const displayEntityId = (ticket: SupportTicket) =>
  ticket.linkedEntityDisplayId ||
  ticket.entityDisplayId ||
  (ticket.entityId ? publicEntityId(entityPrefix(ticket.entityType), ticket.entityId) : 'Not linked');

const fmtDate = (value?: string) => {
  if (!value || value === '-') return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
};

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

const TicketModal = ({
  ticket,
  messages,
  loading,
  onClose,
  onReload,
}: {
  ticket: TicketRow;
  messages: SupportTicketMessage[];
  loading: boolean;
  onClose: () => void;
  onReload: () => Promise<void>;
}) => {
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!body.trim() && files.length === 0) {
      setErr('Add a response or attach a file.');
      return;
    }
    setSending(true);
    setErr(null);
    try {
      const attachments: UploadedAttachment[] = [];
      for (const file of files) {
        attachments.push(await uploadSupportAttachment(file));
      }
      await addTicketMessage(ticket.id, {
        body: body.trim() || undefined,
        attachments,
        authorType: 'client',
      });
      setBody('');
      setFiles([]);
      await onReload();
    } catch (e: any) {
      setErr(e.message || 'Failed to send response');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      title={`Ticket ${displayTicketId(ticket)}`}
      subtitle={`${ticket.subject} - ${displayEntityId(ticket)}`}
      onClose={onClose}
      fullscreen
      chrome={<StatusChip status={ticket.status || 'open'} />}
      footer={
        <>
          <div style={{ fontSize: 12, color: err ? 'var(--red-text)' : 'var(--text-tertiary)' }}>
            {err || 'Responses and attachments are stored on the ticket history for this account.'}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn ghost" onClick={onClose}>Close</button>
            <button className="btn primary" onClick={submit} disabled={sending}>
              {sending ? 'Sending...' : 'Send response'}
            </button>
          </div>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) 360px', gap: 16, maxWidth: 1180, margin: '0 auto' }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Conversation</div>
            <Chip dot={false}>{messages.length} messages</Chip>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading ? (
              <Loading rows={3} />
            ) : messages.length === 0 ? (
              <div style={{ padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Initial issue</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ticket.body || ticket.subject}</div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} style={{ padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 8, background: m.authorType === 'client' ? 'var(--bg-elev)' : 'var(--bg-sunken)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <strong style={{ fontSize: 12.5 }}>{m.authorName || (m.authorType === 'client' ? 'Client' : 'Cortex Support')}</strong>
                    <span className="mono muted" style={{ fontSize: 11 }}>{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</span>
                  </div>
                  {m.body && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{m.body}</div>}
                  {!!m.attachments?.length && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {m.attachments.map((a) => (
                        <a key={a.key || a.url} className="btn ghost sm" href={a.url} target="_blank" rel="noreferrer">
                          <Icon name="download" size={12} /> {a.filename || a.key?.split('/').pop() || 'Attachment'}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Client response
              </label>
              <textarea
                style={{ ...field, height: 130, marginTop: 6, resize: 'vertical' }}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write the customer, supplier, warehouse, or internal response here..."
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <label className="btn ghost sm" style={{ cursor: 'pointer' }}>
                  <Icon name="plus" size={12} /> Attach files
                  <input
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  />
                </label>
                <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {files.length ? files.map((f) => f.name).join(', ') : 'PDF, CSV, spreadsheet, document, or image attachments'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">Ticket summary</div></div>
            <div className="card-body" style={{ display: 'grid', gap: 10 }}>
              <div className="kv"><div className="kv-label">Ticket ID</div><div className="kv-value mono">{displayTicketId(ticket)}</div></div>
              <div className="kv"><div className="kv-label">Linked entity</div><div className="kv-value mono">{displayEntityId(ticket)}</div></div>
              <div className="kv"><div className="kv-label">Entity type</div><div className="kv-value">{ticket.entityType || 'None'}</div></div>
              <div className="kv"><div className="kv-label">Channel</div><div className="kv-value">{ticket.channel || 'internal'}</div></div>
              <div className="kv"><div className="kv-label">Priority</div><div className="kv-value">{ticket.priority || 'med'}</div></div>
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Icon name="sparkle" size={15} style={{ color: 'var(--purple)' }} /> Cortex triage</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ActionRow done label="Linked the ticket to its source entity" />
              <ActionRow done label="Prepared the resolution history for review" />
              <ActionRow label="Waiting for client response or evidence attachment" detail="Attach proof, carrier documents, labels, or order screenshots before resolution." />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export const Support = ({ onNewTicket }: ScreenProps) => {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchTickets()
      .then((d) => {
        setTickets(
          (d.tickets || []).map((t) => ({
            ...t,
            opened: t.createdAt || '-',
          })),
        );
      })
      .catch(() =>
        fetchLedger()
          .then((lg: LedgerResponse) => {
            const t = (lg.events || [])
              .filter((e) => /exception|dispute|short|mis-?pick|claim|return/i.test(`${e.subject} ${e.summary} ${e.event_type}`))
              .slice(0, 12)
              .map((e, i) => ({
                id: `fallback-${i}`,
                publicId: publicEntityId('TI', e.id || i),
                subject: e.subject || e.summary || 'Operational exception',
                entityType: e.entity_type || 'ledger',
                entityId: e.entity_id,
                entityDisplayId: e.entity_id ? publicEntityId(entityPrefix(e.entity_type), e.entity_id) : undefined,
                channel: e.source_system || 'system',
                priority: /short|exception|fraud/i.test(`${e.subject}`) ? 'high' : 'med',
                status: e.status === 'approved' ? 'on-track' : 'open',
                owner: e.actor || 'Cortex',
                createdAt: e.created_at || e.ts,
                opened: e.created_at || e.ts || '-',
              }));
            setTickets(t as TicketRow[]);
          })
          .catch(() => setTickets([])),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const reloadSelected = async () => {
    if (!selected || selected.id.startsWith('fallback-')) return;
    setDetailLoading(true);
    try {
      const d = await fetchTicketDetail(selected.id);
      setSelected({ ...d.ticket, opened: d.ticket.createdAt || '-' });
      setMessages(d.messages || []);
    } finally {
      setDetailLoading(false);
    }
  };

  const openTicket = async (ticket: TicketRow) => {
    setSelected(ticket);
    setMessages([]);
    if (ticket.id.startsWith('fallback-')) return;
    setDetailLoading(true);
    try {
      const d = await fetchTicketDetail(ticket.id);
      setSelected({ ...d.ticket, opened: d.ticket.createdAt || '-' });
      setMessages(d.messages || []);
    } finally {
      setDetailLoading(false);
    }
  };

  const changeStatus = async (ticket: TicketRow, status: string) => {
    if (ticket.id.startsWith('fallback-')) return;
    setUpdating(ticket.id);
    try {
      await updateTicketStatus(ticket.id, status);
      await load();
      if (selected?.id === ticket.id) await reloadSelected();
    } finally {
      setUpdating(null);
    }
  };

  const featured = selected || tickets[0];

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Support</h1>
          <p className="page-subtitle">Ticketing tied to OMS entities, customer responses, evidence attachments, and Cortex triage.</p>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="download" size={13} /> Export</button>
          <button className="btn primary" onClick={onNewTicket}><Icon name="plus" size={13} /> New ticket</button>
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
              <EmptyState>No tickets. Operations are clean, and new exceptions will open ticket records automatically.</EmptyState>
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} className="clickable" onClick={() => openTicket(t)}>
                      <td className="mono strong">{displayTicketId(t)}</td>
                      <td style={{ maxWidth: 260, whiteSpace: 'normal' }}>
                        <div style={{ fontWeight: 600 }}>{t.subject}</div>
                        <div className="muted" style={{ fontSize: 10.5 }}>{t.messagesCount || 0} responses - {t.attachmentsCount || 0} files</div>
                      </td>
                      <td className="mono" style={{ color: 'var(--accent-text)' }}>{displayEntityId(t)}</td>
                      <td className="muted">{t.channel || 'internal'}</td>
                      <td>{t.priority === 'high' ? <Chip tone="red">High</Chip> : t.priority === 'med' ? <Chip tone="amber">Med</Chip> : <Chip>Low</Chip>}</td>
                      <td><StatusChip status={t.status || 'open'} /></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Avatar name={t.owner || 'Cortex'} size={18} />
                          <span style={{ fontSize: 12 }}>{(t.owner || 'Cortex').split(' ')[0]}</span>
                        </div>
                      </td>
                      <td className="muted">{fmtDate(t.opened)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {t.status !== 'in-progress' && (
                            <button className="btn ghost sm" disabled={updating === t.id || t.id.startsWith('fallback-')} onClick={() => changeStatus(t, 'in-progress')}>
                              Start
                            </button>
                          )}
                          {t.status !== 'resolved' && (
                            <button className="btn ghost sm" disabled={updating === t.id || t.id.startsWith('fallback-')} onClick={() => changeStatus(t, 'resolved')}>
                              Resolve
                            </button>
                          )}
                          <button className="btn ghost sm" onClick={() => openTicket(t)}>Respond</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Icon name="sparkle" size={15} style={{ color: 'var(--purple)' }} /> AI ticket triage {featured ? `- ${displayTicketId(featured)}` : ''}
              </div>
              <Chip tone="purple" dot={false}>Evidence-ready</Chip>
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
                    <div className="kv"><div className="kv-label">Linked entity</div><div className="kv-value mono">{displayEntityId(featured)}</div></div>
                    <div className="kv"><div className="kv-label">Channel</div><div className="kv-value mono">{featured.channel || 'internal'}</div></div>
                    <div className="kv"><div className="kv-label">Owner</div><div className="kv-value">{featured.owner || 'Cortex'}</div></div>
                    <div className="kv"><div className="kv-label">Opened</div><div className="kv-value mono">{featured.opened || '-'}</div></div>
                  </div>
                  <div style={{ background: 'var(--purple-soft)', border: '1px solid var(--purple-soft)', borderRadius: 8, padding: 12, fontSize: 12.5, lineHeight: 1.55 }}>
                    <strong style={{ display: 'block', marginBottom: 4 }}>Resolution workspace</strong>
                    Open the ticket to respond, attach labels, ASNs, BOLs, screenshots, carrier evidence, or warehouse proof. Cortex keeps that evidence linked to the source entity.
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn" onClick={() => featured && openTicket(featured)}>Open response thread</button>
                    <button className="btn ghost" disabled={featured.id.startsWith('fallback-')} onClick={() => changeStatus(featured, 'open')}>Reopen</button>
                    <button className="btn ghost" disabled={featured.id.startsWith('fallback-')} onClick={() => changeStatus(featured, 'escalated')}>Escalate</button>
                    <button className="btn primary" disabled={featured.id.startsWith('fallback-')} onClick={() => changeStatus(featured, 'resolved')}>Mark resolved</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {selected && (
        <TicketModal
          ticket={selected}
          messages={messages}
          loading={detailLoading}
          onClose={() => setSelected(null)}
          onReload={reloadSelected}
        />
      )}
    </div>
  );
};
