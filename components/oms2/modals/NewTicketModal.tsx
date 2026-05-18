import React, { useState } from 'react';
import { Modal } from '../ui';
import { createTicket, CreateTicketBody } from '../../../lib/oms';

const field: React.CSSProperties = {
  width: '100%',
  height: 34,
  padding: '0 10px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  fontSize: 12.5,
  color: 'var(--text)',
  outline: 'none',
};
const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 4,
  display: 'block',
};

export const NewTicketModal = ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) => {
  const [f, setF] = useState({
    subject: '',
    entityType: 'order',
    entityId: '',
    channel: 'internal',
    priority: 'med',
    body: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (!f.subject.trim()) {
      setErr('Subject is required');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const body: CreateTicketBody = {
        subject: f.subject.trim(),
        body: f.body.trim() || undefined,
        entityType: f.entityType,
        entityId: f.entityId.trim() || undefined,
        channel: f.channel,
        priority: f.priority,
      };
      await createTicket(body);
      onSuccess();
    } catch (e: any) {
      setErr(e.message || 'Failed to create ticket');
      setSaving(false);
    }
  };

  return (
    <Modal
      title="New ticket"
      subtitle="Every ticket attaches to a real entity — an order, SKU, ASN, invoice, or warehouse."
      onClose={onClose}
      fullscreen
      footer={
        <>
          <div style={{ fontSize: 12, color: err ? 'var(--red-text)' : 'var(--text-tertiary)' }}>
            {err || 'AI triage will analyze and propose a resolution after creation.'}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={submit} disabled={saving}>
              {saving ? 'Creating…' : 'Create ticket'}
            </button>
          </div>
        </>
      }
    >
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Ticket details</div>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Subject *</label>
              <input style={field} value={f.subject} onChange={set('subject')} placeholder="Wrong item shipped — customer received 16oz" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={label}>Linked entity type</label>
                <select style={field} value={f.entityType} onChange={set('entityType')}>
                  <option value="order">Order</option>
                  <option value="sku">SKU</option>
                  <option value="asn">ASN</option>
                  <option value="invoice">Invoice</option>
                  <option value="warehouse">Warehouse</option>
                </select>
              </div>
              <div>
                <label style={label}>Entity ID</label>
              <input style={field} value={f.entityId} onChange={set('entityId')} placeholder="OR12345678 or source order ID" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={label}>Channel</label>
                <select style={field} value={f.channel} onChange={set('channel')}>
                  <option value="internal">Internal</option>
                  <option value="amazon">Amazon</option>
                  <option value="shopify">Shopify</option>
                  <option value="ebay">eBay</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div>
                <label style={label}>Priority</label>
                <select style={field} value={f.priority} onChange={set('priority')}>
                  <option value="low">Low</option>
                  <option value="med">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div>
              <label style={label}>Description</label>
              <textarea
                style={{ ...field, height: 100, padding: '8px 10px' }}
                value={f.body}
                onChange={set('body')}
                placeholder="Describe the issue…"
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
