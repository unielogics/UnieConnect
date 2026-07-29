import { apiUrl, authFetch, getStoredToken, TOKEN_KEY } from './api';

export type UserRole = 'super_admin' | 'management' | 'ecommerce_client' | 'billing';

export interface CurrentUser {
  userId: string;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  fulfillmentStatus?: 'active' | 'paused' | 'blocked';
  fulfillmentStatusNote?: string;
  fulfillmentStatusAt?: string;
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
  const token = getStoredToken();
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
  const token = getStoredToken();
  try {
    const res = await authFetch(apiUrl('/api/v1/auth/me'), {
      headers: {},
    });
    if (!res.ok) return null;
    const data = await res.json();
    const role = parseRole(data.role);
    if (!role) return null;
    const current: CurrentUser = {
      userId: data.userId,
      email: data.email,
      role,
    };
    if (data.firstName) current.firstName = data.firstName;
    if (data.lastName) current.lastName = data.lastName;
    if (data.avatarUrl) current.avatarUrl = data.avatarUrl;
    if (data.fulfillmentStatus) current.fulfillmentStatus = data.fulfillmentStatus;
    if (data.fulfillmentStatusNote) current.fulfillmentStatusNote = data.fulfillmentStatusNote;
    if (data.fulfillmentStatusAt) current.fulfillmentStatusAt = data.fulfillmentStatusAt;
    return current;
  } catch {
    const role = getRoleFromToken();
    if (!role || !token) return null;
    const parts = token.split('.');
    const payload = parts[1] ? JSON.parse(atob(parts[1])) : {};
    return { userId: payload.userId, email: payload.email || '', role };
  }
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',').pop() || '');
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

export async function uploadProfileAvatar(file: File): Promise<{ url: string; key: string }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(apiUrl('/api/v1/uploads/images'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      dataBase64: await fileToBase64(file),
      purpose: 'profile-avatar',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || err?.message || 'Failed to upload profile avatar');
  }
  return res.json();
}
