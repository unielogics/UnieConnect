import React, { useEffect, useRef, useState } from 'react';
import { Thumb } from './ui';
import { Icon } from './icons';
import { OmsSku } from '../../lib/oms';

/**
 * Shared searchable SKU picker with product thumbnails, used across OMS order/shipment
 * flows. Searches SKU + title + ASIN (null-safe) and shows the true physical warehouse
 * on-hand (`networkOnHand`) when available, falling back to the channel `available`.
 *
 * Extracted from NewOrderModal so the shipment-plan and other item-selection surfaces
 * can reuse the exact same picker.
 */

const pickerField: React.CSSProperties = {
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

const onHandOf = (s: OmsSku): number => Number((s as any).networkOnHand ?? s.available ?? 0);

export const SkuPicker = ({
  skus,
  value,
  onPick,
}: {
  skus: OmsSku[];
  value: string;
  onPick: (id: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = skus.find((s) => s.id === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = skus
    .filter((s) => !q || `${s.sku} ${s.title || ''} ${s.asin || ''}`.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 50);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ ...pickerField, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', cursor: 'pointer' }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: selected ? 'var(--text)' : 'var(--text-tertiary)',
          }}
        >
          {selected ? `${selected.sku} — ${selected.title || ''}` : 'Select SKU…'}
        </span>
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 20,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 8, borderBottom: '1px solid var(--border-subtle)' }}>
            <input
              autoFocus
              style={{ ...pickerField, height: 30 }}
              placeholder="Search SKU, title, or ASIN…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>No matching SKUs.</div>
            )}
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onPick(s.id);
                  setOpen(false);
                  setQ('');
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  background: s.id === value ? 'var(--bg-elev)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Thumb image={s.image} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.title || s.sku}
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                    {s.sku}
                    {s.asin ? ` · ASIN ${s.asin}` : ''}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{onHandOf(s)} on-hand</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SkuPicker;
