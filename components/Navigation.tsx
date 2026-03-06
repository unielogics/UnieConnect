import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { fetchUserFeatures, Feature } from '../lib/features';
import { getIcon } from '../lib/icons';

interface NavItem {
  label: string;
  href: string;
  icon?: string;
  order: number;
  category?: string;
}

interface NavigationProps {
  onNavigate?: () => void;
  canManageUsers?: boolean;
  adminMode?: 'administrative' | 'regular';
  onAdminModeChange?: (mode: 'administrative' | 'regular') => void;
}

export default function Navigation({ onNavigate, canManageUsers, adminMode = 'regular', onAdminModeChange }: NavigationProps) {
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
    { label: 'Orders', href: '/orders', icon: 'orders', order: 1, category: 'core' },
    { label: 'Customers', href: '/customers', icon: 'customers', order: 2, category: 'core' },
    { label: 'Activity', href: '/activity', icon: 'activity', order: 3, category: 'core' },
    { label: 'Items', href: '/items', icon: 'items', order: 4, category: 'core' },
    { label: 'Marketplace', href: '/marketplace', icon: 'marketplace', order: 99, category: 'core' },
  ];

  // Admin-only items
  const adminItems: NavItem[] = canManageUsers
    ? [{ label: 'Users', href: '/users', icon: 'users', order: 0, category: 'admin' }]
    : [];

  const allItems =
    adminMode === 'administrative'
      ? adminItems
      : [...coreItems, ...navItems].sort((a, b) => a.order - b.order);

  if (loading) {
    return (
      <nav className="nav">
        <div className="muted" style={{ padding: '10px 12px', fontSize: 13 }}>
          Loading...
        </div>
      </nav>
    );
  }

  return (
    <nav className="nav">
      {canManageUsers && onAdminModeChange && (
        <div className="nav-admin-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={`nav-toggle-btn ${adminMode === 'regular' ? 'active' : ''}`}
            onClick={() => onAdminModeChange('regular')}
            data-label="Regular"
            data-short="R"
          >
            Regular
          </button>
          <button
            type="button"
            className={`nav-toggle-btn ${adminMode === 'administrative' ? 'active' : ''}`}
            onClick={() => onAdminModeChange('administrative')}
            data-label="Admin"
            data-short="A"
          >
            Admin
          </button>
        </div>
      )}
      {allItems.map((item) => {
        const isActive = router.pathname === item.href || router.pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${isActive ? 'active' : ''}`}
            title={item.label}
            onClick={onNavigate}
          >
            <span className="nav-icon">{getIcon(item.icon, 'nav-icon-svg')}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
