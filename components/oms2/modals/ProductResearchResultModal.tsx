import React, { useEffect, useState } from 'react';
import { Modal, Chip } from '../ui';
import { fetchChannelAccounts, mapItemToChannel, createCatalogItem, ChannelAccount, ProductResearchResult } from '../../../lib/oms';

/**
 * Rich Keepa/Cortex product-research result modal. Renders the Cortex sellability verdict,
 * opportunity stats, and SVG charts (sales-rank + buy-box price history from
 * keepa.charts.series) so the user can judge if an item is a good seller — then optionally
 * list it to a marketplace (creates the catalog item if needed + maps it active).
 */

type Pt = Record<string, number | null>;

const verdictTone = (v?: string) =>
  v === 'favorable' ? 'green' : v === 'cautious' ? 'red' : 'amber';

function LineChart({ points, field, color, label, invert }: { points: Pt[]; field: string; color: string; label: string; invert?: boolean }) {
  const vals = points.map((p) => (typeof p[field] === 'number' ? (p[field] as number) : null));
  const ts = points.map((p) => (typeof p.t === 'number' ? (p.t as number) : 0));
  const present = vals.map((v, i) => ({ v, t: ts[i] })).filter((d) => d.v != null) as { v: number; t: number }[];
  if (present.length < 2) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
        {label}: not enough history
      </div>
    );
  }
  const W = 320, H = 90, pad = 4;
  const vMin = Math.min(...present.map((d) => d.v));
  const vMax = Math.max(...present.map((d) => d.v));
  const tMin = Math.min(...present.map((d) => d.t));
  const tMax = Math.max(...present.map((d) => d.t));
  const x = (t: number) => pad + ((t - tMin) / (tMax - tMin || 1)) * (W - 2 * pad);
  const yRaw = (v: number) => (v - vMin) / (vMax - vMin || 1);
  const y = (v: number) => {
    const norm = invert ? yRaw(v) : 1 - yRaw(v); // lower sales-rank = better → invert so "up" = good
    return pad + norm * (H - 2 * pad);
  };
  const line = present.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.t).toFixed(1)} ${y(d.v).toFixed(1)}`).join(' ');
  const last = present[present.length - 1].v;
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg-elev)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{Math.round(last).toLocaleString()}</span>
      </div>
      {/* No preserveAspectRatio="none": that non-uniformly stretched the stroke at any width ≠ 320.
          Uniform scaling (xMidYMid meet) keeps the line proportional. */}
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <path d={line} fill="none" stroke={color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--bg-elev)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{value ?? '—'}</div>
    </div>
  );
}

export const ProductResearchResultModal = ({ row, onClose, onListed }: {
  row: ProductResearchResult;
  onClose: () => void;
  onListed?: () => void;
}) => {
  const r = row.result || ({} as any);
  const keepa = r.keepa || null;
  const verdict = keepa?.verdict || null;
  const opp = keepa?.opportunity || null;
  const series: Pt[] = Array.isArray(keepa?.charts?.series) ? keepa.charts.series : [];

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
          sku: r.sku,
          title: r.title || r.sku,
          asin: keepa?.asin || r.asin || undefined,
          image: keepa?.image || undefined,
          category: keepa?.category || undefined,
        } as any);
        itemId = (created as any)?.id || (created as any)?._id || '';
      }
      if (!itemId) throw new Error('Could not resolve the catalog item to list.');
      await mapItemToChannel(itemId, {
        channelAccountId: selectedAccount,
        channelItemId: keepa?.asin || r.asin || r.sku,
        sku: r.sku,
        status: 'active',
      });
      setListMsg({ tone: 'ok', text: 'Listed & activated on the selected marketplace.' });
      onListed?.();
    } catch (e: any) {
      setListMsg({ tone: 'err', text: e?.message || 'Failed to list to marketplace.' });
    } finally {
      setListing(false);
    }
  };

  return (
    <Modal title={r.sku || 'Product research'} subtitle={r.title || keepa?.title || undefined} onClose={onClose} width={720}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Verdict headline */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {keepa?.image && <img src={keepa.image} alt="" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', background: '#fff' }} />}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {verdict?.final_verdict
                ? <Chip tone={verdictTone(verdict.final_verdict) as any} dot={false}>{String(verdict.final_verdict).toUpperCase()}</Chip>
                : <Chip tone="amber" dot={false}>NO KEEPA DATA</Chip>}
              {verdict?.recommended_to_sell_label && (
                <span style={{ fontSize: 13, fontWeight: 700 }}>Sell: {verdict.recommended_to_sell_label}</span>
              )}
              {verdict?.decision_confidence != null && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>confidence {(verdict.decision_confidence * 100).toFixed(0)}%</span>
              )}
            </div>
            {keepa?.brand && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{keepa.brand}{keepa.category ? ` · ${keepa.category}` : ''}</div>}
          </div>
        </div>

        {verdict && (verdict.positive_reasons?.length || verdict.blocking_reasons?.length) ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green-text)', marginBottom: 4 }}>Why it could sell</div>
              {(verdict.positive_reasons || []).slice(0, 4).map((x: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>• {x}</div>
              ))}
              {!(verdict.positive_reasons || []).length && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</div>}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red-text)', marginBottom: 4 }}>Risks</div>
              {(verdict.blocking_reasons || []).slice(0, 4).map((x: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>• {x}</div>
              ))}
              {!(verdict.blocking_reasons || []).length && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</div>}
            </div>
          </div>
        ) : null}

        {/* Opportunity + Keepa stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <Stat label="Opportunity score" value={r.opportunityScore ?? '—'} />
          <Stat label="Sales rank" value={keepa?.salesRank != null ? Number(keepa.salesRank).toLocaleString() : '—'} />
          <Stat label="Buy box" value={keepa?.buyBoxPrice != null ? `$${Number(keepa.buyBoxPrice).toFixed(2)}` : '—'} />
          <Stat label="Reviews" value={keepa?.reviewCount != null ? Number(keepa.reviewCount).toLocaleString() : '—'} />
        </div>
        {opp && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <Stat label="Est. monthly units" value={opp.est_monthly_units != null ? Number(opp.est_monthly_units).toLocaleString() : '—'} />
            <Stat label="Amazon share 30d" value={opp.amazon_share_30d_pct != null ? `${Number(opp.amazon_share_30d_pct).toFixed(0)}%` : '—'} />
            <Stat label="Buy-box sellers" value={opp.distinct_buybox_sellers_30d ?? '—'} />
          </div>
        )}

        {/* Charts */}
        {series.length >= 2 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <LineChart points={series} field="sales_rank" color="var(--purple)" label="Sales rank (lower = better)" />
            <LineChart points={series} field="buy_box_landed_usd" color="var(--green-text)" label="Buy-box price" invert />
            <LineChart points={series} field="new_offer_count" color="var(--amber-text)" label="Offer count" invert />
            <LineChart points={series} field="review_count" color="var(--blue-text)" label="Reviews" invert />
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 8 }}>
            No Keepa history charts available for this item{keepa ? '' : ' — no identifier resolved'}.
          </div>
        )}

        {/* List to marketplace */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>List &amp; add SKU to a marketplace</div>
          {accounts.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No connected marketplaces. Connect one first.</div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="filter-select" value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.display_name || a.channel}{a.marketplace_id ? ` (${a.marketplace_id})` : ''}</option>
                ))}
              </select>
              <button className="btn primary" onClick={listToMarketplace} disabled={listing}>
                {listing ? 'Listing…' : 'List & activate'}
              </button>
              {listMsg && (
                <span style={{ fontSize: 12, color: listMsg.tone === 'ok' ? 'var(--green-text)' : 'var(--red-text)' }}>{listMsg.text}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
