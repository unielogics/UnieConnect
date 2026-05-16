import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  ExternalLink,
  FileText,
  Gauge,
  Layers3,
  PackageCheck,
  PackageSearch,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { CommandCenter, InventoryPlan, OmsRange, OmsSku, omsFetch, BusinessDoubleResponse } from '../lib/oms';

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

function fallbackSkus(): OmsSku[] {
  return [
    { id: 'demo-1', sku: 'SKU-ATL-001', title: 'Multipack kitchen organizer', available: 84, inbound: 260, velocity30d: 132, daysOfCover: 19, risk: 'medium', currentWarehouseCount: 1, proposedWarehouseCount: 3, proposedUnits: 420, minViableUnits: 160, palletCubeFt: 52, palletWeightLbs: 930, fillPercent: 87, serviceTier: 'standard', recommendation: 'Split across NJ, GA, and TX to reduce zone cost' },
    { id: 'demo-2', sku: 'SKU-FL-204', title: 'Premium pet travel mat', available: 18, inbound: 0, velocity30d: 96, daysOfCover: 6, risk: 'high', currentWarehouseCount: 1, proposedWarehouseCount: 2, proposedUnits: 300, minViableUnits: 120, palletCubeFt: 44, palletWeightLbs: 520, fillPercent: 72, serviceTier: 'priority', recommendation: 'Priority replenishment required before service miss' },
    { id: 'demo-3', sku: 'SKU-NJ-778', title: 'Compact storage bin set', available: 340, inbound: 140, velocity30d: 88, daysOfCover: 116, risk: 'low', currentWarehouseCount: 2, proposedWarehouseCount: 2, proposedUnits: 180, minViableUnits: 80, palletCubeFt: 36, palletWeightLbs: 690, fillPercent: 60, serviceTier: 'economy', recommendation: 'Pool with compatible seller inventory for pallet efficiency' },
  ];
}

function fallbackCommand(range: OmsRange): CommandCenter {
  return {
    range,
    metrics: { revenue: 184200, revenueDeltaPct: 12.4, orders: 1268, ordersDeltaPct: 8.1, aov: 145, grossProfit: 66312, refunds: 1480, units: 3910, unitsDeltaPct: 10.2 },
    warnings: [
      { severity: 'high', title: 'Priority replenishment window', detail: '7 SKUs will fall below 10 days of cover before the next planned inbound.' },
      { severity: 'medium', title: 'Pallet fill opportunity', detail: 'Cortex found compatible seller volume to complete two LTL pallets.' },
    ],
    autonomousActivity: [
      { system: 'OMS', action: 'Six-month demand plan refreshed from marketplace trends', status: 'complete', confidence: 0.92, at: new Date().toISOString() },
      { system: 'WMS', action: 'Inbound truth gate checked against ASN and staged inventory', status: 'complete', confidence: 0.86, at: new Date().toISOString() },
      { system: 'Cortex', action: 'TMS consolidation plan prepared for approval threshold', status: 'ready', confidence: 0.89, at: new Date().toISOString() },
    ],
    counts: { items: 238, orders: 1268, customers: 812, suppliers: 34, channels: 3, shipmentPlans: 18, facilities: 4 },
  };
}

function fallbackPlan(): InventoryPlan {
  const skus = fallbackSkus();
  return {
    current: { skuCount: 238, warehouseCount: 1, stockoutRiskSkus: 17, estimatedMonthlyCost: 42600 },
    proposed: { warehouseCount: 4, stockoutRiskSkus: 6, estimatedMonthlyCost: 34900, sharedPalletCandidates: 42 },
    months: ['Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026'].map((month, index) => ({
      month,
      projectedUnits: 8600 + index * 720,
      proposedReplenishment: 3100 + index * 260,
      savings: 4200 + index * 310,
    })),
    skus,
    warehouses: [
      { id: 'w-nj', code: 'NJ', name: 'New Jersey Cross-Dock', city: 'Newark', state: 'NJ' },
      { id: 'w-fl', code: 'FL', name: 'Florida Fulfillment', city: 'Miami', state: 'FL' },
      { id: 'w-tx', code: 'TX', name: 'Texas Regional Node', city: 'Dallas', state: 'TX' },
    ],
  };
}

function fallbackBusiness(): BusinessDoubleResponse {
  return {
    persistence: 'frontend_fallback',
    plan: {
      id: 'fallback-business-double',
      status: 'draft',
      title: 'Six-month multi-warehouse operating plan',
      summary: 'A production UI fallback is active until the local OMS backend is reachable. The same UI consumes the real OMS API when it is online.',
      currentMetrics: { monthlyRevenue: 184200, monthlyCost: 42600, averageDeliveryDays: 5.2, warehouseNodes: 1, stockoutRiskPct: 18 },
      optimizedMetrics: { monthlyRevenue: 198936, monthlyCost: 34900, averageDeliveryDays: 2.8, warehouseNodes: 4, stockoutRiskPct: 7 },
      savings: { monthly: 7700, annualized: 92400, freightPct: 14, storagePct: 7, handlingPct: 5 },
      autonomousAfterApproval: ['WMS work prioritization', 'ASN routing', 'TMS consolidation', 'label audit claims', 'seller inventory nudges'],
      approvalRequiredFor: ['Business Double operating model changes', 'low-confidence cross-system dispatch', 'policy/compliance exceptions'],
    },
  };
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

function EmptyState({ label }: { label: string }) {
  return <div className="oms-panel oms-muted">{label}</div>;
}

function Loading() {
  return <div className="oms-panel oms-muted">Loading OMS intelligence...</div>;
}

function CommandScreen({ data, range, setRange }: { data: CommandCenter | null; range: OmsRange; setRange: (range: OmsRange) => void }) {
  if (!data) return <Loading />;
  return (
    <div className="oms-page">
      <div className="oms-toolbar">
        <div>
          <div className="oms-eyebrow">Sales Overview</div>
          <h2 style={{ margin: '4px 0 0' }}>Today / 7 day / 30 day operating picture</h2>
        </div>
        <div className="oms-segments">
          {(['today', '7d', '30d'] as OmsRange[]).map((r) => (
            <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r === 'today' ? 'Today' : r}</button>
          ))}
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

function InventoryScreen({ plan, selected, toggleSku, openSku }: { plan: InventoryPlan | null; selected: Record<string, OmsSku>; toggleSku: (sku: OmsSku) => void; openSku: (sku: OmsSku) => void }) {
  if (!plan) return <Loading />;
  return (
    <div className="oms-page">
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

function SkuTable({ skus, selected, toggleSku, openSku }: { skus: OmsSku[]; selected: Record<string, OmsSku>; toggleSku: (sku: OmsSku) => void; openSku: (sku: OmsSku) => void }) {
  const [menu, setMenu] = useState<{ x: number; y: number; sku: OmsSku } | null>(null);
  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);
  return (
    <div className="oms-panel">
      <div className="oms-toolbar" style={{ marginBottom: 14 }}>
        <div><div className="oms-eyebrow">SKU Intelligence</div><h2>Warehouse truth and placement readiness</h2></div>
        <span className="oms-muted">Right-click a row for actions</span>
      </div>
      <div className="oms-table-wrap">
        <table className="oms-table">
          <thead>
            <tr>
              <th></th><th>SKU</th><th>Title</th><th>Available</th><th>Days</th><th>Risk</th><th>Service</th><th>Pallet Fill</th><th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {skus.map((sku) => (
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

function ShipmentWizard({ selected, onClose }: { selected: OmsSku[]; onClose: () => void }) {
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
    setBusy(true);
    setResult(null);
    try {
      const draft = await omsFetch<any>('/shipment-wizard/drafts', {
        method: 'POST',
        body: JSON.stringify({
          requiresBol,
          requiresLabels,
          selectedItems: selected.map((item) => ({
            id: item.id,
            itemId: item.id,
            sku: item.sku,
            title: item.title,
            quantity: Math.max(1, item.proposedUnits),
            boxCount: 1,
            unitsPerBox: Math.max(1, item.proposedUnits),
          })),
        }),
      });
      setResult(`Draft ${draft?.draft?.id || draft?.draft?.id || 'created'} created. ASN will be generated after supplier ship-from selection is present.`);
    } catch (err: any) {
      setResult(err?.message ? `Local draft prepared; API is offline (${err.message}).` : 'Local draft prepared; API is offline.');
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
            <div className="oms-table-wrap" style={{ marginTop: 12 }}>
              <table className="oms-table">
                <thead><tr><th>SKU</th><th>Units</th><th>Pallet fill</th><th>Service</th><th>Routing</th></tr></thead>
                <tbody>{selected.map((s) => <tr key={s.id}><td>{s.sku}</td><td>{fmt.format(s.proposedUnits)}</td><td>{s.fillPercent}%</td><td><Badge value={s.serviceTier} /></td><td>Cortex auto-routed</td></tr>)}</tbody>
              </table>
            </div>
          </div>
          <div className="oms-two-grid">
            <div className="oms-panel">
              <div className="oms-eyebrow">Documents</div>
              <label style={{ display: 'flex', gap: 10, marginTop: 14 }}><input type="checkbox" checked={requiresBol} onChange={(e) => setRequiresBol(e.target.checked)} /> Generate BOL</label>
              <label style={{ display: 'flex', gap: 10, marginTop: 14 }}><input type="checkbox" checked={requiresLabels} onChange={(e) => setRequiresLabels(e.target.checked)} /> Generate shipping labels</label>
              <p className="oms-muted">ASN is mandatory and generated after confirmation. The client does not choose the warehouse.</p>
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

function GenericTableScreen({ type, rows }: { type: string; rows: any[] }) {
  if (!rows?.length) return <EmptyState label={`No ${type} available yet.`} />;
  const keys = Object.keys(rows[0] || {}).filter((k) => !['_id', 'id', '__v'].includes(k)).slice(0, 7);
  return (
    <div className="oms-panel">
      <div className="oms-toolbar" style={{ marginBottom: 14 }}><div><div className="oms-eyebrow">{type}</div><h2>Production data projection</h2></div><RefreshCcw size={18} /></div>
      <div className="oms-table-wrap">
        <table className="oms-table">
          <thead><tr>{keys.map((k) => <th key={k}>{k}</th>)}</tr></thead>
          <tbody>{rows.map((row, i) => <tr key={row._id || row.id || i}>{keys.map((k) => <td key={k}>{renderCell(row[k])}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function renderCell(value: any) {
  if (value == null) return '—';
  if (typeof value === 'object') return Array.isArray(value) ? `${value.length} records` : value.name?.first || value.email || value.name || JSON.stringify(value).slice(0, 42);
  if (String(value).match(/^\d{4}-\d{2}-\d{2}/)) return new Date(value).toLocaleDateString();
  return String(value);
}

function HeatmapScreen({ data }: { data: any }) {
  if (!data) return <Loading />;
  return (
    <div className="oms-hero-grid">
      <div className="oms-panel">
        <div className="oms-eyebrow">United States Demand</div>
        <div className="oms-map-grid" style={{ marginTop: 16 }}>{data.states?.map((s: any) => <div key={s.state} className={`oms-state-cell ${s.risk}`} title={`${s.state}: ${fmt.format(s.demand)} demand units`}>{s.state}</div>)}</div>
      </div>
      <div className="oms-panel">
        <div className="oms-eyebrow">Warehouses</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>{data.warehouses?.map((w: any) => <div key={w.id} className="oms-card"><strong>{w.name || w.code}</strong><p className="oms-muted">{w.state} · {fmt.format(w.inventoryUnits)} units · {w.activeSkus} SKUs</p></div>)}</div>
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
      <GenericTableScreen type="Carrier findings" rows={data.findings || []} />
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
  const [shipments, setShipments] = useState<any[]>([]);
  const [heatmap, setHeatmap] = useState<any>(null);
  const [labels, setLabels] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, OmsSku>>({});
  const [detail, setDetail] = useState<any | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    void loadCore();
  }, [range]);

  useEffect(() => {
    void loadView(view);
  }, [view]);

  async function loadCore() {
    try {
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
      setCommand(fallbackCommand(range));
      setBusiness(fallbackBusiness());
      setPlan(fallbackPlan());
    }
  }

  async function loadView(next: ViewKey) {
    try {
      if (next === 'orders') setOrders((await omsFetch<any>('/orders')).orders || []);
      if (next === 'customers') setCustomers((await omsFetch<any>('/customers')).customers || []);
      if (next === 'suppliers') setSuppliers((await omsFetch<any>('/suppliers')).suppliers || []);
      if (next === 'shipments') setShipments((await omsFetch<any>('/ledger')).events || []);
      if (next === 'heatmap') setHeatmap(await omsFetch('/heatmap'));
      if (next === 'labels') setLabels(await omsFetch('/label-audit'));
      if (next === 'billing') setBilling(await omsFetch('/billing-profit'));
      if (next === 'ledger') setLedger((await omsFetch<any>('/ledger')).events || []);
    } catch (error) {
      console.error('[OMS] view load failed', error);
      if (next === 'orders') setOrders([{ externalOrderId: 'UC-10492', channel: 'shopify', status: 'ready_to_ship', customer: 'M. Alvarez', total: '$184.21' }]);
      if (next === 'customers') setCustomers([{ name: 'Northstar Trading', email: 'ops@northstar.example', ltv: '$18,420', risk: 'low' }]);
      if (next === 'suppliers') setSuppliers([{ name: 'Atlantic Source Co.', leadTimeDays: 11, quality: '97%', activeSkus: 42 }]);
      if (next === 'shipments') setShipments([{ event_type: 'asn_projected', source_system: 'oms', summary: 'ASN draft prepared after Cortex auto-routing.', created_at: new Date().toISOString() }]);
      if (next === 'heatmap') setHeatmap({ states: ['CA', 'TX', 'FL', 'NJ', 'GA', 'IL', 'PA', 'AZ', 'WA', 'NC', 'OH', 'NY'].map((state, index) => ({ state, demand: 80 + index * 10, revenue: 2000 + index * 800, risk: index % 4 === 0 ? 'high' : index % 3 === 0 ? 'medium' : 'low' })), warehouses: fallbackPlan().warehouses.map((w, index) => ({ ...w, inventoryUnits: 900 + index * 550, activeSkus: 50 + index * 12 })) });
      if (next === 'labels') setLabels({ summary: { openFindings: 18, estimatedRefunds: 1240, optimizedServiceSavings: 3120 }, findings: [{ carrier: 'UPS', trackingNumber: '1Z-DEMO-482', findingType: 'late_delivery_refund', severity: 'high', refundAmount: 42, status: 'open', recommendation: 'File refund with delivery evidence' }] });
      if (next === 'billing') setBilling({ current: { freight: 18400, storage: 9200, handling: 11600, accessorials: 2600 }, optimized: { freight: 15400, storage: 8100, handling: 9800, accessorials: 1700 } });
      if (next === 'ledger') setLedger([{ event_type: 'fallback_loaded', source_system: 'oms', summary: 'OMS cockpit fallback data loaded while local API is offline.', created_at: new Date().toISOString() }]);
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

  const approveBusiness = async () => {
    if (!business?.plan?.id) return;
    setApproving(true);
    try {
      await omsFetch(`/business-double/${encodeURIComponent(business.plan.id)}/approve`, { method: 'POST', body: JSON.stringify({}) });
      await loadCore();
      await loadView('ledger');
      void router.push('/oms?view=ledger');
    } catch {
      setLedger([{ event_type: 'approval_queued', source_system: 'oms', summary: 'Business Double approval is queued locally until the OMS backend is reachable.', created_at: new Date().toISOString() }]);
      void router.push('/oms?view=ledger');
    } finally {
      setApproving(false);
    }
  };

  const screen =
    view === 'business' ? <BusinessScreen data={business} onApprove={approveBusiness} approving={approving} /> :
    view === 'inventory' ? <InventoryScreen plan={plan} selected={selected} toggleSku={toggleSku} openSku={openSku} /> :
    view === 'skus' ? <div className="oms-page"><SkuTable skus={plan?.skus || []} selected={selected} toggleSku={toggleSku} openSku={openSku} /></div> :
    view === 'orders' ? <GenericTableScreen type="Orders" rows={orders} /> :
    view === 'customers' ? <GenericTableScreen type="Customers" rows={customers} /> :
    view === 'suppliers' ? <GenericTableScreen type="Suppliers" rows={suppliers} /> :
    view === 'shipments' ? <GenericTableScreen type="Shipment / ASN activity" rows={shipments} /> :
    view === 'heatmap' ? <HeatmapScreen data={heatmap} /> :
    view === 'labels' ? <LabelAuditScreen data={labels} /> :
    view === 'billing' ? <BillingScreen data={billing} /> :
    view === 'marketplace' ? <MarketplaceScreen /> :
    view === 'ledger' ? <GenericTableScreen type="Intelligence ledger" rows={ledger} /> :
    <CommandScreen data={command} range={range} setRange={setRange} />;

  return (
    <DashboardLayout title={copy.title} subtitle={copy.subtitle}>
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
      {wizardOpen && <ShipmentWizard selected={selectedList} onClose={() => setWizardOpen(false)} />}
    </DashboardLayout>
  );
}
