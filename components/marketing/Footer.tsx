import React from 'react';
import Link from 'next/link';
import { Logo } from './Logo';

/** Marketing footer. Anchor links target sections on the landing page (`/#id`). */
export const Footer = () => (
  <footer className="footer">
    <div className="wrap">
      <div className="footer-grid">
        <div>
          <Link href="/#top" className="brand"><Logo /> UnieConnect</Link>
          <p className="footer-disclaimer">
            The AI-powered command center for ecommerce operations. Designed to connect
            marketplaces, APIs, and warehouses nationwide into one operating layer. Feature
            availability may vary by connected platform and warehouse partner.
          </p>
        </div>
        <div>
          <h4>Platform</h4>
          <Link href="/#command">Command Center</Link>
          <Link href="/#integrations">Integrations</Link>
          <Link href="/#network">Warehouse Network</Link>
          <Link href="/#cortex">Cortex AI</Link>
        </div>
        <div>
          <h4>Solutions</h4>
          <Link href="/#marketplace">Marketplace Layer</Link>
          <Link href="/#shipping">Shipping &amp; Fulfillment</Link>
          <Link href="/audit">Free Catalog Audit</Link>
          <Link href="/oms">Open the App</Link>
        </div>
        <div>
          <h4>Company</h4>
          <Link href="/#demo">Book a Demo</Link>
          <Link href="/#why">How it Works</Link>
          <Link href="/#different">Why Different</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Unielogics. All rights reserved.</span>
        <span>Built for the future of ecommerce fulfillment control.</span>
      </div>
    </div>
  </footer>
);
