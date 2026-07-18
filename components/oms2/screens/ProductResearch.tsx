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
import { ProductResearchResultModal } from '../modals/ProductResearchResultModal';

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

const riskTone = (risk?: string) =>
  risk === 'needs_data' ? 'amber' : risk === 'strong_candidate' ? 'green' : risk === 'weak_candidate' ? 'red' : 'blue';

const readinessTone = (score?: number) => {
  const n = Number(score || 0);
  if (n >= 75) return 'green';
  if (n >= 45) return 'amber';
  return 'red';
};

const n = (value: unknown) => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const selectedBaseline = (sku: OmsSku | undefined, manual: Record<string, string>) => {
  const manualDims = n(manual.length) > 0 && n(manual.width) > 0 && n(manual.height) > 0;
  const hasSku = Boolean(sku || manual.sku.trim());
  return [
    { label: 'Product identity', met: hasSku, detail: sku ? sku.sku : manual.sku || 'SKU required' },
    { label: 'Dimensions', met: sku ? n(sku.palletCubeFt) > 0 : manualDims, detail: sku ? 'From catalog if available' : 'L x W x H' },
    { label: 'Weight', met: sku ? n(sku.palletWeightLbs) > 0 : n(manual.weight) > 0, detail: sku ? 'From catalog if available' : 'Weight in lb' },
    { label: 'Cost', met: n(manual.cost) > 0, detail: sku ? 'Cortex checks catalog details after run' : 'Needed for margin' },
    { label: 'Selling price', met: n(manual.price) > 0, detail: sku ? 'Cortex checks catalog details after run' : 'Needed for margin' },
  ];
};

export const ProductResearch = ({ onNavigate }: ScreenProps) => {
  const [workflow, setWorkflow] = useState<'single' | 'bulk'>('single');
  const [readiness, setReadiness] = useState<IntelligenceReadiness | null>(null);
  const [runs, setRuns] = useState<IntelligenceRun[]>([]);
  const [skus, setSkus] = useState<OmsSku[]>([]);
  const [selectedSku, setSelectedSku] = useState('');
  const [skuSearch, setSkuSearch] = useState('');
  const [manual, setManual] = useState({ sku: '', title: '', asin: '', cost: '', price: '', weight: '', length: '', width: '', height: '' });
  const [result, setResult] = useState<ProductResearchResult | null>(null);
  const [bulkResults, setBulkResults] = useState<ProductResearchResult[]>([]);
  const [csvName, setCsvName] = useState('');
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [activeResult, setActiveResult] = useState<ProductResearchResult | null>(null);
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
  const filteredSkus = useMemo(() => {
    const q = skuSearch.trim().toLowerCase();
    if (!q) return skus.slice(0, 8);
    return skus.filter((sku) => `${sku.sku} ${sku.title || ''}`.toLowerCase().includes(q)).slice(0, 12);
  }, [skuSearch, skus]);
  const baseline = useMemo(() => selectedBaseline(selected, manual), [selected, manual]);
  const missingBaseline = baseline.filter((item) => !item.met).length;
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
    setErr(null);
    setCsvName(file.name);
    const text = await file.text();
    setCsvRows(parseCsv(text));
  };

  const runBulk = async () => {
    if (!csvRows.length) return;
    setBusy(true);
    setErr(null);
    try {
      const response = await runBulkProductResearch({ filename: csvName || 'product-research.csv', rows: csvRows });
      setBulkResults(response.results || []);
      await load();
    } catch (e: any) {
      setErr(e.message || 'Bulk Product Research failed');
    } finally {
      setBusy(false);
    }
  };

  // Paste multiple ASIN/UPC/identifiers (newline or comma separated) → one bulk run.
  const pastedIdentifiers = useMemo(
    () => Array.from(new Set(pasteText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))),
    [pasteText],
  );
  const runPasted = async () => {
    if (!pastedIdentifiers.length) return;
    setBusy(true);
    setErr(null);
    try {
      // Each identifier becomes a row; the backend classifies asin vs upc/ean and looks it up.
      const rows = pastedIdentifiers.map((id) => ({ identifier: id, asin: id }));
      const response = await runBulkProductResearch({ filename: `pasted-${pastedIdentifiers.length}-identifiers`, rows });
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
    <div className="page fade-in product-research-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Product Research</h1>
          <p className="page-subtitle">Find one product, check what Cortex needs, then run enrichment. Use CSV only when you want to process a catalog in bulk.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => onNavigate('skus')}><Icon name="box" size={13} /> SKU catalog</button>
        </div>
      </div>

      <div className="research-status-strip">
        <div>
          <div className="research-status-label">Account readiness</div>
          <div className={`research-status-score ${readinessTone(readiness?.score)}`}>{readiness?.score || 0}%</div>
        </div>
        <div>
          <div className="research-status-label">Best data feed</div>
          <div className="research-status-value">{sourceLabel(readiness?.sourceMode)}</div>
          <div className="research-status-sub">{readiness?.primarySource?.replace(/_/g, ' ') || 'setup needed'}</div>
        </div>
        <div>
          <div className="research-status-label">Catalog</div>
          <div className="research-status-value">{readiness?.counts?.catalogItems || 0} SKUs</div>
          <div className="research-status-sub">{readiness?.counts?.marketplaceMappedItems || 0} marketplace mapped</div>
        </div>
        <div>
          <div className="research-status-label">Blocking setup</div>
          <div className="research-status-value">{readiness?.blockers?.length || 0}</div>
          <div className="research-status-sub">items lowering confidence</div>
        </div>
      </div>

      <div className="research-workflow-tabs">
        <button className={workflow === 'single' ? 'active' : ''} onClick={() => setWorkflow('single')}>
          <Icon name="search" size={13} /> Single item search
        </button>
        <button className={workflow === 'bulk' ? 'active' : ''} onClick={() => setWorkflow('bulk')}>
          <Icon name="download" size={13} style={{ transform: 'rotate(180deg)' }} /> Bulk CSV
        </button>
      </div>

      {workflow === 'single' ? (
        <div className="research-single-layout">
          <div className="card research-search-card">
            <div className="card-header">
              <div>
                <div className="card-title"><Icon name="search" size={15} /> Find a product</div>
                <div className="card-subtitle">Search the catalog first. If the item is not in the account yet, switch to manual entry.</div>
              </div>
              <Chip tone="purple" dot={false}>Cortex</Chip>
            </div>
            <div className="card-body">
              <div className="research-search-box">
                <Icon name="search" size={15} />
                <input
                  value={skuSearch}
                  onChange={(e) => setSkuSearch(e.target.value)}
                  placeholder="Search by SKU or title..."
                  aria-label="Search SKUs"
                />
                {selectedSku && (
                  <button className="btn ghost sm" onClick={() => { setSelectedSku(''); setSkuSearch(''); }}>
                    Manual item
                  </button>
                )}
              </div>

              <div className="research-sku-list">
                {filteredSkus.length === 0 ? (
                  <EmptyState>No matching SKUs. Enter the item manually below.</EmptyState>
                ) : filteredSkus.map((sku) => (
                  <button
                    key={sku.id}
                    className={`research-sku-row ${selected?.id === sku.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedSku(sku.sku);
                      setSkuSearch(`${sku.sku} ${sku.title || ''}`.trim());
                    }}
                  >
                    <div>
                      <div className="mono strong">{sku.sku}</div>
                      <div className="research-muted">{sku.title || 'Untitled product'}</div>
                    </div>
                    <div className="research-row-meta">
                      <span>{Math.round(n(sku.daysOfCover))}d cover</span>
                      <Chip tone={sku.risk === 'high' ? 'red' : sku.risk === 'medium' ? 'amber' : 'green'} dot={false}>{sku.risk || 'unknown'}</Chip>
                    </div>
                  </button>
                ))}
              </div>

              {!selected && (
                <div className="research-manual-panel">
                  <div className="research-section-title">Manual item</div>
                  <div className="research-manual-grid">
                    {[
                      ['sku', 'SKU', 'Required'],
                      ['title', 'Title', 'Recommended'],
                      ['asin', 'ASIN / ID', 'Optional'],
                      ['cost', 'Cost', 'Needed for margin'],
                      ['price', 'Selling price', 'Needed for margin'],
                      ['weight', 'Weight lb', 'Needed for shipping'],
                      ['length', 'Length in', 'L'],
                      ['width', 'Width in', 'W'],
                      ['height', 'Height in', 'H'],
                    ].map(([key, label, hint]) => (
                      <label key={key}>
                        <span>{label}</span>
                        <input className="input" value={(manual as any)[key]} placeholder={hint} onChange={(e) => setManual((m) => ({ ...m, [key]: e.target.value }))} />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card research-action-card">
            <div className="card-header">
              <div>
                <div className="card-title"><Icon name="sparkle" size={15} /> Ready to analyze</div>
                <div className="card-subtitle">Cortex can run now, but complete fields produce stronger recommendations.</div>
              </div>
              <Chip tone={missingBaseline ? 'amber' : 'green'} dot={false}>{missingBaseline ? `${missingBaseline} gaps` : 'Ready'}</Chip>
            </div>
            <div className="card-body">
              <div className="research-product-preview">
                <div className="research-product-icon"><Icon name="box" size={20} /></div>
                <div>
                  <div className="research-product-title">{selected?.title || manual.title || selected?.sku || manual.sku || 'Choose a product'}</div>
                  <div className="research-muted">{selected?.sku || manual.sku || 'Search an existing SKU or enter a manual SKU'}</div>
                </div>
              </div>

              <div className="research-checklist">
                {baseline.map((item) => (
                  <div key={item.label} className={`research-check ${item.met ? 'met' : 'missing'}`}>
                    <Icon name={item.met ? 'check' : 'warning'} size={12} />
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn primary research-run-btn" onClick={runSingle} disabled={busy || (!selected && !manual.sku)}>
                <Icon name="sparkle" size={14} /> {busy ? 'Analyzing...' : 'Run Cortex analysis'}
              </button>
              <button className="btn research-run-btn" onClick={() => onNavigate('skus')}>
                <Icon name="box" size={13} /> Open SKU table
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="research-bulk-layout">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title"><Icon name="download" size={15} style={{ transform: 'rotate(180deg)' }} /> Upload product CSV</div>
                <div className="card-subtitle">Use this for catalog cleanup or large imports. Marketplace data still has priority when available.</div>
              </div>
              <Chip dot={false}>CSV</Chip>
            </div>
            <div className="card-body">
              <label className="research-upload-zone">
                <Icon name="download" size={22} style={{ transform: 'rotate(180deg)' }} />
                <strong>{csvName || 'Choose a CSV file'}</strong>
                <span>{csvRows.length ? `${csvRows.length.toLocaleString()} rows ready to analyze` : 'No file selected yet'}</span>
                <input type="file" accept=".csv,text/csv" onChange={(e) => handleCsv(e.target.files?.[0] || null)} disabled={busy} />
              </label>

              <div className="research-column-guide">
                {['sku', 'title', 'asin', 'cost', 'price', 'weight', 'length', 'width', 'height'].map((column) => (
                  <span key={column}>{column}</span>
                ))}
              </div>

              <button className="btn primary research-run-btn" onClick={runBulk} disabled={busy || !csvRows.length}>
                <Icon name="sparkle" size={14} /> {busy ? 'Analyzing...' : 'Run bulk research'}
              </button>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>…or paste identifiers</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  Paste ASINs / UPCs / other identifiers (one per line or comma-separated). We research each against Keepa via Cortex.
                </div>
                <textarea
                  className="input"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'B08N5WRWNW\n012345678905\nB01ABCDEF2'}
                  rows={4}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
                />
                <button className="btn primary research-run-btn" onClick={runPasted} disabled={busy || !pastedIdentifiers.length} style={{ marginTop: 8 }}>
                  <Icon name="sparkle" size={14} /> {busy ? 'Analyzing...' : `Research ${pastedIdentifiers.length || ''} identifier${pastedIdentifiers.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">What Cortex checks</div>
            </div>
            <div className="card-body" style={{ display: 'grid', gap: 10 }}>
              <Impact label="Product identity" detail="Matches SKU, title, ASIN, or marketplace identity." />
              <Impact label="Profit baseline" detail="Uses cost and selling price to determine margin readiness." />
              <Impact label="Fulfillment baseline" detail="Uses weight and dimensions for pallet and parcel fit." />
              <Impact label="Optimization readiness" detail="Creates a blocked notice when data is missing, not a fake approval." />
              {readiness?.blockers?.length ? (
                <div className="research-blockers">
                  {readiness.blockers.slice(0, 4).map((blocker) => <Chip key={blocker} tone="amber" dot={false}>{blocker}</Chip>)}
                </div>
              ) : <Chip tone="green" dot={false}>Account ready for high-confidence enrichment</Chip>}
            </div>
          </div>
        </div>
      )}

      {(result || bulkResults.length > 0) && (
        <div className="card research-results-card">
          <div className="card-header">
            <div>
              <div className="card-title">Research results</div>
              <div className="card-subtitle">Click a row for the full Keepa intelligence — verdict, charts, and list-to-marketplace.</div>
            </div>
            <Chip tone="purple" dot={false}>{result ? 'Single item' : `${bulkResults.length} rows`}</Chip>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Keepa verdict</th>
                  <th className="num">Score</th>
                  <th className="num">Sales rank</th>
                  <th>Readiness</th>
                  <th>Next step</th>
                </tr>
              </thead>
              <tbody>
                {(result ? [result] : bulkResults).slice(0, 100).map((row) => {
                  const v = row.result.keepa?.verdict?.final_verdict || row.result.keepaVerdict;
                  const vTone = v === 'favorable' ? 'green' : v === 'cautious' ? 'red' : v ? 'amber' : undefined;
                  return (
                    <tr key={row.id || row.sku} className="clickable" onClick={() => setActiveResult(row)} style={{ cursor: 'pointer' }}>
                      <td className="mono strong">{row.sku}</td>
                      <td>{v ? <Chip tone={vTone as any} dot={false}>{String(v).toUpperCase()}</Chip> : <Chip tone={riskTone(row.result.productRisk)}>{String(row.result.productRisk || row.status).replace(/_/g, ' ')}</Chip>}</td>
                      <td className="num mono strong">{row.result.opportunityScore || 0}</td>
                      <td className="num">{row.result.keepa?.salesRank != null ? Number(row.result.keepa.salesRank).toLocaleString() : '—'}</td>
                      <td>{String(row.result.marketplaceReadiness || 'unknown').replace(/_/g, ' ')}</td>
                      <td>{row.result.recommendedAction}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeResult && (
        <ProductResearchResultModal
          row={activeResult}
          onClose={() => setActiveResult(null)}
          onListed={load}
        />
      )}

      <div className="research-bottom-grid">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent research</div>
            {latestRun?.confidence != null && <Confidence value={latestRun.confidence} />}
          </div>
          <div style={{ padding: 0 }}>
            {runs.length === 0 ? (
              <EmptyState>No Product Research runs yet.</EmptyState>
            ) : runs.slice(0, 8).map((run) => (
              <div key={run.id} className="research-run-row">
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
          <div className="card-body research-impact-list">
            <Impact label="Opportunity score" detail="Ranks products by enrichment and optimization potential." />
            <Impact label="Pallet footprint" detail="Adds cube, weight, pallet fill, and LTL suitability." />
            <Impact label="Marketplace readiness" detail="Separates marketplace-enriched confidence from CSV/manual fallback." />
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
