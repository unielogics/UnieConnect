import { apiUrl } from './api';
import { TOKEN_KEY } from './api';

export type UserRole = 'super_admin' | 'management' | 'ecommerce_client' | 'billing';

export interface CurrentUser {
  userId: string;
  email: string;
  role: UserRole;
}

const CAN_MANAGE_USERS: UserRole[] = ['super_admin', 'management'];
const VALID_ROLES: UserRole[] = ['super_admin', 'management', 'ecommerce_client', 'billing'];

function parseRole(value: unknown): UserRole | undefined {
  if (typeof value !== 'string') return undefined;
  return VALID_ROLES.includes(value as UserRole) ? (value as UserRole) : undefined;
}

/** Decode role from JWT payload (fallback when /me is unavailable) */
export function getRoleFromToken(): UserRole | undefined {
  if (typeof window === 'undefined') return undefined;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return undefined;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return undefined;
    const payload = JSON.parse(atob(parts[1]));
    return parseRole(payload.role);
  } catch {
    return undefined;
  }
}

export function canManageUsers(role: UserRole | undefined): boolean {
  return !!role && CAN_MANAGE_USERS.includes(role);
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  if (!token) return null;
  try {
    const res = await fetch(apiUrl('/api/v1/auth/me'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const role = parseRole(data.role);
    if (!role) return null;
    return {
      userId: data.userId,
      email: data.email,
      role,
    };
  } catch {
    const role = getRoleFromToken();
    if (!role) return null;
    const parts = token.split('.');
    const payload = parts[1] ? JSON.parse(atob(parts[1])) : {};
    return { userId: payload.userId, email: payload.email || '', role };
  }
}
