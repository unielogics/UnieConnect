import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, Confidence, EmptyState, ErrorState, Loading, Sparkline, Thumb } from '../ui';
import {
  fetchIntelligenceReadiness,
  fetchOmsSkus,
  fetchProductResearchRuns,
  fetchProductResearchRun,
  IntelligenceReadiness,
  IntelligenceRun,
  OmsSku,
  ProductResearchResult,
  runBulkProductResearch,
  runProductResearch,
} from '../../../lib/oms';
import type { ScreenProps } from '../UnieConnectApp';
import { ProductResearchFullView } from '../modals/ProductResearchFullView';

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
  const [searchFocused, setSearchFocused] = useState(false);
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

  // Unified research history: freshly-run results (rich — thumbnail/verdict/sparkline, opened in place)
  // merged with persisted runs (lighter — re-fetched on open). Deduped by runId so a fresh run doesn't
  // appear twice once it lands in the runs list.
  const historyRows = useMemo(() => {
    const freshResults = [...(result ? [result] : []), ...bulkResults];
    const seenRunIds = new Set<string>();
    const rows: Array<{
      key: string; sku: string; title: string; image?: string | null;
      verdict?: string; verdictTone?: string; score?: number | null; salesRank?: number | null;
      spark: number[]; statusLabel: string; statusTone: string; onOpen: () => void;
    }> = [];

    const verdictToneOf = (v?: string) => (v === 'favorable' ? 'green' : v === 'cautious' ? 'red' : v ? 'amber' : 'blue');
    const sparkOf = (res: ProductResearchResult) => {
      const s = (res.result.keepa as any)?.extract?.keepa_trend_bundle?.chart?.series
        || (res.result.keepa as any)?.charts?.series || [];
      return Array.isArray(s)
        ? s.map((p: any) => (typeof p?.sales_rank === 'number' ? p.sales_rank : null)).filter((x: any): x is number => x != null)
        : [];
    };

    freshResults.forEach((res) => {
      if (res.runId) seenRunIds.add(res.runId);
      const v = res.result.keepa?.verdict?.final_verdict || res.result.keepaVerdict;
      // Sales rank sparkline is inverted (lower rank = better), so negate to render "up = better".
      const spark = sparkOf(res).map((x) => -x);
      rows.push({
        key: res.id || res.sku,
        sku: res.sku,
        title: res.result.title || res.result.keepa?.title || 'Untitled product',
        image: res.result.keepa?.image,
        verdict: v || undefined,
        verdictTone: v ? verdictToneOf(v) : undefined,
        score: res.result.opportunityScore ?? null,
        salesRank: res.result.keepa?.salesRank ?? null,
        spark,
        statusLabel: String(res.result.marketplaceReadiness || res.status || 'done').replace(/_/g, ' '),
        statusTone: res.result.productRisk === 'strong_candidate' ? 'green' : res.result.productRisk === 'weak_candidate' ? 'red' : 'blue',
        onOpen: () => setActiveResult(res),
      });
    });

    runs.forEach((run) => {
      if (run.id && seenRunIds.has(run.id)) return;
      const input = (run.input || {}) as Record<string, any>;
      rows.push({
        key: run.id,
        sku: input.sku || input.asin || input.identifier || run.publicId || run.id,
        title: input.title || String(run.runType).replace(/_/g, ' '),
        image: null,
        score: run.confidence != null ? Math.round(Number(run.confidence) * 100) : null,
        salesRank: null,
        spark: [],
        statusLabel: run.status.replace(/_/g, ' '),
        statusTone: run.status === 'completed' ? 'green' : run.status === 'needs_data' ? 'amber' : 'blue',
        onOpen: () => openRun(run.id),
      });
    });

    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, bulkResults, runs]);

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
      if (response.result) setActiveResult(response.result);
      await load();
    } catch (e: any) {
      setErr(e.message || 'Product Research failed');
    } finally {
      setBusy(false);
    }
  };

  // The search text looks like a raw identifier (ASIN or UPC/EAN/GTIN), not a catalog search.
  const searchIdentifier = useMemo(() => {
    const q = skuSearch.trim().toUpperCase();
    if (/^[A-Z0-9]{10}$/.test(q) && !/^\d{10}$/.test(q)) return { value: q, kind: 'ASIN' as const };
    if (/^\d{12,14}$/.test(q)) return { value: q, kind: 'UPC/EAN' as const };
    return null;
  }, [skuSearch]);
  const exactCatalogMatch = useMemo(
    () => skus.some((s) => s.sku?.toUpperCase() === skuSearch.trim().toUpperCase() || (s.asin || '').toUpperCase() === skuSearch.trim().toUpperCase()),
    [skus, skuSearch],
  );

  // Research a pasted identifier directly against Keepa via Cortex (no catalog SKU required).
  const runIdentifier = async () => {
    const id = skuSearch.trim();
    if (!id) return;
    setBusy(true);
    setErr(null);
    try {
      const response = await runProductResearch({ sku: id, asin: id, identifier: id });
      setResult(response.result);
      if (response.result) setActiveResult(response.result);
      await load();
    } catch (e: any) {
      setErr(e.message || 'Keepa lookup failed for that identifier');
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

  // Re-open a recent research run in the full view (renders from stored result.keepa.extract).
  const openRun = async (runId: string) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetchProductResearchRun(runId);
      const first = res.productResearchResults?.[0];
      if (first) setActiveResult(first);
      else setErr('This run has no stored result to view.');
    } catch (e: any) {
      setErr(e.message || 'Failed to open research run');
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
              <div className="research-search-wrap">
                <div className="research-search-box">
                  <Icon name="search" size={15} />
                  <input
                    value={skuSearch}
                    onChange={(e) => setSkuSearch(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && searchIdentifier && !exactCatalogMatch && !busy) runIdentifier(); }}
                    placeholder="Search by SKU / title, or paste an ASIN / UPC…"
                    aria-label="Search SKUs or research an identifier"
                  />
                  {selectedSku && (
                    <button className="btn ghost sm" onClick={() => { setSelectedSku(''); setSkuSearch(''); }}>
                      Manual item
                    </button>
                  )}
                </div>

                {searchFocused && !skuSearch.trim() && runs.length > 0 && (
                  <div className="research-recent-dropdown">
                    <div className="research-recent-head">Recent research</div>
                    {runs.slice(0, 6).map((run) => {
                      const input = (run.input || {}) as Record<string, any>;
                      const label = input.sku || input.asin || input.identifier || run.publicId || run.id;
                      return (
                        <button
                          key={run.id}
                          className="research-recent-item"
                          // onMouseDown (not onClick) so it fires before the input's blur closes the dropdown.
                          onMouseDown={(e) => { e.preventDefault(); openRun(run.id); }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div className="mono strong" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                            <div className="research-muted">{String(run.runType).replace(/_/g, ' ')} · {run.publicId}</div>
                          </div>
                          <Chip tone={run.status === 'completed' ? 'green' : run.status === 'needs_data' ? 'amber' : 'blue'} dot={false}>{run.status.replace(/_/g, ' ')}</Chip>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {searchIdentifier && !exactCatalogMatch && (
                <button
                  className="btn primary"
                  style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}
                  onClick={runIdentifier}
                  disabled={busy}
                >
                  <Icon name="sparkle" size={14} /> {busy ? 'Researching…' : `Research ${searchIdentifier.kind} ${searchIdentifier.value} on Keepa`}
                </button>
              )}

              <div className="research-sku-list">
                {filteredSkus.length === 0 ? (
                  searchIdentifier ? (
                    <EmptyState>Not in your catalog yet — click “Research {searchIdentifier.kind}” above to pull it from Keepa via Cortex.</EmptyState>
                  ) : (
                    <EmptyState>No matching SKUs. Paste an ASIN/UPC to research a new product, or enter it manually below.</EmptyState>
                  )
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

      {activeResult && (
        <ProductResearchFullView
          row={activeResult}
          onClose={() => setActiveResult(null)}
          onListed={load}
        />
      )}

      <div className="research-bottom-grid">
        <div className="card research-history-card">
          <div className="card-header">
            <div>
              <div className="card-title">Research history &amp; results</div>
              <div className="card-subtitle">Every run — freshest first. Click any row for the full Keepa intelligence: verdict, charts, and list-to-marketplace.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {latestRun?.confidence != null && <Confidence value={latestRun.confidence} />}
              <Chip tone="purple" dot={false}>{historyRows.length} {historyRows.length === 1 ? 'entry' : 'entries'}</Chip>
            </div>
          </div>
          {historyRows.length === 0 ? (
            <EmptyState>No research yet. Search a SKU or paste an ASIN / UPC above to run your first analysis.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="data research-history-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Verdict</th>
                    <th className="num">Score</th>
                    <th className="num">Sales rank</th>
                    <th>Trend</th>
                    <th>Status</th>
                    <th className="num" aria-label="open" />
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((row) => (
                    <tr key={row.key} className="clickable" onClick={row.onOpen} style={{ cursor: 'pointer' }}>
                      <td>
                        <div className="research-history-product">
                          <Thumb image={row.image} size={34} />
                          <div style={{ minWidth: 0 }}>
                            <div className="mono strong" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.sku}</div>
                            <div className="research-muted">{row.title}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {row.verdict
                          ? <Chip tone={row.verdictTone as any} dot={false}>{row.verdict.toUpperCase()}</Chip>
                          : <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>—</span>}
                      </td>
                      <td className="num mono strong">{row.score != null ? row.score : '—'}</td>
                      <td className="num">{row.salesRank != null ? Number(row.salesRank).toLocaleString() : '—'}</td>
                      <td>{row.spark.length >= 2 ? <Sparkline data={row.spark} width={72} height={24} color="var(--purple)" fill /> : <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>—</span>}</td>
                      <td><Chip tone={row.statusTone as any} dot={false}>{row.statusLabel}</Chip></td>
                      <td className="num"><Icon name="chevron" size={14} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
