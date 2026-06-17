import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { fetchUserFeatures, Feature } from '../lib/features';
import { getIcon } from '../lib/icons';

const OMS_NAVIGATION_START_EVENT = 'unieconnect:oms-navigation-start';

function emitNavigationStart() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OMS_NAVIGATION_START_EVENT));
}

interface NavItem {
  label: string;
  href: string;
  icon?: string;
  order: number;
  category?: string;
}

interface NavigationProps {
  sidebarCollapsed?: boolean;
  onNavigate?: () => void;
  canManageUsers?: boolean;
  adminMode?: 'administrative' | 'regular';
  onAdminModeChange?: (mode: 'administrative' | 'regular') => void;
}

export default function Navigation({ sidebarCollapsed = false, onNavigate, canManageUsers, adminMode = 'regular', onAdminModeChange }: NavigationProps) {
  const router = useRouter();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadFeatures();
  }, []);

  const loadFeatures = async () => {
    try {
      const data = await fetchUserFeatures();
      setFeatures(data.features);
    } catch (err) {
      console.error('Failed to load features:', err);
    } finally {
      setLoading(false);
    }
  };

  // Build navigation items from features
  const navItems: NavItem[] = features
    .filter((f) => f.metadata?.route && f.metadata?.navLabel)
    .map((f) => ({
      label: f.metadata!.navLabel!,
      href: f.metadata!.route!,
      icon: f.metadata!.navIcon,
      order: f.metadata!.navOrder || 999,
      category: f.category,
    }))
    .sort((a, b) => a.order - b.order);

  // Group by category
  const grouped: Record<string, NavItem[]> = {};
  navItems.forEach((item) => {
    const category = item.category || 'other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
  });

  // Regular (core) navigation items
  const coreItems: NavItem[] = [
    { label: 'Integrations', href: '/dashboard', icon: 'integrations', order: 0, category: 'core' },
    { label: 'My 3PLs', href: '/connect-warehouse', icon: 'warehouse', order: 0.5, category: 'core' },
    { label: 'Orders', href: '/orders', icon: 'orders', order: 1, category: 'core' },
    { label: 'Customers', href: '/customers', icon: 'customers', order: 2, category: 'core' },
    { label: 'Activity', href: '/activity', icon: 'activity', order: 3, category: 'core' },
    { label: 'Catalog', href: '/catalog', icon: 'items', order: 5, category: 'core' },
    { label: 'Shipment plans', href: '/shipment-plans', icon: 'package', order: 6, category: 'core' },
    { label: 'Ship-from', href: '/suppliers', icon: 'users', order: 8, category: 'core' },
    { label: 'Marketplace', href: '/marketplace', icon: 'marketplace', order: 99, category: 'core' },
  ];

  // Admin-only items
  const adminItems: NavItem[] = canManageUsers
    ? [
        { label: 'Users', href: '/users', icon: 'users', order: 0, category: 'admin' },
        { label: 'OMS accounts', href: '/oms-admin', icon: 'warehouse', order: 1, category: 'admin' },
      ]
    : [];

  const allItems =
    adminMode === 'administrative'
      ? adminItems
      : [...coreItems, ...navItems].sort((a, b) => a.order - b.order);

  const sections =
    adminMode === 'administrative'
      ? [{ title: 'ADMIN', items: adminItems }]
      : [
          { title: 'CORE', items: coreItems },
          ...(navItems.length > 0 ? [{ title: 'INTEGRATIONS', items: navItems }] : []),
        ];

  if (loading) {
    return (
      <nav className="flex flex-col py-4">
        <div className="px-4 py-2 text-sm text-gray-400">Loading...</div>
      </nav>
    );
  }

  return (
    <nav className="nav flex flex-col gap-0.5 py-4 overflow-hidden min-w-0">
      {canManageUsers && onAdminModeChange && (
        <div className="nav-admin-toggle flex gap-1 px-2 py-1.5 mb-2" role="group" aria-label="View mode">
          <button
            type="button"
            className={`nav-toggle-btn flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              adminMode === 'regular' ? 'active' : ''
            }`}
            data-label="Regular"
            data-short="R"
            onClick={() => onAdminModeChange('regular')}
          >
            Regular
          </button>
          <button
            type="button"
            className={`nav-toggle-btn flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              adminMode === 'administrative' ? 'active' : ''
            }`}
            data-label="Admin"
            data-short="A"
            onClick={() => onAdminModeChange('administrative')}
          >
            Admin
          </button>
        </div>
      )}
      {sections.map((section) =>
        section.items.length > 0 ? (
          <div key={section.title} className="nav-section mb-4 min-w-0">
            <div className="nav-section-label px-4 py-1.5 mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
              {section.title}
            </div>
            {section.items.map((item) => {
              const isActive = router.pathname === item.href || router.pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-colors ${
                    isActive ? 'active bg-[#3b82f6] text-white' : 'text-gray-300 hover:bg-[#374151] hover:text-white'
                  }`}
                  title={item.label}
                  onClick={() => {
                    emitNavigationStart();
                    onNavigate?.();
                  }}
                >
                  <span className="nav-icon flex-shrink-0 w-5 h-5 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5">
                    {getIcon(item.icon)}
                  </span>
                  <span className="nav-label font-medium truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ) : null
      )}
    </nav>
  );
}
