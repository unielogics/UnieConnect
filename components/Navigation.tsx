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

export default function Navigation() {
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

  // Standard navigation items (always shown)
  const standardItems: NavItem[] = [
    { label: 'Integrations', href: '/dashboard', icon: 'integrations', order: 0, category: 'core' },
    { label: 'Orders', href: '/orders', icon: 'orders', order: 1, category: 'core' },
    { label: 'Customers', href: '/customers', icon: 'customers', order: 2, category: 'core' },
    { label: 'Activity', href: '/activity', icon: 'activity', order: 3, category: 'core' },
    { label: 'Items', href: '/items', icon: 'items', order: 4, category: 'core' },
    { label: 'Marketplace', href: '/marketplace', icon: 'marketplace', order: 99, category: 'core' },
  ];

  const allItems = [...standardItems, ...navItems].sort((a, b) => a.order - b.order);

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
      {allItems.map((item) => {
        const isActive = router.pathname === item.href || router.pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${isActive ? 'active' : ''}`}
            title={item.label}
          >
            <span className="nav-icon">{getIcon(item.icon, 'nav-icon-svg')}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
