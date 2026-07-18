import React, { useEffect, useMemo, useState } from 'react';
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

const VTONE: Record<string, { bg: string; fg: string; label: string }> = {
  favorable: { bg: 'var(--green-soft)', fg: 'var(--green-text)', label: 'FAVORABLE' },
  neutral: { bg: 'var(--amber-soft)', fg: 'var(--amber-text)', label: 'NEUTRAL' },
  cautious: { bg: 'var(--red-soft)', fg: 'var(--red-text)', label: 'CAUTIOUS' },
};

// ── Multi-series time-series chart (scaled up from the modal LineChart) ───────────────────
function KeepaChart({
  series, fields, height = 150, title, hint,
}: {
  series: Pt[];
  fields: { key: string; color: string; label: string; invert?: boolean; usd?: boolean }[];
  height?: number;
  title: string;
  hint?: string;
}) {
  const W = 640, H = height, pad = 6;
  const ts = series.map((p) => (typeof p.t === 'number' ? (p.t as number) : 0));
  const tMin = Math.min(...ts), tMax = Math.max(...ts);
  const x = (t: number) => pad + ((t - tMin) / (tMax - tMin || 1)) * (W - 2 * pad);
  const drawn = fields
    .map((f) => {
      const pts = series
        .map((p) => ({ t: typeof p.t === 'number' ? (p.t as number) : 0, v: num((p as any)[f.key]) }))
        .filter((d) => d.v != null) as { t: number; v: number }[];
      if (pts.length < 2) return null;
      const vMin = Math.min(...pts.map((d) => d.v));
      const vMax = Math.max(...pts.map((d) => d.v));
      const y = (v: number) => {
        const nrm = (v - vMin) / (vMax - vMin || 1);
        return pad + (f.invert ? nrm : 1 - nrm) * (H - 2 * pad);
      };
      const path = pts.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.t).toFixed(1)} ${y(d.v).toFixed(1)}`).join(' ');
      const last = pts[pts.length - 1].v;
      return { f, path, last };
    })
    .filter(Boolean) as { f: any; path: string; last: number }[];

  if (!drawn.length) {
    return (
      <div style={panel}>
        <div style={panelTitle}>{title}</div>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>No history available yet.</div>
      </div>
    );
  }
  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={panelTitle}>{title}</span>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {drawn.map((d) => (
            <span key={d.f.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-secondary)' }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: d.f.color }} />
              {d.f.label}: <strong style={{ color: 'var(--text)' }}>{d.f.usd ? `$${d.last.toFixed(2)}` : Math.round(d.last).toLocaleString()}</strong>
            </span>
          ))}
        </div>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        {drawn.map((d) => <path key={d.f.key} d={d.path} fill="none" stroke={d.f.color} strokeWidth={1.8} />)}
      </svg>
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

export const ProductResearchFullView = ({ row, onClose, onListed }: {
  row: ProductResearchResult;
  onClose: () => void;
  onListed?: () => void;
}) => {
  const r = (row.result || {}) as any;
  const k = r.keepa || {};
  const ex = k.extract || {};
  const lp = ex.listing_profile || {};
  const verdict = ex.sell_decision_hybrid || k.verdict || {};
  const opp = ex.opportunity_summary_ux || k.opportunity || {};
  const chart = (ex.keepa_trend_bundle && ex.keepa_trend_bundle.chart) || k.charts || {};
  const series: Pt[] = Array.isArray(chart.series) ? chart.series : [];
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
    <Modal title={`Research · ${r.sku || k.asin || 'product'}`} subtitle={r.title || lp.title || undefined} onClose={onClose} fullscreen>
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

        {/* 3. CHARTS GRID */}
        {series.length >= 2 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <KeepaChart title="Sales rank history" series={series} fields={[{ key: 'sales_rank', color: 'var(--purple)', label: 'BSR', invert: false }]} hint="Lower is better — line up = improving rank." />
            <KeepaChart title="Price history" series={series} fields={[{ key: 'amazon_price_usd', color: 'var(--blue-text)', label: 'Amazon', invert: true, usd: true }, { key: 'buy_box_landed_usd', color: 'var(--green-text)', label: 'Buy box', invert: true, usd: true }]} />
            <KeepaChart title="Offer count" series={series} fields={[{ key: 'new_offer_count', color: 'var(--amber-text)', label: 'Offers', invert: true }]} hint="Number of competing new offers over time." />
            <KeepaChart title="Reviews" series={series} fields={[{ key: 'review_count', color: 'var(--text-secondary)', label: 'Reviews', invert: true }]} />
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
