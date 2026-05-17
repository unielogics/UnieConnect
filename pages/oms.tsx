import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowRight,
  ArrowUpDown,
  Brain,
  Building2,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileUp,
  ExternalLink,
  FileText,
  Gauge,
  Layers3,
  PackageCheck,
  PackageSearch,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { CommandCenter, InventoryPlan, OmsRange, OmsSku, omsFetch, BusinessDoubleResponse } from '../lib/oms';
import { createShipmentPlan, fetchShipmentPlans } from '../lib/shipment-plan';
import { apiUrl, TOKEN_KEY } from '../lib/api';

type ViewKey =
  | 'command'
  | 'business'
  | 'inventory'
  | 'skus'
  | 'orders'
  | 'shipments'
  | 'customers'
  | 'suppliers'
  | 'heatmap'
  | 'labels'
  | 'billing'
  | 'marketplace'
  | 'ledger';

const viewTitles: Record<ViewKey, { title: string; subtitle: string }> = {
  command: { title: 'Command Center', subtitle: 'Sales, inventory risk, and autonomous OMS activity' },
  business: { title: 'Business Double', subtitle: 'Current business vs optimized Cortex operating model' },
  inventory: { title: 'Inventory Plan', subtitle: 'Six-month placement, pallet economics, and WMS truth gates' },
  skus: { title: 'SKUs', subtitle: 'SKU intelligence, warehouse truth, billing impact, and shipment readiness' },
  orders: { title: 'Orders', subtitle: 'Order activity, service status, and customer drilldown' },
  shipments: { title: 'Shipments', subtitle: 'ASNs, shipment plans, BOLs, labels, and WMS receiving' },
  customers: { title: 'Customers', subtitle: 'Customer value, service risk, and channel history' },
  suppliers: { title: 'Suppliers', subtitle: 'Supplier lead times, quality, SKU coverage, and shipment history' },
  heatmap: { title: 'Inventory Heatmap', subtitle: 'Warehouse inventory against regional demand' },
  labels: { title: 'Carrier Label Audit', subtitle: 'Refund opportunities, service misses, and optimized label choices' },
  billing: { title: 'Billing & Profit', subtitle: 'Current vs optimized cost and profit model' },
  marketplace: { title: 'AI Marketplace', subtitle: 'OMS widgets, bots, automations, and accounting extensions' },
  ledger: { title: 'Intelligence Ledger', subtitle: 'The chain from marketplace data to WMS truth to Cortex action' },
};

const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const money = (n?: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n || 0));
const pct = (n?: number) => `${Number(n || 0) > 0 ? '+' : ''}${Number(n || 0).toFixed(1)}%`;

type EntityKind = 'order' | 'customer' | 'supplier' | 'sku' | 'shipment';
type EntityMode = 'manual' | 'csv';
type EntityModalState = { entity: EntityKind; mode: EntityMode } | null;

async function appFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || err?.message || `Request failed (${res.status})`);
  }
  return res.json();
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = (rows.shift() || []).map((header) => header.trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function getView(raw: unknown): ViewKey {
  const value = typeof raw === 'string' ? raw : 'command';
  return (Object.keys(viewTitles).includes(value) ? value : 'command') as ViewKey;
}

function Badge({ value }: { value: string }) {
  const v = String(value || '').toLowerCase();
  const cls = v.includes('high') || v.includes('failed') || v.includes('late') ? 'red' : v.includes('medium') || v.includes('pending') || v.includes('priority') ? 'amber' : 'green';
  return <span className={`oms-badge ${cls}`}>{value.replace(/_/g, ' ')}</span>;
}

function MetricCard({ label, value, delta, icon }: { label: string; value: string; delta?: number; icon?: React.ReactNode }) {
  return (
    <div className="oms-card oms-stat">
      <div className="oms-toolbar">
        <span className="oms-muted">{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      {delta != null && <span className={`oms-delta ${delta >= 0 ? 'good' : 'bad'}`}>{pct(delta)} vs prior</span>}
    </div>
  );
}

type PageAction = {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary';
};

function EmptyState({ label, detail, action }: { label: string; detail?: string; action?: PageAction }) {
  const content = (
    <div className="oms-panel oms-empty">
      <div>
        <div className="oms-eyebrow">Setup Required</div>
        <h2>{label}</h2>
        {detail && <p className="oms-muted">{detail}</p>}
      </div>
      {action && <ActionButton action={action} />}
    </div>
  );
  return content;
}

function Loading() {
  return <div className="oms-panel oms-muted">Loading OMS intelligence...</div>;
}

function ActionButton({ action }: { action: PageAction }) {
  const className = action.variant === 'secondary' ? 'oms-action-secondary' : 'oms-action';
  const inner = <>{action.icon}{action.label}</>;
  if (action.href) {
    const href = action.href;
    return <button className={className} onClick={() => window.location.assign(href)}>{inner}</button>;
  }
  return <button className={className} onClick={action.onClick}>{inner}</button>;
}

function PageActions({ actions }: { actions?: PageAction[] }) {
  if (!actions?.length) return null;
  return (
    <div className="oms-page-actions">
      {actions.map((action) => <ActionButton key={action.label} action={action} />)}
    </div>
  );
}

function humanize(key: string) {
  return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function cellText(value: any): string {
  if (value == null) return '';
  if (typeof value === 'object') return Array.isArray(value) ? `${value.length} records` : JSON.stringify(value);
  return String(value);
}

function CommandScreen({ data, range, setRange, actions }: { data: CommandCenter | null; range: OmsRange; setRange: (range: OmsRange) => void; actions?: PageAction[] }) {
  if (!data) return <Loading />;
  return (
    <div className="oms-page">
      <div className="oms-toolbar">
        <div>
          <div className="oms-eyebrow">Sales Overview</div>
          <h2 style={{ margin: '4px 0 0' }}>Today / 7 day / 30 day operating picture</h2>
        </div>
        <div className="oms-toolbar">
          <PageActions actions={actions} />
          <div className="oms-segments">
            {(['today', '7d', '30d'] as OmsRange[]).map((r) => (
              <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r === 'today' ? 'Today' : r}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="oms-card-grid">
        <MetricCard label="Revenue" value={money(data.metrics.revenue)} delta={data.metrics.revenueDeltaPct} icon={<DollarSign size={18} />} />
        <MetricCard label="Orders" value={fmt.format(data.metrics.orders)} delta={data.metrics.ordersDeltaPct} icon={<ClipboardList size={18} />} />
        <MetricCard label="Units sold" value={fmt.format(data.metrics.units)} delta={data.metrics.unitsDeltaPct} icon={<PackageCheck size={18} />} />
        <MetricCard label="Gross profit" value={money(data.metrics.grossProfit)} icon={<Gauge size={18} />} />
      </div>
      <div className="oms-hero-grid">
        <div className="oms-panel">
          <div className="oms-toolbar">
            <div>
              <div className="oms-eyebrow">Warnings</div>
              <h2>What needs attention</h2>
            </div>
            <ShieldAlert size={20} />
          </div>
          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            {data.warnings.length ? data.warnings.map((w) => (
              <div key={`${w.title}-${w.detail}`} className="oms-card" style={{ boxShadow: 'none' }}>
                <div className="oms-toolbar">
                  <strong>{w.title}</strong>
                  <Badge value={w.severity} />
                </div>
                <p className="oms-muted" style={{ margin: '8px 0 0' }}>{w.detail}</p>
              </div>
            )) : <EmptyState label="No active warnings from the current OMS projection." />}
          </div>
        </div>
        <div className="oms-panel">
          <div className="oms-eyebrow">Autonomous Activity</div>
          <h2 style={{ marginTop: 4 }}>Cortex / OMS / WMS</h2>
          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            {data.autonomousActivity.map((a) => (
              <div key={`${a.system}-${a.action}`} className="oms-card" style={{ boxShadow: 'none' }}>
                <div className="oms-toolbar">
                  <strong>{a.system}</strong>
                  <Badge value={a.status} />
                </div>
                <p className="oms-muted" style={{ margin: '8px 0' }}>{a.action}</p>
                <div className="oms-progress"><span style={{ width: `${Math.round(a.confidence * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="oms-three-grid">
        <div className="oms-panel"><div className="oms-eyebrow">Catalog</div><h2>{fmt.format(data.counts.items || 0)} SKUs</h2><p className="oms-muted">Active catalog records feeding inventory placement.</p></div>
        <div className="oms-panel"><div className="oms-eyebrow">Customers</div><h2>{fmt.format(data.counts.customers || 0)} customers</h2><p className="oms-muted">Demand and order behavior used in forecast scoring.</p></div>
        <div className="oms-panel"><div className="oms-eyebrow">Shipment Plans</div><h2>{fmt.format(data.counts.shipmentPlans || 0)} plans</h2><p className="oms-muted">ASN and shipment activity available for WMS truth checks.</p></div>
      </div>
    </div>
  );
}

function BusinessScreen({ data, onApprove, approving }: { data: BusinessDoubleResponse | null; onApprove: () => void; approving: boolean }) {
  if (!data) return <Loading />;
  const { plan } = data;
  return (
    <div className="oms-page">
      <div className="oms-hero-grid">
        <div className="oms-panel">
          <div className="oms-eyebrow">Only Approval Surface</div>
          <h2>{plan.title}</h2>
          <p className="oms-muted">{plan.summary}</p>
          <div className="oms-two-grid" style={{ marginTop: 18 }}>
            <div className="oms-card">
              <div className="oms-eyebrow">Current Business</div>
              <MetricRows data={plan.currentMetrics} />
            </div>
            <div className="oms-card">
              <div className="oms-eyebrow">Optimized Business</div>
              <MetricRows data={plan.optimizedMetrics} />
            </div>
          </div>
        </div>
        <div className="oms-panel">
          <div className="oms-eyebrow">Projected Savings</div>
          <h2>{money(plan.savings.annualized)} annualized</h2>
          <p className="oms-muted">Monthly savings: {money(plan.savings.monthly)}. Cortex will keep optimizing WMS/TMS activity after this model is approved.</p>
          <button className="oms-action" style={{ marginTop: 18, width: '100%' }} onClick={onApprove} disabled={approving}>
            {approving ? 'Approving...' : 'Approve Business Double'}
          </button>
          <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
            {plan.approvalRequiredFor.map((item) => <div key={item} className="oms-badge amber">{item}</div>)}
          </div>
        </div>
      </div>
      <div className="oms-panel">
        <div className="oms-eyebrow">Autonomous After Approval</div>
        <div className="oms-three-grid" style={{ marginTop: 14 }}>
          {plan.autonomousAfterApproval.map((item) => (
            <div key={item} className="oms-card" style={{ boxShadow: 'none' }}>
              <CheckCircle2 size={18} color="var(--oms-accent-2)" />
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricRows({ data }: { data: Record<string, number> }) {
  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="oms-toolbar">
          <span className="oms-muted">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</span>
          <strong>{key.toLowerCase().includes('cost') || key.toLowerCase().includes('revenue') ? money(value) : fmt.format(value)}</strong>
        </div>
      ))}
    </div>
  );
}

function InventoryScreen({ plan, selected, toggleSku, openSku, actions }: { plan: InventoryPlan | null; selected: Record<string, OmsSku>; toggleSku: (sku: OmsSku) => void; openSku: (sku: OmsSku) => void; actions?: PageAction[] }) {
  if (!plan) return <Loading />;
  return (
    <div className="oms-page">
      <div className="oms-toolbar">
        <div>
          <div className="oms-eyebrow">Inventory Operating Plan</div>
          <h2 style={{ margin: '4px 0 0' }}>Current truth, proposed placement, and shipment execution</h2>
        </div>
        <PageActions actions={actions} />
      </div>
      <div className="oms-two-grid">
        <div className="oms-panel">
          <div className="oms-eyebrow">Current Business</div>
          <MetricRows data={plan.current} />
        </div>
        <div className="oms-panel">
          <div className="oms-eyebrow">Proposed Plan</div>
          <MetricRows data={plan.proposed} />
        </div>
      </div>
      <div className="oms-panel">
        <div className="oms-toolbar">
          <div>
            <div className="oms-eyebrow">Six Month Forecast</div>
            <h2>Inventory movement by month</h2>
          </div>
          <Sparkles size={20} color="var(--oms-accent)" />
        </div>
        <div className="oms-three-grid" style={{ marginTop: 16 }}>
          {plan.months.map((m) => (
            <div key={m.month} className="oms-card">
              <strong>{m.month}</strong>
              <p className="oms-muted">{fmt.format(m.projectedUnits)} projected units</p>
              <div className="oms-progress"><span style={{ width: `${Math.min(100, (m.proposedReplenishment / Math.max(1, m.projectedUnits)) * 100)}%` }} /></div>
              <p className="oms-muted">Suggested replenishment: {fmt.format(m.proposedReplenishment)} · savings {money(m.savings)}</p>
            </div>
          ))}
        </div>
      </div>
      <SkuTable skus={plan.skus} selected={selected} toggleSku={toggleSku} openSku={openSku} />
    </div>
  );
}

function SkuTable({ skus, selected, toggleSku, openSku, actions }: { skus: OmsSku[]; selected: Record<string, OmsSku>; toggleSku: (sku: OmsSku) => void; openSku: (sku: OmsSku) => void; actions?: PageAction[] }) {
  const [menu, setMenu] = useState<{ x: number; y: number; sku: OmsSku } | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: keyof OmsSku; dir: 'asc' | 'desc' }>({ key: 'risk', dir: 'desc' });
  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = term
      ? skus.filter((sku) => [sku.sku, sku.title, sku.recommendation, sku.risk, sku.serviceTier].some((value) => String(value || '').toLowerCase().includes(term)))
      : skus;
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const an = Number(av);
      const bn = Number(bv);
      const result = Number.isFinite(an) && Number.isFinite(bn) ? an - bn : String(av || '').localeCompare(String(bv || ''));
      return sort.dir === 'asc' ? result : -result;
    });
  }, [skus, query, sort]);
  const setSortKey = (key: keyof OmsSku) => setSort((current) => ({ key, dir: current.key === key && current.dir === 'asc' ? 'desc' : 'asc' }));
  return (
    <div className="oms-panel">
      <div className="oms-table-panel-head">
        <div><div className="oms-eyebrow">SKU Intelligence</div><h2>Warehouse truth and placement readiness</h2></div>
        <div className="oms-table-controls">
          <label className="oms-local-search">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search SKU, title, recommendation" />
          </label>
          <PageActions actions={actions} />
        </div>
      </div>
      {!skus.length ? (
        <EmptyState
          label="No SKUs found in the OMS database"
          detail="Create catalog items or connect a marketplace feed before Cortex can forecast demand, pallet footprint, and placement."
        />
      ) : null}
      <div className="oms-table-wrap">
        <table className="oms-table">
          <thead>
            <tr>
              <th></th>
              {[
                ['sku', 'SKU'],
                ['title', 'Title'],
                ['available', 'Available'],
                ['daysOfCover', 'Days'],
                ['risk', 'Risk'],
                ['serviceTier', 'Service'],
                ['fillPercent', 'Pallet Fill'],
                ['recommendation', 'Recommendation'],
              ].map(([key, label]) => (
                <th key={key}>
                  <button className="oms-sort-button" type="button" onClick={() => setSortKey(key as keyof OmsSku)}>
                    {label}<ArrowUpDown size={13} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((sku) => (
              <tr
                key={sku.id}
                onClick={() => openSku(sku)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenu({ x: event.clientX, y: event.clientY, sku });
                }}
              >
                <td onClick={(event) => event.stopPropagation()}>
                  <input type="checkbox" checked={Boolean(selected[sku.id])} onChange={() => toggleSku(sku)} />
                </td>
                <td><strong>{sku.sku}</strong></td>
                <td>{sku.title || '—'}</td>
                <td>{fmt.format(sku.available)}</td>
                <td>{sku.daysOfCover}</td>
                <td><Badge value={sku.risk} /></td>
                <td><Badge value={sku.serviceTier} /></td>
                <td><div className="oms-progress"><span style={{ width: `${sku.fillPercent}%` }} /></div></td>
                <td>{sku.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {skus.length > 0 && filtered.length === 0 && <p className="oms-muted">No SKUs match that search.</p>}
      {menu && (
        <div className="oms-context-menu" style={{ left: menu.x, top: menu.y }}>
          <button onClick={() => openSku(menu.sku)}>Open SKU intelligence</button>
          <button onClick={() => toggleSku(menu.sku)}>Toggle shipment selection</button>
          <button onClick={() => window.location.reload()}>Refresh OMS projection</button>
        </div>
      )}
    </div>
  );
}

function DetailModal({ sku, onClose }: { sku: any; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="oms-full-modal" role="dialog" aria-modal="true">
      <div className="oms-full-modal-head">
        <div><div className="oms-eyebrow">SKU Detail</div><h2 style={{ margin: 0 }}>{sku?.sku} · {sku?.title}</h2></div>
        <button className="oms-action-secondary" onClick={onClose}><X size={16} /> Close</button>
      </div>
      <div className="oms-full-modal-body">
        <div className="oms-page">
          <div className="oms-card-grid">
            <MetricCard label="Available" value={fmt.format(sku?.intelligence?.available || 0)} />
            <MetricCard label="Days cover" value={fmt.format(sku?.intelligence?.daysOfCover || 0)} />
            <MetricCard label="Pallet cube" value={`${fmt.format(sku?.intelligence?.palletCubeFt || 0)} ft³`} />
            <MetricCard label="Billing optimized" value={money(sku?.billing?.optimizedMonthly || 0)} />
          </div>
          <div className="oms-two-grid">
            <div className="oms-panel">
              <div className="oms-eyebrow">Next 6 Shipments</div>
              <div className="oms-table-wrap" style={{ marginTop: 12 }}>
                <table className="oms-table">
                  <thead><tr><th>ID</th><th>Date</th><th>Destination</th><th>Qty</th><th>Status</th><th>Mode</th></tr></thead>
                  <tbody>{(sku?.nextShipments || []).map((s: any) => <tr key={s.id}><td>{s.id}</td><td>{s.date ? new Date(s.date).toLocaleDateString() : '—'}</td><td>{s.destination}</td><td>{s.quantity}</td><td><Badge value={s.status} /></td><td>{s.mode}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
            <div className="oms-panel">
              <div className="oms-eyebrow">Warehouses</div>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>{(sku?.warehouses || []).map((w: any) => <div key={w.code} className="oms-card"><div className="oms-toolbar"><strong>{w.name || w.code}</strong><span>{fmt.format(w.available)} available</span></div><p className="oms-muted">{w.inbound} inbound · {w.daysOfCover} days cover · {money(w.storageCost)} storage</p></div>)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShipmentWizard({ selected, suppliers, locations, onClose }: { selected: OmsSku[]; suppliers: any[]; locations: any[]; onClose: () => void }) {
  const [supplierId, setSupplierId] = useState(selected[0]?.supplierId || '');
  const [shipFromLocationId, setShipFromLocationId] = useState('');
  const [shipmentTitle, setShipmentTitle] = useState('');
  const [estimatedArrivalDate, setEstimatedArrivalDate] = useState('');
  const [boxCount, setBoxCount] = useState(1);
  const [unitsPerBox, setUnitsPerBox] = useState(1);
  const [palletCount, setPalletCount] = useState(1);
  const [requiresBol, setRequiresBol] = useState(true);
  const [requiresLabels, setRequiresLabels] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const confirm = async () => {
    if (!supplierId) {
      setResult('Select a supplier before creating the OMS shipment. This ties the shipment to a real ship-from source.');
      return;
    }
    setBusy(true);
    setResult(null);
    const selectedItems = selected.map((item) => ({
      id: item.id,
      itemId: item.id,
      sku: item.sku,
      title: item.title,
      quantity: Math.max(1, item.proposedUnits || item.available || 1),
      boxCount,
      unitsPerBox,
      palletCount,
    }));
    try {
      const draft = await omsFetch<any>('/shipment-wizard/drafts', {
        method: 'POST',
        body: JSON.stringify({
          supplierId,
          requiresBol,
          requiresLabels,
          selectedItems,
          packagePlan: { boxCount, unitsPerBox, palletCount },
        }),
      });
      const draftId = draft?.draft?.id;
      if (!draftId) {
        setResult('Draft created, but the backend did not return a draft id.');
        return;
      }
      const confirmed = await omsFetch<any>(`/shipment-wizard/drafts/${encodeURIComponent(draftId)}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          supplierId,
          shipFromLocationId: shipFromLocationId || null,
          shipmentTitle,
          estimatedArrivalDate,
          requiresBol,
          requiresLabels,
          selectedItems,
          packagePlan: { boxCount, unitsPerBox, palletCount },
        }),
      });
      setResult(confirmed?.status === 'needs_setup'
        ? confirmed.message
        : `Shipment ${confirmed?.plan?.internal_shipment_id || confirmed?.plan?.internalShipmentId || draftId} created. ASN is projected and waiting for WMS truth.`);
    } catch (err: any) {
      setResult(err?.message || 'Shipment draft could not be created.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="oms-full-modal" role="dialog" aria-modal="true">
      <div className="oms-full-modal-head">
        <div><div className="oms-eyebrow">Shipment Wizard</div><h2 style={{ margin: 0 }}>Auto-routed ASN, BOL, and labels</h2></div>
        <button className="oms-action-secondary" onClick={onClose}><X size={16} /> Close</button>
      </div>
      <div className="oms-full-modal-body">
        <div className="oms-page">
          <div className="oms-panel">
            <div className="oms-eyebrow">Selected SKUs</div>
            {selected.length ? (
              <div className="oms-table-wrap" style={{ marginTop: 12 }}>
                <table className="oms-table">
                  <thead><tr><th>SKU</th><th>Units</th><th>Pallet fill</th><th>Service</th><th>Routing</th></tr></thead>
                  <tbody>{selected.map((s) => <tr key={s.id}><td>{s.sku}</td><td>{fmt.format(s.proposedUnits)}</td><td>{s.fillPercent}%</td><td><Badge value={s.serviceTier} /></td><td>Cortex auto-routed</td></tr>)}</tbody>
                </table>
              </div>
            ) : (
              <EmptyState label="Select SKUs before creating a shipment" detail="The wizard can only create ASN intent after at least one real catalog item is selected from the inventory or SKU screen." action={{ label: 'Go to SKUs', href: '/oms?view=skus', icon: <PackageSearch size={16} /> }} />
            )}
          </div>
          <div className="oms-two-grid">
            <div className="oms-panel">
              <div className="oms-eyebrow">Supplier Source</div>
              <div className="oms-form-grid">
                <label>
                  Supplier
                  <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                    <option value="">Select supplier</option>
                    {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name || supplier.company_name || supplier.email || supplier.id}</option>)}
                  </select>
                </label>
                <label>
                  Ship-from location
                  <select value={shipFromLocationId} onChange={(event) => setShipFromLocationId(event.target.value)}>
                    <option value="">Use supplier default / add later</option>
                    {locations.filter((location) => !supplierId || location.supplier_id === supplierId || location.supplierId === supplierId).map((location) => (
                      <option key={location.id} value={location.id}>{location.name || location.label || location.address?.city || location.id}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Shipment title
                  <input value={shipmentTitle} onChange={(event) => setShipmentTitle(event.target.value)} placeholder="Spring replenishment / FBA inbound / LTL pool" />
                </label>
                <label>
                  Estimated arrival
                  <input type="date" value={estimatedArrivalDate} onChange={(event) => setEstimatedArrivalDate(event.target.value)} />
                </label>
              </div>
            </div>
            <div className="oms-panel">
              <div className="oms-eyebrow">Documents</div>
              <label style={{ display: 'flex', gap: 10, marginTop: 14 }}><input type="checkbox" checked={requiresBol} onChange={(e) => setRequiresBol(e.target.checked)} /> Generate BOL</label>
              <label style={{ display: 'flex', gap: 10, marginTop: 14 }}><input type="checkbox" checked={requiresLabels} onChange={(e) => setRequiresLabels(e.target.checked)} /> Generate shipping labels</label>
              <p className="oms-muted">ASN is mandatory and generated after confirmation. The client does not choose the warehouse.</p>
            </div>
          </div>
          <div className="oms-two-grid">
            <div className="oms-panel">
              <div className="oms-eyebrow">Package Plan</div>
              <div className="oms-form-grid compact">
                <label>Boxes<input type="number" min={1} value={boxCount} onChange={(event) => setBoxCount(Math.max(1, Number(event.target.value) || 1))} /></label>
                <label>Units / box<input type="number" min={1} value={unitsPerBox} onChange={(event) => setUnitsPerBox(Math.max(1, Number(event.target.value) || 1))} /></label>
                <label>Pallets<input type="number" min={1} value={palletCount} onChange={(event) => setPalletCount(Math.max(1, Number(event.target.value) || 1))} /></label>
              </div>
              <p className="oms-muted">Cortex uses this package plan with SKU dimensions and WMS truth to determine pallet footprint and final routing.</p>
            </div>
            <div className="oms-panel">
              <div className="oms-eyebrow">Execution Rules</div>
              <p className="oms-muted">Cortex selects the destination warehouse, WMS receives ASN truth, and TMS can consolidate once WMS confirms readiness.</p>
              <button className="oms-action" onClick={confirm} disabled={busy}>{busy ? 'Creating draft...' : 'Create auto-routed shipment draft'}</button>
              {result && <p className="oms-muted">{result}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GenericTableScreen({
  type,
  rows,
  actions,
  emptyDetail,
  relationNotes,
  onRowClick,
}: {
  type: string;
  rows: any[];
  actions?: PageAction[];
  emptyDetail?: string;
  relationNotes?: Array<{ label: string; detail: string; status?: 'ready' | 'blocked' | 'info' }>;
  onRowClick?: (row: any) => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const keys = Object.keys(rows?.[0] || {}).filter((k) => !['_id', 'id', '__v', 'password', 'token'].includes(k)).slice(0, 8);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const base = term ? rows.filter((row) => cellText(row).toLowerCase().includes(term)) : rows;
    if (!sort) return base;
    return [...base].sort((a, b) => {
      const av = a?.[sort.key];
      const bv = b?.[sort.key];
      const an = Number(av);
      const bn = Number(bv);
      const result = Number.isFinite(an) && Number.isFinite(bn) ? an - bn : renderCell(av).localeCompare(renderCell(bv));
      return sort.dir === 'asc' ? result : -result;
    });
  }, [rows, query, sort]);
  const setSortKey = (key: string) => setSort((current) => ({ key, dir: current?.key === key && current.dir === 'asc' ? 'desc' : 'asc' }));
  return (
    <div className="oms-panel">
      <div className="oms-table-panel-head">
        <div>
          <div className="oms-eyebrow">{type}</div>
          <h2>Database-backed records</h2>
        </div>
        <div className="oms-table-controls">
          <label className="oms-local-search">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${type.toLowerCase()}`} />
          </label>
          <PageActions actions={actions} />
        </div>
      </div>
      {relationNotes?.length ? (
        <div className="oms-relation-strip">
          {relationNotes.map((note) => (
            <div key={note.label} className={`oms-relation-note ${note.status || 'info'}`}>
              <strong>{note.label}</strong>
              <span>{note.detail}</span>
            </div>
          ))}
        </div>
      ) : null}
      {!rows?.length ? (
        <EmptyState label={`No ${type} available yet`} detail={emptyDetail} />
      ) : null}
      <div className="oms-table-wrap">
        <table className="oms-table">
          <thead>
            <tr>{keys.map((k) => (
              <th key={k}>
                <button className="oms-sort-button" type="button" onClick={() => setSortKey(k)}>
                  {humanize(k)}<ArrowUpDown size={13} />
                </button>
              </th>
            ))}</tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={row._id || row.id || i} onClick={() => onRowClick?.(row)}>
                {keys.map((k) => <td key={k}>{renderCell(row[k])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && filtered.length === 0 && <p className="oms-muted">No records match that search.</p>}
    </div>
  );
}

function renderCell(value: any) {
  if (value == null) return '—';
  if (typeof value === 'object') return Array.isArray(value) ? `${value.length} records` : value.name?.first || value.email || value.name || JSON.stringify(value).slice(0, 42);
  if (String(value).match(/^\d{4}-\d{2}-\d{2}/)) return new Date(value).toLocaleDateString();
  return String(value);
}

function OrderModal({ order, onClose }: { order: any; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const customer = order?.customer_name || order?.customerName || order?.customer_email || order?.customerEmail || 'Customer not mapped';
  const totals = order?.totals || {};
  const shipping = order?.shipping_address || order?.shippingAddress || {};
  return (
    <div className="oms-full-modal" role="dialog" aria-modal="true">
      <div className="oms-full-modal-head">
        <div><div className="oms-eyebrow">Order Detail</div><h2 style={{ margin: 0 }}>{order?.external_order_id || order?.externalOrderId || order?.orderNo || order?.id}</h2></div>
        <button className="oms-action-secondary" onClick={onClose}><X size={16} /> Close</button>
      </div>
      <div className="oms-full-modal-body">
        <div className="oms-page">
          <div className="oms-card-grid">
            <MetricCard label="Customer" value={String(customer)} />
            <MetricCard label="Total" value={money(totals.total || order?.total || 0)} />
            <MetricCard label="Status" value={String(order?.status || 'unknown')} />
            <MetricCard label="Channel" value={String(order?.account_channel || order?.channel || 'not connected')} />
          </div>
          <div className="oms-two-grid">
            <div className="oms-panel">
              <div className="oms-eyebrow">Shipping Destination</div>
              <p className="oms-muted">{[shipping.name, shipping.address1, shipping.city, shipping.state || shipping.stateOrProvinceCode, shipping.postalCode || shipping.zip].filter(Boolean).join(', ') || 'No shipping address stored.'}</p>
              <div className="oms-toolbar">
                <button className="oms-action-secondary" onClick={() => window.location.assign('/customers')}>Open customers</button>
                <button className="oms-action" onClick={() => window.location.assign('/shipment-plans')}>Create shipment plan</button>
              </div>
            </div>
            <div className="oms-panel">
              <div className="oms-eyebrow">OMS / WMS Execution</div>
              <p className="oms-muted">Orders remain OMS demand signals until inventory and warehouse execution states are confirmed by the WMS integration.</p>
              <MetricRows data={{
                lineCount: Array.isArray(order?.lines) ? order.lines.length : 0,
                paid: order?.paid === true ? 1 : 0,
                fulfillmentRisk: order?.status === 'late' ? 1 : 0,
              }} />
            </div>
          </div>
          <GenericTableScreen
            type="Order lines"
            rows={Array.isArray(order?.lines) ? order.lines : []}
            emptyDetail="No order lines are stored for this order yet. Connect marketplace line-item ingestion to enable SKU-level WMS allocation."
          />
        </div>
      </div>
    </div>
  );
}

function EntityCreateModal({
  state,
  customers,
  skus,
  suppliers,
  locations,
  onClose,
  onSwitch,
  onCreated,
  openShipmentWizard,
}: {
  state: Exclude<EntityModalState, null>;
  customers: any[];
  skus: OmsSku[];
  suppliers: any[];
  locations: any[];
  onClose: () => void;
  onSwitch: (entity: EntityKind, mode: EntityMode) => void;
  onCreated: () => Promise<void>;
  openShipmentWizard: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const title = {
    order: 'Order',
    customer: 'Customer',
    supplier: 'Supplier',
    sku: 'SKU',
    shipment: 'Shipment plan',
  }[state.entity];
  const templates: Record<EntityKind, string> = {
    customer: 'name,email,company,phone',
    supplier: 'name,email,phone,status',
    sku: 'sku,title,asin,weight,category',
    order: 'orderNumber,customerEmail,sku,quantity,unitPrice,status,channel',
    shipment: 'shipmentTitle,supplierName,shipFromLocationName,sku,quantity,estimatedArrivalDate',
  };
  const missing = useMemo(() => {
    const items: Array<{ label: string; detail: string; action: () => void }> = [];
    if (state.entity === 'order') {
      if (!customers.length) items.push({ label: 'Customer required', detail: 'Create or import a customer before a manual or CSV order can be accepted.', action: () => onSwitch('customer', 'manual') });
      if (!skus.length) items.push({ label: 'SKU required', detail: 'Create or import at least one catalog item so order lines can map to inventory.', action: () => onSwitch('sku', 'manual') });
    }
    if (state.entity === 'shipment') {
      if (!suppliers.length) items.push({ label: 'Supplier required', detail: 'Create or import a supplier before shipment plans can be built.', action: () => onSwitch('supplier', 'manual') });
      if (!locations.length) items.push({ label: 'Ship-from location required', detail: 'Add a supplier ship-from location in the shipment planner before CSV shipment import.', action: () => window.location.assign('/shipment-plans') });
      if (!skus.length) items.push({ label: 'SKU required', detail: 'Create or import at least one SKU before building an ASN or shipment plan.', action: () => onSwitch('sku', 'manual') });
    }
    return items;
  }, [customers.length, locations.length, onSwitch, skus.length, state.entity, suppliers.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    setForm({});
    setCsv('');
    setMessage(null);
  }, [state.entity, state.mode]);

  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const skuById = (id?: string) => (id ? skus.find((sku) => sku.id === id) : undefined);
  const customerByEmail = (email?: string) => customers.find((customer) => String(customer.email || '').toLowerCase() === String(email || '').toLowerCase());
  const skuByCode = (code?: string) => skus.find((sku) => String(sku.sku || '').toLowerCase() === String(code || '').toLowerCase());
  const supplierByName = (name?: string) => suppliers.find((supplier) => supplier.id === name || String(supplier.name || '').toLowerCase() === String(name || '').toLowerCase());
  const locationByName = (name?: string) => locations.find((location) => location.id === name || String(location.name || '').toLowerCase() === String(name || '').toLowerCase());

  const createOne = async (row: Record<string, string>) => {
    if (state.entity === 'customer') {
      return appFetch('/api/v1/customers', {
        method: 'POST',
        body: JSON.stringify({ name: row.name, email: row.email, company: row.company, phone: row.phone, channel: row.channel || 'manual' }),
      });
    }
    if (state.entity === 'supplier') {
      return appFetch('/api/v1/suppliers', {
        method: 'POST',
        body: JSON.stringify({ name: row.name, email: row.email, phone: row.phone, status: row.status || 'active' }),
      });
    }
    if (state.entity === 'sku') {
      return appFetch('/api/v1/items', {
        method: 'POST',
        body: JSON.stringify({ sku: row.sku, title: row.title || row.name || row.sku, asin: row.asin, weight: row.weight, category: row.category }),
      });
    }
    if (state.entity === 'order') {
      const customer = row.customerId ? customers.find((item) => item.id === row.customerId) : customerByEmail(row.customerEmail || row.email);
      const item = row.itemId ? skuById(row.itemId) : skuByCode(row.sku);
      if (!customer) throw new Error(`Customer not found for order ${row.orderNumber || row.externalOrderId || ''}`.trim());
      if (!item) throw new Error(`SKU not found for order ${row.orderNumber || row.externalOrderId || ''}`.trim());
      const quantity = Math.max(1, Number(row.quantity || 1));
      const unitPrice = Number(row.unitPrice || row.unit_price || 0);
      return appFetch('/api/v1/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerId: customer.id,
          orderNumber: row.orderNumber || row.externalOrderId,
          externalOrderId: row.externalOrderId || row.orderNumber,
          status: row.status || 'open',
          channel: row.channel || 'manual',
          total: row.total ? Number(row.total) : quantity * unitPrice,
          source: state.mode === 'csv' ? 'oms_csv_import' : 'oms_manual',
          lines: [{ itemId: item.id, sku: item.sku, title: item.title, quantity, unitPrice }],
        }),
      });
    }
    const supplier = supplierByName(row.supplierId || row.supplierName);
    const location = locationByName(row.shipFromLocationId || row.shipFromLocationName);
    const item = skuByCode(row.sku) || skuById(row.itemId);
    if (!supplier || !location || !item) throw new Error('Shipment plans require supplier, ship-from location, and SKU.');
    return createShipmentPlan({
      supplierId: supplier.id,
      shipFromLocationId: location.id,
      prepServicesOnly: false,
      shipmentTitle: row.shipmentTitle || `OMS shipment ${new Date().toLocaleDateString()}`,
      estimatedArrivalDate: row.estimatedArrivalDate || undefined,
      items: [{ sku: item.sku, itemId: item.id, title: item.title, quantity: Math.max(1, Number(row.quantity || 1)) }],
    });
  };

  const submit = async (event: any) => {
    event.preventDefault();
    if (missing.length) return;
    setBusy(true);
    setMessage(null);
    try {
      const rows = state.mode === 'csv' ? parseCsv(csv) : [form];
      if (!rows.length) throw new Error('No records provided.');
      for (const row of rows) await createOne(row);
      setMessage(`${rows.length} ${title.toLowerCase()} record${rows.length === 1 ? '' : 's'} created.`);
      await onCreated();
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Create failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="oms-full-modal" role="dialog" aria-modal="true">
      <div className="oms-full-modal-head">
        <div>
          <div className="oms-eyebrow">{state.mode === 'csv' ? 'CSV Import' : 'Manual Create'}</div>
          <h2 style={{ margin: 0 }}>{title}</h2>
        </div>
        <button className="oms-action-secondary" onClick={onClose}><X size={16} /> Close</button>
      </div>
      <div className="oms-full-modal-body">
        <form className="oms-page" onSubmit={submit}>
          {missing.length ? (
            <div className="oms-panel oms-dependency-panel">
              <div>
                <div className="oms-eyebrow">Relationship Rules</div>
                <h2>Finish required setup first</h2>
                <p className="oms-muted">The OMS now enforces real operating relationships instead of creating orphan records.</p>
              </div>
              <div className="oms-three-grid">
                {missing.map((item) => (
                  <div key={item.label} className="oms-card">
                    <strong>{item.label}</strong>
                    <p className="oms-muted">{item.detail}</p>
                    <button className="oms-action-secondary" type="button" onClick={item.action}>Resolve</button>
                  </div>
                ))}
              </div>
            </div>
          ) : state.mode === 'csv' ? (
            <div className="oms-panel">
              <div className="oms-eyebrow">Import Template</div>
              <h2>{templates[state.entity]}</h2>
              <p className="oms-muted">Paste CSV rows using the headers above. Orders must reference an existing customer email and SKU. Shipment plans must reference existing supplier, ship-from location, and SKU records.</p>
              <textarea className="oms-textarea" value={csv} onChange={(event) => setCsv(event.target.value)} placeholder={`${templates[state.entity]}\n`} rows={10} />
            </div>
          ) : (
            <div className="oms-panel">
              <div className="oms-eyebrow">Manual Intake</div>
              <h2>Create {title.toLowerCase()}</h2>
              {state.entity === 'customer' && (
                <div className="oms-form-grid compact">
                  <label>Name<input value={form.name || ''} onChange={(event) => update('name', event.target.value)} required /></label>
                  <label>Email<input type="email" value={form.email || ''} onChange={(event) => update('email', event.target.value)} /></label>
                  <label>Company<input value={form.company || ''} onChange={(event) => update('company', event.target.value)} /></label>
                  <label>Phone<input value={form.phone || ''} onChange={(event) => update('phone', event.target.value)} /></label>
                </div>
              )}
              {state.entity === 'supplier' && (
                <div className="oms-form-grid compact">
                  <label>Name<input value={form.name || ''} onChange={(event) => update('name', event.target.value)} required /></label>
                  <label>Email<input type="email" value={form.email || ''} onChange={(event) => update('email', event.target.value)} /></label>
                  <label>Phone<input value={form.phone || ''} onChange={(event) => update('phone', event.target.value)} /></label>
                  <label>Status<select value={form.status || 'active'} onChange={(event) => update('status', event.target.value)}><option value="active">Active</option><option value="paused">Paused</option></select></label>
                </div>
              )}
              {state.entity === 'sku' && (
                <div className="oms-form-grid compact">
                  <label>SKU<input value={form.sku || ''} onChange={(event) => update('sku', event.target.value)} required /></label>
                  <label>Title<input value={form.title || ''} onChange={(event) => update('title', event.target.value)} required /></label>
                  <label>ASIN<input value={form.asin || ''} onChange={(event) => update('asin', event.target.value)} /></label>
                  <label>Weight<input type="number" min={0} step="0.01" value={form.weight || ''} onChange={(event) => update('weight', event.target.value)} /></label>
                  <label>Category<input value={form.category || ''} onChange={(event) => update('category', event.target.value)} /></label>
                </div>
              )}
              {state.entity === 'order' && (
                <div className="oms-form-grid compact">
                  <label>Customer<select value={form.customerId || ''} onChange={(event) => update('customerId', event.target.value)} required><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name || customer.email || customer.id}</option>)}</select></label>
                  <label>SKU<select value={form.itemId || ''} onChange={(event) => update('itemId', event.target.value)} required><option value="">Select SKU</option>{skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sku} - {sku.title || 'Untitled'}</option>)}</select></label>
                  <label>Order #<input value={form.orderNumber || ''} onChange={(event) => update('orderNumber', event.target.value)} required /></label>
                  <label>Quantity<input type="number" min={1} value={form.quantity || '1'} onChange={(event) => update('quantity', event.target.value)} /></label>
                  <label>Unit price<input type="number" min={0} step="0.01" value={form.unitPrice || '0'} onChange={(event) => update('unitPrice', event.target.value)} /></label>
                  <label>Status<select value={form.status || 'open'} onChange={(event) => update('status', event.target.value)}><option value="open">Open</option><option value="paid">Paid</option><option value="fulfilled">Fulfilled</option><option value="cancelled">Cancelled</option></select></label>
                </div>
              )}
              {state.entity === 'shipment' && (
                <div className="oms-form-grid compact">
                  <label>Supplier<select value={form.supplierId || ''} onChange={(event) => update('supplierId', event.target.value)} required><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
                  <label>Ship-from<select value={form.shipFromLocationId || ''} onChange={(event) => update('shipFromLocationId', event.target.value)} required><option value="">Select location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
                  <label>SKU<select value={form.itemId || ''} onChange={(event) => update('itemId', event.target.value)} required><option value="">Select SKU</option>{skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sku} - {sku.title || 'Untitled'}</option>)}</select></label>
                  <label>Quantity<input type="number" min={1} value={form.quantity || '1'} onChange={(event) => update('quantity', event.target.value)} /></label>
                  <label>Shipment title<input value={form.shipmentTitle || ''} onChange={(event) => update('shipmentTitle', event.target.value)} /></label>
                  <label>ETA<input type="date" value={form.estimatedArrivalDate || ''} onChange={(event) => update('estimatedArrivalDate', event.target.value)} /></label>
                </div>
              )}
            </div>
          )}
          <div className="oms-modal-actions">
            {state.entity === 'shipment' && state.mode === 'manual' ? <button className="oms-action-secondary" type="button" onClick={openShipmentWizard}><Truck size={16} /> Use auto-routed wizard</button> : null}
            <button className="oms-action-secondary" type="button" onClick={() => onSwitch(state.entity, state.mode === 'csv' ? 'manual' : 'csv')}>
              {state.mode === 'csv' ? <Plus size={16} /> : <FileUp size={16} />}
              {state.mode === 'csv' ? 'Manual create' : 'Import CSV'}
            </button>
            <button className="oms-action" disabled={busy || Boolean(missing.length)}>{busy ? 'Saving...' : `Save ${title}`}</button>
          </div>
          {message && <div className="oms-error-banner">{message}</div>}
        </form>
      </div>
    </div>
  );
}

function HeatmapScreen({ data }: { data: any }) {
  if (!data) return <Loading />;
  return (
    <div className="oms-hero-grid">
      <div className="oms-panel">
        <div className="oms-eyebrow">United States Demand</div>
        {data.states?.length ? (
          <div className="oms-map-grid" style={{ marginTop: 16 }}>{data.states?.map((s: any) => <div key={s.state} className={`oms-state-cell ${s.risk}`} title={`${s.state}: ${fmt.format(s.demand)} demand units`}>{s.state}</div>)}</div>
        ) : (
          <EmptyState label="No regional demand data yet" detail="Connect marketplace orders or a custom order API so the heatmap can calculate state-level demand from real customer destinations." action={{ label: 'Connect marketplace', href: '/dashboard', icon: <ExternalLink size={16} /> }} />
        )}
      </div>
      <div className="oms-panel">
        <div className="oms-eyebrow">Warehouses</div>
        {data.warehouses?.length ? (
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>{data.warehouses?.map((w: any) => <div key={w.id} className="oms-card"><strong>{w.name || w.code}</strong><p className="oms-muted">{w.state || 'state pending'} · {fmt.format(w.inventoryUnits)} units · {w.activeSkus} SKUs</p></div>)}</div>
        ) : (
          <EmptyState label="No WMS warehouse connection" detail="Connect WMS warehouses before the OMS can compare inventory placement against regional demand." action={{ label: 'Connect WMS', href: '/connect-warehouse', icon: <Building2 size={16} /> }} />
        )}
      </div>
    </div>
  );
}

function LabelAuditScreen({ data }: { data: any }) {
  if (!data) return <Loading />;
  return (
    <div className="oms-page">
      <div className="oms-card-grid">
        <MetricCard label="Open findings" value={fmt.format(data.summary?.openFindings || 0)} />
        <MetricCard label="Estimated refunds" value={money(data.summary?.estimatedRefunds || 0)} />
        <MetricCard label="Service savings" value={money(data.summary?.optimizedServiceSavings || 0)} />
        <MetricCard label="Audit posture" value="Active" />
      </div>
      <GenericTableScreen
        type="Carrier findings"
        rows={data.findings || []}
        actions={[{ label: 'Upload carrier file', href: '/oms?view=labels', icon: <Upload size={16} /> }]}
        emptyDetail="Carrier audit findings appear after carrier account enrichment or file uploads create evidence-backed refund opportunities."
      />
    </div>
  );
}

function BillingScreen({ data }: { data: any }) {
  if (!data) return <Loading />;
  const rows = Object.keys(data.current || {}).map((key) => ({ category: key, current: money(data.current[key]), optimized: money(data.optimized?.[key]), savings: money(Number(data.current[key] || 0) - Number(data.optimized?.[key] || 0)) }));
  return <GenericTableScreen type="Cost model" rows={rows} />;
}

function MarketplaceScreen() {
  const apps = ['Inventory optimizer', 'Carrier refund bot', 'Accounting bridge', 'Customer support AI', 'Backhaul finder', 'Demand anomaly watcher'];
  return <div className="oms-three-grid">{apps.map((app, i) => <div key={app} className="oms-panel"><Sparkles size={20} color="var(--oms-accent)" /><h2>{app}</h2><p className="oms-muted">Installable OMS intelligence module for automations, alerts, and operating suggestions.</p><Badge value={i % 2 === 0 ? 'ready' : 'coming soon'} /></div>)}</div>;
}

export default function OmsPage() {
  const router = useRouter();
  const view = getView(router.query.view);
  const copy = viewTitles[view];
  const [range, setRange] = useState<OmsRange>('7d');
  const [command, setCommand] = useState<CommandCenter | null>(null);
  const [business, setBusiness] = useState<BusinessDoubleResponse | null>(null);
  const [plan, setPlan] = useState<InventoryPlan | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierLocations, setSupplierLocations] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [heatmap, setHeatmap] = useState<any>(null);
  const [labels, setLabels] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, OmsSku>>({});
  const [detail, setDetail] = useState<any | null>(null);
  const [orderDetail, setOrderDetail] = useState<any | null>(null);
  const [entityModal, setEntityModal] = useState<EntityModalState>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void loadCore();
  }, [range]);

  useEffect(() => {
    void loadView(view);
  }, [view]);

  useEffect(() => {
    if (!wizardOpen || suppliers.length || supplierLocations.length) return;
    void omsFetch<any>('/suppliers')
      .then((response) => {
        setSuppliers(response.suppliers || []);
        setSupplierLocations(response.locations || []);
      })
      .catch((error) => {
        console.error('[OMS] supplier load for wizard failed', error);
        setLoadError(error instanceof Error ? error.message : 'Unable to load suppliers for shipment wizard.');
      });
  }, [wizardOpen, suppliers.length, supplierLocations.length]);

  async function loadCore() {
    try {
      setLoadError(null);
      const [cmd, bd, inv] = await Promise.all([
        omsFetch<CommandCenter>(`/command-center?range=${range}`),
        omsFetch<BusinessDoubleResponse>('/business-double'),
        omsFetch<InventoryPlan>('/inventory-plan?horizon=6m'),
      ]);
      setCommand(cmd);
      setBusiness(bd);
      setPlan(inv);
    } catch (error) {
      console.error('[OMS] core load failed', error);
      setLoadError(error instanceof Error ? error.message : 'OMS API is not reachable.');
      setCommand(null);
      setBusiness(null);
      setPlan(null);
    }
  }

  async function loadView(next: ViewKey) {
    try {
      setLoadError(null);
      if (next === 'orders') {
        const [orderResponse, customerResponse] = await Promise.all([
          omsFetch<any>('/orders'),
          omsFetch<any>('/customers'),
        ]);
        setOrders(orderResponse.orders || []);
        setCustomers(customerResponse.customers || []);
      }
      if (next === 'customers') setCustomers((await omsFetch<any>('/customers')).customers || []);
      if (next === 'suppliers') {
        const response = await omsFetch<any>('/suppliers');
        setSuppliers(response.suppliers || []);
        setSupplierLocations(response.locations || []);
      }
      if (next === 'shipments') {
        const [plansResponse, supplierResponse] = await Promise.all([
          fetchShipmentPlans({ limit: 200 }),
          omsFetch<any>('/suppliers'),
        ]);
        setShipments(plansResponse.plans || []);
        setSuppliers(supplierResponse.suppliers || []);
        setSupplierLocations(supplierResponse.locations || []);
      }
      if (next === 'heatmap') setHeatmap(await omsFetch('/heatmap'));
      if (next === 'labels') setLabels(await omsFetch('/label-audit'));
      if (next === 'billing') setBilling(await omsFetch('/billing-profit'));
      if (next === 'ledger') setLedger((await omsFetch<any>('/ledger')).events || []);
    } catch (error) {
      console.error('[OMS] view load failed', error);
      setLoadError(error instanceof Error ? error.message : 'OMS API is not reachable.');
      if (next === 'orders') setOrders([]);
      if (next === 'customers') setCustomers([]);
      if (next === 'suppliers') {
        setSuppliers([]);
        setSupplierLocations([]);
      }
      if (next === 'shipments') setShipments([]);
      if (next === 'heatmap') setHeatmap({ states: [], warehouses: [] });
      if (next === 'labels') setLabels({ summary: { openFindings: 0, estimatedRefunds: 0, optimizedServiceSavings: 0 }, findings: [] });
      if (next === 'billing') setBilling({ current: {}, optimized: {} });
      if (next === 'ledger') setLedger([]);
    }
  }

  const selectedList = useMemo(() => Object.values(selected), [selected]);

  const toggleSku = (sku: OmsSku) => {
    setSelected((current) => {
      const next = { ...current };
      if (next[sku.id]) delete next[sku.id];
      else next[sku.id] = sku;
      return next;
    });
  };

  const openSku = async (sku: OmsSku) => {
    try {
      setDetail(await omsFetch(`/skus/${encodeURIComponent(sku.id)}`));
    } catch {
      setDetail({ sku: sku.sku, title: sku.title, intelligence: sku, nextShipments: [], warehouses: [] });
    }
  };

  const openEntityModal = (entity: EntityKind, mode: EntityMode = 'manual') => {
    setEntityModal({ entity, mode });
  };

  const reloadAfterEntityMutation = async () => {
    await loadCore();
    if (view === 'skus' || entityModal?.entity === 'sku') await loadCore();
    if (view === 'orders' || entityModal?.entity === 'order') await loadView('orders');
    if (view === 'customers' || entityModal?.entity === 'customer') await loadView('customers');
    if (view === 'suppliers' || entityModal?.entity === 'supplier') await loadView('suppliers');
    if (view === 'shipments' || entityModal?.entity === 'shipment') await loadView('shipments');
    await loadView('ledger');
  };

  const approveBusiness = async () => {
    if (!business?.plan?.id) return;
    setApproving(true);
    try {
      await omsFetch(`/business-double/${encodeURIComponent(business.plan.id)}/approve`, { method: 'POST', body: JSON.stringify({}) });
      await loadCore();
      await loadView('ledger');
      void router.push('/oms?view=ledger');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Business Double approval failed.');
    } finally {
      setApproving(false);
    }
  };

  const primaryActions: Record<string, PageAction[]> = {
    command: [
      { label: 'Create SKU', onClick: () => openEntityModal('sku', 'manual'), icon: <Plus size={16} /> },
      { label: 'Create shipment', onClick: () => setWizardOpen(true), icon: <Truck size={16} /> },
      { label: 'Connect marketplace', href: '/dashboard', icon: <ExternalLink size={16} />, variant: 'secondary' },
    ],
    inventory: [
      { label: 'Create SKU', onClick: () => openEntityModal('sku', 'manual'), icon: <Plus size={16} /> },
      { label: 'Import SKUs', onClick: () => openEntityModal('sku', 'csv'), icon: <Upload size={16} />, variant: 'secondary' },
      { label: 'Create shipment', onClick: () => setWizardOpen(true), icon: <Truck size={16} /> },
      { label: 'Connect WMS', href: '/connect-warehouse', icon: <Building2 size={16} />, variant: 'secondary' },
    ],
    skus: [
      { label: 'Create SKU', onClick: () => openEntityModal('sku', 'manual'), icon: <Plus size={16} /> },
      { label: 'Import CSV', onClick: () => openEntityModal('sku', 'csv'), icon: <Upload size={16} />, variant: 'secondary' },
      { label: 'Create shipment', onClick: () => setWizardOpen(true), icon: <Truck size={16} /> },
    ],
    orders: [
      { label: 'Create order', onClick: () => openEntityModal('order', 'manual'), icon: <Plus size={16} /> },
      { label: 'Import CSV', onClick: () => openEntityModal('order', 'csv'), icon: <Upload size={16} />, variant: 'secondary' },
      { label: 'Connect marketplace', href: '/dashboard', icon: <ExternalLink size={16} />, variant: 'secondary' },
    ],
    customers: [
      { label: 'Create customer', onClick: () => openEntityModal('customer', 'manual'), icon: <Plus size={16} /> },
      { label: 'Import CSV', onClick: () => openEntityModal('customer', 'csv'), icon: <Upload size={16} />, variant: 'secondary' },
      { label: 'Connect marketplace', href: '/dashboard', icon: <ExternalLink size={16} />, variant: 'secondary' },
    ],
    suppliers: [
      { label: 'Create supplier', onClick: () => openEntityModal('supplier', 'manual'), icon: <Plus size={16} /> },
      { label: 'Import CSV', onClick: () => openEntityModal('supplier', 'csv'), icon: <Upload size={16} />, variant: 'secondary' },
    ],
    shipments: [
      { label: 'Create shipment plan', onClick: () => openEntityModal('shipment', 'manual'), icon: <Plus size={16} /> },
      { label: 'Import CSV', onClick: () => openEntityModal('shipment', 'csv'), icon: <Upload size={16} />, variant: 'secondary' },
      { label: 'Auto-routed wizard', onClick: () => setWizardOpen(true), icon: <Truck size={16} />, variant: 'secondary' },
    ],
    heatmap: [{ label: 'Connect warehouse', href: '/connect-warehouse', icon: <Building2 size={16} /> }],
    labels: [{ label: 'Upload carrier file', href: '/oms?view=labels', icon: <Upload size={16} /> }],
    ledger: [{ label: 'Refresh ledger', onClick: () => void loadView('ledger'), icon: <RefreshCcw size={16} />, variant: 'secondary' }],
  };

  const screen =
    view === 'business' ? <BusinessScreen data={business} onApprove={approveBusiness} approving={approving} /> :
    view === 'inventory' ? <InventoryScreen plan={plan} selected={selected} toggleSku={toggleSku} openSku={openSku} actions={primaryActions.inventory} /> :
    view === 'skus' ? <div className="oms-page"><SkuTable skus={plan?.skus || []} selected={selected} toggleSku={toggleSku} openSku={openSku} actions={primaryActions.skus} /></div> :
    view === 'orders' ? <GenericTableScreen type="Orders" rows={orders} actions={primaryActions.orders} onRowClick={setOrderDetail} emptyDetail="Create orders manually, import CSV orders, connect marketplaces, or use the public API. Orders require an existing customer and SKU before they can trigger inventory logic." relationNotes={[
      { label: 'Customer dependency', detail: customers.length ? `${customers.length} customer records available` : 'Create or import customers before creating orders', status: customers.length ? 'ready' : 'blocked' },
      { label: 'Item dependency', detail: plan?.skus?.length ? `${plan.skus.length} SKUs available for order lines` : 'Create or import SKUs before creating orders', status: plan?.skus?.length ? 'ready' : 'blocked' },
    ]} /> :
    view === 'customers' ? <GenericTableScreen type="Customers" rows={customers} actions={primaryActions.customers} emptyDetail="Create customers directly, import a CSV, sync marketplace channels, or use the customer API." /> :
    view === 'suppliers' ? <GenericTableScreen type="Suppliers" rows={suppliers} actions={primaryActions.suppliers} emptyDetail="Create suppliers manually or by CSV before shipments and ASN planning can be built." /> :
    view === 'shipments' ? <GenericTableScreen type="Shipment plans" rows={shipments} actions={primaryActions.shipments} emptyDetail="Create shipment plans manually, import shipment CSV rows, or select SKUs to start the auto-routed OMS shipment wizard." relationNotes={[
      { label: 'Supplier dependency', detail: suppliers.length ? `${suppliers.length} suppliers available` : 'Create or import suppliers first', status: suppliers.length ? 'ready' : 'blocked' },
      { label: 'Ship-from dependency', detail: supplierLocations.length ? `${supplierLocations.length} ship-from locations available` : 'Add ship-from locations before shipment import', status: supplierLocations.length ? 'ready' : 'blocked' },
      { label: 'Item dependency', detail: plan?.skus?.length ? `${plan.skus.length} SKUs available` : 'Create SKUs before shipment planning', status: plan?.skus?.length ? 'ready' : 'blocked' },
    ]} /> :
    view === 'heatmap' ? <HeatmapScreen data={heatmap} /> :
    view === 'labels' ? <LabelAuditScreen data={labels} /> :
    view === 'billing' ? <BillingScreen data={billing} /> :
    view === 'marketplace' ? <MarketplaceScreen /> :
    view === 'ledger' ? <GenericTableScreen type="Intelligence ledger" rows={ledger} actions={primaryActions.ledger} emptyDetail="Ledger entries appear after approved Business Double plans, shipment confirmations, WMS callbacks, carrier audit activity, and Cortex orchestration events." /> :
    <CommandScreen data={command} range={range} setRange={setRange} actions={primaryActions.command} />;

  return (
    <DashboardLayout title={copy.title} subtitle={copy.subtitle}>
      {loadError && <div className="oms-error-banner"><ShieldAlert size={16} /> {loadError}</div>}
      {screen}
      {selectedList.length > 0 && (
        <div className="oms-selection-bar">
          <PackageSearch size={18} />
          <strong>{selectedList.length} SKU{selectedList.length === 1 ? '' : 's'} selected</strong>
          <button className="oms-action-secondary" onClick={() => setSelected({})}>Clear</button>
          <button className="oms-action" onClick={() => setWizardOpen(true)}>Create shipment</button>
        </div>
      )}
      {detail && <DetailModal sku={detail} onClose={() => setDetail(null)} />}
      {orderDetail && <OrderModal order={orderDetail} onClose={() => setOrderDetail(null)} />}
      {entityModal && (
        <EntityCreateModal
          state={entityModal}
          customers={customers}
          skus={plan?.skus || []}
          suppliers={suppliers}
          locations={supplierLocations}
          onClose={() => setEntityModal(null)}
          onSwitch={(entity, mode) => setEntityModal({ entity, mode })}
          onCreated={reloadAfterEntityMutation}
          openShipmentWizard={() => {
            setEntityModal(null);
            setWizardOpen(true);
          }}
        />
      )}
      {wizardOpen && <ShipmentWizard selected={selectedList} suppliers={suppliers} locations={supplierLocations} onClose={() => setWizardOpen(false)} />}
    </DashboardLayout>
  );
}
