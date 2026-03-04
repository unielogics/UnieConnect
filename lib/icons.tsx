import React from 'react';
import {
  FiLink,
  FiPackage,
  FiUsers,
  FiActivity,
  FiFileText,
  FiShoppingCart,
  FiCreditCard,
  FiSearch,
  FiTrendingUp,
  FiSettings,
  FiLogOut,
  FiLock,
  FiUser,
  FiSun,
  FiMoon,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';

export const iconMap: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  'link': FiLink,
  'integrations': FiLink,
  'package': FiPackage,
  'orders': FiPackage,
  'users': FiUsers,
  'customers': FiUsers,
  'activity': FiActivity,
  'file-text': FiFileText,
  'items': FiFileText,
  'shopping-cart': FiShoppingCart,
  'marketplace': FiShoppingCart,
  'warehouse': FiPackage,
  'billing': FiCreditCard,
  'search': FiSearch,
  'product-finder': FiSearch,
  'trending-up': FiTrendingUp,
  'auditing': FiTrendingUp,
  'settings': FiSettings,
  'custom-integrations': FiSettings,
  'team': FiUsers,
  'logout': FiLogOut,
  'lock': FiLock,
  'user': FiUser,
  'sun': FiSun,
  'moon': FiMoon,
  'chevron-left': FiChevronLeft,
  'chevron-right': FiChevronRight,
};

export function getIcon(iconName?: string, className?: string, size: number = 20) {
  if (!iconName) return null;
  const IconComponent = iconMap[iconName.toLowerCase()];
  if (!IconComponent) return null;
  return <IconComponent className={className} size={size} />;
}
