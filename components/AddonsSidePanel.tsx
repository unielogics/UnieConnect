'use client';

import { useEffect } from 'react';
import { X, Package, Box, Tag, Film, Layers, CheckCircle, FilePlus, Gift, User, Check } from 'lucide-react';
import type { LabRequirement, LabServiceType } from '../lib/shipment-plan';

const LAB_SERVICES: { type: LabServiceType; label: string; icon: React.ReactNode }[] = [
  { type: 'bundling', label: 'Bundling', icon: <Package size={18} /> },
  { type: 'kitting', label: 'Kitting', icon: <Box size={18} /> },
  { type: 'relabeling', label: 'Relabeling', icon: <Tag size={18} /> },
  { type: 'shrink-wrap', label: 'Shrink wrap', icon: <Film size={18} /> },
  { type: 'bubble-wrap', label: 'Bubble wrap', icon: <Layers size={18} /> },
  { type: 'quality-control', label: 'Quality control', icon: <CheckCircle size={18} /> },
  { type: 'custom-inserts', label: 'Custom inserts', icon: <FilePlus size={18} /> },
  { type: 'gift-wrapping', label: 'Gift wrapping', icon: <Gift size={18} /> },
  { type: 'personalization', label: 'Personalization', icon: <User size={18} /> },
];

interface AddonsSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  itemIndex: number;
  itemSku: string;
  itemTitle?: string;
  itemQuantity?: number;
  services: LabRequirement[];
  onUpdate: (services: LabRequirement[]) => void;
  expenseBreakdown?: { total: number; lineItems: { label: string; amount: number }[] };
  relabelingRequired?: boolean;
  notes?: string;
  onNotesChange?: (notes: string) => void;
}

export function AddonsSidePanel({
  isOpen,
  onClose,
  itemIndex,
  itemSku,
  itemTitle,
  itemQuantity,
  services,
  onUpdate,
  expenseBreakdown,
  relabelingRequired,
  notes = '',
  onNotesChange,
}: AddonsSidePanelProps) {
  useEffect(() => {
    if (isOpen && relabelingRequired && !services.some((s) => s.type === 'relabeling')) {
      onUpdate([...services, { type: 'relabeling' }]);
    }
  }, [isOpen, relabelingRequired, services, onUpdate]);

  if (!isOpen) return null;

  const toggleService = (type: LabServiceType) => {
    if (type === 'relabeling' && relabelingRequired) return;
    const exists = services.find((s) => s.type === type);
    if (exists) {
      onUpdate(services.filter((s) => s.type !== type));
    } else {
      const base = { type } as LabRequirement;
      if (type === 'bundling' || type === 'kitting') base.bundleQuantity = 1;
      onUpdate([...services, base]);
    }
  };

  const updateBundleQuantity = (type: 'bundling' | 'kitting', qty: number) => {
    const n = Math.min(8, Math.max(1, qty));
    onUpdate(
      services.map((s) =>
        s.type === type ? { ...s, bundleQuantity: n } : s
      )
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '50%',
        height: '100%',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <strong>Add-ons for {itemSku}</strong>
          {itemTitle && (
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {itemTitle}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: 6,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderRadius: 6,
            color: 'var(--muted)',
          }}
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
        <h4 style={{ marginTop: 0, marginBottom: 12, fontSize: 14 }}>Select LAB services</h4>
        <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          Click to add, click again to remove.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
          }}
        >
          {LAB_SERVICES.map(({ type, label, icon }) => {
            const selected = services.some((s) => s.type === type) || (type === 'relabeling' && relabelingRequired);
            const locked = type === 'relabeling' && relabelingRequired;
            return (
              <button
                key={type}
                type="button"
                onClick={() => !locked && toggleService(type)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: 12,
                  border: `1px solid ${selected ? 'var(--accent, #2563eb)' : 'var(--border)'}`,
                  borderRadius: 8,
                  background: selected ? 'color-mix(in srgb, var(--accent, #2563eb) 10%, var(--surface))' : 'var(--surface)',
                  cursor: locked ? 'default' : 'pointer',
                  color: selected ? 'var(--accent, #2563eb)' : 'inherit',
                  opacity: locked ? 1 : undefined,
                }}
              >
                {icon}
                <span style={{ fontSize: 12 }}>{label}{locked ? ' (required)' : ''}</span>
              </button>
            );
          })}
        </div>

        {(services.some((s) => s.type === 'bundling') || services.some((s) => s.type === 'kitting')) && (
          <div style={{ marginTop: 16 }}>
            {services.some((s) => s.type === 'bundling') && (
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Bundling: units per bundle</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={services.find((s) => s.type === 'bundling')?.bundleQuantity ?? 1}
                  onChange={(e) => updateBundleQuantity('bundling', Number(e.target.value) || 1)}
                  style={{ width: 80, padding: 6, borderRadius: 6, border: '1px solid var(--border)' }}
                />
                <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>(1–8)</span>
              </div>
            )}
            {services.some((s) => s.type === 'kitting') && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Kitting: units per kit</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={services.find((s) => s.type === 'kitting')?.bundleQuantity ?? 1}
                  onChange={(e) => updateBundleQuantity('kitting', Number(e.target.value) || 1)}
                  style={{ width: 80, padding: 6, borderRadius: 6, border: '1px solid var(--border)' }}
                />
                <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>(1–8)</span>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange?.(e.target.value)}
            placeholder="Optional notes for this item..."
            rows={3}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)', resize: 'vertical', fontSize: 13 }}
          />
        </div>

        {expenseBreakdown && expenseBreakdown.lineItems.length > 0 && (
          <div
            style={{
              marginTop: 24,
              padding: 12,
              background: 'var(--bg-muted, #f4f4f4)',
              borderRadius: 8,
            }}
          >
            <h4 style={{ marginTop: 0, marginBottom: 8, fontSize: 13 }}>Expense breakdown</h4>
            {expenseBreakdown.lineItems.map((line, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>{line.label}</span>
                <span>${line.amount.toFixed(2)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <span>Total</span>
              <span>${expenseBreakdown.total.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            className="button-primary"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 16px',
            }}
          >
            <Check size={18} />
            Apply add-ons
          </button>
        </div>
      </div>
    </div>
  );
}
