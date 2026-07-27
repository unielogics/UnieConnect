import React, { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { Chip, Loading, EmptyState, Modal } from '../ui';
import { fetchInboxMessages, markInboxMessageRead, InboxMessage } from '../../../lib/oms';
import type { ScreenProps } from '../UnieConnectApp';

const PAGE_SIZE = 25;

const fmtDate = (value?: string) => {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
};

const MessageModal = ({ message, onClose }: { message: InboxMessage; onClose: () => void }) => (
  <Modal
    title={message.subject}
    subtitle={message.fromEmail ? `From ${message.fromEmail}` : undefined}
    onClose={onClose}
    footer={
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, width: '100%' }}>
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
    }
  >
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="card">
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="kv"><div className="kv-label">Sent</div><div className="kv-value mono">{fmtDate(message.createdAt)}</div></div>
          {message.eventType && (
            <div className="kv"><div className="kv-label">Type</div><div className="kv-value">{message.eventType}</div></div>
          )}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 4, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {message.body || 'No content.'}
          </div>
        </div>
      </div>
    </div>
  </Modal>
);

export const Inbox = (_props: ScreenProps) => {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InboxMessage | null>(null);

  const load = (nextOffset = offset) => {
    setLoading(true);
    fetchInboxMessages({ limit: PAGE_SIZE, offset: nextOffset })
      .then((d) => {
        setMessages(d.messages || []);
        setTotal(d.total || 0);
        setOffset(nextOffset);
      })
      .catch(() => {
        setMessages([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => load(0), []);

  const openMessage = async (message: InboxMessage) => {
    setSelected(message);
    if (!message.read) {
      try {
        await markInboxMessageRead(message.id);
        setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, read: true } : m)));
      } catch {
        // best-effort; the message still opens even if the read-flag update fails
      }
    }
  };

  const unreadCount = messages.filter((m) => !m.read).length;
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inbox</h1>
          <p className="page-subtitle">Every email your warehouse has sent to your account, in one place.</p>
        </div>
      </div>

      {loading ? (
        <div className="card"><Loading rows={6} /></div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              Messages <Chip dot={false}>{total}</Chip>
              {unreadCount > 0 && <Chip tone="amber">{unreadCount} unread</Chip>}
            </div>
          </div>
          {messages.length === 0 ? (
            <EmptyState>No messages yet. Emails your warehouse sends you (order updates, invoices, and more) will show up here.</EmptyState>
          ) : (
            <>
              <table className="data">
                <thead>
                  <tr>
                    <th></th>
                    <th>Subject</th>
                    <th>From</th>
                    <th>Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((m) => (
                    <tr key={m.id} className="clickable" onClick={() => openMessage(m)}>
                      <td style={{ width: 20 }}>
                        {!m.read && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}
                      </td>
                      <td style={{ fontWeight: m.read ? 400 : 700 }}>{m.subject}</td>
                      <td className="muted">{m.fromEmail || '-'}</td>
                      <td className="muted">{fmtDate(m.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, padding: 12 }}>
                <button className="btn ghost sm" disabled={!hasPrev} onClick={() => load(Math.max(0, offset - PAGE_SIZE))}>
                  <Icon name="chevron" size={12} /> Previous
                </button>
                <button className="btn ghost sm" disabled={!hasNext} onClick={() => load(offset + PAGE_SIZE)}>
                  Next <Icon name="chevronDown" size={12} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {selected && <MessageModal message={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};
