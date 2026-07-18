import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';
import { Chip, ProgressBar, Sparkline, fmt, Loading, ErrorState, EmptyState } from '../ui';
import {
  fetchBillingProfit,
  fetchBillingInvoices,
  fetchBillingStatementPdf,
  downloadBlob,
  BillingProfitResponse,
  BillingRange,
  BillingInvoiceRow,
} from '../../../lib/oms';
import { num } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';
import { CortexInlineBadge, CortexRowAction, useInlineRecommendations } from '../InlineRecommendation';
import { InvoiceModal } from '../InvoiceModal';

const CAT_META: { key: string; label: string; desc: string; refund?: boolean }[] = [
  { key: 'storage', label: 'Storage', desc: 'Long-term tier avoidance, smarter pre-positioning' },
  { key: 'freight', label: 'Freight (in + out)', desc: 'Lane consolidation, shared pallets, zone optimization' },
  { key: 'handling', label: 'Handling & pick', desc: 'Split-node strategy effect' },
  { key: 'materials', label: 'Materials', desc: 'Packaging materials consumed at pack-out' },
  { key: 'accessorials', label: 'Accessorials', desc: 'Auto-disputed rework, dim-weight reclass' },
  { key: 'refundsCaptured', label: 'Refunds captured', desc: 'Cortex audit bot files more claims', refund: true },
  { key: 'lostRevenue', label: 'Lost revenue (SLA)', desc: 'Faster SLA reduces refund/chargeback rate' },
];
const LEDGER_CATEGORY_OPTIONS = CAT_META.filter((c) => !c.refund && c.key !== 'lostRevenue');
const LEDGER_STATUS_OPTIONS = ['open', 'approved', 'submitted', 'paid', 'void'];
const RANGE_PRESETS: { key: BillingRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'mtd', label: 'MTD' },
];
const LEDGER_LIMIT = 25;

type CustomRange = { from: string; to: string } | null;

function nextDayIso(dayIso: string): string {
  const d = new Date(dayIso);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export const Billing = ({ onNavigate, onOpenOrderById, onOpenAsnById }: ScreenProps) => {
  const [range, setRange] = useState<BillingRange>('30d');
  const [custom, setCustom] = useState<CustomRange>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFrom, setPickerFrom] = useState('');
  const [pickerTo, setPickerTo] = useState('');
  const [data, setData] = useState<BillingProfitResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [ledgerRows, setLedgerRows] = useState<BillingInvoiceRow[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerErr, setLedgerErr] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [warehouseCode, setWarehouseCode] = useState('');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  const ledgerRef = useRef<HTMLDivElement>(null);
  // Pass `load` so approving/rejecting a billing plan immediately refetches the profit + hero.
  const { recommendations, recFor, screenRec, setSelectedRec, drawer: recDrawer } = useInlineRecommendations('billing', 100, () => load());

  const dateParams = () => (custom ? { from: custom.from, to: custom.to } : { range });

  const load = () => {
    setLoading(true);
    setErr(null);
    fetchBillingProfit(dateParams())
      .then(setData)
      .catch((e) => setErr(e.message || 'Failed to load billing'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [range, custom]);

  const loadLedger = () => {
    setLedgerLoading(true);
    setLedgerErr(null);
    fetchBillingInvoices({
      ...dateParams(),
      category: category || undefined,
      warehouseCode: warehouseCode || undefined,
      status: status || undefined,
      search: search || undefined,
      limit: LEDGER_LIMIT,
      offset,
    })
      .then((res) => {
        setLedgerRows(res.rows);
        setLedgerTotal(res.total);
      })
      .catch((e) => setLedgerErr(e.message || 'Failed to load invoice ledger'))
      .finally(() => setLedgerLoading(false));
  };
  useEffect(loadLedger, [range, custom, category, warehouseCode, status, search, offset]);

  // Debounce free-text search so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setOffset(0);
      setSearch(searchInput);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const scrollToLedger = () => {
    ledgerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const applyPreset = (r: BillingRange) => {
    setCustom(null);
    setRange(r);
    setPickerOpen(false);
    setOffset(0);
  };

  const applyCustom = () => {
    if (!pickerFrom || !pickerTo) return;
    setCustom({ from: new Date(pickerFrom).toISOString(), to: nextDayIso(pickerTo) });
    setPickerOpen(false);
    setOffset(0);
  };

  const filterByCategory = (key: string) => {
    setCategory((prev) => (prev === key ? '' : key));
    setOffset(0);
    scrollToLedger();
  };
  const filterByWarehouse = (code: string) => {
    setWarehouseCode((prev) => (prev === code ? '' : code));
    setOffset(0);
    scrollToLedger();
  };
  const filterByDay = (dayIso: string) => {
    setCustom({ from: dayIso, to: nextDayIso(dayIso) });
    setOffset(0);
    scrollToLedger();
  };

  const exportStatement = async () => {
    setExporting(true);
    try {
      const blob = await fetchBillingStatementPdf({
        ...dateParams(),
        category: category || undefined,
        warehouseCode: warehouseCode || undefined,
        status: status || undefined,
        search: search || undefined,
      });
      downloadBlob(blob, 'billing-statement.pdf');
    } catch {
      /* noop — Export stays clickable for retry */
    } finally {
      setExporting(false);
    }
  };

  if (err) return <div className="page fade-in"><div className="card"><ErrorState message={err} onRetry={load} /></div></div>;
  if (loading || !data) return <div className="page fade-in"><div className="card"><Loading rows={6} /></div></div>;

  const cur = data.current || ({} as any);
  const opt = data.optimized || ({} as any);
  const cats = CAT_META.filter((c) => c.key in cur || c.key in opt).map((c) => ({
    ...c,
    current: num(cur[c.key]),
    optimized: num(opt[c.key]),
  }));
  const currentTotal = data.totals?.current ?? cats.reduce((s, c) => s + (c.refund ? -Math.abs(c.current) : c.current), 0);
  const optimizedTotal = data.totals?.optimized ?? cats.reduce((s, c) => s + (c.refund ? -Math.abs(c.optimized) : c.optimized), 0);
  const savings = data.totals?.savings ?? currentTotal - optimizedTotal;
  const savingsPct = data.totals?.savingsPct ?? (currentTotal ? (savings / currentTotal) * 100 : 0);
  const maxBar = Math.max(1, ...cats.flatMap((c) => [Math.abs(c.current), Math.abs(c.optimized)]));
  const perWh = data.perWarehouse || [];
  const totalDeltaPct = data.deltaPct?.total ?? 0;
  const hasApprovedPlan = (data.totals as any)?.savingsSource === 'approved_overrides' && savings > 0;
  const isEstimate = data.source === 'estimate';
  const isEmptyWindow = data.source === 'empty';
  const categoryRecCount = recommendations.filter((r) => r.entityId).length;
  const sparkData = (data.series || []).map((s) => s.total);
  const rangeLabel = custom
    ? `${(custom.from || '').slice(0, 10)} → ${new Date(nextDayIsoBack(custom.to)).toISOString().slice(0, 10)}`
    : RANGE_PRESETS.find((r) => r.key === range)?.label || range;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing &amp; Profit</h1>
          <p className="page-subtitle">
            {isEstimate
              ? 'Projected from account activity — no WMS invoices have synced yet.'
              : 'Daily invoice tracking cockpit. Every line reconciled against WMS truth, linked to its Order / ASN.'}
          </p>
        </div>
        <div className="page-actions" style={{ position: 'relative' }}>
          <div className="seg">
            {RANGE_PRESETS.map((r) => (
              <button key={r.key} className={!custom && range === r.key ? 'active' : ''} onClick={() => applyPreset(r.key)}>
                {r.label}
              </button>
            ))}
            <button className={custom ? 'active' : ''} onClick={() => setPickerOpen((o) => !o)}>Custom</button>
          </div>
          {pickerOpen && (
            <div
              className="card"
              style={{ position: 'absolute', top: '110%', right: 0, zIndex: 20, padding: 14, width: 260, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  From
                  <input type="date" value={pickerFrom} onChange={(e) => setPickerFrom(e.target.value)} className="input" style={{ width: '100%', marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  To
                  <input type="date" value={pickerTo} onChange={(e) => setPickerTo(e.target.value)} className="input" style={{ width: '100%', marginTop: 4 }} />
                </label>
                <button className="btn primary sm" onClick={applyCustom} disabled={!pickerFrom || !pickerTo}>Apply</button>
              </div>
            </div>
          )}
          <button className="btn" onClick={exportStatement} disabled={exporting}>
            <Icon name="download" size={13} /> {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>

      {isEstimate && (
        <div className="card" style={{ marginBottom: 12, borderLeft: '3px solid var(--amber, #f59e0b)', padding: '12px 16px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text)' }}>Modeled estimate.</strong> No WMS invoices have synced for your account yet — these figures are illustrative, not billed charges.
        </div>
      )}
      {isEmptyWindow && (
        <div className="card" style={{ marginBottom: 12, borderLeft: '3px solid var(--border)', padding: '12px 16px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
          No charges were billed in this window yet. Storage and daily fees post nightly — try 7 days or 30 days to see recent activity.
        </div>
      )}

      <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(180deg, var(--purple-soft) 0%, var(--bg-elev) 50%)' }}>
        <div className="card-body" style={{ padding: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 1fr', gap: 28, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>CURRENT OPERATION</div>
              <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmt.money(currentTotal)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{rangeLabel}</span>
                {data.previous && !isEstimate && !isEmptyWindow && currentTotal > 0 && (
                  <span style={{ color: totalDeltaPct > 0 ? 'var(--red-text)' : 'var(--green-text)', fontWeight: 600 }}>
                    {totalDeltaPct > 0 ? '+' : ''}{totalDeltaPct}% vs prior period
                  </span>
                )}
              </div>
              {sparkData.length >= 2 && (
                <div style={{ marginTop: 8 }}>
                  <Sparkline data={sparkData} color="var(--purple)" width={140} height={30} fill />
                </div>
              )}
            </div>
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-elev)', border: '2px solid var(--purple)', display: 'grid', placeItems: 'center', color: 'var(--purple)' }}>
                <Icon name="arrowRight" size={22} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--purple-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                {hasApprovedPlan ? 'PROJECTED (APPROVED PLAN)' : 'PROJECTED WITH AI PLAN'}
                {screenRec && <CortexRowAction rec={screenRec} label onOpen={() => setSelectedRec(screenRec)} />}
              </div>
              <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--purple-text)' }}>{fmt.money(optimizedTotal)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {hasApprovedPlan ? 'projection · until WMS re-rates' : 'review a suggestion to approve'}
              </div>
            </div>
            <div style={{ background: 'var(--green-soft)', padding: 18, borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--green-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{hasApprovedPlan ? 'YOU SAVE (PROJECTED)' : 'POTENTIAL SAVINGS'}</div>
              {hasApprovedPlan ? (
                <>
                  <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--green-text)', marginTop: 4 }}>{fmt.money(savings)}</div>
                  <div style={{ fontSize: 12, color: 'var(--green-text)', fontWeight: 600, marginTop: 2 }}>
                    {savingsPct.toFixed(1)}% lower cost · {rangeLabel}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green-text)', marginTop: 4 }}>No plan approved yet</div>
                  <div style={{ fontSize: 12, color: 'var(--green-text)', fontWeight: 600, marginTop: 2 }}>
                    {screenRec ? 'Review the AI plan to see projected savings' : 'No AI plan available for this period'}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {screenRec && !hasApprovedPlan && (
        <div
          className="card"
          style={{ marginBottom: 16, border: '1px solid var(--purple)', background: 'linear-gradient(180deg, var(--purple-soft) 0%, var(--bg-elev) 100%)', display: 'flex', alignItems: 'center', gap: 20, padding: '18px 22px', flexWrap: 'wrap' }}
        >
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-elev)', border: '2px solid var(--purple)', display: 'grid', placeItems: 'center', color: 'var(--purple)', flexShrink: 0 }}>
            <Icon name="sparkle" size={22} />
          </div>
          <div style={{ minWidth: 220, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>AI Savings Plan ready to approve</span>
              <Chip tone="purple" dot={false}>{recommendations.length} suggestion{recommendations.length === 1 ? '' : 's'}</Chip>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Cortex found a lower-cost billing plan for {rangeLabel}. Review the suggested rate changes and approve to apply the projected discounts{categoryRecCount ? ` across ${categoryRecCount} categor${categoryRecCount === 1 ? 'y' : 'ies'}` : ''}.
            </div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 130 }}>
            <div style={{ fontSize: 11, color: 'var(--green-text)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Projected savings</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green-text)', letterSpacing: '-0.02em' }}>{fmt.money(savings)}</div>
            <div style={{ fontSize: 11.5, color: 'var(--green-text)', fontWeight: 600 }}>{savingsPct.toFixed(1)}% lower · {rangeLabel}</div>
          </div>
          <button className="btn primary" style={{ flexShrink: 0 }} onClick={() => setSelectedRec(screenRec)}>
            <Icon name="sparkle" size={13} /> Review &amp; approve plan
          </button>
        </div>
      )}

      {hasApprovedPlan && (
        <div
          className="card"
          style={{ marginBottom: 16, borderLeft: '3px solid var(--green, #16a34a)', display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', flexWrap: 'wrap' }}
        >
          <Icon name="check" size={18} style={{ color: 'var(--green-text)' }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>AI Savings Plan approved</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {fmt.money(savings)} projected savings ({savingsPct.toFixed(1)}%) · projection until WMS re-rates
            </div>
          </div>
          {screenRec && (
            <button className="btn ghost sm" onClick={() => setSelectedRec(screenRec)}>Review plan</button>
          )}
        </div>
      )}

      {data.forecast?.storage && (
        <div
          className="card"
          style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20, padding: '14px 20px', flexWrap: 'wrap' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="box" size={16} style={{ color: 'var(--purple)' }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Projected month-end storage
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>
                {data.forecast.storage.method === 'cortex' ? 'Cortex trajectory' : 'Run-rate estimate'} · this calendar month
              </div>
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {fmt.money(data.forecast.storage.projectedMonthEnd)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {fmt.money(data.forecast.storage.mtd)} billed so far
            {data.forecast.storage.observedBilledDays != null && (
              <> · {data.forecast.storage.observedBilledDays} of {data.forecast.storage.daysInMonth} days</>
            )}
          </div>
          {data.forecast.storage.confidence != null && data.forecast.storage.confidence > 0 && (
            <Chip dot={false} tone={data.forecast.storage.confidence >= 0.5 ? 'green' : 'amber'}>
              {Math.round(data.forecast.storage.confidence * 100)}% confidence
            </Chip>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 260 }}>
            Extrapolated from storage already billed this month. Firms up as more days are invoiced.
          </div>
        </div>
      )}

      <BillingTrendCard series={data.series || []} onDayClick={filterByDay} />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <div className="card-title">
              Cost breakdown — current vs. suggested
              <CortexInlineBadge count={recommendations.length} />
            </div>
            <div className="card-subtitle">Every line reconciled against WMS-allocated charges. Click a row to filter the invoice ledger below.</div>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11.5 }}>
            {screenRec && <CortexRowAction rec={screenRec} label onOpen={() => setSelectedRec(screenRec)} />}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, background: 'var(--text-tertiary)', borderRadius: 2 }} />
              <span style={{ color: 'var(--text-secondary)' }}>Current</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, background: 'var(--purple)', borderRadius: 2 }} />
              <span style={{ color: 'var(--text-secondary)' }}>With AI plan</span>
            </span>
          </div>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {cats.length === 0 && <EmptyState>No cost categories returned.</EmptyState>}
          {cats.map((c) => {
            const delta = c.current - c.optimized;
            const good = c.refund ? c.optimized > c.current : delta > 0;
            const rec = recFor(c.key, c.label);
            const active = category === c.key;
            return (
              <div
                key={c.key}
                onClick={() => !c.refund && filterByCategory(c.key)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 1fr 80px auto',
                  gap: 14,
                  alignItems: 'center',
                  padding: '10px 12px',
                  margin: '-10px -12px',
                  borderRadius: 8,
                  cursor: c.refund ? 'default' : 'pointer',
                  background: active ? 'var(--accent-soft, var(--purple-soft))' : rec ? 'var(--purple-soft)' : undefined,
                  boxShadow: active ? 'inset 3px 0 0 var(--accent, var(--purple))' : rec ? 'inset 3px 0 0 var(--purple)' : undefined,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{c.desc}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(['current', 'optimized'] as const).map((sel) => (
                    <div key={sel} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10.5, color: sel === 'optimized' ? 'var(--purple-text)' : 'var(--text-tertiary)', width: 50, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: sel === 'optimized' ? 700 : 600 }}>
                        {sel === 'optimized' ? 'Suggested' : 'Current'}
                      </span>
                      <div className="bar" style={{ flex: 1, height: 16 }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, (Math.abs(c[sel]) / maxBar) * 100)}%`,
                            background: c.refund ? 'var(--green)' : sel === 'optimized' ? 'var(--purple)' : 'var(--text-tertiary)',
                            opacity: sel === 'current' && !c.refund ? 0.5 : 1,
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <span className="mono num" style={{ fontSize: 12, fontWeight: sel === 'optimized' ? 700 : 600, minWidth: 80, textAlign: 'right', color: sel === 'optimized' ? 'var(--purple-text)' : 'var(--text)' }}>
                        {c.refund ? '−' : ''}
                        {fmt.money(Math.abs(c[sel]))}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: good ? 'var(--green-text)' : 'var(--red-text)' }}>
                    {good ? '−' : '+'}
                    {fmt.money(Math.abs(delta), { compact: true })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {c.current ? ((delta / c.current) * 100).toFixed(0) : 0}%
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {rec ? (
                    <button className="btn sm primary" onClick={() => setSelectedRec(rec)} data-hint="Review Cortex optimization">
                      <Icon name="sparkle" size={12} /> Review &amp; approve
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">
            <Icon name="box" size={15} /> Per-warehouse cost reduction
          </div>
          <Chip dot={false}>{rangeLabel}</Chip>
        </div>
        {perWh.length === 0 ? (
          <EmptyState>Per-warehouse cost split is not yet exposed by the billing feed.</EmptyState>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Region</th>
                <th className="num">Current</th>
                <th className="num">Suggested</th>
                <th className="num">Savings</th>
                <th>Impact</th>
              </tr>
            </thead>
            <tbody>
              {perWh.map((w) => {
                const d = num(w.current) - num(w.optimized);
                const pct = w.current ? (d / num(w.current)) * 100 : 0;
                const rec = recFor(w.code, w.region);
                const active = warehouseCode === w.code;
                return (
                  <tr
                    key={w.code}
                    className="clickable"
                    onClick={() => filterByWarehouse(w.code)}
                    style={{ background: active ? 'var(--accent-soft, var(--purple-soft))' : rec ? 'var(--purple-soft)' : undefined, boxShadow: active ? 'inset 3px 0 0 var(--accent, var(--purple))' : rec ? 'inset 3px 0 0 var(--purple)' : undefined }}
                  >
                    <td className="mono strong">{w.code}</td>
                    <td className="muted">{w.region || '—'}</td>
                    <td className="num mono">{fmt.money(num(w.current))}</td>
                    <td className="num mono strong" style={{ color: 'var(--purple-text)' }}>{fmt.money(num(w.optimized))}</td>
                    <td className="num mono strong" style={{ color: 'var(--green-text)' }}>−{fmt.money(d)}</td>
                    <td>
                      <ProgressBar value={pct} max={30} color="green" showLabel height={5} />
                      {rec && <div style={{ marginTop: 5 }}><CortexRowAction rec={rec} label onOpen={() => setSelectedRec(rec)} /></div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" ref={ledgerRef}>
        <div className="card-header">
          <div>
            <div className="card-title"><Icon name="ledger" size={15} /> Invoice ledger</div>
            <div className="card-subtitle">Every warehouse activity billed on your products. Click a row for the full invoice, or a link to jump to its Order / ASN.</div>
          </div>
          <Chip dot={false}>{ledgerTotal} lines</Chip>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="input"
              placeholder="Search description, invoice #, code…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ minWidth: 220 }}
            />
            <select className="input" value={category} onChange={(e) => { setCategory(e.target.value); setOffset(0); }} style={{ width: 160 }}>
              <option value="">All categories</option>
              {LEDGER_CATEGORY_OPTIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <select className="input" value={warehouseCode} onChange={(e) => { setWarehouseCode(e.target.value); setOffset(0); }} style={{ width: 160 }}>
              <option value="">All warehouses</option>
              {perWh.map((w) => <option key={w.code} value={w.code}>{w.code}</option>)}
            </select>
            <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }} style={{ width: 140 }}>
              <option value="">All statuses</option>
              {LEDGER_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {(category || warehouseCode || status || search) && (
              <button
                className="btn ghost sm"
                onClick={() => { setCategory(''); setWarehouseCode(''); setStatus(''); setSearchInput(''); setSearch(''); setOffset(0); }}
              >
                Clear filters
              </button>
            )}
          </div>

          {ledgerErr ? (
            <ErrorState message={ledgerErr} onRetry={loadLedger} />
          ) : ledgerLoading ? (
            <Loading rows={5} />
          ) : ledgerRows.length === 0 ? (
            <EmptyState>No billed activity in this window.</EmptyState>
          ) : (
            <>
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice #</th>
                    <th>Warehouse</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th className="num">Qty</th>
                    <th className="num">Amount</th>
                    <th>Status</th>
                    <th>Links</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map((r) => (
                    <tr key={r.id} className="clickable" onClick={() => setSelectedInvoice(r.invoiceNumber)}>
                      <td className="mono muted">{(r.date || '').slice(0, 10)}</td>
                      <td className="mono strong">{r.invoiceNumber}</td>
                      <td className="mono">{r.warehouse || '—'}</td>
                      <td><Chip dot={false}>{r.category}</Chip></td>
                      <td>{r.description || r.code || '—'}</td>
                      <td className="num mono">{r.qty || '—'}</td>
                      <td className="num mono strong">{fmt.money(r.amount)}</td>
                      <td><Chip tone={r.status === 'paid' ? 'green' : r.status === 'void' ? 'red' : 'default'} dot={false}>{r.status}</Chip></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {r.linkedOrder ? (
                            <button className="btn ghost sm" onClick={() => onOpenOrderById?.(r.linkedOrder!.omsId)}>Order →</button>
                          ) : null}
                          {r.linkedAsn ? (
                            <button className="btn ghost sm" onClick={() => onOpenAsnById?.(r.linkedAsn!.omsId)}>ASN →</button>
                          ) : null}
                          {!r.linkedOrder && !r.linkedAsn && <span className="muted">—</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                <span>
                  {offset + 1}–{Math.min(offset + LEDGER_LIMIT, ledgerTotal)} of {ledgerTotal}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn ghost sm" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - LEDGER_LIMIT))}>Prev</button>
                  <button className="btn ghost sm" disabled={offset + LEDGER_LIMIT >= ledgerTotal} onClick={() => setOffset((o) => o + LEDGER_LIMIT)}>Next</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedInvoice && (
        <InvoiceModal
          invoiceNumber={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onNavigate={onNavigate}
          onOpenOrderById={onOpenOrderById}
          onOpenAsnById={onOpenAsnById}
        />
      )}
      {recDrawer}
    </div>
  );
};

function nextDayIsoBack(toIsoExclusive: string): string {
  const d = new Date(toIsoExclusive);
  d.setDate(d.getDate() - 1);
  return d.toISOString();
}

const BillingTrendCard = ({
  series,
  onDayClick,
}: {
  series: Array<{ date: string; total: number; lineCount: number }>;
  onDayClick: (dayIso: string) => void;
}) => {
  if (!series.length) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div className="card-title">Daily invoice activity</div></div>
        <EmptyState>No billed activity in this window yet.</EmptyState>
      </div>
    );
  }

  const W = 720;
  const H = 170;
  const P = { l: 50, r: 12, t: 16, b: 28 };
  const N = series.length;
  const max = Math.max(1, ...series.map((s) => s.total)) * 1.05;
  const xStep = N > 1 ? (W - P.l - P.r) / (N - 1) : 0;
  const yScale = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const linePath = series.map((s, i) => `${i ? 'L' : 'M'}${P.l + i * xStep} ${yScale(s.total)}`).join(' ');
  const areaPath = N > 1 ? `${linePath} L${P.l + (N - 1) * xStep} ${H - P.b} L${P.l} ${H - P.b} Z` : '';
  const total = series.reduce((s, d) => s + d.total, 0);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div>
          <div className="card-title">Daily invoice activity</div>
          <div className="card-subtitle">
            <strong style={{ color: 'var(--text)' }}>{fmt.money(total, { compact: true })}</strong> billed across {N} day{N === 1 ? '' : 's'}. Click a point to filter the ledger to that day.
          </div>
        </div>
      </div>
      <div style={{ padding: '8px 16px 12px' }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }} preserveAspectRatio="none">
          {[0, 0.5, 1].map((p) => {
            const y = yScale(max * p);
            return (
              <g key={p}>
                <line x1={P.l} x2={W - P.r} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="0.5" />
                <text x={P.l - 8} y={y + 3} textAnchor="end" fontSize="9.5" fill="var(--text-tertiary)" fontFamily="var(--mono)">
                  {fmt.money(max * p, { compact: true }).replace('$', '')}
                </text>
              </g>
            );
          })}
          <path d={areaPath} fill="var(--purple)" opacity="0.1" />
          <path d={linePath} fill="none" stroke="var(--purple)" strokeWidth="2" />
          {series.map((s, i) => (
            <circle
              key={s.date}
              cx={P.l + i * xStep}
              cy={yScale(s.total)}
              r={4}
              fill="var(--purple)"
              style={{ cursor: 'pointer' }}
              onClick={() => onDayClick(s.date)}
            >
              <title>{`${s.date}: ${fmt.money(s.total)} (${s.lineCount} lines)`}</title>
            </circle>
          ))}
          {series.map((s, i) => {
            if (N > 10 && i % Math.ceil(N / 8) !== 0) return null;
            const x = P.l + i * xStep;
            return (
              <text key={s.date} x={x} y={H - 10} textAnchor="middle" fontSize="9" fill="var(--text-tertiary)">
                {s.date.slice(5)}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
