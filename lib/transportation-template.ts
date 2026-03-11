import { apiUrl, TOKEN_KEY } from './api';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export type TransportationTemplate = {
  id: string;
  name: string;
  supplierId?: string;
  unitsPerBox: number;
  weightPerBox: number;
  weightPerUnit?: number;
  dimensions?: { length?: number; width?: number; height?: number };
};

export async function fetchTransportationTemplates(supplierId?: string): Promise<{ templates: TransportationTemplate[] }> {
  const url = new URL(apiUrl('/api/v1/transportation-templates'));
  if (supplierId) url.searchParams.set('supplierId', supplierId);
  const res = await fetch(url.toString(), { headers: { ...authHeaders(), Accept: 'application/json' } });
  return readJson<{ templates: TransportationTemplate[] }>(res);
}

export async function createTransportationTemplate(body: {
  name: string;
  supplierId?: string;
  unitsPerBox: number;
  weightPerBox: number;
  weightPerUnit?: number;
  dimensions?: { length?: number; width?: number; height?: number };
}): Promise<TransportationTemplate> {
  const res = await fetch(apiUrl('/api/v1/transportation-templates'), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return readJson<TransportationTemplate>(res);
}

export async function updateTransportationTemplate(
  id: string,
  body: Partial<{
    name: string;
    supplierId?: string;
    unitsPerBox: number;
    weightPerBox: number;
    weightPerUnit?: number;
    dimensions?: { length?: number; width?: number; height?: number };
  }>
): Promise<TransportationTemplate> {
  const res = await fetch(apiUrl(`/api/v1/transportation-templates/${encodeURIComponent(id)}`), {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return readJson<TransportationTemplate>(res);
}

export async function deleteTransportationTemplate(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/transportation-templates/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any)?.error || `Request failed (${res.status})`);
  }
}
