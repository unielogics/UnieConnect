import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, Confidence, EmptyState, ErrorState, Loading, fmt } from '../ui';
import {
  fetchIntelligenceReadiness,
  fetchOmsSkus,
  fetchProductResearchRuns,
  IntelligenceReadiness,
  IntelligenceRun,
  OmsSku,
  ProductResearchResult,
  runBulkProductResearch,
  runProductResearch,
} from '../../../lib/oms';
import type { ScreenProps } from '../UnieConnectApp';

const parseCsv = (text: string) => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return headers.reduce<Record<string, string>>((acc, h, i) => {
      acc[h] = cells[i]?.trim() || '';
      return acc;
    }, {});
  });
};

const splitCsvLine = (line: string) => {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
};

const sourceLabel = (mode?: string) => {
  if (mode === 'marketplace_primary') return 'Marketplace primary';
  if (mode === 'marketplace_plus_csv') return 'Marketplace + CSV';
  if (mode === 'csv_fallback') return 'CSV fallback';
  return 'Manual / setup needed';
};

export const ProductResearch = ({ onNavigate }: ScreenProps) => {
  const [readiness, setReadiness] = useState<IntelligenceReadiness | null>(null);
  const [runs, setRuns] = useState<IntelligenceRun[]>([]);
  const [skus, setSkus] = useState<OmsSku[]>([]);
  const [selectedSku, setSelectedSku] = useState('');
  const [manual, setManual] = useState({ sku: '', title: '', asin: '', cost: '', price: '', weight: '', length: '', width: '', height: '' });
  const [result, setResult] = useState<ProductResearchResult | null>(null);
  const [bulkResults, setBulkResults] = useState<ProductResearchResult[]>([]);
  const [csvName, setCsvName] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setErr(null);
    Promise.all([
      fetchIntelligenceReadiness(),
      fetchProductResearchRuns().catch(() => ({ runs: [] })),
      fetchOmsSkus().catch(() => ({ skus: [], total: 0 })),
    ])
      .then(([r, runData, skuData]) => {
        setReadiness(r);
        setRuns(runData.runs || []);
        setSkus(skuData.skus || []);
        setSelectedSku((current) => current || skuData.skus?.[0]?.sku || '');
      })
      .catch((e) => setErr(e.message || 'Failed to load Product Research'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const selected = useMemo(() => skus.find((s) => s.sku === selectedSku || s.id === selectedSku), [skus, selectedSku]);
  const latestRun = runs[0];

  const runSingle = async () => {
    setBusy(true);
    setErr(null);
    try {
      const payload = selected
        ? { sku: selected.sku, itemId: selected.id, title: selected.title }
        : {
            sku: manual.sku,
            title: manual.title,
            asin: manual.asin,
            cost: Number(manual.cost || 0),
            price: Number(manual.price || 0),
            weight: Number(manual.weight || 0),
            dimensions: {
              length: Number(manual.length || 0),
              width: Number(manual.width || 0),
              height: Number(manual.height || 0),
            },
          };
      const response = await runProductResearch(payload);
      setResult(response.result);
      await load();
    } catch (e: any) {
      setErr(e.message || 'Product Research failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCsv = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    setCsvName(file.name);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const response = await runBulkProductResearch({ filename: file.name, rows });
      setBulkResults(response.results || []);
      await load();
    } catch (e: any) {
      setErr(e.message || 'Bulk Product Research failed');
    } finally {
      setBusy(false);
    }
  };

  if (err) return <div className="page fade-in"><div className="card"><ErrorState message={err} onRetry={load} /></div></div>;
  if (loading) return <div className="page fade-in"><div className="card"><Loading rows={6} /></div></div>;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Product Research</h1>
          <p className="page-subtitle">Cortex enrichment for single items and bulk CSV catalogs. Marketplace connections remain the strongest signal; CSV fills gaps.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => onNavigate('skus')}><Icon name="box" size={13} /> SKU catalog</button>
          <button className="btn primary" onClick={runSingle} disabled={busy || (!selected && !manual.sku)}><Icon name="sparkle" size={13} /> Analyze item</button>
        </div>
      </div>

      <div className="stat-grid cols-4" style={{ marginBottom: 16 }}>
        <div className="stat ai">
          <div className="stat-label">AI readiness</div>
          <div className="stat-value">{readiness?.score || 0}%</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>{readiness?.posture || 'unknown'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Primary feed</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{sourceLabel(readiness?.sourceMode)}</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>{readiness?.primarySource?.replace(/_/g, ' ')}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Catalog SKUs</div>
          <div className="stat-value">{readiness?.counts?.catalogItems || 0}</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>{readiness?.counts?.marketplaceMappedItems || 0} marketplace mapped</div>
        </div>
        <div className="stat warn">
          <div className="stat-label">Data blockers</div>
          <div className="stat-value">{readiness?.blockers?.length || 0}</div>
          <div className="stat-delta down"><span className="arrow">▼</span> confidence blockers</div>
        </div>
      </div>

      <div className="row-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title"><Icon name="sparkle" size={15} /> Single item analysis</div>
              <div className="card-subtitle">Use an existing SKU or enter a product manually.</div>
            </div>
            <Chip tone="purple" dot={false}>Cortex</Chip>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 12 }}>
            {skus.length > 0 && (
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="label">Existing SKU</span>
                <select className="input" value={selectedSku} onChange={(e) => setSelectedSku(e.target.value)}>
                  <option value="">Manual item</option>
                  {skus.map((sku) => (
                    <option key={sku.id} value={sku.sku}>{sku.sku} · {sku.title || sku.sku}</option>
                  ))}
                </select>
              </label>
            )}
            {!selected && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['sku', 'SKU'],
                  ['title', 'Title'],
                  ['asin', 'ASIN / ID'],
                  ['cost', 'Cost'],
                  ['price', 'Price'],
                  ['weight', 'Weight lb'],
                  ['length', 'Length in'],
                  ['width', 'Width in'],
                  ['height', 'Height in'],
                ].map(([key, label]) => (
                  <label key={key} style={{ display: 'grid', gap: 5 }}>
                    <span className="label">{label}</span>
                    <input className="input" value={(manual as any)[key]} onChange={(e) => setManual((m) => ({ ...m, [key]: e.target.value }))} />
                  </label>
                ))}
              </div>
            )}
            <button className="btn primary" onClick={runSingle} disabled={busy || (!selected && !manual.sku)}>
              <Icon name="sparkle" size={13} /> {busy ? 'Analyzing...' : 'Run Cortex Product Research'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title"><Icon name="download" size={15} style={{ transform: 'rotate(180deg)' }} /> Bulk CSV analysis</div>
              <div className="card-subtitle">Fallback or supplement when marketplace data is incomplete.</div>
            </div>
            <Chip dot={false}>CSV</Chip>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 12 }}>
            <div style={{ padding: 18, border: '1px dashed var(--border)', borderRadius: 10, background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Upload product CSV</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Recommended columns: sku, title, asin, cost, price, weight, length, width, height.
              </div>
              <input type="file" accept=".csv,text/csv" onChange={(e) => handleCsv(e.target.files?.[0] || null)} disabled={busy} />
              {csvName && <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>{csvName}</div>}
            </div>
            {readiness?.blockers?.length ? (
              <div style={{ display: 'grid', gap: 6 }}>
                {readiness.blockers.slice(0, 3).map((blocker) => (
                  <Chip key={blocker} tone="amber" dot={false}>{blocker}</Chip>
                ))}
              </div>
            ) : (
              <Chip tone="green" dot={false}>Ready for high-confidence enrichment</Chip>
            )}
          </div>
        </div>
      </div>

      {(result || bulkResults.length > 0) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title">Latest Product Research output</div>
            <Chip tone="purple" dot={false}>{result ? 'Single item' : `${bulkResults.length} CSV rows`}</Chip>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Risk</th>
                  <th className="num">Opportunity</th>
                  <th>Marketplace readiness</th>
                  <th>Fulfillment</th>
                  <th>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {(result ? [result] : bulkResults).slice(0, 25).map((row) => (
                  <tr key={row.id || row.sku}>
                    <td className="mono strong">{row.sku}</td>
                    <td><Chip tone={row.result.productRisk === 'needs_data' ? 'amber' : row.result.productRisk === 'strong_candidate' ? 'green' : 'blue'}>{String(row.result.productRisk || row.status).replace(/_/g, ' ')}</Chip></td>
                    <td className="num mono strong">{row.result.opportunityScore || 0}</td>
                    <td>{String(row.result.marketplaceReadiness || 'unknown').replace(/_/g, ' ')}</td>
                    <td className="muted">{String(row.result.fulfillment?.ltlSuitability || row.result.fulfillment?.warehouseFit || 'pending').replace(/_/g, ' ')}</td>
                    <td>{row.result.recommendedAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="row-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent runs</div>
            {latestRun?.confidence != null && <Confidence value={latestRun.confidence} />}
          </div>
          <div style={{ padding: 0 }}>
            {runs.length === 0 ? (
              <EmptyState>No Product Research runs yet.</EmptyState>
            ) : runs.slice(0, 8).map((run) => (
              <div key={run.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{String(run.runType).replace(/_/g, ' ')}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{run.publicId} · {run.cortexStatus || 'pending cortex'}</div>
                </div>
                <Chip tone={run.status === 'completed' ? 'green' : run.status === 'needs_data' ? 'amber' : 'blue'}>{run.status.replace(/_/g, ' ')}</Chip>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Feeds Optimize Suite</div>
            <Chip tone="purple" dot={false}>Reusable intelligence</Chip>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 12 }}>
            <Impact label="SKU opportunity score" detail="Improves SKU ranking inside Business Double and Inventory Plan." />
            <Impact label="Pallet footprint" detail="Adds cube, weight, pallet fill, and LTL suitability before shipment planning." />
            <Impact label="Marketplace readiness" detail="Separates marketplace-enriched confidence from CSV/manual fallback confidence." />
            <Impact label="Warehouse fit" detail="Prepares placement logic while WMS truth remains required for final execution." />
            <button className="btn" onClick={() => onNavigate('double')}>
              <Icon name="double" size={13} /> Open Business Double
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Impact = ({ label, detail }: { label: string; detail: string }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 10, alignItems: 'start' }}>
    <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--purple-soft)', color: 'var(--purple)', display: 'grid', placeItems: 'center' }}>
      <Icon name="sparkle" size={12} />
    </div>
    <div>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{detail}</div>
    </div>
  </div>
);
