import React from 'react';
import { Icon } from './icons';

export const TITLE_MAP: Record<string, [string, string]> = {
  command: ['Command Center', 'Live operating cockpit'],
  double: ['Business Double', 'Current vs. optimized — single approval surface'],
  plan: ['Inventory Plan', '6-month dynamic AI plan'],
  'product-research': ['Product Research', 'Cortex enrichment for individual products and CSV catalogs'],
  skus: ['SKUs', 'Every product, every warehouse'],
  warehouses: ['Warehouses', 'Inventory, WMS activity, and Cortex signals'],
  'sku-detail': ['SKU detail', 'History, billing, channels, shipments'],
  orders: ['Orders', 'Marketplace orders enriched with WMS'],
  customers: ['Customers', 'Unified buyer profiles + LTV'],
  suppliers: ['My Suppliers', 'Vendors, terms, shipment plans'],
  shipments: ['Shipment Plans', 'Inbound plans & receipt status'],
  heatmap: ['US Heatmap', 'Demand & warehouse coverage'],
  labels: ['Carrier Label Audit', 'Late deliveries & refund opportunities'],
  marketplace: ['Marketplace', 'AI bots, automations, and widgets'],
  billing: ['Billing & Profit', 'Current vs optimized cost'],
  audits: ['Audits & Claims', 'Autonomous refund opportunities'],
  support: ['Support', 'Tickets tied to real entities'],
  connections: ['Connections', 'Marketplaces, WMS, Cortex, carriers'],
  ledger: ['Intelligence Ledger', 'Source → finding → action → outcome'],
  profile: ['Profile Settings', 'Account, billing, and security'],
};

export const TopBar = ({
  section,
  copilotOpen,
  onToggleCopilot,
  theme,
  onToggleTheme,
  onOpenProfile,
}: {
  section: string;
  copilotOpen: boolean;
  onToggleCopilot: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenProfile?: () => void;
}) => {
  const [title] = TITLE_MAP[section] || ['', ''];
  return (
    <header className="topbar">
      <div className="crumbs">
        <span className="crumb">Unielogics ops</span>
        <span className="crumb-sep">/</span>
        <span className="crumb current">{title}</span>
        <span className="crumb-status">
          <span className="dot" />
          All systems live
        </span>
      </div>

      <div className="topbar-search">
        <Icon name="search" className="search-icon" />
        <input placeholder="Search SKUs, orders, ASNs, invoices, tickets…" />
        <kbd>⌘K</kbd>
      </div>

      <button
        className="icon-btn"
        data-hint={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        onClick={onToggleTheme}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>
      <button className="icon-btn" data-hint="Notifications">
        <Icon name="bell" />
        <span className="pip" />
      </button>
      <button className="icon-btn" data-hint="Settings" onClick={onOpenProfile}>
        <Icon name="settings" />
      </button>

      <button className={`copilot-btn ${copilotOpen ? 'active' : ''}`} onClick={onToggleCopilot}>
        <span className="ai-dot" />
        Copilot
      </button>
    </header>
  );
};
