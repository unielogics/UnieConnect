import React from 'react';
import {
  Link2,
  Package,
  Users,
  Activity,
  FileText,
  ShoppingCart,
  CreditCard,
  Search,
  TrendingUp,
  Settings,
  LogOut,
  Lock,
  User,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
} from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const iconMap: Record<string, React.ComponentType<any>> = {
  link: Link2,
  integrations: Link2,
  package: Package,
  orders: Package,
  users: Users,
  customers: Users,
  activity: Activity,
  'file-text': FileText,
  items: FileText,
  'shopping-cart': ShoppingCart,
  marketplace: ShoppingCart,
  warehouse: Package,
  billing: CreditCard,
  search: Search,
  'product-finder': Search,
  'trending-up': TrendingUp,
  auditing: TrendingUp,
  settings: Settings,
  'custom-integrations': Settings,
  team: Users,
  logout: LogOut,
  lock: Lock,
  user: User,
  sun: Sun,
  moon: Moon,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  dashboard: LayoutDashboard,
};

export function getIcon(iconName?: string, className?: string, size: number = 20) {
  if (!iconName) return null;
  const IconComponent = iconMap[iconName.toLowerCase()];
  if (!IconComponent) return null;
  return <IconComponent className={className} size={size} />;
}
