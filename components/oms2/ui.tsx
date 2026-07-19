import React, { useEffect, useState } from 'react';
import { Icon } from './icons';

export const OMS_NAVIGATION_START_EVENT = 'unieconnect:oms-navigation-start';

export function emitOmsNavigationStart() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OMS_NAVIGATION_START_EVENT));
}

export function useCloseOnOmsNavigation(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const close = () => onClose();
    window.addEventListener(OMS_NAVIGATION_START_EVENT, close);
    return () => window.removeEventListener(OMS_NAVIGATION_START_EVENT, close);
  }, [enabled, onClose]);
}

export type Tone = 'default' | 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'outline';

export const Chip = ({
  tone = 'default',
  dot = true,
  children,
  className = '',
}: {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) => (
  <span className={`chip ${tone === 'default' ? '' : tone} ${className}`}>
    {dot ? <span className="chip-dot" /> : null}
    {children}
  </span>
);

// Small rounded product thumbnail with a box-icon fallback. Shared across tables + pickers.
export const Thumb = ({ image, size = 40 }: { image?: string | null; size?: number }) => (
  <div
    style={{
      width: size, height: size, flexShrink: 0, borderRadius: 8,
      border: '1px solid var(--border-subtle)', background: 'var(--bg-elev)', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)',
    }}
  >
    {image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    ) : (
      <Icon name="box" size={Math.round(size * 0.5)} />
    )}
  </div>
);

/**
 * Compact "last N" context strip for create modals (recent orders when ordering,
 * recent ASNs when receiving). Shows number, status chip, units + a couple of thumbnails.
 */
export const RecentStrip = ({
  label,
  items,
}: {
  label: string;
  items: Array<{ id: string; number: string; status?: string; units?: number; date?: string; images?: (string | null | undefined)[] }>;
}) => {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {items.map((it) => (
          <div key={it.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 8, background: 'var(--bg-elev)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.number}</span>
              {it.status ? <Chip dot={false}>{it.status}</Chip> : null}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              {(it.images || []).filter(Boolean).slice(0, 2).map((img, i) => (
                <Thumb key={i} image={img as string} size={22} />
              ))}
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{it.units ?? 0} units</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const STATUS_MAP: Record<string, [Tone, string]> = {
  'on-track': ['green', 'On track'],
  'at-risk': ['amber', 'At risk'],
  breached: ['red', 'Breached'],
  new: ['blue', 'New'],
  picking: ['blue', 'Picking'],
  packed: ['blue', 'Packed'],
  shipped: ['purple', 'Shipped'],
  delivered: ['green', 'Delivered'],
  exception: ['red', 'Exception'],
  hold: ['amber', 'Hold'],
  open: ['amber', 'Open'],
  'in-progress': ['blue', 'In progress'],
  resolved: ['green', 'Resolved'],
  closed: ['green', 'Closed'],
  escalated: ['red', 'Escalated'],
  blocked: ['red', 'Blocked'],
  cancelled: ['red', 'Cancelled'],
  draft: ['default', 'Draft'],
  scheduled: ['blue', 'Scheduled'],
  'in-transit': ['purple', 'In transit'],
  received: ['green', 'Received'],
  'received-with-exception': ['amber', 'Recv. with exc.'],
  healthy: ['green', 'Healthy'],
  warn: ['amber', 'Warning'],
  idle: ['default', 'Idle'],
  live: ['green', 'Live'],
  approved: ['green', 'Approved'],
  submitted: ['blue', 'Submitted'],
  stopped: ['amber', 'Stopped'],
  'asn_cancelled': ['red', 'ASN cancelled'],
  'asn_stopped': ['amber', 'ASN stopped'],
  'evidence-ready': ['purple', 'Evidence ready'],
  executed: ['green', 'Executed'],
  logged: ['default', 'Logged'],
  saved: ['blue', 'Saved'],
  recommendation: ['purple', 'Recommendation'],
  forecast: ['purple', 'Forecast'],
  finding: ['purple', 'Finding'],
  approval: ['green', 'Approval'],
  event: ['blue', 'Event'],
  decision: ['purple', 'Decision'],
  simulation: ['purple', 'Simulation'],
};

export const StatusChip = ({ status }: { status: string }) => {
  const [tone, label] = STATUS_MAP[status] || ['default', status];
  return <Chip tone={tone}>{label}</Chip>;
};

export const Sparkline = ({
  data,
  color = 'currentColor',
  width = 80,
  height = 28,
  fill = false,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}) => {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  if (max <= 0 || max === min) return <svg width={width} height={height} />;
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - ((v - min) / range) * (height - 4) - 2,
  ]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const dFill = fill ? `${d} L${width} ${height} L0 ${height} Z` : undefined;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {fill && dFill && <path d={dFill} fill={color} opacity="0.12" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const ProgressBar = ({
  value,
  max = 100,
  color = 'accent',
  showLabel = false,
  height = 6,
}: {
  value: number;
  max?: number;
  color?: 'accent' | 'green' | 'amber' | 'red' | 'purple';
  showLabel?: boolean;
  height?: number;
}) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <div className="bar" style={{ flex: 1, height }}>
        <div className={`bar-fill ${color === 'accent' ? '' : color}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel ? (
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 32, textAlign: 'right' }}>
          {Math.round(pct)}%
        </span>
      ) : null}
    </div>
  );
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export const Gauge = ({
  value,
  target = 30,
  max = 60,
  label,
  size = 86,
}: {
  value: number;
  target?: number;
  max?: number;
  label?: string;
  size?: number;
}) => {
  const pct = Math.min(1, value / max);
  const angle = -120 + pct * 240;
  const targetAngle = -120 + (target / max) * 240;
  const tone = value < target * 0.4 ? 'red' : value < target * 0.8 ? 'amber' : 'green';
  const colorMap: Record<string, string> = { red: 'var(--red)', amber: 'var(--amber)', green: 'var(--green)' };
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const arcStart = polar(cx, cy, r, -120);
  const arcEnd = polar(cx, cy, r, 120);
  const arcVal = polar(cx, cy, r, angle);
  const largeArc = angle - -120 > 180 ? 1 : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <svg width={size} height={size * 0.74}>
        <path d={`M${arcStart.x} ${arcStart.y} A ${r} ${r} 0 1 1 ${arcEnd.x} ${arcEnd.y}`} fill="none" stroke="var(--bg-active)" strokeWidth="6" strokeLinecap="round" />
        <path d={`M${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${largeArc} 1 ${arcVal.x} ${arcVal.y}`} fill="none" stroke={colorMap[tone]} strokeWidth="6" strokeLinecap="round" />
        <line x1={polar(cx, cy, r - 6, targetAngle).x} y1={polar(cx, cy, r - 6, targetAngle).y} x2={polar(cx, cy, r + 6, targetAngle).x} y2={polar(cx, cy, r + 6, targetAngle).y} stroke="var(--text-secondary)" strokeWidth="1.5" />
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--text)">{value}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="9" fill="var(--text-tertiary)" letterSpacing="0.05em">DAYS</text>
      </svg>
      {label && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>{label}</div>}
    </div>
  );
};

export const Confidence = ({ value }: { value: number }) => {
  const pct = Math.round(value * 100);
  const tone = value > 0.85 ? 'green' : value > 0.7 ? 'amber' : 'red';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 12 }}>
        {[0.3, 0.5, 0.7, 0.85, 1].map((t, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: 4 + i * 2,
              background: value >= t - 0.001 ? `var(--${tone})` : 'var(--bg-active)',
              borderRadius: 1,
            }}
          />
        ))}
      </div>
      <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: `var(--${tone}-text)` }}>{pct}%</span>
    </div>
  );
};

export const fmt = {
  money: (n: number, opts: { compact?: boolean; sign?: boolean } = {}) => {
    const { compact = false, sign = false } = opts;
    const num = Number.isFinite(n) ? n : 0;
    const s = sign && num > 0 ? '+' : '';
    if (compact && Math.abs(num) >= 1000) {
      return `${s}$${(num / 1000).toFixed(Math.abs(num) >= 10000 ? 0 : 1)}k`;
    }
    return `${s}$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  },
  pct: (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`,
  num: (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('en-US'),
};

export const Avatar = ({ name, size = 22 }: { name: string; size?: number }) => {
  const safe = name || '?';
  const initials = safe.split(' ').map((s) => s[0]).slice(0, 2).join('');
  const hash = [...safe].reduce((s, c) => s + c.charCodeAt(0), 0);
  const palettes = [
    ['#f97316', '#db2777'],
    ['#0ea5e9', '#6366f1'],
    ['#10b981', '#0ea5e9'],
    ['#a855f7', '#ec4899'],
    ['#f59e0b', '#ef4444'],
    ['#22c55e', '#16a34a'],
  ];
  const [a, b] = palettes[hash % palettes.length];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${a}, ${b})`,
        color: 'white',
        display: 'grid',
        placeItems: 'center',
        fontSize: size * 0.4,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials.toUpperCase()}
    </div>
  );
};

/* ---- Card ---- */
export const Card = ({
  title,
  subtitle,
  chrome,
  children,
  className = '',
  bodyClass = '',
  style,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  chrome?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClass?: string;
  style?: React.CSSProperties;
}) => (
  <div className={`card ${className}`} style={style}>
    {(title || chrome) && (
      <div className="card-header">
        <div>
          {title && <div className="card-title">{title}</div>}
          {subtitle && <div className="card-subtitle">{subtitle}</div>}
        </div>
        {chrome}
      </div>
    )}
    {children !== undefined && <div className={`card-body ${bodyClass}`}>{children}</div>}
  </div>
);

/* ---- KPI stat tile ---- */
export const KPI = ({
  label,
  value,
  delta,
  deltaDir,
  sub,
  spark,
  sparkColor = 'var(--accent)',
  sparkFill = false,
  tone = '',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  delta?: React.ReactNode;
  deltaDir?: 'up' | 'down';
  sub?: React.ReactNode;
  spark?: number[];
  sparkColor?: string;
  sparkFill?: boolean;
  tone?: '' | 'danger' | 'warn' | 'good' | 'ai';
}) => (
  <div className={`stat ${tone}`}>
    {spark && (
      <div className="stat-spark">
        <Sparkline data={spark} color={sparkColor} fill={sparkFill} />
      </div>
    )}
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
    {delta !== undefined && (
      <div className={`stat-delta ${deltaDir || ''}`}>
        {deltaDir && <span className="arrow">{deltaDir === 'up' ? '▲' : '▼'}</span>}
        {delta}
      </div>
    )}
    {sub !== undefined && <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>{sub}</div>}
  </div>
);

/* ---- Segmented control ---- */
export function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.id} className={value === o.id ? 'active' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---- Tabs ---- */
export function Tabs<T extends string>({
  value,
  tabs,
  onChange,
}: {
  value: T;
  tabs: { id: T; label: string; count?: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={`tab ${value === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count !== undefined && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---- Loading / empty / error ---- */
export const Loading = ({ rows = 3 }: { rows?: number }) => (
  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="skel" style={{ height: 56 }} />
    ))}
  </div>
);

export const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <div className="empty">{children}</div>
);

export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="empty">
    <Icon name="warning" size={20} style={{ color: 'var(--amber)', marginBottom: 8 }} />
    <div style={{ marginBottom: onRetry ? 10 : 0 }}>{message}</div>
    {onRetry && (
      <button className="btn sm" onClick={onRetry}>
        <Icon name="refresh" size={12} /> Retry
      </button>
    )}
  </div>
);

/* ---- Modal shell (anchored right of the 64px rail) ---- */
export const Modal = ({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width,
  fullscreen,
  chrome,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number | string;
  fullscreen?: boolean;
  chrome?: React.ReactNode;
}) => {
  useCloseOnOmsNavigation(onClose);

  return (
    <div className={`modal-overlay ${fullscreen ? 'fullscreen' : ''}`} onClick={fullscreen ? undefined : onClose}>
      <div className="modal" style={!fullscreen ? { width: width || undefined } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
            {fullscreen && (
              <button className="btn ghost sm" onClick={onClose}>
                <Icon name="chevron" size={11} style={{ transform: 'rotate(180deg)' }} /> Back
              </button>
            )}
            <div>
              <div style={{ fontSize: fullscreen ? 18 : 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>
              {subtitle && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{subtitle}</div>}
            </div>
            {chrome}
          </div>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
};

export const useToggle = (init = false): [boolean, () => void, (v: boolean) => void] => {
  const [v, setV] = useState(init);
  return [v, () => setV((p) => !p), setV];
};
