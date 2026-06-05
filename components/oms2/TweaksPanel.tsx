import React, { useState } from 'react';
import { Icon } from './icons';
import type { Tweaks } from './UnieConnectApp';
import { ACCENT_OPTIONS } from './UnieConnectApp';

export const TweaksPanel = ({
  tweaks,
  setTweak,
}: {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(k: K, v: Tweaks[K]) => void;
}) => {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        data-hint="Tweaks"
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 120,
          width: 38,
          height: 38,
          borderRadius: 10,
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          display: 'grid',
          placeItems: 'center',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <Icon name="settings" size={16} />
      </button>
    );
  }

  const Section = ({ label }: { label: string }) => (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', paddingTop: 8 }}>
      {label}
    </div>
  );

  const Seg = <T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) => (
    <div className="seg" style={{ width: '100%' }}>
      {options.map((o) => (
        <button key={o} className={value === o ? 'active' : ''} onClick={() => onChange(o)} style={{ flex: 1, textTransform: 'capitalize' }}>
          {o}
        </button>
      ))}
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 120,
        width: 260,
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-pop)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <b style={{ fontSize: 12, fontWeight: 700 }}>Tweaks</b>
        <button className="icon-btn" onClick={() => setOpen(false)} data-hint="Close">
          <Icon name="x" size={14} />
        </button>
      </div>
      <div style={{ padding: '4px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Section label="Theme" />
        <Seg value={tweaks.theme} options={['light', 'dark']} onChange={(v) => setTweak('theme', v)} />
        <Section label="Accent" />
        <div style={{ display: 'flex', gap: 8 }}>
          {ACCENT_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setTweak('accent', c)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: c,
                border: tweaks.accent === c ? '2px solid var(--text)' : '2px solid transparent',
                outline: '1px solid var(--border)',
              }}
            />
          ))}
        </div>
        <Section label="Density" />
        <Seg value={tweaks.density} options={['comfortable', 'compact']} onChange={(v) => setTweak('density', v)} />
      </div>
    </div>
  );
};
