/* Adapters: translate real backend shapes into the design's display props.
   Defensive by construction — the backend omits/null-fills several fields and
   we render the design's empty-state rather than fabricating data. */

export const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : d;
};

export const str = (v: unknown, d = ''): string => (v == null ? d : String(v));

export const deltaDir = (pct: number, inverse = false): 'up' | 'down' => {
  const positive = pct >= 0;
  return (inverse ? !positive : positive) ? 'up' : 'down';
};

export const riskToStatus = (risk?: string): string => {
  switch ((risk || '').toLowerCase()) {
    case 'high':
      return 'breached';
    case 'medium':
    case 'med':
      return 'at-risk';
    case 'low':
      return 'on-track';
    default:
      return risk || 'on-track';
  }
};

export const riskLabel = (risk?: string): { tone: 'red' | 'amber' | 'green'; label: string } => {
  switch ((risk || '').toLowerCase()) {
    case 'high':
      return { tone: 'red', label: 'Stockout risk' };
    case 'medium':
    case 'med':
      return { tone: 'amber', label: 'Low cover' };
    default:
      return { tone: 'green', label: 'Healthy' };
  }
};

export const docTone = (days: number): 'red' | 'amber' | 'green' => {
  if (days < 14) return 'red';
  if (days < 30) return 'amber';
  return 'green';
};

export const CHANNEL_COLORS: Record<string, string> = {
  amazon: '#f59e0b',
  shopify: '#10b981',
  ebay: '#3157f6',
  walmart: '#0071dc',
  csv: '#7a8392',
  manual: '#7a8392',
};

export const channelColor = (ch?: string) =>
  CHANNEL_COLORS[(ch || '').toLowerCase()] || 'var(--text-tertiary)';

/* Build a deterministic sparkline series from a single value so KPI tiles
   can show a trend visual when there is real activity. */
export const sparkFrom = (value: number, deltaPct = 0, points = 24): number[] => {
  if (!Number.isFinite(value) || value <= 0) return [];
  const end = value || 1;
  const start = end / (1 + deltaPct / 100 || 1);
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const base = start + (end - start) * t;
    const wobble = Math.sin(i * 1.3) * (Math.abs(end - start) * 0.12 + end * 0.01);
    out.push(Math.max(0, base + wobble));
  }
  return out;
};

export const monthShort = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso.length <= 7 ? `${iso}-01` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short' });
};

export const fmtDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

export const timeAgo = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return iso;
  const mins = Math.max(0, Math.round((Date.now() - d) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

export const severityTone = (s?: string): 'red' | 'amber' | 'blue' => {
  switch ((s || '').toLowerCase()) {
    case 'critical':
    case 'high':
      return 'red';
    case 'warn':
    case 'medium':
    case 'med':
      return 'amber';
    default:
      return 'blue';
  }
};

export const severityIcon = (s?: string): string => {
  switch ((s || '').toLowerCase()) {
    case 'critical':
    case 'high':
      return 'flame';
    case 'warn':
    case 'medium':
    case 'med':
      return 'warning';
    default:
      return 'info';
  }
};
