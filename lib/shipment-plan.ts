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

export type ShipmentPlanItem = {
  sku: string;
  asin?: string;
  title?: string;
  quantity: number;
  boxCount: number;
  unitsPerBox: number;
  expDate?: string;
  weightPerUnit?: number;
  weightPerBox?: number;
  dimensions?: { width?: number; height?: number; length?: number };
  fnsku?: string;
  upc?: string;
};

export type ShipmentPlan = {
  id: string;
  internalShipmentId: string;
  supplierId: string;
  shipFromLocationId: string;
  prepServicesOnly: boolean;
  marketplaceId?: string;
  marketplaceType?: 'FBA' | 'FBW';
  facilityId?: string | null;
  facility?: { id: string; name: string; code: string } | null;
  status: string;
  asnId?: string | null;
  items: ShipmentPlanItem[];
  shipFromAddress?: Record<string, unknown>;
  orderNo?: string;
  receiptNo?: string;
  orderDate?: string;
  estimatedArrivalDate?: string;
  shipmentTitle?: string;
  supplier?: { id: string; name: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

export async function fetchShipmentPlans(params?: { limit?: number; offset?: number; status?: string }) {
  const url = new URL(apiUrl('/api/v1/shipment-plans'));
  if (params?.limit) url.searchParams.set('limit', String(params.limit));
  if (params?.offset) url.searchParams.set('offset', String(params.offset));
  if (params?.status) url.searchParams.set('status', params.status);
  const res = await fetch(url.toString(), { headers: { ...authHeaders(), Accept: 'application/json' } });
  return readJson<{ plans: ShipmentPlan[]; total: number }>(res);
}

export async function fetchShipmentPlan(id: string) {
  const res = await fetch(apiUrl(`/api/v1/shipment-plans/${encodeURIComponent(id)}`), {
    headers: { ...authHeaders(), Accept: 'application/json' },
  });
  return readJson<ShipmentPlan>(res);
}

export async function createShipmentPlan(body: {
  supplierId: string;
  shipFromLocationId: string;
  prepServicesOnly: boolean;
  marketplaceId?: string;
  marketplaceType?: 'FBA' | 'FBW';
  items: ShipmentPlanItem[];
  orderNo?: string;
  receiptNo?: string;
  orderDate?: string;
  estimatedArrivalDate?: string;
  shipmentTitle?: string;
}) {
  const res = await fetch(apiUrl('/api/v1/shipment-plans'), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  return readJson<ShipmentPlan>(res);
}

export async function updateShipmentPlan(
  id: string,
  body: Partial<{
    items: ShipmentPlanItem[];
    orderNo: string;
    receiptNo: string;
    orderDate: string;
    estimatedArrivalDate: string;
    shipmentTitle: string;
  }>
) {
  const res = await fetch(apiUrl(`/api/v1/shipment-plans/${encodeURIComponent(id)}`), {
    method: 'PUT',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  return readJson<ShipmentPlan>(res);
}

export async function submitShipmentPlan(id: string) {
  const res = await fetch(apiUrl(`/api/v1/shipment-plans/${encodeURIComponent(id)}/submit`), {
    method: 'POST',
    headers: { ...authHeaders(), Accept: 'application/json' },
  });
  return readJson<ShipmentPlan>(res);
}

export async function cancelShipmentPlan(id: string) {
  const res = await fetch(apiUrl(`/api/v1/shipment-plans/${encodeURIComponent(id)}/cancel`), {
    method: 'POST',
    headers: { ...authHeaders(), Accept: 'application/json' },
  });
  return readJson<ShipmentPlan>(res);
}

export async function createASN(shipmentPlanId: string) {
  const res = await fetch(apiUrl(`/api/v1/shipment-plans/${encodeURIComponent(shipmentPlanId)}/create-asn`), {
    method: 'POST',
    headers: { ...authHeaders(), Accept: 'application/json' },
  });
  return readJson<{ asn: any; plan: ShipmentPlan }>(res);
}

export async function fetchClosestFacilityPreview(shipFromLocationId: string) {
  const url = new URL(apiUrl('/api/v1/shipment-plans/closest-facility-preview'));
  url.searchParams.set('shipFromLocationId', shipFromLocationId);
  const res = await fetch(url.toString(), { headers: { ...authHeaders(), Accept: 'application/json' } });
  return readJson<{ facilityId: string | null; facility: { name: string; code?: string } | null; distanceMiles: number | null }>(res);
}

export async function fetchClosestFacility(shipmentPlanId: string) {
  const res = await fetch(apiUrl(`/api/v1/shipment-plans/${encodeURIComponent(shipmentPlanId)}/closest-facility`), {
    headers: { ...authHeaders(), Accept: 'application/json' },
  });
  return readJson<any>(res);
}

export async function fetchEstimatedCost(shipmentPlanId: string) {
  const res = await fetch(apiUrl(`/api/v1/shipment-plans/${encodeURIComponent(shipmentPlanId)}/estimated-cost`), {
    headers: { ...authHeaders(), Accept: 'application/json' },
  });
  return readJson<{ total: number; perUnit: number; breakdown: Record<string, number> }>(res);
}

export async function fetchRateShopToWarehouse(shipmentPlanId: string) {
  const res = await fetch(
    apiUrl(`/api/v1/shipment-plans/${encodeURIComponent(shipmentPlanId)}/rate-shop-to-warehouse`),
    { method: 'POST', headers: { ...authHeaders(), Accept: 'application/json' } }
  );
  return readJson<{ parcel: Array<{ amount: number; currency: string; provider?: string }>; ltl: any[]; ftl: any[] }>(res);
}

export async function fetchShipmentActivity(params?: {
  limit?: number;
  offset?: number;
  shipmentPlanId?: string;
  action?: string;
  from?: string;
  to?: string;
}) {
  const url = new URL(apiUrl('/api/v1/shipment-plans/activity'));
  if (params?.limit) url.searchParams.set('limit', String(params.limit));
  if (params?.offset) url.searchParams.set('offset', String(params.offset));
  if (params?.shipmentPlanId) url.searchParams.set('shipmentPlanId', params.shipmentPlanId);
  if (params?.action) url.searchParams.set('action', params.action);
  if (params?.from) url.searchParams.set('from', params.from);
  if (params?.to) url.searchParams.set('to', params.to);
  const res = await fetch(url.toString(), { headers: { ...authHeaders(), Accept: 'application/json' } });
  return readJson<{ events: any[]; total: number }>(res);
}

export async function fetchItemShipmentActivity(itemId: string, params?: { limit?: number; offset?: number }) {
  const url = new URL(apiUrl(`/api/v1/items/${encodeURIComponent(itemId)}/shipment-activity`));
  if (params?.limit) url.searchParams.set('limit', String(params.limit));
  if (params?.offset) url.searchParams.set('offset', String(params.offset));
  const res = await fetch(url.toString(), { headers: { ...authHeaders(), Accept: 'application/json' } });
  return readJson<{ events: any[]; total: number }>(res);
}
