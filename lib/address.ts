import { apiUrl, TOKEN_KEY } from './api';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type ValidatedAddress = {
  formatted?: string;
  street?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
};

export async function validateAddress(address: string): Promise<{
  found: boolean;
  warning?: string;
  address?: ValidatedAddress;
}> {
  const res = await fetch(apiUrl('/api/v1/address/validate'), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ address: address.trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `Validation failed (${res.status})`);
  }
  return data as { found: boolean; warning?: string; address?: ValidatedAddress };
}

export async function suggestAddress(query: string): Promise<{
  suggestions: ValidatedAddress[];
}> {
  const qs = new URLSearchParams();
  qs.set('q', query.trim());
  const res = await fetch(apiUrl(`/api/v1/address/suggest?${qs.toString()}`), {
    method: 'GET',
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `Suggest failed (${res.status})`);
  }
  return data as { suggestions: ValidatedAddress[] };
}
