import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { SiteShell } from '../components/marketing/SiteShell';
import { apiUrl } from '../lib/api';

const AuditMap = dynamic(() => import('../components/marketing/AuditMap'), {
  ssr: false,
  loading: () => <div className="uc-leaflet" aria-busy="true" />,
});

type Step = 1 | 2 | 'scanning' | 3;

type AuditBand = { low: number; base: number; high: number };
type AuditProduct = {
  title: string;
  price?: string | null;
  variants?: number | null;
  ship_zone?: string | null;
  source?: 'known' | 'inferred' | 'needs' | string;
  image_url?: string | null;
  weight?: string | null;
  dimensions?: string | null;
  weight_lb?: number | null;
  dimensions_in?: { length?: number | null; width?: number | null; height?: number | null } | null;
};
type AuditOrigin = { zip: string; state: string };
type ZoneEstimate = { zone: number; low: number; base: number; high: number };
type NetworkNode = {
  id?: string;
  name?: string;
  postal?: string | null;
  state?: string | null;
  max_trailer_length_ft?: number | null;
  loading_equipment?: string[];
  loading_dock_style?: string[];
};
type NetworkScenario = {
  node_count?: number;
  nodes?: NetworkNode[];
  per_order?: Record<string, number>;
  monthly?: Record<string, number>;
  service_components?: Record<string, any>;
};
type NetworkComparison = {
  node_source?: string;
  assumptions?: any;
  warehouse_nodes_consumed?: NetworkNode[];
  single_origin?: NetworkScenario;
  multi_node?: NetworkScenario;
  estimated_monthly_savings?: number;
  estimated_monthly_delta?: number;
  recommendation?: string;
};

type ReportData = {
  reference: string;
  status: string;
  website: string;
  company?: string | null;
  orders: number | null;
  origins: AuditOrigin[];
  originStates: string[];
  proposedStates: string[];
  products: number;
  conf: number;
  pp: AuditBand;
  lbl: AuditBand;
  ppMk: number;
  lblMk: number;
  sampleProducts: AuditProduct[];
  zoneEstimates: ZoneEstimate[];
  blockers: string[];
  sourceLabels: Record<string, string>;
  nextActions: string[];
  networkComparison?: NetworkComparison | null;
  ltlServices?: any;
  monthlyProjection?: {
    orders?: number;
    low?: number;
    base?: number;
    high?: number;
    annualized_base?: number;
    proposed_region_savings_base?: number;
  } | null;
};

const SRC_LABEL = { known: 'From website', inferred: 'Cortex inferred', needs: 'Needs data' };

const Stepper = ({ active }: { active: 1 | 2 | 3 }) => {
  const item = (n: number, lbl: string) => {
    const cls = active > n ? 'done' : active === n ? 'active' : '';
    return (
      <div className={`st ${cls}`}>
        <span className="dot">{active > n ? '✓' : n}</span>
        <span className="lbl">{lbl}</span>
      </div>
    );
  };
  return (
    <div className="stepper">
      {item(1, 'Your store')}<span className={`bar ${active > 1 ? 'fill' : ''}`} />
      {item(2, 'Supplier origins & data')}<span className={`bar ${active > 2 ? 'fill' : ''}`} />
      {item(3, 'Report')}
    </div>
  );
};

export default function AuditPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [url, setUrl] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [origins, setOrigins] = useState<string[]>(['']);
  const [csvName, setCsvName] = useState('');
  const [csvRows, setCsvRows] = useState(0);
  const [orders, setOrders] = useState('');
  const [category, setCategory] = useState('');
  const [scanStep, setScanStep] = useState(0);
  const [report, setReport] = useState<ReportData | null>(null);
  const [scanError, setScanError] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Continuation from the landing page (Step 1): prefill inputs and jump to Step 2.
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query;
    const s = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
    const qUrl = s(q.url); const qCompany = s(q.company); const qEmail = s(q.email);
    const qOrders = s(q.orders); const qZip = s(q.zip);
    if (q.step === '2' || qUrl || qZip || qOrders) {
      if (qUrl) setUrl(qUrl.replace(/^https?:\/\//, ''));
      if (qCompany) setCompany(qCompany);
      if (qEmail) setEmail(qEmail);
      if (qOrders) setOrders(qOrders);
      if (qZip) setOrigins([qZip]);
      setStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  const scrollTop = () => { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* */ } };

  const cleanUrl = (v: string) => (v || 'your-store.com').replace(/^https?:\/\//, '');
  const validOrigins = origins.filter(Boolean);
  const originCount = validOrigins.length || 1;

  // ---- Step transitions ----
  const goStep2 = () => { setUrl(cleanUrl(url)); setStep(2); scrollTop(); };

  const marker = (band: AuditBand) => {
    const span = Math.max(0.01, band.high - band.low);
    return Math.min(88, Math.max(12, ((band.base - band.low) / span) * 76 + 12));
  };

  const normalizeReport = (raw: any): ReportData => {
    const pp = raw?.pick_pack_band || { low: 0, base: 0, high: 0 };
    const lbl = raw?.label_band || { low: 0, base: 0, high: 0 };
    const originRows: AuditOrigin[] = Array.isArray(raw?.origins) ? raw.origins : [];
    const originStates = Array.from(new Set(originRows.map((o) => o.state).filter(Boolean)));
    return {
      reference: String(raw?.reference || ''),
      status: String(raw?.status || 'completed'),
      website: String(raw?.website || cleanUrl(url)),
      company: raw?.company || company || null,
      orders: Number(raw?.monthly_projection?.orders || parseInt((orders || '').replace(/[^0-9]/g, ''), 10)) || null,
      origins: originRows,
      originStates: originStates.length ? originStates : ['CA'],
      proposedStates: Array.isArray(raw?.proposed_regions) ? raw.proposed_regions : [],
      products: Number(raw?.product_count || 0),
      conf: Number(raw?.confidence || 0),
      pp,
      lbl,
      ppMk: marker(pp),
      lblMk: marker(lbl),
      sampleProducts: Array.isArray(raw?.sample_products) ? raw.sample_products : [],
      zoneEstimates: Array.isArray(raw?.zone_estimates) ? raw.zone_estimates : [],
      blockers: Array.isArray(raw?.blockers) ? raw.blockers : [],
      sourceLabels: raw?.source_labels || {},
      nextActions: Array.isArray(raw?.next_actions) ? raw.next_actions : [],
      networkComparison: raw?.network_comparison || null,
      ltlServices: raw?.ltl_services || null,
      monthlyProjection: raw?.monthly_projection || null,
    };
  };

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const pollAudit = async (reference: string) => {
    for (let i = 0; i < 8; i += 1) {
      const res = await fetch(apiUrl(`/api/v1/public/website-catalog-audit/${encodeURIComponent(reference)}`));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || data?.error || 'Catalog audit lookup failed');
      if (!['queued', 'running', 'processing'].includes(String(data?.status || '').toLowerCase())) {
        return data;
      }
      await wait(1000);
    }
    throw new Error('Catalog audit timed out. Please try again in a moment.');
  };

  const runScan = async () => {
    setScanError('');
    setReport(null);
    setScanStep(0);
    setStep('scanning');
    scrollTop();
    try {
      if (!url.trim()) throw new Error('Enter a website URL before running the audit.');
      setScanStep(1);
      await wait(250);
      const payload = {
        website: cleanUrl(url),
        company,
        email,
        origins: validOrigins,
        origin_context: 'manufacturer_supplier_distribution_zip',
        csv: csvName ? { filename: csvName, row_count: csvRows } : null,
        monthly_orders: orders,
        category,
        page_path: '/audit',
      };
      setScanStep(2);
      const res = await fetch(apiUrl('/api/v1/public/website-catalog-audit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || data?.error || 'Catalog audit failed');
      setScanStep(3);
      const finalData = ['queued', 'running', 'processing'].includes(String(data?.status || '').toLowerCase())
        ? await pollAudit(data.reference)
        : data;
      setScanStep(4);
      await wait(250);
      setReport(normalizeReport(finalData));
      setStep(3);
      scrollTop();
    } catch (err: any) {
      setScanError(err?.message || 'Catalog audit failed. Please try again.');
      setScanStep(0);
    }
  };

  // ---- origins + csv handlers ----
  const setOriginAt = (i: number, v: string) => setOrigins((arr) => arr.map((o, idx) => (idx === i ? v : o)));
  const addOrigin = () => setOrigins((arr) => [...arr, '']);
  const removeOrigin = (i: number) => setOrigins((arr) => arr.filter((_, idx) => idx !== i));

  const handleCsv = (file: File) => {
    setCsvName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setCsvRows(Math.max(0, (text.match(/\n/g) || []).length));
    };
    reader.onerror = () => setCsvRows(0);
    reader.readAsText(file.slice(0, 2_000_000));
  };

  // ================= RENDER =================
  return (
    <SiteShell variant="audit" footer={false}>
      <Head><title>Free Catalog Audit — UnieConnect</title></Head>
      <main className="audit-stage">
        {step === 1 && (
          <>
            <Stepper active={1} />
            <div className="step-wrap">
              <div className="step-head">
                <span className="eyebrow"><span className="dot" /> Free Catalog Audit</span>
                <h1>See Your Fulfillment Cost in <span className="grad-text">60 Seconds</span></h1>
                <p>Drop in your store URL and we&apos;ll scan your public catalog.</p>
              </div>
              <div className="step-card">
                <div className="field">
                  <label>Website URL</label>
                  <div className="url-input">
                    <span className="pre">https://</span>
                    <input type="text" placeholder="your-store.com" value={url}
                      onChange={(e) => setUrl(e.target.value)} />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field"><label>Company</label>
                    <input type="text" placeholder="Acme Goods" value={company} onChange={(e) => setCompany(e.target.value)} /></div>
                  <div className="field"><label>Work email</label>
                    <input type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                </div>
                <div className="step-actions">
                  <button className="btn btn-primary btn-lg" onClick={goStep2}>Continue <span aria-hidden="true">→</span></button>
                </div>
                <p className="optional-note">Robots.txt-aware · catalog pages only · no checkout scraping</p>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Stepper active={2} />
            <div className="step-wrap">
              <div className="step-head">
                <span className="eyebrow"><span className="dot" /> Step 2 · Supplier origins &amp; data</span>
                <h1>Where does inventory enter your <span className="grad-text">U.S. network?</span></h1>
                <p>Add the manufacturer, supplier, prep center, 3PL, or warehouse ZIPs where products start moving into U.S. distribution. Multiple ZIPs are expected if inventory comes from more than one place.</p>
              </div>
              <div className="step-card">
                <div className="field">
                  <label>Manufacturer / supplier origin ZIPs <span className="opt-tag">(U.S. ZIPs, add all that apply)</span></label>
                  <p className="field-help">Use the ZIP code for the location that releases inventory into fulfillment: supplier dock, manufacturer, prep center, 3PL, or current warehouse. Cortex uses these ZIPs to model zone exposure and possible warehouse placement.</p>
                  <div className="origins">
                    {origins.map((z, i) => (
                      <div className="origin-row" key={i}>
                        <input type="text" placeholder={`Origin ZIP ${i + 1} · supplier / manufacturer / warehouse`} value={z}
                          inputMode="numeric" onChange={(e) => setOriginAt(i, e.target.value)} />
                        {origins.length > 1 && (
                          <button className="rm" aria-label="Remove" onClick={() => removeOrigin(i)}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button className="add-origin" onClick={addOrigin}>+ Add another supplier or warehouse ZIP</button>
                </div>

                <div className="field">
                  <label>Shipped orders — last 3 months <span className="opt-tag">(CSV, optional)</span></label>
                  <div
                    className={`drop ${csvName ? 'has-file' : ''} ${dragOver ? 'over' : ''}`}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleCsv(e.dataTransfer.files[0]); }}
                  >
                    <div className="di">{csvName ? '✓' : '⬆'}</div>
                    <div className="dt">{csvName || 'Drop your order export here or click to browse'}</div>
                    <div className="ds">{csvName
                      ? `${csvRows.toLocaleString()} rows detected · used to weight real shipping zones`
                      : 'CSV up to 50MB · order date, ship-to ZIP, weight, carrier'}</div>
                    <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                      onChange={(e) => { if (e.target.files?.[0]) handleCsv(e.target.files[0]); }} />
                  </div>
                </div>

                <div className="field-row">
                  <div className="field"><label>Monthly orders <span className="opt-tag">(optional)</span></label>
                    <input type="text" placeholder="e.g. 4,200" value={orders} onChange={(e) => setOrders(e.target.value)} /></div>
                  <div className="field"><label>Primary category <span className="opt-tag">(optional)</span></label>
                    <input type="text" placeholder="Home & kitchen" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
                </div>

                <div className="step-actions">
                  <button className="btn btn-ghost btn-lg" style={{ flex: '0 0 auto' }} onClick={() => { setStep(1); scrollTop(); }}>← Back</button>
                  <button className="btn btn-primary btn-lg" onClick={runScan}>Run catalog audit</button>
                </div>
                <p className="optional-note">Scanning <b style={{ color: 'var(--text-2)' }}>{cleanUrl(url)}</b></p>
              </div>
            </div>
          </>
        )}

        {step === 'scanning' && (
          <>
            <Stepper active={2} />
            <div className="scanning">
              <h2>Auditing {cleanUrl(url)}</h2>
              <div className="su">This takes about a minute. Hang tight.</div>
              <div className="scan-prog">
                {[
                  'Validating URL · robots.txt',
                  csvName ? `Reading ${csvName} · weighting real zones` : 'Crawling catalog + product pages',
                  'Cortex estimating pick/pack + labels',
                  `Modeling ${originCount} supplier/distribution origin${originCount > 1 ? 's' : ''}`,
                ].map((label, idx) => {
                  const cls = scanStep > idx + 1 ? 'done' : scanStep === idx + 1 ? 'active' : '';
                  return (
                    <div className={`scan-step ${cls}`} key={idx}>
                      <span className="sdot">{scanStep > idx + 1 ? '✓' : ''}</span> {label}
                    </div>
                  );
                })}
              </div>
              {scanError && (
                <div className="scan-error">
                  <b>Audit could not run.</b>
                  <span>{scanError}</span>
                  <button className="btn btn-ghost" onClick={() => { setStep(2); setScanError(''); scrollTop(); }}>Back to audit inputs</button>
                </div>
              )}
            </div>
          </>
        )}

        {step === 3 && report && (
          <Report
            report={report}
            url={cleanUrl(url)}
            company={company}
            csvName={csvName}
            csvRows={csvRows}
            onRedo={() => { setStep(1); scrollTop(); }}
          />
        )}
      </main>
    </SiteShell>
  );
}

// ================= REPORT =================
function Report({ report, url, company, csvName, csvRows, onRedo }: {
  report: ReportData; url: string; company: string; csvName: string; csvRows: number; onRedo: () => void;
}) {
  const { orders, origins, originStates, proposedStates, products, conf, pp, lbl, ppMk, lblMk, blockers, sourceLabels, sampleProducts, zoneEstimates, monthlyProjection, nextActions } = report;
  const originN = origins.length || 1;
  const print = () => window.print();
  const displayUrl = (report.website || url).replace(/^https?:\/\//, '');
  const catalogSource = sourceLabels.catalog === 'json_ld_or_product_pages' ? 'catalog crawl' : sourceLabels.catalog || 'catalog evidence';
  const orderSource = sourceLabels.orders === 'csv_weighted' ? 'boosted by CSV' : 'add CSV to raise';
  const network = report.networkComparison;
  const single = network?.single_origin;
  const multi = network?.multi_node;
  const fmtMoney = (n: any, digits = 0) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
  const fmtPer = (n: any) => `$${Number(n || 0).toFixed(2)}`;
  const serviceTiers = multi?.service_components?.ltl_linehaul?.service_tiers || report.ltlServices?.service_tiers || {};

  return (
    <>
      <Stepper active={3} />
      <div className="report-wrap">
        <div className="report-bar">
          <div className="rt">
            <span className={`src-chip ${report.status === 'blocked' ? 'needs' : 'known'}`}>✓ {report.status === 'blocked' ? 'Limited scan' : 'Scan complete'}</span>
            <div>
              <h1>{report.company || company || displayUrl}</h1>
              <div className="meta">
                Cortex audit {report.reference} · {displayUrl} · {products} products · {originN} supplier/distribution origin{originN > 1 ? 's' : ''}
                {csvName ? ` · ${csvRows.toLocaleString()} orders analyzed` : ''}
              </div>
            </div>
          </div>
          <div className="report-cta">
            <button className="btn btn-ghost" onClick={onRedo}>Run another</button>
            <button className="btn btn-ghost" onClick={print}>⬇ Download PDF</button>
            <Link className="btn btn-primary" href="/#demo">Book a demo</Link>
          </div>
        </div>

        <div className="report">
          <div className="report-summary">
            <div className="rs"><div className="l">Store</div><div className="n" style={{ fontSize: 16, fontFamily: 'var(--sans)' }}>{displayUrl}</div><div className="s">{catalogSource}</div></div>
            <div className="rs"><div className="l">Products</div><div className="n">{products}</div><div className="s">sample (capped)</div></div>
            <div className="rs"><div className="l">Confidence</div><div className="n">{conf}%</div><div className="s">{orderSource}</div></div>
            <div className="rs"><div className="l">Pick/pack · base</div><div className="n">${pp.base.toFixed(2)}</div><div className="s">per order</div></div>
            <div className="rs"><div className="l">Label · base</div><div className="n">${lbl.base.toFixed(2)}</div><div className="s">per order</div></div>
          </div>

          {/* ---- Real US heatmap + warehouse coverage ---- */}
          <div className="map-card">
            <div className="rh">
              <span>Demand &amp; warehouse coverage</span>
              <div className="map-legend2">
                <span><span className="mk" style={{ background: 'rgba(139,92,255,0.7)' }} /> Demand</span>
                <span><span className="ring" /> Supplier origin</span>
                <span><span className="ringG" /> Proposed node</span>
              </div>
            </div>
            <div className="map-body">
              <AuditMap originStates={originStates} proposedStates={proposedStates} />
              <div className="map-aside">
                <div className="origin-list-mini">
                  {origins.length ? origins.map((origin, i) => (
                    <div className="o" key={i}>
                      <span className="pin" style={{ background: '#a586ff' }} /> Supplier origin {i + 1} · ZIP {origin.zip}{' '}
                      <span style={{ color: 'var(--text-3)' }}>({origin.state || '?'})</span>
                    </div>
                  )) : (
                    <div className="o"><span className="pin" style={{ background: '#a586ff' }} /> No Cortex-confirmed origins yet</div>
                  )}
                  {proposedStates.map((s) => (
                    <div className="o" key={s}>
                      <span className="pin" style={{ border: '2px solid #36e0a8', background: 'transparent' }} /> Proposed node · {s}
                    </div>
                  ))}
                </div>
                <div className="ai-rec">
                  <div className="hd">✦ Cortex recommendation</div>
                  <div className="tx">
                    {proposedStates.length ? (
                      <>Adding a node in <b>{proposedStates.join(' & ')}</b> moves inventory closer to unserved
                      demand — modeled from the public catalog, supplied supplier/manufacturer ZIPs, and any CSV evidence attached to this audit.</>
                    ) : (
                      <>Cortex needs supplier/manufacturer origin ZIPs and order data before recommending an additional fulfillment region.</>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="report-cols">
            <div className="band">
              <div className="bt"><span>Pick &amp; pack</span><span className="src-chip inferred">Cortex inferred</span></div>
              <div className="big">${pp.base.toFixed(2)}<span>/ order</span></div>
              <div className="track"><div className="rng" /><div className="mk" style={{ left: `${ppMk}%` }} /></div>
              <div className="ends"><span>low ${pp.low}</span><span>high ${pp.high}</span></div>
              <div className="note">Modeled from item size tiers and packaging assumptions.</div>
            </div>
            <div className="band">
              <div className="bt"><span>Shipping label</span><span className={`src-chip ${csvName ? 'known' : 'inferred'}`}>{csvName ? 'From your CSV' : 'Cortex inferred'}</span></div>
              <div className="big">${lbl.base.toFixed(2)}<span>/ order</span></div>
              <div className="track"><div className="rng" /><div className="mk" style={{ left: `${lblMk}%` }} /></div>
              <div className="ends"><span>low ${lbl.low}</span><span>high ${lbl.high}</span></div>
              <div className="note">{csvName
                ? `Weighted by ${csvRows.toLocaleString()} real shipped orders across ${originN} supplier/distribution origin${originN > 1 ? 's' : ''}.`
                : `Modeled across ${originN} supplier/distribution origin${originN > 1 ? 's' : ''} and zones 2–8.`}</div>
            </div>
            <div className="band" style={{ padding: 0 }}>
              <div className="bt" style={{ padding: '20px 20px 0' }}><span>Missing-data blockers</span><span className="src-chip needs">{blockers.length} found</span></div>
              <div className="blockers">
                {blockers.length ? blockers.map((blocker, idx) => (
                  <div className="bl" key={blocker}>
                    <span className="sev" style={{ background: idx === 0 ? 'var(--red)' : idx === 1 ? 'var(--amber)' : 'var(--text-3)' }} />
                    <div>
                      <div className="bt" style={{ fontSize: '12.5px', margin: 0 }}>{blocker.split(';')[0]}</div>
                      <div className="bd">{idx === 0 ? 'Highest confidence blocker for this teaser report' : 'Improves the next Cortex audit pass'}</div>
                    </div>
                  </div>
                )) : (
                  <div className="bl"><span className="sev" style={{ background: '#36e0a8' }} /><div><div className="bt" style={{ fontSize: '12.5px', margin: 0 }}>No public blockers found</div><div className="bd">Connect private data for executable SKU-level recommendations.</div></div></div>
                )}
              </div>
            </div>
          </div>

          {orders && (
            <div className="scenario">
              <div className="sc"><div className="l">At {orders.toLocaleString()} orders / mo</div><div className="n">{products} products</div></div>
              <div className="sc"><div className="l">Monthly (base)</div><div className="n">${Number(monthlyProjection?.base || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></div>
              <div className="sc"><div className="l">Monthly range</div><div className="n">${(Number(monthlyProjection?.low || 0) / 1000).toFixed(1)}k–${(Number(monthlyProjection?.high || 0) / 1000).toFixed(1)}k</div></div>
              <div className="sc"><div className="l">Saved w/ proposed node{proposedStates.length > 1 ? 's' : ''}</div><div className="n g">${Number(monthlyProjection?.proposed_region_savings_base || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</div></div>
            </div>
          )}

          {network && single && multi && (
            <div className="next-actions">
              <div className="rh">
                <span>Single warehouse vs Cortex multi-node model</span>
                <span className="src-chip inferred">{String(network.node_source || 'cortex nodes').replace(/_/g, ' ')}</span>
              </div>
              <div className="report-cols" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: 12 }}>
                {[['Current single-origin', single], ['Cortex multi-node', multi]].map(([label, scenario]: any) => (
                  <div className="band" key={label}>
                    <div className="bt"><span>{label}</span><span className="src-chip known">{scenario.node_count || 0} node{scenario.node_count === 1 ? '' : 's'}</span></div>
                    <div className="big">{fmtPer(scenario.per_order?.total)}<span>/ order</span></div>
                    <div className="note">Monthly modeled total: <b>{fmtMoney(scenario.monthly?.total)}</b></div>
                    <div className="blockers" style={{ padding: 0, borderTop: '1px solid var(--line)' }}>
                      <div className="bl"><span className="sev" style={{ background: '#a586ff' }} /><div><div className="bt" style={{ fontSize: '12.5px', margin: 0 }}>Pick/pack {fmtPer(scenario.per_order?.pick_pack)}</div><div className="bd">Rate-card picking + packaging/routing/dispatch fees</div></div></div>
                      <div className="bl"><span className="sev" style={{ background: '#36e0a8' }} /><div><div className="bt" style={{ fontSize: '12.5px', margin: 0 }}>Parcel label {fmtPer(scenario.per_order?.parcel_label)}</div><div className="bd">Best Cortex carrier estimate from active node to 48-state demand proxy</div></div></div>
                      <div className="bl"><span className="sev" style={{ background: '#60a5fa' }} /><div><div className="bt" style={{ fontSize: '12.5px', margin: 0 }}>Inbound receiving {fmtPer(scenario.per_order?.inbound_receiving)}</div><div className="bd">ASN + unit receive + pallet-share receiving fees</div></div></div>
                      <div className="bl"><span className="sev" style={{ background: '#f59e0b' }} /><div><div className="bt" style={{ fontSize: '12.5px', margin: 0 }}>LTL linehaul {fmtPer(scenario.per_order?.ltl_linehaul)}</div><div className="bd">Pallet-aware supplier-origin to warehouse-node transfer model</div></div></div>
                    </div>
                    <div className="origin-list-mini" style={{ marginTop: 12 }}>
                      {(scenario.nodes || []).slice(0, 4).map((node: NetworkNode) => (
                        <div className="o" key={`${node.id}-${node.postal}`}>
                          <span className="pin" style={{ border: '2px solid #36e0a8', background: 'transparent' }} />
                          {node.name || node.id} · ZIP {node.postal || '—'} {node.state ? `(${node.state})` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="scenario" style={{ marginTop: 12 }}>
                <div className="sc"><div className="l">Estimated monthly delta</div><div className={`n ${Number(network.estimated_monthly_delta || 0) > 0 ? 'g' : ''}`}>{fmtMoney(network.estimated_monthly_delta)}</div></div>
                <div className="sc"><div className="l">Modeled savings</div><div className="n g">{fmtMoney(network.estimated_monthly_savings)}</div></div>
                <div className="sc"><div className="l">Avg weight</div><div className="n">{Number(network.assumptions?.avg_weight_lb || 0).toFixed(1)} lb</div></div>
                <div className="sc"><div className="l">Avg package</div><div className="n">{Number(network.assumptions?.avg_dimensions_in?.length || 0).toFixed(0)}×{Number(network.assumptions?.avg_dimensions_in?.width || 0).toFixed(0)}×{Number(network.assumptions?.avg_dimensions_in?.height || 0).toFixed(0)} in</div></div>
              </div>
              {Object.keys(serviceTiers).length > 0 && (
                <div className="next-grid" style={{ marginTop: 12 }}>
                  {Object.entries(serviceTiers).map(([tier, value]: any) => (
                    <div className="next-card" key={tier}>
                      <span>{tier.slice(0, 2).toUpperCase()}</span>
                      {tier}: {fmtMoney(value.monthly)} / mo · {value.note}
                    </div>
                  ))}
                </div>
              )}
              <div className="disc" style={{ marginTop: 12 }}>{network.recommendation}</div>
            </div>
          )}

          <div className="report-2col">
            <div className="report-table-wrap">
              <div className="rh"><span>Sample discovered products</span><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>{products} total · {sampleProducts.length} shown</span></div>
              <table className="rtable">
                <thead><tr><th>Product</th><th>Price</th><th>Size / weight</th><th>Source</th></tr></thead>
                <tbody>
                  {sampleProducts.length ? sampleProducts.map((product) => {
                    const source = ['known', 'inferred', 'needs'].includes(String(product.source)) ? String(product.source) as keyof typeof SRC_LABEL : 'inferred';
                    return (
                      <tr key={product.title}>
                        <td className="pn">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {product.image_url ? (
                              <img src={product.image_url} alt="" loading="lazy" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel-2)' }} />
                            ) : (
                              <div style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel-2)' }} />
                            )}
                            <span>{product.title}</span>
                          </div>
                        </td>
                        <td className="mono">{product.price || '—'}</td>
                        <td className="mono">
                          <div>{product.dimensions || 'dimensions needed'}</div>
                          <div style={{ color: 'var(--text-3)', fontSize: 12 }}>{product.weight || (product.weight_lb ? `${product.weight_lb} lb` : 'weight needed')}</div>
                        </td>
                        <td><span className={`src-chip ${source}`}>{SRC_LABEL[source]}</span></td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={4}>Cortex did not find public product records. Connect marketplace data or upload a CSV.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="report-table-wrap">
              <div className="rh"><span>Estimated label cost by zone</span><span className={`src-chip ${csvName ? 'known' : 'inferred'}`}>{csvName ? 'From your CSV' : 'Cortex inferred'}</span></div>
              <table className="rtable">
                <thead><tr><th>Zone</th><th className="num">Low</th><th className="num">Base</th><th className="num">High</th></tr></thead>
                <tbody>
                  {zoneEstimates.map((z) => (
                    <tr key={z.zone}><td className="mono">Zone {z.zone}</td><td className="num mono">${z.low.toFixed(2)}</td><td className="num mono pn">${z.base.toFixed(2)}</td><td className="num mono">${z.high.toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {nextActions.length > 0 && (
            <div className="next-actions">
              <div className="rh"><span>Cortex next actions</span><span className="src-chip inferred">From audit engine</span></div>
              <div className="next-grid">
                {nextActions.map((action, idx) => (
                  <div className="next-card" key={action}><span>{String(idx + 1).padStart(2, '0')}</span>{action}</div>
                ))}
              </div>
            </div>
          )}

          <div className="report-foot">
            <div className="disc">Estimate bands only — exact costs require SKU dimensions and carrier/marketplace data. Website data is discovered evidence, not execution-ready truth.</div>
            <div className="report-cta">
              <button className="btn btn-ghost btn-lg" onClick={print}>⬇ Download PDF</button>
              <Link className="btn btn-primary btn-lg" href="/oms">Open full SKU-level report →</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
