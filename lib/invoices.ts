import { apiUrl } from './api';

const TOKEN_KEY = 'unie-token';

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type InvoiceLine = {
  _id: string;
  shipmentPlanId: string;
  lineType: string;
  amount: number;
  currency: string;
  description?: string;
  linkedAt: string;
};

export async function fetchInvoices(params?: { shipmentPlanId?: string }) {
  const url = new URL(apiUrl('/api/v1/invoices'));
  if (params?.shipmentPlanId) url.searchParams.set('shipmentPlanId', params.shipmentPlanId);
  const res = await fetch(url.toString(), { headers: { ...authHeaders(), Accept: 'application/json' } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `Request failed (${res.status})`);
  return data as { lines: InvoiceLine[] };
}
