import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import {
  fetchTransportationTemplates,
  createTransportationTemplate,
  updateTransportationTemplate,
  deleteTransportationTemplate,
  type TransportationTemplate,
} from '../lib/transportation-template';

interface TransportationTemplatePopupProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId?: string;
  onSelect?: (template: TransportationTemplate) => void;
}

export function TransportationTemplatePopup({
  isOpen,
  onClose,
  supplierId,
  onSelect,
}: TransportationTemplatePopupProps) {
  const [templates, setTemplates] = useState<TransportationTemplate[]>([]);
  const [editing, setEditing] = useState<TransportationTemplate | null>(null);
  const [form, setForm] = useState({
    name: '',
    unitsPerBox: 1,
    weightPerBox: 0,
    weightPerUnit: 0,
    length: '' as number | '',
    width: '' as number | '',
    height: '' as number | '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      void fetchTransportationTemplates(supplierId)
        .then((r) => setTemplates(r.templates))
        .catch((e) => setError(e?.message || 'Failed to load templates'));
    }
  }, [isOpen, supplierId]);

  const resetForm = () => {
    setEditing(null);
    setForm({ name: '', unitsPerBox: 1, weightPerBox: 0, weightPerUnit: 0, length: '', width: '', height: '' });
  };

  const handleSave = async () => {
    const len = form.length ? Number(form.length) : 0;
    const wid = form.width ? Number(form.width) : 0;
    const hgt = form.height ? Number(form.height) : 0;
    if (!form.name.trim() || form.unitsPerBox < 1 || form.weightPerBox < 0) {
      setError('Name, units per box (≥1), and weight per box (≥0) are required.');
      return;
    }
    if (len <= 0 || wid <= 0 || hgt <= 0) {
      setError('Length, width, and height (all in inches, > 0) are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dimensions = { length: len, width: wid, height: hgt };
      if (editing) {
        const updated = await updateTransportationTemplate(editing.id, {
          name: form.name.trim(),
          unitsPerBox: form.unitsPerBox,
          weightPerBox: form.weightPerBox,
          weightPerUnit: form.weightPerUnit || undefined,
          dimensions,
        });
        setTemplates((prev) => prev.map((t) => (t.id === editing.id ? updated : t)));
      } else {
        const created = await createTransportationTemplate({
          name: form.name.trim(),
          supplierId: supplierId || undefined,
          unitsPerBox: form.unitsPerBox,
          weightPerBox: form.weightPerBox,
          weightPerUnit: form.weightPerUnit || undefined,
          dimensions,
        });
        setTemplates((prev) => [created, ...prev]);
        if (onSelect) {
          onSelect(created);
          onClose();
        }
      }
      resetForm();
    } catch (e: any) {
      setError(e?.message || 'Failed to save template');
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (t: TransportationTemplate) => {
    setEditing(t);
    setForm({
      name: t.name,
      unitsPerBox: t.unitsPerBox,
      weightPerBox: t.weightPerBox,
      weightPerUnit: t.weightPerUnit ?? 0,
      length: t.dimensions?.length ?? '',
      width: t.dimensions?.width ?? '',
      height: t.dimensions?.height ?? '',
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteTransportationTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (editing?.id === id) resetForm();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete template');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transportation Templates" size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {error && (
          <div className="alert error" style={{ margin: 0 }}>
            {error}
          </div>
        )}

        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, background: 'var(--surface)' }}>
          <h4 style={{ marginTop: 0, marginBottom: 12 }}>{editing ? 'Edit template' : 'New template'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Standard Box"
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Units/box</label>
              <input
                type="number"
                min={1}
                value={form.unitsPerBox}
                onChange={(e) => setForm((f) => ({ ...f, unitsPerBox: Math.max(1, Number(e.target.value) || 1) }))}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Length (in) *</label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={form.length}
                onChange={(e) => setForm((f) => ({ ...f, length: e.target.value ? Number(e.target.value) : '' }))}
                placeholder="Required"
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Width (in) *</label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={form.width}
                onChange={(e) => setForm((f) => ({ ...f, width: e.target.value ? Number(e.target.value) : '' }))}
                placeholder="Required"
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Height (in) *</label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={form.height}
                onChange={(e) => setForm((f) => ({ ...f, height: e.target.value ? Number(e.target.value) : '' }))}
                placeholder="Required"
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Weight/box (lbs)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={form.weightPerBox}
                onChange={(e) => setForm((f) => ({ ...f, weightPerBox: Math.max(0, Number(e.target.value) || 0) }))}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Weight/unit (lbs)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={form.weightPerUnit}
                onChange={(e) => setForm((f) => ({ ...f, weightPerUnit: e.target.value === '' ? 0 : Number(e.target.value) }))}
                placeholder="Optional"
                style={{ width: '100%', maxWidth: 140, padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
              />
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="button-primary" onClick={handleSave} disabled={busy}>
              {busy ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
            {editing && (
              <button className="button-secondary" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </div>

        <div>
          <h4 style={{ marginTop: 0, marginBottom: 12 }}>Saved templates</h4>
          {templates.length === 0 ? (
            <p className="muted">No templates yet. Create one above.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {templates.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 12,
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: editing?.id === t.id ? 'color-mix(in srgb, var(--accent-weak) 15%, var(--surface))' : undefined,
                  }}
                >
                  <div>
                    <strong>{t.name}</strong>
                    <span className="muted" style={{ marginLeft: 8, fontSize: 14 }}>
                      {t.unitsPerBox} units/box • {t.weightPerBox} lbs/box
                      {t.dimensions?.length != null || t.dimensions?.width != null || t.dimensions?.height != null
                        ? ` • ${[t.dimensions?.length, t.dimensions?.width, t.dimensions?.height].filter((n) => n != null).join('×')} in`
                        : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="button-secondary"
                      style={{ padding: '6px 12px', fontSize: 13 }}
                      onClick={() => {
                        if (onSelect) {
                          onSelect(t);
                          onClose();
                        } else {
                          handleEdit(t);
                        }
                      }}
                    >
                      {onSelect ? 'Select' : 'Edit'}
                    </button>
                    {!onSelect && (
                      <button
                        className="button-secondary"
                        style={{ padding: '6px 12px', fontSize: 13, color: 'var(--danger, #b45309)' }}
                        onClick={() => handleDelete(t.id)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
