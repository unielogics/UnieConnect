import { apiUrl, TOKEN_KEY } from './api';

export type AmazonAccount = {
  id: string;
  channel: string;
  sellingPartnerId?: string;
  marketplaceIds?: string[];
  region?: string;
  status: string;
};

export type AmazonCatalogItem = {
  sellerSku?: string;
  asin?: string;
  title?: string;
  conditionType?: string;
  status?: string;
  productType?: string;
  availableQuantity?: number;
  fulfillmentAvailability?: any;
  issues?: any[];
  raw?: any;
};

export type Supplier = {
  _id?: string;
  id: string;
  name: string;
  onlineSupplier?: boolean;
  email?: string;
  phone?: string;
  hoursOfOperation?: string;
  website?: string;
  notes?: string;
  loadingDock?: boolean | null;
  maxVehicleSize?: string | null;
  equipmentRequired?: string[];
  appointmentRequired?: boolean;
  dockAppointmentLeadTimeHours?: number | null;
  liftgateRequired?: boolean;
  insidePickup?: boolean;
  palletExchange?: boolean;
  pickupInstructions?: string;
  contactName?: string;
  pickupProfile?: {
    loadingDock?: boolean | null;
    maxVehicleSize?: string | null;
    hoursOfOperation?: string;
    equipmentRequired?: string[];
    appointmentRequired?: boolean;
    dockAppointmentLeadTimeHours?: number | null;
    liftgateRequired?: boolean;
    insidePickup?: boolean;
    palletExchange?: boolean;
    pickupInstructions?: string;
    contactName?: string;
  };
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type ShipFromLocation = {
  _id?: string;
  id: string;
  supplierId: string;
  label: string;
  contactName?: string;
  email?: string;
  phone?: string;
  hoursOfOperation?: string;
  website?: string;
  isDefault?: boolean;
  address: {
    addressLine1: string;
    addressLine2?: string;
    addressLine3?: string;
    city: string;
    stateOrProvinceCode: string;
    postalCode: string;
    countryCode: string;
    districtOrCounty?: string;
  };
  supplier?: Supplier;
  createdAt?: string;
  updatedAt?: string;
};

export type InboundHistoryItem = {
  id: string;
  workflowId: string;
  shipmentId?: string;
  shipmentName?: string;
  shipmentCount?: number;
  workflowStatus?: string;
  status?: string;
  packingMode?: string;
  supplierId?: string;
  shipFromLocationId?: string;
  shipFromAddress?: Record<string, unknown>;
  marketplaceId?: string;
  destinationFulfillmentCenterId?: string;
  itemCount: number;
  skuLabels?: {
    requestedAt?: string;
    fetchedAt?: string;
    itemCount?: number;
    note?: string;
    items?: Array<{
      sellerSku: string;
      asin?: string;
      title?: string;
      quantity?: number;
    }>;
  };
  boxLabels?: { url?: string };
  labels?: { url?: string };
  updatedAt?: string;
  createdAt?: string;
};

export type SendToAmazonWorkflowItem = {
  sellerSku: string;
  asin?: string;
  title?: string;
  availableQuantity?: number;
  quantity: number;
  packingMode: 'individual' | 'case_packed';
  cartonCount?: number;
  unitsPerCarton?: number;
  prepOwner?: 'AMAZON' | 'SELLER';
  labelOwner?: 'AMAZON' | 'SELLER';
  status: 'selected' | 'needs_input' | 'ready' | 'error';
  issues: string[];
};

export type SendToAmazonCarton = {
  cartonId: string;
  cartonName: string;
  packingGroupId?: string;
  quantity: number;
  unitsPerCarton: number;
  contentSource: 'BOX_CONTENT_PROVIDED';
  items: Array<{
    sellerSku: string;
    quantity: number;
  }>;
};

export type SendToAmazonPlacementOption = {
  placementOptionId: string;
  status?: string;
  preference?: string;
  fees?: any;
  discounts?: any;
  shipments: Array<{
    shipmentId?: string;
    shipmentName?: string;
    destinationFulfillmentCenterId?: string;
    items: Array<{
      sellerSku: string;
      quantity: number;
    }>;
  }>;
  raw?: any;
};

export type SendToAmazonShipment = {
  shipmentId: string;
  shipmentName?: string;
  destinationFulfillmentCenterId?: string;
  status?: string;
  items: Array<{
    sellerSku: string;
    quantity: number;
  }>;
  boxes?: any[];
  labels?: {
    boxLabelUrl?: string;
    fetchedAt?: string;
    raw?: any;
  };
  raw?: any;
};

export type SendToAmazonWorkflow = {
  id: string;
  workflowId: string;
  workflowName: string;
  workflowStatus: string;
  marketplaceId?: string;
  shipFromLocationId?: string;
  shipFromAddress?: Record<string, unknown>;
  items: SendToAmazonWorkflowItem[];
  cartons: SendToAmazonCarton[];
  placementOptions: SendToAmazonPlacementOption[];
  selectedPlacementOptionId?: string;
  selectedPlacement?: SendToAmazonPlacementOption | null;
  shipments: SendToAmazonShipment[];
  warnings: string[];
  errors: string[];
  amazonReferences: {
    inboundPlanId?: string;
    packingOptionId?: string;
    createPlanOperationId?: string;
    generatePackingOperationId?: string;
    confirmPackingOperationId?: string;
    generatePlacementOperationId?: string;
    confirmPlacementOperationId?: string;
  };
  metrics: {
    itemCount: number;
    readyItemCount: number;
    totalUnits: number;
    shipmentCount: number;
    placementCount: number;
    cartonCount: number;
  };
  updatedAt?: string;
  createdAt?: string;
};

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

export async function fetchAmazonAccounts() {
  const res = await fetch(apiUrl('/api/v1/channel-accounts'), {
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
  });
  const accounts = await readJson<AmazonAccount[]>(res);
  return accounts.filter((account) => account.channel === 'amazon');
}

export async function fetchAmazonCatalogItems(params: {
  accountId: string;
  marketplaceId?: string;
  q?: string;
  nextToken?: string;
  pageSize?: number;
}) {
  const url = new URL(apiUrl('/api/v1/amazon/catalog/items'));
  url.searchParams.set('accountId', params.accountId);
  if (params.marketplaceId) url.searchParams.set('marketplaceId', params.marketplaceId);
  if (params.q) url.searchParams.set('q', params.q);
  if (params.nextToken) url.searchParams.set('nextToken', params.nextToken);
  if (params.pageSize !== undefined) url.searchParams.set('pageSize', String(params.pageSize));
  const res = await fetch(url.toString(), {
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
  });
  return readJson<{
    marketplaceId: string;
    nextToken?: string;
    strategy: string;
    items: AmazonCatalogItem[];
  }>(res);
}

export async function fetchSuppliers() {
  const res = await fetch(apiUrl('/api/v1/suppliers'), {
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
  });
  return readJson<Supplier[]>(res);
}

export type SupplierProductDirect = {
  id: string;
  sku: string;
  title: string;
  source: 'item';
};

export type SupplierProductHistorical = {
  sku: string;
  title?: string;
  asin?: string;
  source: 'plan' | 'inbound';
  lastUsedAt: string;
  planId?: string;
  workflowId?: string;
};

export type SupplierProductsResponse = {
  direct: SupplierProductDirect[];
  historical: SupplierProductHistorical[];
};

export async function fetchSupplierProducts(supplierId: string) {
  const res = await fetch(apiUrl(`/api/v1/suppliers/${encodeURIComponent(supplierId)}/products`), {
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error('Failed to fetch supplier products');
  return readJson<SupplierProductsResponse>(res);
}

export async function createSupplier(body: Record<string, unknown>) {
  const res = await fetch(apiUrl('/api/v1/suppliers'), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  return readJson<Supplier>(res);
}

export async function updateSupplier(id: string, body: Record<string, unknown>) {
  const res = await fetch(apiUrl(`/api/v1/suppliers/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  return readJson<Supplier>(res);
}

export async function deleteSupplier(id: string) {
  const res = await fetch(apiUrl(`/api/v1/suppliers/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
  });
  return readJson<{ success: boolean }>(res);
}

export async function fetchShipFromLocations(params?: { supplierId?: string }) {
  const url = new URL(apiUrl('/api/v1/ship-from-locations'));
  if (params?.supplierId) url.searchParams.set('supplierId', params.supplierId);
  const res = await fetch(url.toString(), {
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
  });
  return readJson<ShipFromLocation[]>(res);
}

export async function createShipFromLocation(body: Record<string, unknown>) {
  const res = await fetch(apiUrl('/api/v1/ship-from-locations'), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  return readJson<ShipFromLocation>(res);
}

export async function updateShipFromLocation(id: string, body: Record<string, unknown>) {
  const res = await fetch(apiUrl(`/api/v1/ship-from-locations/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  return readJson<ShipFromLocation>(res);
}

export async function deleteShipFromLocation(id: string) {
  const res = await fetch(apiUrl(`/api/v1/ship-from-locations/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
  });
  return readJson<{ success: boolean }>(res);
}

export async function saveAmazonInboundDraft(body: Record<string, unknown>) {
  const res = await fetch(apiUrl('/api/v1/amazon/inbound/workflows/draft'), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  return readJson<any>(res);
}

export async function fetchAmazonInboundSkuLabels(body: Record<string, unknown>) {
  const res = await fetch(apiUrl('/api/v1/amazon/inbound/workflows/sku-labels'), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  return readJson<any>(res);
}

export async function createAmazonInboundPlan(body: Record<string, unknown>) {
  const res = await fetch(apiUrl('/api/v1/amazon/inbound/plan'), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  return readJson<any>(res);
}

export async function createAmazonInboundShipment(body: Record<string, unknown>) {
  const res = await fetch(apiUrl('/api/v1/amazon/inbound/shipment'), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  return readJson<any>(res);
}

export async function fetchAmazonInboundLabels(params: {
  accountId: string;
  shipmentId: string;
  pageType?: string;
  labelType?: string;
  numberOfPackages?: number;
}) {
  const url = new URL(apiUrl(`/api/v1/amazon/inbound/${encodeURIComponent(params.shipmentId)}/labels`));
  url.searchParams.set('accountId', params.accountId);
  if (params.pageType) url.searchParams.set('pageType', params.pageType);
  if (params.labelType) url.searchParams.set('labelType', params.labelType);
  if (params.numberOfPackages !== undefined) url.searchParams.set('numberOfPackages', String(params.numberOfPackages));
  const res = await fetch(url.toString(), {
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
  });
  return readJson<any>(res);
}

export async function fetchAmazonInboundHistory(params: { accountId: string; workflowStatus?: string; limit?: number }) {
  const url = new URL(apiUrl('/api/v1/amazon/inbound/history'));
  url.searchParams.set('accountId', params.accountId);
  if (params.workflowStatus) url.searchParams.set('workflowStatus', params.workflowStatus);
  if (params.limit !== undefined) url.searchParams.set('limit', String(params.limit));
  const res = await fetch(url.toString(), {
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
  });
  return readJson<InboundHistoryItem[]>(res);
}

export async function fetchAmazonInboundDetail(params: { accountId: string; workflowOrShipmentId: string; mode?: 'workflow' | 'shipment' }) {
  const url = new URL(apiUrl(`/api/v1/amazon/inbound/history/${encodeURIComponent(params.workflowOrShipmentId)}`));
  url.searchParams.set('accountId', params.accountId);
  if (params.mode) url.searchParams.set('mode', params.mode);
  const res = await fetch(url.toString(), {
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
  });
  return readJson<any>(res);
}

export async function fetchSendToAmazonWorkflows(params: {
  accountId: string;
  limit?: number;
}) {
  const url = new URL(apiUrl('/api/v1/amazon/send-to-amazon/workflows'));
  url.searchParams.set('accountId', params.accountId);
  if (params.limit !== undefined) url.searchParams.set('limit', String(params.limit));

  const res = await fetch(url.toString(), {
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
  });

  return readJson<SendToAmazonWorkflow[]>(res);
}

export async function saveSendToAmazonWorkflowDraft(body: {
  accountId: string;
  workflowId?: string;
  workflowName?: string;
  marketplaceId?: string;
  shipFromLocationId?: string;
  shipFromAddress?: Record<string, unknown>;
  items: Array<{
    sellerSku: string;
    asin?: string;
    title?: string;
    availableQuantity?: number;
    quantity: number;
    packingMode?: 'individual' | 'case_packed';
    cartonCount?: number;
    unitsPerCarton?: number;
    prepOwner?: 'AMAZON' | 'SELLER';
    labelOwner?: 'AMAZON' | 'SELLER';
  }>;
}) {
  const res = await fetch(apiUrl('/api/v1/amazon/send-to-amazon/workflows'), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  return readJson<SendToAmazonWorkflow>(res);
}

export async function fetchSendToAmazonWorkflow(params: {
  accountId: string;
  workflowId: string;
}) {
  const url = new URL(apiUrl(`/api/v1/amazon/send-to-amazon/workflows/${encodeURIComponent(params.workflowId)}`));
  url.searchParams.set('accountId', params.accountId);

  const res = await fetch(url.toString(), {
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
  });

  return readJson<SendToAmazonWorkflow>(res);
}

export async function generateSendToAmazonPlacementPreview(body: {
  accountId: string;
  workflowId: string;
}) {
  const res = await fetch(apiUrl(`/api/v1/amazon/send-to-amazon/workflows/${encodeURIComponent(body.workflowId)}/placement-preview`), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ accountId: body.accountId }),
  });

  return readJson<SendToAmazonWorkflow>(res);
}

export async function confirmSendToAmazonPlacement(body: {
  accountId: string;
  workflowId: string;
  placementOptionId?: string;
}) {
  const res = await fetch(apiUrl(`/api/v1/amazon/send-to-amazon/workflows/${encodeURIComponent(body.workflowId)}/confirm-placement`), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ accountId: body.accountId, placementOptionId: body.placementOptionId }),
  });

  return readJson<SendToAmazonWorkflow>(res);
}

export async function fetchSendToAmazonShipmentLabels(body: {
  accountId: string;
  workflowId: string;
  shipmentId: string;
}) {
  const res = await fetch(
    apiUrl(
      `/api/v1/amazon/send-to-amazon/workflows/${encodeURIComponent(body.workflowId)}/shipments/${encodeURIComponent(body.shipmentId)}/labels`,
    ),
    {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ accountId: body.accountId }),
    },
  );

  return readJson<{
    workflow: SendToAmazonWorkflow;
    shipmentId: string;
    labelUrl?: string;
    raw?: any;
  }>(res);
}
