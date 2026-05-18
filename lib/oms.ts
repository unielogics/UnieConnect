import { apiUrl, TOKEN_KEY } from './api';

export type OmsRange = 'today' | '7d' | '30d';

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const res = await fetch(apiUrl(`/api/v1${path}`), {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || err?.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function omsFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const res = await fetch(apiUrl(`/api/v1/oms${path}`), {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `OMS request failed (${res.status})`);
  }
  return res.json();
}

export type OmsSku = {
  id: string;
  sku: string;
  title?: string;
  supplierId?: string | null;
  available: number;
  inbound: number;
  velocity30d: number;
  daysOfCover: number;
  risk: 'high' | 'medium' | 'low' | string;
  currentWarehouseCount: number;
  proposedWarehouseCount: number;
  proposedUnits: number;
  minViableUnits: number;
  palletCubeFt: number;
  palletWeightLbs: number;
  fillPercent: number;
  serviceTier: 'priority' | 'standard' | 'economy' | string;
  recommendation: string;
};

export type InventoryPlan = {
  current: Record<string, number>;
  proposed: Record<string, number>;
  months: Array<{ month: string; projectedUnits: number; proposedReplenishment: number; savings: number }>;
  skus: OmsSku[];
  warehouses: Array<{ id: string; code?: string; name?: string; city?: string; state?: string }>;
};

export type CommandCenter = {
  range: OmsRange;
  metrics: {
    revenue: number;
    revenueDeltaPct: number;
    orders: number;
    ordersDeltaPct: number;
    aov: number;
    grossProfit: number;
    refunds: number;
    units: number;
    unitsDeltaPct: number;
  };
  warnings: Array<{ severity: string; title: string; detail: string }>;
  autonomousActivity: Array<{ system: string; action: string; status: string; confidence: number; at: string }>;
  counts: Record<string, number>;
};

export type BusinessDoubleResponse = {
  plan: {
    id: string;
    status: string;
    title: string;
    summary: string;
    forecastHorizonMonths?: number;
    currentMetrics: Record<string, number>;
    optimizedMetrics: Record<string, number>;
    savings: Record<string, number>;
    autonomousAfterApproval: string[];
    approvalRequiredFor: string[];
  };
  latestApproved?: unknown;
  persistence: string;
};

/* ============================ Extended OMS types ============================ */

export type CommandCenterFull = {
  range: OmsRange;
  generatedAt?: string;
  source?: { sales?: string; inventory?: string; persistence?: string };
  metrics: CommandCenter['metrics'];
  warnings: Array<{ severity: string; title: string; detail: string }>;
  autonomousActivity: Array<{ system: string; action: string; status: string; confidence: number; at: string; impact?: string }>;
  counts: Record<string, number>;
};

export type InventoryPlanFull = {
  horizon?: string;
  generatedAt?: string;
  current: { skuCount?: number; warehouseCount?: number; stockoutRiskSkus?: number; estimatedMonthlyCost?: number } & Record<string, number>;
  proposed: { warehouseCount?: number; stockoutRiskSkus?: number; estimatedMonthlyCost?: number; sharedPalletCandidates?: number } & Record<string, number>;
  months: Array<{ month: string; projectedUnits: number; proposedReplenishment: number; savings: number }>;
  skus: OmsSku[];
  warehouses: Array<{ id: string; code?: string; name?: string; city?: string; state?: string }>;
};

export type OmsSkuDetail = {
  id: string;
  sku: string;
  title?: string;
  asin?: string;
  image?: string | null;
  supplierId?: string | null;
  dimensions?: { length?: number; width?: number; height?: number } | null;
  weight?: number | null;
  price?: number;
  margin?: number;
  intelligence?: Record<string, unknown> & {
    risk?: string;
    available?: number;
    inbound?: number;
    daysOfCover?: number;
    velocity30d?: number;
    revenue30d?: number;
    grossProfit30d?: number;
  };
  nextShipments: Array<{ id: string; date: string; origin: string; destination: string; quantity: number; status: string; cube?: number; mode?: string }>;
  warehouses: Array<{ code: string; name?: string; region?: string; available: number; inbound: number; daysOfCover: number; storageCost?: number; velocityPerDay?: number; status?: string }>;
  history: Array<{ ts: string; type: string; actor: string; subject: string; impact?: number | null }>;
  channels?: Array<{ channel: string; units30d: number; revenue30d: number; shareOfDemand: number; refundRate: number }>;
  billing?: { currentMonthly: number; optimizedMonthly: number; drivers?: Array<{ wh: string; storage: number; handling: number; accessorial?: number }> };
  relatedSkus?: Array<{ id: string; sku: string; title?: string; daysOfCover: number }>;
};

export type OmsOrder = {
  id: string;
  ch?: string;
  account_channel?: string;
  chOrderId?: string;
  customer?: string;
  customer_name?: string;
  customer_email?: string;
  display_name?: string;
  state?: string;
  items?: number;
  qty?: number;
  total?: number;
  status?: string;
  sla?: string;
  wh?: string;
  sku?: string;
  skuName?: string;
  date?: string;
  promised?: string;
  carrier?: string;
  tracking?: string;
  cost?: number;
};

export type OmsCustomer = {
  id: string;
  name: string;
  email?: string;
  state?: string;
  city?: string;
  primaryChannel?: string;
  orders: number;
  ltv: number;
  aov: number;
  lastOrder?: string;
  firstOrder?: string;
  segment?: string;
  tags?: string[];
};

export type OmsSupplier = {
  id: string;
  name: string;
  country?: string;
  region?: string;
  leadTime?: number;
  onTime?: number;
  qualityPass?: number;
  paymentTerms?: string;
  relationship?: string;
  spend90d?: number;
  spendYTD?: number;
  skuCount?: number;
  rating?: number;
  contact?: string;
  skus?: string[];
};

export type HeatmapResponse = {
  states: Array<{ state: string; demand: number; revenue: number; risk?: number; orders?: number }>;
  warehouses: Array<{ id: string; name?: string; code?: string; state?: string; inventoryUnits?: number; activeSkus?: number; capacity?: number; region?: string; status?: string }>;
};

export type LabelAuditResponse = {
  findings: Array<{
    id: string;
    order?: string;
    carrier: string;
    service?: string;
    trackingNumber?: string;
    tracking?: string;
    findingType?: string;
    issue?: string;
    severity?: string;
    refundAmount?: number;
    refund?: number;
    cost?: number;
    weight?: string | number;
    dim?: string;
    zone?: number;
    shipped?: string;
    promised?: string;
    delivered?: string;
    status?: string;
    auditStatus?: string;
    recommendation?: string;
    optimizedCarrier?: string;
    optimizedCost?: number;
  }>;
  summary: { openFindings?: number; estimatedRefunds?: number; optimizedServiceSavings?: number; labels30d?: number; lateDeliveries?: number };
};

export type BillingProfitResponse = {
  revenue?: number;
  current: { freight: number; storage: number; handling: number; accessorials: number; refundsCaptured: number; lostRevenue?: number } & Record<string, number>;
  optimized: { freight: number; storage: number; handling: number; accessorials: number; refundsCaptured: number; lostRevenue?: number } & Record<string, number>;
  perWarehouse?: Array<{ code: string; region?: string; current: number; optimized: number }>;
};

export type LedgerResponse = {
  events: Array<{
    id: string;
    entity_type?: string;
    entity_id?: string;
    event_type?: string;
    source_system?: string;
    actor?: string;
    type?: string;
    summary?: string;
    subject?: string;
    payload?: Record<string, unknown>;
    confidence?: number;
    impact?: number;
    evidence?: number;
    status?: string;
    created_at?: string;
    ts?: string;
  }>;
  persistence?: string;
};

export type CopilotContext = {
  screen: string;
  posture?: string;
  summary?: string;
  recommendedPrompts?: string[];
  latestSignals?: Array<{ title?: string; detail?: string; confidence?: number }>;
};

export const fetchCommandCenter = (range: OmsRange) =>
  omsFetch<CommandCenterFull>(`/command-center?range=${range}`);

export const fetchBusinessDouble = () => omsFetch<BusinessDoubleResponse>('/business-double');

export const approveBusinessDouble = (planId: string) =>
  omsFetch<{ approved: boolean; planId: string }>(`/business-double/${encodeURIComponent(planId)}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

export const fetchInventoryPlan = (horizon: '6m' | '3m' = '6m') =>
  omsFetch<InventoryPlanFull>(`/inventory-plan?horizon=${horizon}`);

export const fetchOmsSkus = () => omsFetch<{ skus: OmsSku[]; total: number }>('/skus');

export const fetchOmsSkuDetail = (skuId: string) =>
  omsFetch<OmsSkuDetail>(`/skus/${encodeURIComponent(skuId)}`);

export const fetchOmsOrders = () => omsFetch<{ orders: OmsOrder[] }>('/orders');

export const fetchOmsCustomers = () => omsFetch<{ customers: OmsCustomer[] }>('/customers');

export const fetchOmsSuppliers = () =>
  omsFetch<{ suppliers: OmsSupplier[]; locations: Array<Record<string, unknown>> }>('/suppliers');

export const fetchHeatmap = () => omsFetch<HeatmapResponse>('/heatmap');

export const fetchLabelAudit = () => omsFetch<LabelAuditResponse>('/label-audit');

export const fetchBillingProfit = () => omsFetch<BillingProfitResponse>('/billing-profit');

export const fetchLedger = () => omsFetch<LedgerResponse>('/ledger');

export const fetchCopilotContext = (screen: string) =>
  omsFetch<CopilotContext>(`/copilot/context?screen=${encodeURIComponent(screen)}`);

export const createShipmentDraft = (body: unknown) =>
  omsFetch<{ draft: { id: string } & Record<string, unknown>; persistence: string }>('/shipment-wizard/drafts', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const confirmShipmentDraft = (draftId: string, body: unknown) =>
  omsFetch<Record<string, unknown>>(`/shipment-wizard/drafts/${encodeURIComponent(draftId)}/confirm`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

/* ============================ Create / ticket fetchers ============================ */

export type CreateCatalogItemBody = {
  sku: string;
  title: string;
  description?: string;
  image?: string;
  upc?: string;
  ean?: string;
  asin?: string;
  category?: string;
  subCategory?: string;
  lob?: string;
  weight?: number;
  dimensions?: { length?: number; width?: number; height?: number };
  supplierId?: string;
  tags?: string[];
};

export const createCatalogItem = async (body: CreateCatalogItemBody) => {
  const result = await apiFetch<any>('/items', { method: 'POST', body: JSON.stringify(body) });
  return { item: result?.item || result };
};

export type UploadedImage = {
  key: string;
  bucket: string;
  contentType: string;
  size: number;
  url: string;
  storage: 's3';
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',').pop() || '');
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

export const uploadCatalogImage = async (file: File) =>
  apiFetch<UploadedImage>('/uploads/images', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      dataBase64: await fileToBase64(file),
    }),
  });

export type CreateCustomerBody = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  channel?: string;
  externalCustomerId?: string;
  addresses?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
};

export const createCustomer = async (body: CreateCustomerBody) => {
  const result = await apiFetch<any>('/customers', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { customer: result?.customer || result };
};

export type CreateOrderLine = {
  itemId?: string;
  sku?: string;
  title?: string;
  quantity: number;
  unitPrice: number;
};

export type CreateOrderBody = {
  customerId: string;
  lines: CreateOrderLine[];
  channel?: string;
  externalOrderId?: string;
  orderNumber?: string;
  status?: string;
  paid?: boolean;
  total?: number;
  currency?: string;
  shippingAddress?: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export const createManualOrder = async (body: CreateOrderBody) => {
  const result = await apiFetch<any>('/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { order: result?.order || result };
};

export type SupportTicket = {
  id: string;
  subject: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  channel?: string;
  priority: string;
  status: string;
  owner?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateTicketBody = {
  subject: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  channel?: string;
  priority?: string;
};

export const fetchTickets = () =>
  apiFetch<{ tickets: SupportTicket[] }>('/support/tickets');

export const createTicket = (body: CreateTicketBody) =>
  apiFetch<{ ticket: SupportTicket }>('/support/tickets', { method: 'POST', body: JSON.stringify(body) });

export const updateTicketStatus = (id: string, status: string) =>
  apiFetch<{ ticket: SupportTicket }>(`/support/tickets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
