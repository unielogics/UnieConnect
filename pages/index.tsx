import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { TOKEN_KEY } from '../lib/api';
import { SiteShell } from '../components/marketing/SiteShell';

// ---------------- Dashboard tab data (ported from landing.js) ----------------
type DashTab = { kpis: [string, string, string][]; rows: [string, string, string, string][] };
const DASH: Record<string, DashTab> = {
  Overview: { kpis: [['Revenue 7d', '$1.24M', '+9.7%'], ['Orders', '12,108', '+6.4%'], ['Gross profit', '$426k', '+11.8%'], ['AI savings 30d', '$184k', '+$24k']], rows: [['Optimized plan ready · rev 14', '92% conf', 'v', 'Review'], ['Autonomous actions today', '18 run', 'g', 'Live'], ['Stockout risk · OBL-02413', '11 days', 'a', 'In plan']] },
  Orders: { kpis: [['Orders 14d', '28,412', '+12.4%'], ['At-risk SLA', '23', '+4'], ['Exceptions', '8', '−3'], ['Avg cost', '$8.42', '−$0.41']], rows: [['AMZ-058214 · Cascade 32oz', 'ATL1', 'g', 'Shipped'], ['SHP-058244 · Helix Band', 'ONT3', 'a', 'At risk'], ['EBY-058261 · Mesa Skillet', 'DFW2', 'v', 'Picking']] },
  Inventory: { kpis: [['SKUs tracked', '26', '+4'], ['At risk <14d', '7', '−2'], ['On-hand value', '$1.42M', '−$28k'], ['Avg placement', '73', '+9']], rows: [['UC-02400 · 32oz Bottle', '1,240u', 'a', '11d cover'], ['MTC-02426 · Skillet', '3,210u', 'g', '71d cover'], ['FLX-02452 · Band Set', '640u', 'v', 'Rebalance']] },
  Warehouses: { kpis: [['Active nodes', '6', 'live'], ['Inbound ASNs', '8', '2 today'], ['Avg util', '68%', '+4pp'], ['Dock-to-stock', '4.2d', '−0.4d']], rows: [['ATL1 · Atlanta DC', '78% util', 'g', 'Live'], ['ONT3 · Ontario CA', '89% util', 'a', 'Capacity warn'], ['ORD5 · Chicago IL', '54% util', 'g', 'Live']] },
  Shipping: { kpis: [['Labels 14d', '28,412', '+12%'], ['On-time rate', '96.8%', '+1.4pp'], ['Avg label cost', '$8.10', '−$0.62'], ['Refunds found', '$24.2k', '90d']], rows: [['UPS Ground · zone-optimized', '−$0.48/order', 'g', 'Active'], ['Late deliveries flagged', '23 · refundable', 'a', 'Auditing'], ['Carrier rate refresh · 3 lanes', '−$0.18/lb', 'v', 'Applied']] },
  'Cortex AI': { kpis: [['Open recs', '12', '5 high'], ['Confidence', '92%', 'calibrated'], ['Est. savings', '$51.5k', 'this plan'], ['Brier 90d', '0.094', '↓ better']], rows: [['Rebalance ONT3 → ATL1+EWR4', '+$18.4k', 'v', 'Recommend'], ['Bump PO-77412 +28%', 'prevent stockout', 'v', 'Recommend'], ['UPS dim-weight reclass ×14', '+$1.24k', 'g', 'Auto-filed']] },
  Ledger: { kpis: [['Events 24h', '412', 'logged'], ['AI actions', '186', 'auto'], ['Operator approvals', '6', 'today'], ['Disputes filed', '14', '$4.8k']], rows: [['Cortex:Net-Opt-v3 · rebalance', '09:14', 'v', 'Recommend'], ['TMS · re-routed 12 parcels', '09:02', 'g', 'Executed'], ['Operator · approved plan rev 13', '07:58', 'g', 'Approval']] },
  APIs: { kpis: [['Connections', '12', 'healthy'], ['Webhooks 24h', '8,402', 'ok'], ['API keys', '7', 'scoped'], ['Sync lag', '0.4s', 'p50']], rows: [['Amazon SP-API', '2 min ago', 'g', 'Healthy'], ['Shopify · main store', '47s ago', 'g', 'Healthy'], ['eBay US', 'token 7d', 'a', 'Renew soon']] },
};
const TABS = Object.keys(DASH);

// ---------------- Multi-warehouse optimization matrix ----------------
const WH = ['ATL1', 'DFW2', 'ONT3', 'EWR4', 'ORD5', 'SEA6'];
const MWO_ROWS = [
  { name: 'Cascade Hydration Bottle 32oz', sku: 'UC-02400', costs: [6.20, 7.10, 9.40, 6.80, 7.60, 9.10] },
  { name: 'Northwind Performance Tee', sku: 'OBL-02413', costs: [4.90, 4.40, 6.10, 5.20, 4.80, 6.40] },
  { name: 'Mesa Cast Iron Skillet 12"', sku: 'MTC-02426', costs: [12.40, 11.80, 10.90, 13.10, 11.40, 10.60] },
  { name: 'Helix Resistance Band Set', sku: 'FLX-02452', costs: [5.60, 5.10, 6.80, 5.90, 4.70, 7.20] },
  { name: 'Nimbus Memory Foam Pillow', sku: 'NMB-PLW', costs: [8.10, 8.60, 7.40, 8.90, 8.20, 7.10] },
];

// ---------------- Hooks: scroll reveal + count-up ----------------
function useScrollFx(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const reveals = Array.from(document.querySelectorAll('.uc-site .reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.14 });
    reveals.forEach((el) => io.observe(el));

    const counters = Array.from(document.querySelectorAll<HTMLElement>('.uc-site [data-count]'));
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;
        const target = parseFloat(el.dataset.count || '0');
        const suffix = el.dataset.suffix || '';
        const prefix = el.dataset.prefix || '';
        const dur = 1400; const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          const val = target * eased;
          el.textContent = prefix + (target % 1 === 0 ? Math.round(val).toLocaleString() : val.toFixed(1)) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        cio.unobserve(el);
      });
    }, { threshold: 0.5 });
    counters.forEach((el) => cio.observe(el));

    return () => { io.disconnect(); cio.disconnect(); };
  }, [active]);
}

export default function Home() {
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Marketing site lives on the apex; the app lives on user.unieconnect.com.
    if (window.location.hostname === 'user.unieconnect.com') {
      setRedirecting(true);
      const token = localStorage.getItem(TOKEN_KEY);
      window.location.href = token ? '/oms' : '/login';
    }
  }, []);

  useScrollFx(!redirecting);

  if (redirecting) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#07040e' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Redirecting…</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>UnieConnect — The AI-Powered Command Center for Ecommerce Operations</title>
        <meta name="description" content="UnieConnect centralizes your sales channels, warehouse network, inventory, shipping, fulfillment, billing events, and AI recommendations into one command center." />
      </Head>
      <SiteShell variant="full">
        <LandingContent />
      </SiteShell>
    </>
  );
}

function LandingContent() {
  const [tab, setTab] = useState('Overview');
  return (
    <>
      {/* ============ HERO ============ */}
      <header className="hero" id="top">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow reveal"><span className="dot" /> AI-Powered OMS · Marketplace · Command Center</span>
            <h1 className="reveal d1">Before AI, Ecommerce Operations Were Scattered. Now They Run From <span className="grad-text">One Command Center.</span></h1>
            <p className="hero-sub reveal d2">UnieConnect centralizes your sales channels, warehouse network, inventory, shipping, fulfillment activity, billing events, and AI recommendations into one dashboard — so sellers can operate nationwide without losing control.</p>
            <div className="hero-ctas reveal d3">
              <a className="btn btn-primary btn-lg" href="#demo">Book a Demo</a>
              <Link className="btn btn-ghost btn-lg" href="/oms">Explore the Command Center →</Link>
            </div>
            <div className="hero-trust reveal d4">
              <span><span className="tick">✓</span> Connect Shopify, Amazon, eBay &amp; APIs</span>
              <span><span className="tick">✓</span> Built to connect warehouses nationwide</span>
              <span><span className="tick">✓</span> Cortex AI with human approval</span>
            </div>
          </div>

          <div className="cc-mock reveal d2">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <linearGradient id="line" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#8b5cff" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#8b5cff" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              <path id="p1" d="M15 18 L50 50" stroke="url(#line)" strokeWidth="0.5" fill="none" />
              <path id="p2" d="M74 14 L50 50" stroke="url(#line)" strokeWidth="0.5" fill="none" />
              <path id="p3" d="M8 52 L50 50" stroke="url(#line)" strokeWidth="0.5" fill="none" />
              <path id="p4" d="M17 85 L50 50" stroke="url(#line)" strokeWidth="0.5" fill="none" />
              <path id="p5" d="M75 85 L50 50" stroke="url(#line)" strokeWidth="0.5" fill="none" />
              <path id="p6" d="M80 50 L50 50" stroke="url(#line)" strokeWidth="0.5" fill="none" />
              {['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((p, i) => (
                <circle className="flow-dot" r="1.1" key={p}>
                  <animateMotion dur={`${2.4 + i * 0.25}s`} repeatCount="indefinite"><mpath href={`#${p}`} /></animateMotion>
                </circle>
              ))}
            </svg>
            <div className="orbit-chip" style={{ left: '15%', top: '18%', animationDelay: '0s' }}><span className="ic" style={{ background: '#f59e0b' }}>A</span> Amazon</div>
            <div className="orbit-chip" style={{ left: '74%', top: '14%', animationDelay: '.6s' }}><span className="ic" style={{ background: '#10b981' }}>S</span> Shopify</div>
            <div className="orbit-chip" style={{ left: '8%', top: '52%', animationDelay: '1.1s' }}><span className="ic" style={{ background: '#3157f6' }}>e</span> eBay</div>
            <div className="orbit-chip" style={{ left: '17%', top: '85%', animationDelay: '1.5s' }}><span className="ic" style={{ background: '#6d3fff' }}>{'{}'}</span> API</div>
            <div className="orbit-chip" style={{ left: '75%', top: '85%', animationDelay: '.9s' }}><span className="ic" style={{ background: '#46e0ff', color: '#063' }}>▣</span> WMS</div>
            <div className="orbit-chip" style={{ left: '80%', top: '50%', animationDelay: '1.8s' }}><span className="ic" style={{ background: '#ff5fa8' }}>⌂</span> Warehouse</div>
            <div className="cc-center">
              <div className="cc-center-head">
                <span className="d" style={{ background: '#ff5f57' }} /><span className="d" style={{ background: '#febc2e' }} /><span className="d" style={{ background: '#28c840' }} />
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>command center</span>
              </div>
              <div className="cc-bar"><i /></div>
              <div className="cc-bar" style={{ width: '80%' }}><i style={{ animationDelay: '.4s' }} /></div>
              <div className="cc-mini-cards">
                <div className="cc-mini"><div className="n">$184k</div><div className="l">AI savings</div></div>
                <div className="cc-mini"><div className="n">6</div><div className="l">warehouses</div></div>
                <div className="cc-mini"><div className="n">12,108</div><div className="l">orders 7d</div></div>
                <div className="cc-mini"><div className="n">92%</div><div className="l">confidence</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ============ BEFORE / AFTER ============ */}
      <section className="section" id="why">
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow"><span className="dot" /> The Transformation</span>
            <h2 className="section-title">The Difference Between Running Operations Manually and Running Them With AI</h2>
          </div>
          <div className="ba-grid">
            <div className="ba-col ba-before reveal">
              <div className="ba-tag b">● Before AI</div>
              <div className="ba-h">Scattered, reactive, manual</div>
              <div className="ba-list">
                {['Orders trapped across marketplaces', 'Warehouse updates scattered in emails and portals', 'Inventory decisions made too late', 'Shipping and fulfillment handled separately', 'No central view of nationwide activity', 'Growth decisions depend on spreadsheets', 'Sellers react after problems happen'].map((t) => (
                  <div className="ba-item" key={t}><span className="mk">✕</span> {t}</div>
                ))}
              </div>
            </div>
            <div className="ba-col ba-after reveal d2">
              <div className="ba-tag a">● After AI with UnieConnect</div>
              <div className="ba-h">Centralized, proactive, intelligent</div>
              <div className="ba-list">
                {['Every marketplace connected', 'Every warehouse visible', 'Inventory centralized across locations', 'Fulfillment status updated in one dashboard', 'APIs extend the system into any workflow', 'Cortex AI recommends better actions', 'Sellers approve smarter decisions before problems grow'].map((t) => (
                  <div className="ba-item" key={t}><span className="mk">✓</span> {t}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ COMMAND CENTER ============ */}
      <section className="section" id="command">
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow"><span className="dot" /> The Command Center</span>
            <h2 className="section-title">One Dashboard for Every Channel, Warehouse, Order, and Decision</h2>
            <p className="section-sub">Orders, SKUs, inventory, warehouses, shipping, billing events, and AI recommendations are no longer scattered across disconnected tools. They are centralized into one operating dashboard.</p>
          </div>

          <div className="dash reveal d1">
            <div className="dash-top">
              <span className="tl"><i style={{ background: '#ff5f57' }} /><i style={{ background: '#febc2e' }} /><i style={{ background: '#28c840' }} /></span>
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>app.unielogics.com</span>
            </div>
            <div className="dash-tabs">
              {TABS.map((t) => (
                <button key={t} className={`dash-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>
            <div className="dash-body">
              <div className="dash-kpis">
                {DASH[tab].kpis.map(([l, n, c]) => (
                  <div className="dk" key={l}><div className="l">{l}</div><div className="n">{n}</div><div className="c up">{c}</div></div>
                ))}
              </div>
              <div className="dash-rows">
                {DASH[tab].rows.map(([a, b, pill, c]) => (
                  <div className="drow" key={a}><span>{a}</span><span className="mono">{b}</span><span className={`pill ${pill}`}>{c}</span><span style={{ color: 'var(--text-3)', fontSize: 11 }}>›</span></div>
                ))}
              </div>
            </div>
          </div>

          <div className="fcards reveal d2" style={{ marginTop: 24 }}>
            {[['▤', 'Unified order management', "Every channel's orders in one queue with WMS fulfillment truth."], ['◫', 'Cross-channel inventory', 'One source of truth across every warehouse and SKU.'], ['▦', 'Warehouse activity', 'Live monitoring of receiving, picking, and movement.'], ['➤', 'Fulfillment tracking', 'Shipment status updated in one place, not five portals.'], ['$', 'Billing & profit visibility', 'Reconcile WMS charges against expected costs.'], ['✦', 'AI recommendations', 'Cortex proposes actions; you approve the plan.'], ['▣', 'Execution ledger', 'An auditable record of every action and decision.'], ['{ }', 'API-connected workflows', 'Extend the system into any external process.']].map(([ic, h, p]) => (
              <div className="fcard" key={h}><div className="ic">{ic}</div><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ INTEGRATIONS ============ */}
      <section className="section" id="integrations">
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow"><span className="dot" /> Marketplace + API Flexibility</span>
            <h2 className="section-title">Connect Marketplaces, Custom Workflows, and External Systems</h2>
            <p className="section-sub">Connect standard marketplaces, power custom workflows with APIs, and bring operational data into one system — without locking the seller into one rigid process.</p>
          </div>
          <div className="intg-wall reveal d1">
            {[['#10b981', 'S', 'Shopify'], ['#f59e0b', 'a', 'Amazon SP-API'], ['#3157f6', 'e', 'eBay'], ['#6d3fff', '{}', 'REST APIs'], ['#46e0ff', '▣', 'WMS', '#063'], ['#ff5fa8', '3', '3PL partners'], ['#8b5cff', '▶', 'Shippo'], ['#22c55e', 'K', 'Keepa'], ['#0ea5e9', '◉', 'Geoapify'], ['#f97316', '▲', 'AWS']].map(([bg, gl, nm, color]) => (
              <div className="intg" key={nm}><span className="glint" /><div className="logo" style={{ background: bg, color: color || '#fff' }}>{gl}</div><div className="nm">{nm}</div></div>
            ))}
          </div>
          <div className="fcards c3 reveal d2" style={{ marginTop: 24 }}>
            {[['Product, order & inventory sync', 'Keep catalogs, orders, and stock aligned across connected channels.'], ['API keys with scoped permissions', 'Grant precise, revocable access for each integration and workflow.'], ['Webhook-ready architecture', 'Built to react to events and extend into custom and external systems.']].map(([h, p]) => (
              <div className="fcard" key={h}><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ WAREHOUSE NETWORK ============ */}
      <section className="section" id="network">
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow"><span className="dot" /> Nationwide Warehouse Network</span>
            <h2 className="section-title">Add Warehouses to Your Command Center and Operate Nationwide</h2>
            <p className="section-sub">Designed to connect warehouses nationwide and built to centralize warehouse activity. Add warehouse partners into your command center instead of opening new facilities or chasing updates manually.</p>
          </div>
          <div className="map-wrap">
            <div className="map-stage reveal d1">
              <svg viewBox="0 0 100 72" aria-hidden="true">
                <defs>
                  <radialGradient id="hub" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#a586ff" /><stop offset="100%" stopColor="#6d3fff" />
                  </radialGradient>
                </defs>
                <g stroke="url(#line)" strokeWidth="0.4" fill="none">
                  <path id="w1" d="M18 20 L50 36" /><path id="w2" d="M30 52 L50 36" />
                  <path id="w3" d="M72 18 L50 36" /><path id="w4" d="M82 46 L50 36" />
                  <path id="w5" d="M64 58 L50 36" /><path id="w6" d="M22 40 L50 36" />
                </g>
                {[['w1', '2.6s'], ['w3', '3.0s'], ['w4', '2.3s'], ['w5', '3.3s']].map(([w, d]) => (
                  <circle className="flow-dot" r="0.9" key={w}><animateMotion dur={d} repeatCount="indefinite"><mpath href={`#${w}`} /></animateMotion></circle>
                ))}
                <g className="wh-node">
                  {[[18, 20, '2.5s'], [30, 52, '3s'], [72, 18, '2.2s'], [82, 46, '2.8s'], [64, 58, '3.2s'], [22, 40, '2.6s']].map(([cx, cy, dur], i) => (
                    <circle cx={cx} cy={cy} r="2" key={i}><animate attributeName="r" values="2;2.8;2" dur={dur as string} repeatCount="indefinite" /></circle>
                  ))}
                </g>
                <circle cx="50" cy="36" r="5.5" fill="url(#hub)" />
                <circle cx="50" cy="36" r="5.5" fill="none" stroke="#a586ff" strokeWidth="0.5" opacity="0.6"><animate attributeName="r" values="5.5;9;5.5" dur="3s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite" /></circle>
                <text x="50" y="37.4" textAnchor="middle" fontSize="2.6" fill="#fff" fontFamily="Inter" fontWeight="600">YOU</text>
              </svg>
            </div>
            <div className="map-legend reveal d2">
              <div className="map-stat"><span className="n" data-count="6">0</span><span className="t">warehouse nodes connectable into one view</span></div>
              <div className="map-stat"><span className="n" data-count="50">0</span><span className="t">states reachable from a flexible footprint</span></div>
              <div className="map-stat"><span className="n" data-count="1" data-suffix=" dashboard">0</span><span className="t">to monitor inventory, ASNs &amp; billing across the network</span></div>
              <div className="ai-place-card">
                <div className="hd">✦ Cortex recommendation</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Move 340 units closer to Northeast demand</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-2)' }}>Placing inventory at EWR4 cuts average delivery 1.4 days and reduces blended freight cost.</div>
              </div>
            </div>
          </div>
          <div className="fcards reveal d3" style={{ marginTop: 30 }}>
            {[['Connect multiple locations', 'Bring warehouse partners into one command center.'], ['Inventory across warehouses', 'Live snapshots and movement in a single view.'], ['Order status by location', 'Track fulfillment activity per node.'], ['Inbound ASN monitoring', 'Watch shipments land and reconcile receipts.'], ['Warehouse billing events', 'See charges and track disputes in context.'], ['Charge dispute tracking', 'Surface variances and recover overcharges.'], ['Live inventory snapshots', "Know what's where, when it matters."], ['Network performance', 'Centralize warehouse performance metrics.']].map(([h, p]) => (
              <div className="fcard" key={h}><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ MULTI-WAREHOUSE OPTIMIZATION ============ */}
      <section className="section" id="optimize">
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow"><span className="dot" /> Multi-Warehouse Optimization</span>
            <h2 className="section-title">For Every Product, Cortex Finds the Warehouse That Drops Shipping Cost the Most</h2>
            <p className="section-sub">The same SKU costs more to ship from the wrong node. Cortex models per-product, per-warehouse landed cost across your network and routes each product to its cheapest, fastest origin — automatically.</p>
          </div>
          <div className="mwo-card reveal d1">
            <div className="mwo-head">
              <div className="t"><span style={{ color: 'var(--violet-bright)' }}>✦</span> Per-product cost by warehouse <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>· est. label + handling / order</span></div>
              <div className="mwo-legend">
                <span><span className="sw" style={{ background: 'linear-gradient(135deg,rgba(54,224,168,0.5),rgba(139,92,255,0.5))', border: '1px solid rgba(54,224,168,0.6)' }} /> Optimal warehouse</span>
                <span><span className="sw" style={{ background: 'rgba(255,138,138,0.4)' }} /> Most expensive</span>
              </div>
            </div>
            <div className="mwo-scroll">
              <table className="mwo-table">
                <thead>
                  <tr>
                    <th className="prod-h">Product</th>
                    <th>ATL1<span className="wh-util">Southeast</span></th>
                    <th>DFW2<span className="wh-util">S. Central</span></th>
                    <th>ONT3<span className="wh-util">West</span></th>
                    <th>EWR4<span className="wh-util">Northeast</span></th>
                    <th>ORD5<span className="wh-util">Midwest</span></th>
                    <th>SEA6<span className="wh-util">Pac. NW</span></th>
                    <th style={{ borderLeft: '1px solid var(--hair)' }}>Best · saves</th>
                  </tr>
                </thead>
                <tbody>
                  {MWO_ROWS.map((r) => {
                    const min = Math.min(...r.costs); const max = Math.max(...r.costs);
                    const bestWh = WH[r.costs.indexOf(min)];
                    const save = max - min; const pct = Math.round((save / max) * 100);
                    return (
                      <tr key={r.sku}>
                        <td className="mwo-prod"><div className="pn">{r.name}</div><div className="ps">{r.sku}</div></td>
                        {r.costs.map((c, i) => {
                          const cls = c === min ? 'best' : c === max ? 'worst' : '';
                          return (
                            <td className={`mwo-cell ${cls}`} key={i}>
                              <span className="val">${c.toFixed(2)}</span>
                              {c === min && <span className="tag">{bestWh}</span>}
                            </td>
                          );
                        })}
                        <td className="mwo-save"><div className="amt">−${save.toFixed(2)}</div><div className="pct">{pct}% vs worst</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mwo-foot">
              <div style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 560 }}>Routing each SKU to its optimal node instead of a single default warehouse cuts blended shipping cost across this sample by</div>
              <div className="big"><span className="g">−18.4%</span> &nbsp;<span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 400 }}>≈ $41,200 / mo at current volume</span></div>
            </div>
          </div>
          <div className="mwo-side reveal d2">
            {[['⊞', 'Per-SKU, per-node modeling', 'Dim-weight, zone, handling and storage tier scored for every product at every warehouse.'], ['➤', 'Auto-routes to the cheapest origin', 'Once you approve the plan, orders flow to the optimal node without manual rules.'], ['↻', 'Re-optimizes as demand shifts', 'When regional demand or rates change, the optimal node updates — and so does the plan.']].map(([ic, h, p]) => (
              <div className="fcard" key={h}><div className="ic">{ic}</div><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ OMS + WMS ============ */}
      <section className="section" id="omswms">
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow"><span className="dot" /> OMS + WMS Relationship</span>
            <h2 className="section-title">The OMS Knows the Business. The WMS Validates the Operation.</h2>
            <p className="section-sub">The OMS holds the commercial data: orders, products, demand, channels, customers, costs, inventory expectations. The WMS validates what&apos;s physically happening. Together they create a feedback loop that makes the AI smarter.</p>
          </div>
          <div className="flow reveal d1">
            {[['01', 'Marketplace Data', 'Orders, listings, demand flow in from every channel.', true], ['02', 'OMS Baseline', 'The commercial source of truth and expectations.', true], ['03', 'Warehouse Execution', 'Receiving, picking, packing, shipping happen.', true], ['04', 'WMS Validation', 'Physical activity and billing events confirmed.', true], ['05', 'Cortex AI', 'Compares expectation vs execution, finds gaps.', true], ['06', 'Approved Action', 'Seller approves the recommended next move.', false]].map(([num, h, p, arr]) => (
              <div className="flow-step" key={num as string}><div className="num">{num}</div><h3>{h}</h3><p>{p}</p>{arr && <span className="arr">›</span>}</div>
            ))}
          </div>
          <div className="fcards c5 reveal d2" style={{ marginTop: 24 }}>
            {[['OMS baseline', 'Creates the business expectation.'], ['WMS truth', 'Confirms physical warehouse activity.'], ['Cortex compares', 'Expectation vs execution, continuously.'], ['One place', 'Recommendations land in your dashboard.'], ['Compounding', 'Better data creates better decisions over time.']].map(([h, p]) => (
              <div className="fcard" key={h}><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CORTEX AI ============ */}
      <section className="section" id="cortex">
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow"><span className="dot" /> Cortex AI</span>
            <h2 className="section-title">AI That Watches the Operation, Finds the Gaps, and Recommends the Next Move</h2>
            <p className="section-sub">Cortex does not replace the operator. It analyzes marketplace activity, inventory, warehouse activity, supplier data, shipping costs, and fulfillment patterns, then recommends actions with confidence scores and estimated impact.</p>
          </div>
          <div className="rec-stack reveal d1">
            <div className="rec">
              <div className="top"><span className="pill v">Inventory placement</span><span className="conf"><span className="bars"><i style={{ height: 4 }} /><i style={{ height: 7 }} /><i style={{ height: 10 }} /><i style={{ height: 13 }} /></span> 92%</span></div>
              <h3>Move 340 units closer to Northeast demand</h3>
              <p>Rebalance inventory toward EWR4 to capture rising regional demand.</p>
              <div className="impact"><div><div className="l">Est. impact</div><div className="v g">+$18.4k</div></div><div><div className="l">SLA</div><div className="v">−1.4d</div></div></div>
              <div className="acts"><button className="approve">Approve</button><button className="reject">Reject</button></div>
            </div>
            <div className="rec">
              <div className="top"><span className="pill a">Supplier risk</span><span className="conf" style={{ color: 'var(--amber)' }}><span className="bars"><i style={{ height: 4, background: 'var(--amber)' }} /><i style={{ height: 7, background: 'var(--amber)' }} /><i style={{ height: 10, background: 'var(--amber)' }} /><i style={{ height: 13, background: 'rgba(255,255,255,.15)' }} /></span> 78%</span></div>
              <h3>Supplier delay risk detected</h3>
              <p>Meridian Textiles on-time rate dropped to 81%. Reorder earlier to protect cover.</p>
              <div className="impact"><div><div className="l">Avoids</div><div className="v g">$12.3k</div></div><div><div className="l">Lead time</div><div className="v">42d</div></div></div>
              <div className="acts"><button className="approve">Approve</button><button className="reject">Reject</button></div>
            </div>
            <div className="rec">
              <div className="top"><span className="pill v">Margin</span><span className="conf"><span className="bars"><i style={{ height: 4 }} /><i style={{ height: 7 }} /><i style={{ height: 10 }} /><i style={{ height: 13 }} /></span> 88%</span></div>
              <h3>SKU margin leak found</h3>
              <p>Freight share on Helix Band Set up 2.3pp. Add a closer node to recover margin.</p>
              <div className="impact"><div><div className="l">Est. impact</div><div className="v g">+$9.8k</div></div><div><div className="l">Margin</div><div className="v">+2.1pp</div></div></div>
              <div className="acts"><button className="approve">Approve</button><button className="reject">Reject</button></div>
            </div>
          </div>
          <div className="fcards c5 reveal d2" style={{ marginTop: 24 }}>
            {[['Inventory placement', 'Where to position stock.'], ['Pricing & SKU optimization', 'Surface margin opportunities.'], ['Supplier & billing audits', 'Catch risk and overcharges.'], ['Carrier audit', 'Recover refunds on late labels.'], ['Human approval workflow', 'You approve every move.']].map(([h, p]) => (
              <div className="fcard" key={h}><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ MARKETPLACE LAYER ============ */}
      <section className="section" id="marketplace">
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow"><span className="dot" /> Marketplace Layer</span>
            <h2 className="section-title">A Marketplace Built Around Fulfillment Flexibility</h2>
            <p className="section-sub">UnieConnect is also designed as a marketplace layer where sellers connect with warehouse capacity, fulfillment support, and operational services as the network grows — flexibility without giving up central control.</p>
          </div>
          <div className="mp-cards reveal d1">
            {[['Warehouse A', 'Available', 'g', '42%', 'Southeast', 'FBA prep · B2B', '4.2d'], ['Warehouse B', 'Preferred', 'v', '68%', 'West', 'Parcel · Kitting', '3.8d'], ['Warehouse C', 'Available', 'g', '55%', 'Midwest', 'LTL · Pallets', '3.5d']].map(([name, tag, pill, cap, region, svc, dts]) => (
              <div className="mp" key={name}>
                <div className="mp-h"><span className="mp-name">{name}</span><span className={`pill ${pill}`}>{tag}</span></div>
                <div className="cap">Available capacity</div>
                <div className="meter"><i style={{ width: cap as string }} /></div>
                <div className="row"><span>Region</span><span>{region}</span></div>
                <div className="row"><span>Services</span><span>{svc}</span></div>
                <div className="row"><span>Dock-to-stock</span><span>{dts}</span></div>
                <button className="mp-cta">Add to Command Center</button>
              </div>
            ))}
          </div>
          <div className="fcards reveal d2" style={{ marginTop: 24 }}>
            {[['Discover capacity', 'Find warehouse partners as you scale.'], ['Add partners', 'Bring nodes into one operating layer.'], ['Regional strategies', 'Support multi-region fulfillment.'], ['Stay in control', 'Reduce the need to open facilities.']].map(([h, p]) => (
              <div className="fcard" key={h}><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ SHIPPING ============ */}
      <section className="section" id="shipping">
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow"><span className="dot" /> Shipping &amp; Fulfillment</span>
            <h2 className="section-title">Shipping, Fulfillment, and Tracking Connected to the Same System</h2>
          </div>
          <div className="fcards c3 reveal d1">
            {[['◷', 'Carrier rate shopping', 'Compare service options before you ship.'], ['⌖', 'Address validation', 'Catch bad addresses before they cost you.'], ['▱', 'Shipment drafting', 'Build outbound shipments inside the system.'], ['➤', 'Tracking support', 'Follow shipments through to delivery.'], ['$', 'Cost visibility', 'See shipping cost in the same view as profit.'], ['↻', 'Warehouse-to-seller status', 'Fulfillment updates flow back automatically.']].map(([ic, h, p]) => (
              <div className="fcard" key={h}><div className="ic">{ic}</div><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ LEAD / AUDIT TOOL ============ */}
      <LeadSection />

      {/* ============ COMPARISON ============ */}
      <section className="section" id="different">
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow"><span className="dot" /> Why UnieConnect Is Different</span>
            <h2 className="section-title">Most OMS Platforms Manage Orders. UnieConnect Manages the Operation.</h2>
          </div>
          <div className="cmp">
            <div className="cmp-col cmp-trad reveal">
              <h3>Traditional OMS</h3>
              <div className="cmp-list">
                {['Tracks orders', 'Shows inventory', 'Depends on manual warehouse updates', 'Offers limited intelligence', 'Does not create a nationwide operating layer', 'Does not help build a flexible warehouse network'].map((t) => (
                  <div className="cmp-row" key={t}><span className="mk">–</span> {t}</div>
                ))}
              </div>
            </div>
            <div className="cmp-col cmp-uc reveal d2">
              <h3><span className="brand-mark" style={{ width: 26, height: 26, fontSize: 13 }}>U</span> UnieConnect</h3>
              <div className="cmp-list">
                {['Connects marketplaces, APIs & warehouse activity', 'Centralizes nationwide fulfillment', 'Feeds AI with real operational data', 'Recommends actions with confidence & impact', 'Lets sellers approve decisions before problems grow', 'Turns the OMS into a command center'].map((t) => (
                  <div className="cmp-row" key={t}><span className="mk">✓</span> {t}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="section" id="demo">
        <div className="wrap">
          <div className="final reveal">
            <span className="eyebrow"><span className="dot" /> Get Started</span>
            <h2 style={{ marginTop: 18 }}>Build Your AI-Powered Fulfillment Command Center</h2>
            <p>Connect your channels, APIs, warehouses, inventory, fulfillment activity, and AI recommendations into one system built for modern ecommerce operations.</p>
            <div className="final-ctas">
              <a className="btn btn-primary btn-lg" href="#audit">Book a Demo</a>
              <Link className="btn btn-ghost btn-lg" href="/oms">See the Platform →</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ---------------- Lead form / catalog audit teaser ----------------
function LeadSection() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [orders, setOrders] = useState('');
  const [zip, setZip] = useState('');

  // Step 1 of the audit wizard: collect the basics here, then continue into
  // Step 2 (origins & data) on the dedicated /audit page, carrying the inputs.
  const continueToAudit = (e: React.FormEvent) => {
    e.preventDefault();
    const query: Record<string, string> = { step: '2' };
    if (url.trim()) query.url = url.trim();
    if (company.trim()) query.company = company.trim();
    if (email.trim()) query.email = email.trim();
    if (orders.trim()) query.orders = orders.trim();
    if (zip.trim()) query.zip = zip.trim();
    router.push({ pathname: '/audit', query });
  };

  return (
    <section className="section" id="audit">
      <div className="wrap">
        <div className="lead reveal">
          <div className="lead-left">
            <span className="eyebrow"><span className="dot" /> Free Catalog Audit · Step 1 of 3</span>
            <h2 style={{ marginTop: 18 }}>See Your Fulfillment Cost in 60 Seconds</h2>
            <p>Start here. Drop in your store URL and we&apos;ll continue the audit — next you&apos;ll add your ship-from origins, then Cortex estimates pick/pack and shipping label cost bands and shows where a command center would save you money.</p>
            <div className="lead-feat">
              {['Detects your platform and product catalog', 'Estimate bands with confidence — no fake exact numbers', 'Full SKU-level report unlocks inside UnieConnect', 'Robots.txt-aware · catalog pages only · no checkout scraping'].map((t) => (
                <div className="li" key={t}><span className="tick">✓</span> {t}</div>
              ))}
            </div>
          </div>
          <div className="lead-right">
            <form onSubmit={continueToAudit}>
              <div className="field"><label>Website URL</label><input type="text" placeholder="your-store.com" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
              <div className="field-row">
                <div className="field"><label>Company</label><input type="text" placeholder="Acme Goods" value={company} onChange={(e) => setCompany(e.target.value)} /></div>
                <div className="field"><label>Work email</label><input type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              </div>
              <div className="field-row">
                <div className="field"><label>Monthly orders (optional)</label><input type="text" placeholder="e.g. 4,200" value={orders} onChange={(e) => setOrders(e.target.value)} /></div>
                <div className="field"><label>Ship-from ZIP (optional)</label><input type="text" placeholder="30301" value={zip} onChange={(e) => setZip(e.target.value)} /></div>
              </div>
              <button className="btn btn-primary btn-lg" type="submit" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}>
                Continue my free audit <span aria-hidden="true">→</span>
              </button>
            </form>
            <p className="optional-note" style={{ marginTop: 12 }}>Next: add your ship-from origins &amp; optional order CSV, then get your full report.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
