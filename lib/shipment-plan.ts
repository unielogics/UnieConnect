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

export type LabServiceType = 'bundling' | 'kitting' | 'relabeling' | 'shrink-wrap' | 'bubble-wrap' | 'quality-control' | 'custom-inserts' | 'gift-wrapping' | 'personalization';

export type LabRequirement = {
  type: LabServiceType;
  instructions?: string;
  labelType?: 'fba' | 'fbw' | 'hazmat' | 'custom';
  labelTemplate?: string;
  componentSkus?: string[];
  bundleQuantity?: number;
};

export type ShipmentPlanItem = {
  sku: string;
  asin?: string;
  title?: string;
  itemId?: string;
  quantity?: number;
  boxCount?: number;
  unitsPerBox?: number;
  expDate?: string;
  weightPerUnit?: number;
  weightPerBox?: number;
  dimensions?: { width?: number; height?: number; length?: number };
  fnsku?: string;
  upc?: string;
  labRequirements?: { services?: LabRequirement[]; instructions?: string };
  templateId?: string;
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

export type FacilityOption = { id: string; name: string; code?: string };

export async function fetchFacilities(): Promise<FacilityOption[]> {
  const res = await fetch(apiUrl('/api/v1/facilities'), {
    headers: { ...authHeaders(), Accept: 'application/json' },
  });
  const data = await readJson<FacilityOption[]>(res);
  return Array.isArray(data) ? data : [];
}

export async function fetchShipmentPlans(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  supplierId?: string;
  facilityId?: string;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}) {
  const url = new URL(apiUrl('/api/v1/shipment-plans'));
  if (params?.limit) url.searchParams.set('limit', String(params.limit));
  if (params?.offset) url.searchParams.set('offset', String(params.offset));
  if (params?.status) url.searchParams.set('status', params.status);
  if (params?.supplierId) url.searchParams.set('supplierId', params.supplierId);
  if (params?.facilityId) url.searchParams.set('facilityId', params.facilityId);
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.sortBy) url.searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) url.searchParams.set('sortOrder', params.sortOrder);
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

export function fetchAsnLabelUrl(asnId: string): string {
  return apiUrl(`/api/v1/asn/${encodeURIComponent(asnId)}/label`);
}

export function fetchItemBarcodePdfUrl(asnId: string, wmsItemId: string): string {
  return apiUrl(`/api/v1/asn/${encodeURIComponent(asnId)}/items/${encodeURIComponent(wmsItemId)}/barcode-pdf`);
}

export async function fetchAsnLabelBlob(asnId: string): Promise<Blob> {
  const res = await fetch(apiUrl(`/api/v1/asn/${encodeURIComponent(asnId)}/label`), {
    headers: { ...authHeaders(), Accept: 'application/pdf' },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any)?.error || `Failed to fetch ASN label (${res.status})`);
  }
  return res.blob();
}

export async function fetchItemBarcodeBlob(asnId: string, wmsItemId: string): Promise<Blob> {
  const res = await fetch(
    apiUrl(`/api/v1/asn/${encodeURIComponent(asnId)}/items/${encodeURIComponent(wmsItemId)}/barcode-pdf`),
    { headers: { ...authHeaders(), Accept: 'application/pdf' } }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any)?.error || `Failed to fetch item barcode (${res.status})`);
  }
  return res.blob();
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
  return readJson<{
    facilityId: string | null;
    facility: {
      name: string;
      code?: string;
      address?: {
        addressLine1?: string;
        city?: string;
        stateOrProvinceCode?: string;
        postalCode?: string;
        countryCode?: string;
        lat?: number;
        long?: number;
      };
    } | null;
    distanceMiles: number | null;
    shipFromAddress?: { lat: number; long: number };
  }>(res);
}

export async function fetchClosestFacility(shipmentPlanId: string) {
  const res = await fetch(apiUrl(`/api/v1/shipment-plans/${encodeURIComponent(shipmentPlanId)}/closest-facility`), {
    headers: { ...authHeaders(), Accept: 'application/json' },
  });
  return readJson<any>(res);
}

export type EstimateServiceFeesLineItem = {
  code: string;
  label: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
};

export async function fetchEstimateServiceFees(params: {
  shipFromLocationId: string;
  items: Array<{
    sku: string;
    quantity?: number;
    boxCount?: number;
    labRequirements?: { services?: Array<{ type: string; bundleQuantity?: number }> };
  }>;
  prepServicesOnly: boolean;
  marketplaceType?: 'FBA' | 'FBW';
}) {
  const res = await fetch(apiUrl('/api/v1/shipment-plans/estimate-service-fees'), {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(params),
  });
  return readJson<{
    total: number;
    perUnit: number;
    lineItems: EstimateServiceFeesLineItem[];
    warehouseCode?: string;
  }>(res);
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
