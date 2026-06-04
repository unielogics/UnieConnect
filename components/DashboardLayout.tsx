import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Activity,
  BarChart3,
  Boxes,
  Brain,
  Building2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Command,
  Factory,
  History,
  Home,
  LogOut,
  Moon,
  PackageSearch,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Sun,
  Truck,
  Users,
  Warehouse,
  X,
  Zap,
} from 'lucide-react';
import { TOKEN_KEY } from '../lib/api';
import { canManageUsers, fetchCurrentUser, getRoleFromToken, type CurrentUser } from '../lib/user';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

type OmsSection = {
  id: string;
  label: string;
  icon: ReactNode;
  items: Array<{ label: string; href: string; description: string }>;
};

const sections: OmsSection[] = [
  {
    id: 'command',
    label: 'Command',
    icon: <Home size={20} />,
    items: [
      { label: 'Command Center', href: '/oms', description: 'Sales, risk, and autonomous activity' },
      { label: 'Business Double', href: '/oms?view=business', description: 'Current vs optimized business plan' },
      { label: 'Integrations', href: '/dashboard', description: 'Marketplace and channel connections' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: <Boxes size={20} />,
    items: [
      { label: 'Inventory Plan', href: '/oms?view=inventory', description: 'Six-month placement and pallet economics' },
      { label: 'SKUs', href: '/oms?view=skus', description: 'SKU intelligence and warehouse truth' },
      { label: 'Catalog', href: '/catalog', description: 'Legacy item management' },
      { label: 'Heatmap', href: '/oms?view=heatmap', description: 'Demand and warehouse inventory map' },
    ],
  },
  {
    id: 'operations',
    label: 'Ops',
    icon: <Truck size={20} />,
    items: [
      { label: 'Orders', href: '/oms?view=orders', description: 'Order flow and customer drilldown' },
      { label: 'Shipments', href: '/oms?view=shipments', description: 'ASNs, shipment plans, and WMS receiving' },
      { label: 'Shipment Plans', href: '/shipment-plans', description: 'Legacy shipment plan workspace' },
      { label: 'Warehouses', href: '/connect-warehouse', description: '3PL and warehouse connections' },
    ],
  },
  {
    id: 'network',
    label: 'Network',
    icon: <Building2 size={20} />,
    items: [
      { label: 'Customers', href: '/oms?view=customers', description: 'Customer LTV, service, and order behavior' },
      { label: 'Suppliers', href: '/oms?view=suppliers', description: 'Lead time, quality, and supplied SKUs' },
      { label: 'Ship-from', href: '/suppliers', description: 'Supplier and ship-from master data' },
      { label: 'Activity', href: '/activity', description: 'Legacy activity stream' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: <CircleDollarSign size={20} />,
    items: [
      { label: 'Billing & Profit', href: '/oms?view=billing', description: 'Current vs optimized cost' },
      { label: 'Label Audit', href: '/oms?view=labels', description: 'Carrier refunds and service savings' },
      { label: 'Ledger', href: '/oms?view=ledger', description: 'OMS to WMS to Cortex decision chain' },
      { label: 'Marketplace', href: '/oms?view=marketplace', description: 'AI tools, bots, and automations' },
    ],
  },
];

const adminSection: OmsSection = {
  id: 'admin',
  label: 'Admin',
  icon: <Settings size={20} />,
  items: [
    { label: 'Users', href: '/users', description: 'Team and access management' },
    { label: 'OMS Accounts', href: '/oms-admin', description: 'Administrative OMS account controls' },
  ],
};

function getSectionForPath(pathname: string, queryView?: string): string {
  if (pathname === '/dashboard') return 'command';
  if (pathname === '/catalog') return 'inventory';
  if (pathname.startsWith('/shipment-plans') || pathname === '/orders' || pathname === '/connect-warehouse') return 'operations';
  if (pathname === '/customers' || pathname === '/suppliers' || pathname === '/activity') return 'network';
  if (pathname === '/marketplace') return 'finance';
  if (pathname === '/users' || pathname === '/oms-admin') return 'admin';
  if (pathname === '/oms') {
    if (queryView === 'inventory' || queryView === 'skus' || queryView === 'heatmap') return 'inventory';
    if (queryView === 'orders' || queryView === 'shipments') return 'operations';
    if (queryView === 'customers' || queryView === 'suppliers') return 'network';
    if (queryView === 'billing' || queryView === 'labels' || queryView === 'ledger' || queryView === 'marketplace') return 'finance';
    return 'command';
  }
  return 'command';
}

export default function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [search, setSearch] = useState('');

  const canAdmin = canManageUsers(currentUser?.role);
  const availableSections = useMemo(() => (canAdmin ? [...sections, adminSection] : sections), [canAdmin]);
  const routeSection = getSectionForPath(router.pathname, typeof router.query.view === 'string' ? router.query.view : undefined);
  const activeSection = availableSections.find((s) => s.id === (activeSectionId || routeSection)) || sections[0];

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    if (window.location.hostname === 'unieconnect.com') {
      window.location.href = `https://user.unieconnect.com${window.location.pathname}${window.location.search}`;
      return;
    }
    const saved = localStorage.getItem('unie-theme');
    setTheme(saved === 'dark' || saved === 'light' ? saved : 'light');
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.body.classList.toggle('theme-dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty('--sidebar-width', '64px');
    localStorage.setItem('unie-theme', theme);
  }, [mounted, theme]);

  useEffect(() => {
    if (!mounted) return;
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (!savedToken) {
      window.location.href = '/login';
      return;
    }
    setToken(savedToken);
    const role = getRoleFromToken();
    if (role) setCurrentUser({ userId: '', email: '', role });
    void fetchCurrentUser().then((u) => u && setCurrentUser(u));
  }, [mounted]);

  useEffect(() => {
    setActiveSectionId(null);
  }, [router.asPath]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (copilotOpen) {
        setCopilotOpen(false);
        return;
      }
      setActiveSectionId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [copilotOpen]);

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/login';
  };

  if (!mounted) return null;

  return (
    <div className={`oms-shell ${activeSectionId ? 'menu-open' : ''} ${copilotOpen ? 'copilot-open' : ''}`}>
      <aside className="oms-rail" aria-label="Primary">
        <Link href="/oms" className="oms-mark" title="UnieConnect OMS">
          <img src="/unieconnect-logo.png" alt="UnieConnect" />
        </Link>
        <div className="oms-rail-items">
          {availableSections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`oms-rail-button ${routeSection === section.id ? 'active-route' : ''} ${activeSectionId === section.id ? 'active' : ''}`}
              title={section.label}
              aria-label={section.label}
              onClick={() => setActiveSectionId((id) => (id === section.id ? null : section.id))}
            >
              {section.icon}
            </button>
          ))}
        </div>
        <div className="oms-rail-bottom">
          <button
            type="button"
            className="oms-rail-button"
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            onClick={() => setTheme((value) => (value === 'light' ? 'dark' : 'light'))}
          >
            {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
          </button>
          <button type="button" className="oms-rail-button" title="Logout" aria-label="Logout" onClick={handleLogout}>
            <LogOut size={19} />
          </button>
        </div>
      </aside>

      {activeSectionId && (
        <aside className="oms-secondary" aria-label={`${activeSection.label} navigation`}>
          <div className="oms-secondary-head">
            <div>
              <div className="oms-eyebrow">Workspace</div>
              <h2>{activeSection.label}</h2>
            </div>
            <button type="button" onClick={() => setActiveSectionId(null)} aria-label="Close section menu">
              <X size={18} />
            </button>
          </div>
          <div className="oms-secondary-list">
            {activeSection.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`oms-secondary-link ${router.asPath === item.href ? 'active' : ''}`}
                onClick={() => setActiveSectionId(null)}
              >
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        </aside>
      )}

      <main className="oms-main">
        <header className="oms-topbar">
          <div className="oms-title-block">
            <div className="oms-mode"><Zap size={14} /> AI OMS · Cortex ready</div>
            {title && <h1>{title}</h1>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="oms-topbar-actions">
            <label className="oms-search">
              <Search size={16} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders / SKUs / customers" />
              <kbd>⌘K</kbd>
            </label>
            <button type="button" className="oms-top-button" onClick={() => router.push('/oms?view=ledger')}>
              <History size={16} />
              <span>Ledger</span>
            </button>
            <button type="button" className="oms-top-button" onClick={() => setCopilotOpen((value) => !value)}>
              <Brain size={16} />
              <span>Cortex</span>
            </button>
            <Link href="/profile" className="oms-profile">
              {(currentUser?.email || 'UC').slice(0, 2).toUpperCase()}
            </Link>
          </div>
        </header>
        <section className="oms-content">{children}</section>
      </main>

      {copilotOpen && (
        <aside className="oms-copilot" aria-label="Cortex">
          <div className="oms-copilot-head">
            <div>
              <div className="oms-eyebrow">Cortex</div>
              <h2>Business Double advisor</h2>
            </div>
            <button type="button" onClick={() => setCopilotOpen(false)} aria-label="Close Cortex">
              <X size={18} />
            </button>
          </div>
          <div className="oms-copilot-card">
            <Brain size={22} />
            <p>
              Ask how the OMS forecast, WMS truth gate, and Cortex dispatch plan affect this screen. Low-confidence cross-system actions remain escalated.
            </p>
          </div>
          <div className="oms-copilot-prompts">
            {['Where are we losing money?', 'Which SKUs need inventory now?', 'What can Cortex automate?', 'Which labels should be disputed?'].map((prompt) => (
              <button key={prompt} type="button">{prompt}</button>
            ))}
          </div>
          <div className="oms-copilot-signal">
            <ShieldCheck size={16} />
            <span>Approval required only for Business Double plan changes and low-confidence execution exceptions.</span>
          </div>
        </aside>
      )}
    </div>
  );
}
