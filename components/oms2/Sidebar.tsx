import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import type { CurrentUser } from '../../lib/user';

export type NavItem = {
  id: string;
  label: string;
  icon: string;
  desc: string;
  badge?: { type: 'warn' | 'danger' | 'ai'; value: string };
};
export type NavCat = { id: string; label: string; icon: string; badge?: string; items: NavItem[] };

export const SIDEBAR_NAV: NavCat[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'cockpit',
    items: [{ id: 'command', label: 'Command Center', icon: 'cockpit', desc: 'Live operating cockpit' }],
  },
  {
    id: 'optimize',
    label: 'Optimize',
    icon: 'double',
    badge: 'Plan',
    items: [
      { id: 'double', label: 'Business Double', icon: 'double', desc: 'Current vs. optimized — accept plan here' },
      { id: 'plan', label: 'Inventory Plan', icon: 'studio', desc: '6-month dynamic forward plan' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: 'inventory',
    items: [
      { id: 'skus', label: 'SKUs', icon: 'box', desc: 'Every product, every warehouse' },
      { id: 'suppliers', label: 'Suppliers', icon: 'tag', desc: 'Vendor terms, lead times, ratings' },
      { id: 'shipments', label: 'Shipment Plans', icon: 'shipments', desc: 'Inbound to warehouses' },
      { id: 'heatmap', label: 'US Heatmap', icon: 'map', desc: 'Demand & warehouse coverage' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: 'orders',
    badge: '12',
    items: [
      { id: 'orders', label: 'Orders', icon: 'orders', desc: 'Marketplace orders + WMS truth', badge: { type: 'warn', value: '12' } },
      { id: 'customers', label: 'Customers', icon: 'support', desc: 'Buyers, LTV, segments' },
      { id: 'labels', label: 'Carrier Label Audit', icon: 'audit', desc: 'Late, refunds, optimization' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: 'billing',
    items: [
      { id: 'billing', label: 'Billing & Profit', icon: 'billing', desc: 'Current vs. optimized cost' },
      { id: 'audits', label: 'Audits & Claims', icon: 'audit', desc: 'Refund opportunities' },
    ],
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    icon: 'grid',
    items: [{ id: 'marketplace', label: 'Marketplace', icon: 'grid', desc: 'Install AI bots & widgets' }],
  },
  {
    id: 'system',
    label: 'System',
    icon: 'settings',
    items: [
      { id: 'support', label: 'Support', icon: 'support', desc: 'Tickets', badge: { type: 'danger', value: '3' } },
      { id: 'connections', label: 'Connections', icon: 'plug', desc: 'Marketplaces, WMS, carriers' },
      { id: 'ledger', label: 'Intelligence Ledger', icon: 'ledger', desc: 'Source → finding → action' },
    ],
  },
];

const SidebarPanel = ({
  cat,
  active,
  onNavigate,
  onClose,
}: {
  cat: NavCat;
  active: string;
  onNavigate: (id: string) => void;
  onClose: () => void;
}) => (
  <div className="sb-panel fade-in">
    <div className="sb-panel-head">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="sb-panel-icon">
          <Icon name={cat.icon} size={14} />
        </div>
        <div>
          <div className="sb-panel-label">{cat.label}</div>
          <div className="sb-panel-sub">
            {cat.items.length} {cat.items.length === 1 ? 'page' : 'pages'}
          </div>
        </div>
      </div>
      <button className="icon-btn" onClick={onClose} data-hint="Close">
        <Icon name="x" size={14} />
      </button>
    </div>
    <div className="sb-panel-items">
      {cat.items.map((it) => (
        <button
          key={it.id}
          className={`sb-panel-item ${active === it.id ? 'active' : ''}`}
          onClick={() => onNavigate(it.id)}
        >
          <Icon name={it.icon} size={14} className="sb-panel-item-icon" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sb-panel-item-label">{it.label}</div>
            {it.desc && <div className="sb-panel-item-desc">{it.desc}</div>}
          </div>
          {it.badge && <span className={`nav-item-badge ${it.badge.type}`}>{it.badge.value}</span>}
        </button>
      ))}
    </div>
  </div>
);

export const Sidebar = ({
  active,
  onNavigate,
  onInteract,
  user,
}: {
  active: string;
  onNavigate: (id: string) => void;
  onInteract?: () => void;
  user?: CurrentUser | null;
}) => {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!openCat) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.sidebar-rail') && !t.closest('.sb-panel')) setOpenCat(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenCat(null);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [openCat]);

  const activeCat = SIDEBAR_NAV.find((c) => c.items.some((it) => it.id === active))?.id;

  const handleCatClick = (cat: NavCat) => {
    onInteract?.();
    if (cat.items.length === 1) {
      onNavigate(cat.items[0].id);
      setOpenCat(null);
    } else {
      setOpenCat(openCat === cat.id ? null : cat.id);
    }
  };

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const email = user?.email || '';
  const displayName = fullName || email || 'Account';
  const initialsSource = fullName || email.split('@')[0] || 'UC';
  const initials = initialsSource
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'UC';

  return (
    <>
      <aside className="sidebar-rail" ref={railRef}>
        <div className="sb-brand">
          <div className="brand-mark">U</div>
        </div>

        <nav className="sb-nav">
          {SIDEBAR_NAV.map((cat) => (
            <button
              key={cat.id}
              className={`sb-item ${activeCat === cat.id ? 'active' : ''} ${openCat === cat.id ? 'expanded' : ''}`}
              onClick={() => handleCatClick(cat)}
              data-hint={cat.label}
            >
              <Icon name={cat.icon} size={18} />
              <span className="sb-label">{cat.label}</span>
              {cat.badge && <span className="sb-badge">{cat.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="sb-footer">
          <button className="sb-item" data-hint="Help">
            <Icon name="info" size={18} />
            <span className="sb-label">Help</span>
          </button>
          <button className="sb-item avatar-btn" data-hint={displayName}>
            <div className="avatar">
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}
            </div>
          </button>
        </div>
      </aside>

      {openCat ? (
        <SidebarPanel
          cat={SIDEBAR_NAV.find((c) => c.id === openCat)!}
          active={active}
          onNavigate={(id) => {
            onNavigate(id);
            setOpenCat(null);
          }}
          onClose={() => setOpenCat(null)}
        />
      ) : null}
    </>
  );
};
