import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { SiteShell } from '../components/marketing/SiteShell';

const AuditMap = dynamic(() => import('../components/marketing/AuditMap'), {
  ssr: false,
  loading: () => <div className="uc-leaflet" aria-busy="true" />,
});

// ZIP first-digit → representative state (rough, for the demand map)
const ZIP_STATE: Record<string, string> = {
  '0': 'MA', '1': 'NY', '2': 'VA', '3': 'GA', '4': 'MI', '5': 'MN', '6': 'IL', '7': 'TX', '8': 'CO', '9': 'CA',
};

type Step = 1 | 2 | 'scanning' | 3;

type ReportData = {
  orders: number | null;
  validOrigins: string[];
  originStates: string[];
  proposedStates: string[];
  products: number;
  conf: number;
  pp: { low: number; base: number; high: number };
  lbl: { low: number; base: number; high: number };
  ppMk: number;
  lblMk: number;
};

const SAMPLE: [string, string, string, 'known' | 'inferred' | 'needs'][] = [
  ['Cascade Hydration Bottle 32oz', '$28.00', '4', 'known'],
  ['Northwind Performance Tee', '$32.00', '6', 'inferred'],
  ['Mesa Cast Iron Skillet 12"', '$54.00', '1', 'known'],
  ['Quartz Wireless Charger', '$39.00', '2', 'needs'],
  ['Lumen Aroma Diffuser', '$44.00', '3', 'known'],
  ['Atlas Leather Cardholder', '$35.00', '5', 'known'],
];
const SRC_LABEL = { known: 'From website', inferred: 'Cortex inferred', needs: 'Needs data' };
const ZONES = [2, 3, 4, 5, 6, 7, 8].map((z) => ({
  z, lo: (4.6 + z * 0.5).toFixed(2), base: (5.4 + z * 0.7).toFixed(2), hi: (6.8 + z * 1.0).toFixed(2),
}));

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
      {item(2, 'Origins & data')}<span className={`bar ${active > 2 ? 'fill' : ''}`} />
      {item(3, 'Report')}
    </div>
  );
};

export default function AuditPage() {
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
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const scrollTop = () => { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* */ } };

  const cleanUrl = (v: string) => (v || 'your-store.com').replace(/^https?:\/\//, '');
  const validOrigins = origins.filter(Boolean);
  const originCount = validOrigins.length || 1;

  // ---- Step transitions ----
  const goStep2 = () => { setUrl(cleanUrl(url)); setStep(2); scrollTop(); };

  const buildReport = (): ReportData => {
    const ordersNum = parseInt((orders || '').replace(/[^0-9]/g, ''), 10) || null;
    const vo = origins.filter(Boolean);
    const originStates = Array.from(
      new Set(vo.map((z) => ZIP_STATE[String(z).trim()[0]]).filter(Boolean)),
    ) as string[];
    if (originStates.length === 0) originStates.push('CA');
    const candidates = ['GA', 'TX', 'NJ', 'IL', 'NV', 'NC'].filter((s) => !originStates.includes(s));
    const proposedStates = candidates.slice(0, originStates.length >= 2 ? 1 : 2);
    const products = 80 + Math.floor(Math.random() * 180);
    const conf = (csvName ? 78 : 62) + Math.floor(Math.random() * 10);
    const pp = { low: 2.1, base: 3.4, high: 5.2 };
    const lbl = csvName ? { low: 5.2, base: 7.2, high: 10.1 } : { low: 5.8, base: 8.1, high: 12.4 };
    const ppMk = ((pp.base - pp.low) / (pp.high - pp.low)) * 76 + 12;
    const lblMk = ((lbl.base - lbl.low) / (lbl.high - lbl.low)) * 76 + 12;
    return { orders: ordersNum, validOrigins: vo, originStates, proposedStates, products, conf, pp, lbl, ppMk, lblMk };
  };

  const runScan = () => { setScanStep(0); setStep('scanning'); scrollTop(); };

  // Drive the scan animation, then reveal the report.
  useEffect(() => {
    if (step !== 'scanning') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const total = 4;
    let i = 0;
    const advance = () => {
      if (i < total) {
        setScanStep(i + 1);
        i += 1;
        timers.push(setTimeout(advance, 720 + Math.random() * 420));
      } else {
        setReport(buildReport());
        setStep(3);
        scrollTop();
      }
    };
    timers.push(setTimeout(advance, 500));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

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
                <span className="eyebrow"><span className="dot" /> Step 2 · Origins &amp; data</span>
                <h1>Where do you <span className="grad-text">ship from?</span></h1>
                <p>Add every location you ship from. Upload recent orders to sharpen the estimate.</p>
              </div>
              <div className="step-card">
                <div className="field">
                  <label>Ship-from locations <span className="opt-tag">(add all that apply)</span></label>
                  <div className="origins">
                    {origins.map((z, i) => (
                      <div className="origin-row" key={i}>
                        <input type="text" placeholder={`Ship-from ZIP ${i + 1}`} value={z}
                          inputMode="numeric" onChange={(e) => setOriginAt(i, e.target.value)} />
                        {origins.length > 1 && (
                          <button className="rm" aria-label="Remove" onClick={() => removeOrigin(i)}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button className="add-origin" onClick={addOrigin}>+ Add another origin</button>
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
                  `Optimizing across ${originCount} origin${originCount > 1 ? 's' : ''}`,
                ].map((label, idx) => {
                  const cls = scanStep > idx + 1 ? 'done' : scanStep === idx + 1 ? 'active' : '';
                  return (
                    <div className={`scan-step ${cls}`} key={idx}>
                      <span className="sdot">{scanStep > idx + 1 ? '✓' : ''}</span> {label}
                    </div>
                  );
                })}
              </div>
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
  const { orders, validOrigins, originStates, proposedStates, products, conf, pp, lbl, ppMk, lblMk } = report;
  const originN = validOrigins.length || 1;
  const print = () => window.print();

  return (
    <>
      <Stepper active={3} />
      <div className="report-wrap">
        <div className="report-bar">
          <div className="rt">
            <span className="src-chip known">✓ Scan complete</span>
            <div>
              <h1>{company || url}</h1>
              <div className="meta">
                Shopify detected · {url} · {products} products · {originN} origin{originN > 1 ? 's' : ''}
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
            <div className="rs"><div className="l">Store</div><div className="n" style={{ fontSize: 16, fontFamily: 'var(--sans)' }}>{url}</div><div className="s">Shopify · catalog crawl</div></div>
            <div className="rs"><div className="l">Products</div><div className="n">{products}</div><div className="s">sample (capped)</div></div>
            <div className="rs"><div className="l">Confidence</div><div className="n">{conf}%</div><div className="s">{csvName ? 'boosted by CSV' : 'add CSV to raise'}</div></div>
            <div className="rs"><div className="l">Pick/pack · base</div><div className="n">${pp.base.toFixed(2)}</div><div className="s">per order</div></div>
            <div className="rs"><div className="l">Label · base</div><div className="n">${lbl.base.toFixed(2)}</div><div className="s">per order</div></div>
          </div>

          {/* ---- Real US heatmap + warehouse coverage ---- */}
          <div className="map-card">
            <div className="rh">
              <span>Demand &amp; warehouse coverage</span>
              <div className="map-legend2">
                <span><span className="mk" style={{ background: 'rgba(139,92,255,0.7)' }} /> Demand</span>
                <span><span className="ring" /> Your origin</span>
                <span><span className="ringG" /> Proposed node</span>
              </div>
            </div>
            <div className="map-body">
              <AuditMap originStates={originStates} proposedStates={proposedStates} />
              <div className="map-aside">
                <div className="origin-list-mini">
                  {validOrigins.length ? validOrigins.map((z, i) => (
                    <div className="o" key={i}>
                      <span className="pin" style={{ background: '#a586ff' }} /> Origin {i + 1} · ZIP {z}{' '}
                      <span style={{ color: 'var(--text-3)' }}>({ZIP_STATE[String(z).trim()[0]] || '?'})</span>
                    </div>
                  )) : (
                    <div className="o"><span className="pin" style={{ background: '#a586ff' }} /> No origins entered — defaulting to CA</div>
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
                    Adding a node in <b>{proposedStates.join(' & ')}</b> moves inventory closer to unserved
                    demand — modeled <b>−16% blended label cost</b> and ~1.3 days faster delivery to those regions.
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
                ? `Weighted by ${csvRows.toLocaleString()} real shipped orders across ${originN} origin${originN > 1 ? 's' : ''}.`
                : `Modeled across ${originN} origin${originN > 1 ? 's' : ''} and zones 2–8.`}</div>
            </div>
            <div className="band" style={{ padding: 0 }}>
              <div className="bt" style={{ padding: '20px 20px 0' }}><span>Missing-data blockers</span><span className="src-chip needs">{csvName ? '2' : '3'} found</span></div>
              <div className="blockers">
                <div className="bl"><span className="sev" style={{ background: 'var(--red)' }} /><div><div className="bt" style={{ fontSize: '12.5px', margin: 0 }}>Dimensions / weight</div><div className="bd">Blocks dim-weight label accuracy</div></div></div>
                {!csvName && (
                  <div className="bl"><span className="sev" style={{ background: 'var(--amber)' }} /><div><div className="bt" style={{ fontSize: '12.5px', margin: 0 }}>No order history</div><div className="bd">Upload a CSV to weight real zones</div></div></div>
                )}
                <div className="bl"><span className="sev" style={{ background: 'var(--text-3)' }} /><div><div className="bt" style={{ fontSize: '12.5px', margin: 0 }}>Carrier contract rates</div><div className="bd">Connect carriers for exact pricing</div></div></div>
              </div>
            </div>
          </div>

          {orders && (
            <div className="scenario">
              <div className="sc"><div className="l">At {orders.toLocaleString()} orders / mo</div><div className="n">{products} products</div></div>
              <div className="sc"><div className="l">Monthly (base)</div><div className="n">${((pp.base + lbl.base) * orders).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></div>
              <div className="sc"><div className="l">Monthly range</div><div className="n">${((pp.low + lbl.low) * orders / 1000).toFixed(1)}k–${((pp.high + lbl.high) * orders / 1000).toFixed(1)}k</div></div>
              <div className="sc"><div className="l">Saved w/ proposed node{proposedStates.length > 1 ? 's' : ''}</div><div className="n g">${(((pp.base + lbl.base) * orders) * 0.16).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</div></div>
            </div>
          )}

          <div className="report-2col">
            <div className="report-table-wrap">
              <div className="rh"><span>Sample discovered products</span><span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>{products} total · {SAMPLE.length} shown</span></div>
              <table className="rtable">
                <thead><tr><th>Product</th><th>Price</th><th className="num">Variants</th><th>Source</th></tr></thead>
                <tbody>
                  {SAMPLE.map(([n, p, v, s]) => (
                    <tr key={n}><td className="pn">{n}</td><td className="mono">{p}</td><td className="num mono">{v}</td><td><span className={`src-chip ${s}`}>{SRC_LABEL[s]}</span></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="report-table-wrap">
              <div className="rh"><span>Estimated label cost by zone</span><span className={`src-chip ${csvName ? 'known' : 'inferred'}`}>{csvName ? 'From your CSV' : 'Cortex inferred'}</span></div>
              <table className="rtable">
                <thead><tr><th>Zone</th><th className="num">Low</th><th className="num">Base</th><th className="num">High</th></tr></thead>
                <tbody>
                  {ZONES.map((z) => (
                    <tr key={z.z}><td className="mono">Zone {z.z}</td><td className="num mono">${z.lo}</td><td className="num mono pn">${z.base}</td><td className="num mono">${z.hi}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
