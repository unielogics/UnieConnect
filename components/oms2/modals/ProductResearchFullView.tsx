import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Chip, Confidence } from '../ui';
import { fetchChannelAccounts, mapItemToChannel, createCatalogItem, ChannelAccount, ProductResearchResult } from '../../../lib/oms';

/**
 * Full-screen, maximally-enriched Keepa/Cortex product-research view. Reads the full
 * result.keepa.extract (Cortex demand_extract, 26 sub-objects) and renders a sectioned
 * dashboard. Every panel is keyed off its own `status` so missing data degrades to an
 * "unlock richer data" hint (from possible_upgrades[]) instead of rendering blank.
 */

type Pt = Record<string, number | boolean | null>;
const num = (v: any): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const fmtNum = (v: any) => (num(v) != null ? Number(v).toLocaleString() : '—');
const fmtUsd = (v: any) => (num(v) != null ? `$${Number(v).toFixed(2)}` : '—');
const fmtPct = (v: any) => (num(v) != null ? `${Number(v).toFixed(0)}%` : '—');
const titleCase = (s?: string | null) => (s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—');

// Keepa stores timestamps as "Keepa minutes" (minutes since 2011-01-01, offset 21564000).
// unix_ms = (keepaMinutes + 21564000) * 60000.
const keepaToDate = (t: number) => new Date((t + 21564000) * 60000);
const fmtDate = (t: number, span: number) => {
  const d = keepaToDate(t);
  // span is in keepa minutes; > ~120 days → show "Mon 'YY", else "Mon D".
  if (span > 120 * 24 * 60) return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const fmtDateFull = (t: number) => keepaToDate(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

// Amazon-orange for the Amazon price series, matching keepa.com's palette convention.
const AMAZON_ORANGE = '#e77600';

const VTONE: Record<string, { bg: string; fg: string; label: string }> = {
  favorable: { bg: 'var(--green-soft)', fg: 'var(--green-text)', label: 'FAVORABLE' },
  neutral: { bg: 'var(--amber-soft)', fg: 'var(--amber-text)', label: 'NEUTRAL' },
  cautious: { bg: 'var(--red-soft)', fg: 'var(--red-text)', label: 'CAUTIOUS' },
};

type ChartField = { key: string; color: string; label: string; invert?: boolean; usd?: boolean; type?: 'line' | 'bars' };

// Track the rendered pixel width of a container so the chart draws crisp text + maps hover 1:1.
function useMeasuredWidth(fallback = 640) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect?.width;
      if (cw && cw > 0) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width: w };
}

// ── Interactive keepa.com-style time-series chart ─────────────────────────────────────────
// Real date axis, hover crosshair + tooltip, y-gridlines, and Amazon out-of-stock shading.
function KeepaChart({
  series, fields, height = 200, title, hint, showAmazonStock = false,
}: {
  series: Pt[];
  fields: ChartField[];
  height?: number;
  title: string;
  hint?: string;
  showAmazonStock?: boolean;
}) {
  const { ref, width: W } = useMeasuredWidth();
  const [hover, setHover] = useState<number | null>(null);

  const padL = 46, padR = 14, padT = 12, padB = 26;
  const innerW = Math.max(10, W - padL - padR);
  const innerH = Math.max(10, height - padT - padB);

  const model = useMemo(() => {
    const ts = series.map((p) => (typeof p.t === 'number' ? (p.t as number) : 0));
    if (ts.length < 2) return null;
    const tMin = Math.min(...ts), tMax = Math.max(...ts);
    const span = tMax - tMin || 1;
    const xOf = (t: number) => padL + ((t - tMin) / span) * innerW;

    const drawn = fields
      .map((f) => {
        const pts = series
          .map((p) => ({ t: typeof p.t === 'number' ? (p.t as number) : 0, v: num((p as any)[f.key]) }))
          .filter((d) => d.v != null) as { t: number; v: number }[];
        if (pts.length < 2 && f.type !== 'bars') return null;
        if (!pts.length) return null;
        const vMin = Math.min(...pts.map((d) => d.v));
        const vMax = Math.max(...pts.map((d) => d.v));
        const yOf = (v: number) => {
          const nrm = (v - vMin) / (vMax - vMin || 1);
          return padT + (f.invert ? nrm : 1 - nrm) * innerH;
        };
        const path = pts.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xOf(d.t).toFixed(1)} ${yOf(d.v).toFixed(1)}`).join(' ');
        return { f, pts, vMin, vMax, yOf, path, last: pts[pts.length - 1].v };
      })
      .filter(Boolean) as any[];
    if (!drawn.length) return null;

    // Amazon out-of-stock bands: contiguous runs where amazon_in_stock === false.
    const bands: { x0: number; x1: number }[] = [];
    let inStockCount = 0, stockTotal = 0;
    if (showAmazonStock) {
      let runStart: number | null = null;
      series.forEach((p, i) => {
        const s = (p as any).amazon_in_stock;
        if (s === true || s === false) { stockTotal += 1; if (s === true) inStockCount += 1; }
        const t = typeof p.t === 'number' ? (p.t as number) : 0;
        if (s === false && runStart === null) runStart = t;
        if (s !== false && runStart !== null) { bands.push({ x0: xOf(runStart), x1: xOf(t) }); runStart = null; }
        if (i === series.length - 1 && runStart !== null) bands.push({ x0: xOf(runStart), x1: xOf(t) });
      });
    }
    const stockPct = stockTotal ? Math.round((inStockCount / stockTotal) * 100) : null;

    // ~5 evenly spaced x-axis date ticks.
    const ticks = Array.from({ length: 5 }, (_, i) => {
      const t = tMin + (span * i) / 4;
      return { x: xOf(t), label: fmtDate(t, span) };
    });

    return { ts, tMin, tMax, span, xOf, drawn, bands, stockPct, ticks };
  }, [series, fields, W, innerW, innerH, showAmazonStock, height]);

  if (!model) {
    return (
      <div style={panel}>
        <div style={panelTitle}>{title}</div>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>No history available yet.</div>
      </div>
    );
  }

  const { ts, xOf, drawn, bands, stockPct, ticks } = model;

  // Map a mouse X (in svg px, 1:1 with container px) to the nearest data index.
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < ts.length; i += 1) {
      const d = Math.abs(xOf(ts[i]) - mx);
      if (d < bestD) { bestD = d; best = i; }
    }
    setHover(best);
  };

  const hoverT = hover != null ? ts[hover] : null;
  const hoverX = hoverT != null ? xOf(hoverT) : null;
  const tooltipLeft = hoverX != null ? Math.min(Math.max(hoverX + 10, 4), Math.max(4, W - 168)) : 0;

  return (
    <div style={panel} ref={ref}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <span style={panelTitle}>{title}</span>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {showAmazonStock && stockPct != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-secondary)' }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: AMAZON_ORANGE }} />
              Amazon in-stock <strong style={{ color: 'var(--text)' }}>{stockPct}%</strong>
            </span>
          )}
          {drawn.map((d: any) => {
            const shown = hover != null ? num((series[hover] as any)[d.f.key]) : d.last;
            return (
              <span key={d.f.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: d.f.color }} />
                {d.f.label}: <strong style={{ color: 'var(--text)' }}>{shown == null ? '—' : d.f.usd ? `$${Number(shown).toFixed(2)}` : Math.round(Number(shown)).toLocaleString()}</strong>
              </span>
            );
          })}
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <svg
          width={W} height={height} viewBox={`0 0 ${W} ${height}`}
          style={{ display: 'block', cursor: 'crosshair' }}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* horizontal gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((g) => {
            const y = padT + g * innerH;
            return <line key={g} x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border-subtle)" strokeWidth={1} />;
          })}
          {/* Amazon out-of-stock shaded bands */}
          {bands.map((b: any, i: number) => (
            <rect key={i} x={b.x0} y={padT} width={Math.max(1, b.x1 - b.x0)} height={innerH} fill="var(--red-text)" opacity={0.08} />
          ))}
          {/* x-axis date ticks */}
          {ticks.map((tk: any, i: number) => (
            <text key={i} x={tk.x} y={height - 8} fontSize={10} fill="var(--text-tertiary)" textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}>{tk.label}</text>
          ))}
          {/* series */}
          {drawn.map((d: any) => (
            d.f.type === 'bars' ? (
              <g key={d.f.key}>
                {d.pts.map((p: any, i: number) => {
                  const bw = Math.max(1, (innerW / d.pts.length) * 0.7);
                  const y = d.yOf(p.v);
                  return <rect key={i} x={xOf(p.t) - bw / 2} y={y} width={bw} height={Math.max(0, padT + innerH - y)} fill={d.f.color} opacity={0.55} />;
                })}
              </g>
            ) : (
              <path key={d.f.key} d={d.path} fill="none" stroke={d.f.color} strokeWidth={1.8} strokeLinejoin="round" />
            )
          ))}
          {/* hover crosshair + markers */}
          {hoverX != null && (
            <>
              <line x1={hoverX} y1={padT} x2={hoverX} y2={padT + innerH} stroke="var(--text-tertiary)" strokeWidth={1} strokeDasharray="3 3" />
              {drawn.filter((d: any) => d.f.type !== 'bars').map((d: any) => {
                const v = num((series[hover as number] as any)[d.f.key]);
                if (v == null) return null;
                return <circle key={d.f.key} cx={hoverX} cy={d.yOf(v)} r={3.2} fill={d.f.color} stroke="var(--bg-elev)" strokeWidth={1.5} />;
              })}
            </>
          )}
        </svg>
        {hoverT != null && (
          <div style={{
            position: 'absolute', top: 4, left: tooltipLeft, pointerEvents: 'none',
            background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8,
            boxShadow: 'var(--shadow-pop)', padding: '7px 9px', fontSize: 11, minWidth: 150, zIndex: 2,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>{fmtDateFull(hoverT)}</div>
            {drawn.map((d: any) => {
              const v = num((series[hover as number] as any)[d.f.key]);
              return (
                <div key={d.f.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: d.f.color }} />{d.f.label}
                  </span>
                  <strong style={{ color: 'var(--text)' }}>{v == null ? '—' : d.f.usd ? `$${v.toFixed(2)}` : Math.round(v).toLocaleString()}</strong>
                </div>
              );
            })}
            {showAmazonStock && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                <span>Amazon</span>
                <strong style={{ color: (series[hover as number] as any).amazon_in_stock === false ? 'var(--red-text)' : 'var(--green-text)' }}>
                  {(series[hover as number] as any).amazon_in_stock === false ? 'Out of stock' : 'In stock'}
                </strong>
              </div>
            )}
          </div>
        )}
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: React.ReactNode; tone?: string; sub?: string }) {
  return (
    <div style={{ ...panel, padding: '10px 12px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: tone || 'var(--text)' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, chip, children }: { title: string; chip?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ ...panel, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.01em' }}>{title}</span>
        {chip}
      </div>
      {children}
    </div>
  );
}

// A "needs richer data" hint for a partial panel.
function PartialHint({ note }: { note?: string }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 0' }}>
      {note || 'Needs a richer Keepa pull to populate — re-run research to refresh.'}
    </div>
  );
}

export const ProductResearchFullView = ({ row, onClose, onListed, onContinue, subtitle }: {
  row: ProductResearchResult;
  onClose: () => void;
  onListed?: () => void;
  // When provided (new-product review step), the marketplace-listing footer is replaced by a
  // "Continue to create product" action — listing before the SKU exists would be nonsensical.
  onContinue?: () => void;
  subtitle?: string;
}) => {
  const r = (row.result || {}) as any;
  const k = r.keepa || {};
  const ex = k.extract || {};
  const lp = ex.listing_profile || {};
  const verdict = ex.sell_decision_hybrid || k.verdict || {};
  const opp = ex.opportunity_summary_ux || k.opportunity || {};
  const chart = (ex.keepa_trend_bundle && ex.keepa_trend_bundle.chart) || k.charts || {};
  const series: Pt[] = Array.isArray(chart.series) ? chart.series : [];
  const ordersSeries: Pt[] = Array.isArray(chart.daily_orders_series) ? chart.daily_orders_series : [];
  const dq = ex.data_quality || {};
  const econ = ex.listing_economics_reference || {};
  const bbCtx = ex.buybox_context || {};
  const bbMkt = ex.buy_box_market_summary || {};
  const bbWin = ex.buybox_window_analysis || {};
  const sellers = ex.keepa_offers_digest || {};
  const vol = ex.volume_intelligence || {};
  const mom = ex.momentum_30d_ux || {};
  const est = ex.monthly_sales_estimator || {};
  const place = ex.inventory_placement_summary || {};
  const proc = ex.procurement_suggestion || {};
  const upgrades: { code: string; impact: string }[] = Array.isArray(ex.possible_upgrades) ? ex.possible_upgrades : [];

  const vtone = VTONE[verdict.final_verdict] || VTONE.neutral;
  const [rawOpen, setRawOpen] = useState(false);

  const [accounts, setAccounts] = useState<ChannelAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [listing, setListing] = useState(false);
  const [listMsg, setListMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetchChannelAccounts()
      .then((a) => { const list = Array.isArray(a) ? a : []; setAccounts(list); if (list[0]) setSelectedAccount(list[0].id); })
      .catch(() => setAccounts([]));
  }, []);

  const listToMarketplace = async () => {
    if (!selectedAccount) { setListMsg({ tone: 'err', text: 'Pick a marketplace first.' }); return; }
    setListing(true); setListMsg(null);
    try {
      let itemId = row.itemId || '';
      if (!itemId) {
        const created = await createCatalogItem({
          sku: r.sku, title: r.title || lp.title || r.sku,
          asin: k.asin || r.asin || undefined, image: k.image || undefined, category: k.category || undefined,
        } as any);
        itemId = (created as any)?.id || (created as any)?._id || '';
      }
      if (!itemId) throw new Error('Could not resolve the catalog item to list.');
      await mapItemToChannel(itemId, { channelAccountId: selectedAccount, channelItemId: k.asin || r.asin || r.sku, sku: r.sku, status: 'active' });
      setListMsg({ tone: 'ok', text: 'Listed & activated on the selected marketplace.' });
      onListed?.();
    } catch (e: any) {
      setListMsg({ tone: 'err', text: e?.message || 'Failed to list to marketplace.' });
    } finally { setListing(false); }
  };

  const idChips = [k.asin || r.asin, ...(Array.isArray(lp.upc) ? lp.upc : lp.upc ? [lp.upc] : []), ...(Array.isArray(lp.ean) ? lp.ean : lp.ean ? [lp.ean] : [])].filter(Boolean);

  return (
    <Modal title={`Research · ${r.sku || k.asin || 'product'}`} subtitle={subtitle ?? (r.title || lp.title || undefined)} onClose={onClose} fullscreen>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* 1. VERDICT HERO */}
        <div style={{ ...panel, padding: 18, display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {k.image && <img src={k.image} alt="" style={{ width: 96, height: 96, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: '#fff' }} />}
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>{r.title || lp.title || r.sku}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>
              {lp.manufacturer || lp.brand || k.brand || 'Unknown brand'}{k.category || lp.category_labels_guess?.[0] ? ` · ${k.category || lp.category_labels_guess?.[0]}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {idChips.map((v: string, i: number) => <Chip key={i} dot={false}>{v}</Chip>)}
            </div>
          </div>
          <div style={{ minWidth: 260, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ padding: '6px 14px', borderRadius: 8, background: vtone.bg, color: vtone.fg, fontSize: 15, fontWeight: 800 }}>{vtone.label}</span>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Sell: {verdict.recommended_to_sell_label || (k.keepaRecommendedToSell) || '—'}</span>
            </div>
            {num(verdict.decision_confidence) != null && <Confidence value={verdict.decision_confidence} />}
            {verdict.weights && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                weights · buybox {verdict.weights.buybox_weight} · trend {verdict.weights.trend_weight} · review {verdict.weights.review_weight}
              </div>
            )}
          </div>
        </div>

        {/* verdict reasons */}
        {((verdict.positive_reasons || []).length > 0 || (verdict.blocking_reasons || []).length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Section title="Why it could sell">
              {(verdict.positive_reasons || []).length
                ? (verdict.positive_reasons || []).map((x: string, i: number) => <div key={i} style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>✓ {x}</div>)
                : <PartialHint note="No strong positive signals detected yet." />}
            </Section>
            <Section title="Risks / blockers">
              {(verdict.blocking_reasons || []).length
                ? (verdict.blocking_reasons || []).map((x: string, i: number) => <div key={i} style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>⚠ {x}</div>)
                : <PartialHint note="No blocking risks detected." />}
            </Section>
          </div>
        )}

        {/* 2. OPPORTUNITY BAND */}
        <Section title="Opportunity & demand" chip={<Chip tone="purple" dot={false}>{titleCase(vol.regime || 'neutral')}</Chip>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <Stat label="Est. monthly units" value={fmtNum(est.monthly_units_est_mid ?? opp.est_monthly_units)} sub={num(est.monthly_units_est_low) != null ? `${fmtNum(est.monthly_units_est_low)}–${fmtNum(est.monthly_units_est_high)} range` : undefined} />
            <Stat label="Opportunity %" value={fmtPct(opp.opportunity_pct)} />
            <Stat label="Amazon share 30d" value={fmtPct(opp.amazon_share_30d_pct)} sub={opp.amazon_selling ? 'Amazon is selling' : 'Amazon not on listing'} />
            <Stat label="Buy-box sellers 30d" value={fmtNum(opp.distinct_buybox_sellers_30d)} />
          </div>
          {est.status === 'partial' && est.message && <div style={{ marginTop: 8 }}><PartialHint note={est.message} /></div>}
        </Section>

        {/* 3. CHARTS GRID — interactive keepa.com-style (hover tooltip, date axis, Amazon-stock shading) */}
        {series.length >= 2 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <KeepaChart
              title="Price history"
              series={series}
              showAmazonStock
              fields={[
                { key: 'amazon_price_usd', color: AMAZON_ORANGE, label: 'Amazon', usd: true },
                { key: 'buy_box_landed_usd', color: 'var(--green-text)', label: 'Buy box', usd: true },
              ]}
              hint="Amazon (orange) vs buy-box landed price. Red bands = Amazon out of stock."
            />
            <KeepaChart
              title="Sales rank history"
              series={series}
              fields={[{ key: 'sales_rank', color: 'var(--purple)', label: 'BSR', invert: true }]}
              hint="Best rank at the top (Keepa convention). Higher line = selling faster."
            />
            {ordersSeries.length >= 2 && (
              <KeepaChart
                title="Estimated daily orders"
                series={ordersSeries}
                fields={[{ key: 'daily_orders_est', color: 'var(--blue-text)', label: 'Orders/day', type: 'bars' }]}
                hint="Cortex demand estimate derived from Keepa rank velocity."
              />
            )}
            <KeepaChart
              title="Offers & reviews"
              series={series}
              fields={[
                { key: 'new_offer_count', color: 'var(--amber-text)', label: 'Offers' },
                { key: 'review_count', color: 'var(--text-secondary)', label: 'Reviews' },
              ]}
              hint="Competing offers and cumulative review count over time."
            />
          </div>
        ) : (
          <Section title="History charts"><PartialHint note="No Keepa time-series available for this identifier." /></Section>
        )}

        {/* 4. BUY-BOX COMPETITION */}
        <Section title="Buy-box & competition" chip={<Chip tone={bbCtx.competition_level === 'high' ? 'red' : bbCtx.competition_level === 'low' ? 'green' : 'amber'} dot={false}>{titleCase(bbCtx.competition_level || 'unknown')}</Chip>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <Stat label="Offer rows" value={fmtNum(bbCtx.offer_row_count ?? bbMkt.offer_row_count)} />
            <Stat label="Unique merchants (new)" value={fmtNum(bbCtx.unique_merchants_new_only ?? bbMkt.unique_merchants_new_only)} />
            <Stat label="Amazon present" value={bbMkt.amazon_retail_offer_presence ? 'Yes' : 'No'} />
            <Stat label="Dominance" value={titleCase(bbCtx.dominance_hint)} />
          </div>
          {bbWin.by_window_days && Object.keys(bbWin.by_window_days).length > 0 ? (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
              Buy-box share windows: {Object.entries(bbWin.by_window_days).map(([d, v]: any) => `${d}d: ${JSON.stringify(v).slice(0, 40)}`).join(' · ')}
            </div>
          ) : (bbWin.status === 'partial' ? <div style={{ marginTop: 8 }}><PartialHint note={bbWin.note} /></div> : null)}
        </Section>

        {/* 5. SELLER LANDSCAPE */}
        <Section title="Seller landscape" chip={<Chip dot={false}>{fmtNum(sellers.offer_row_count_total)} offers</Chip>}>
          {Array.isArray(sellers.offers_by_seller) && sellers.offers_by_seller.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="data" style={{ width: '100%' }}>
                <thead><tr><th>Seller</th><th>Condition</th><th className="num">Price</th><th>Amazon?</th></tr></thead>
                <tbody>
                  {sellers.offers_by_seller.slice(0, 15).map((s: any, i: number) => (
                    <tr key={i}>
                      <td className="mono">{s.seller_id || s.sellerId || '—'}</td>
                      <td>{titleCase(s.condition)}</td>
                      <td className="num">{fmtUsd((s.price_cents != null ? s.price_cents / 100 : s.price))}</td>
                      <td>{s.is_amazon || s.isAmazon ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <PartialHint note={sellers.note || 'No offers[] in the snapshot — richer pull needed for the seller table.'} />}
        </Section>

        {/* 6. VOLUME & MOMENTUM + 7. INVENTORY/PROCUREMENT side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Section title="Volume & momentum">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Stat label="Regime" value={titleCase(vol.regime)} />
              <Stat label="Rank Δ 30d" value={mom.sales_rank_delta_30d_plain_language || fmtNum(mom.sales_rank_delta_30d)} />
              <Stat label="New reviews 30d" value={fmtNum(mom.new_reviews_last_30d)} />
              <Stat label="Combined multiplier" value={num(vol.combined_multiplier) != null ? Number(vol.combined_multiplier).toFixed(2) : '—'} />
            </div>
            {vol.listing_gap_reason && <div style={{ marginTop: 8 }}><PartialHint note={vol.listing_gap_reason} /></div>}
          </Section>
          <Section title="Inventory & procurement">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Stat label="Target cover" value={num(place.target_days_cover) != null ? `${place.target_days_cover}d` : '—'} />
              <Stat label="Suggested units" value={fmtNum(place.suggested_total_units_for_target_cover)} />
              <Stat label="Min warehouses" value={fmtNum(place.suggested_min_active_warehouses)} />
              <Stat label="Procurement" value={titleCase(proc.status)} />
            </div>
            {Array.isArray(place.narrative_bullets) && place.narrative_bullets.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {place.narrative_bullets.slice(0, 4).map((b: string, i: number) => <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>• {b}</div>)}
              </div>
            )}
          </Section>
        </div>

        {/* 8. ECONOMICS */}
        <Section title="Pricing & economics">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <Stat label="List price" value={fmtUsd(econ.list_price_usd)} />
            <Stat label="Buy-box landed" value={fmtUsd(econ.buy_box_landed_price_usd)} />
            <Stat label="Amazon price" value={fmtUsd(econ.amazon_price_usd)} />
            <Stat label="Opportunity score" value={fmtNum(r.opportunityScore)} />
          </div>
        </Section>

        {/* 9. UNLOCK RICHER DATA */}
        {upgrades.length > 0 && (
          <Section title="Unlock richer intelligence" chip={<DataQualityBadges dq={dq} />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upgrades.map((u, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Chip tone="amber" dot={false}>{titleCase(u.code)}</Chip>
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{u.impact}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 10. ACTIONS + RAW */}
        <div style={{ ...panel, padding: 16 }}>
          {onContinue ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Reviewed the intelligence? Continue to create the product — these fields prefill the form.
              </div>
              <button className="btn primary" onClick={onContinue}>Continue to create product →</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>List &amp; add SKU to a marketplace</div>
              {accounts.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No connected marketplaces. Connect one first.</div>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select className="filter-select" value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.display_name || a.channel}{a.marketplace_id ? ` (${a.marketplace_id})` : ''}</option>)}
                  </select>
                  <button className="btn primary" onClick={listToMarketplace} disabled={listing}>{listing ? 'Listing…' : 'List & activate'}</button>
                  {listMsg && <span style={{ fontSize: 12, color: listMsg.tone === 'ok' ? 'var(--green-text)' : 'var(--red-text)' }}>{listMsg.text}</span>}
                </div>
              )}
            </>
          )}
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <button className="btn ghost sm" onClick={() => setRawOpen((o) => !o)}>{rawOpen ? 'Hide' : 'Show'} raw Cortex data</button>
            {rawOpen && (
              <pre style={{ marginTop: 10, maxHeight: 360, overflow: 'auto', fontSize: 11, background: 'var(--bg-sunken)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                {JSON.stringify(ex, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

function DataQualityBadges({ dq }: { dq: any }) {
  const items = [
    ['Rank series', dq.has_rank_series],
    ['Reviews', dq.has_review_series],
    ['Buy-box windows', dq.has_buybox_windows],
    ['Forecast', dq.forecast_ready],
  ] as [string, boolean][];
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map(([label, ok]) => <Chip key={label} tone={ok ? 'green' : undefined} dot={false}>{label}{ok ? ' ✓' : ' —'}</Chip>)}
    </div>
  );
}

const panel: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-elev)', padding: 12 };
const panelTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' };
