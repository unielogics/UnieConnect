import { apiUrl, authFetch } from './api';

export type OmsRange = 'today' | '7d' | '30d';

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await authFetch(apiUrl(`/api/v1${path}`), {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
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
  const res = await authFetch(apiUrl(`/api/v1/oms${path}`), {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const details = Array.isArray(err?.details?.errors) && err.details.errors.length ? ` ${err.details.errors.slice(0, 5).join(' ')}` : '';
    throw new Error(`${err?.error || `OMS request failed (${res.status})`}${details}`);
  }
  return res.json();
}

export function publicEntityId(prefix: string, value: unknown): string {
  const normalizedPrefix = String(prefix || 'AC').slice(0, 2).toUpperCase().padEnd(2, 'X');
  const source = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `${normalizedPrefix}${String(hash % 100000000).padStart(8, '0')}`;
}

export function entityPrefix(entityType?: string): string {
  const key = String(entityType || '').toLowerCase().replace(/[-\s]+/g, '_');
  const map: Record<string, string> = {
    asn: 'AS',
    customer: 'CU',
    intermediary: 'IN',
    invoice: 'IV',
    item: 'SK',
    order: 'OR',
    shipment: 'SH',
    shipment_plan: 'SH',
    sku: 'SK',
    supplier: 'SU',
    support_ticket: 'TI',
    ticket: 'TI',
    warehouse: 'WH',
  };
  return map[key] || 'AC';
}

export type OmsSku = {
  id: string;
  sku: string;
  title?: string;
  supplierId?: string | null;
  asin?: string | null;
  enrichmentState?: string;
  enrichmentMarker?: string;
  keepaUnavailable?: boolean;
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

export type MarketplaceFilterParams = {
  channel?: string;
  channelAccountId?: string;
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
    source?: {
      authority?: string;
      cortexRunId?: string | null;
      sellerOptimizationRunId?: string | null;
      sellerOptimizationStatus?: string | null;
      confidence?: number | null;
      generatedAt?: string;
    };
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
  source?: {
    authority?: string;
    cortexRunId?: string | null;
    sellerOptimizationRunId?: string | null;
    sellerOptimizationStatus?: string | null;
    confidence?: number | null;
    generatedAt?: string;
  };
  current: { skuCount?: number; warehouseCount?: number; stockoutRiskSkus?: number; estimatedMonthlyCost?: number } & Record<string, number>;
  proposed: { warehouseCount?: number; stockoutRiskSkus?: number; estimatedMonthlyCost?: number; sharedPalletCandidates?: number } & Record<string, number>;
  months: Array<{ month: string; projectedUnits: number; proposedReplenishment: number; savings: number }>;
  skus: OmsSku[];
  warehouses: Array<{ id: string; code?: string; name?: string; city?: string; state?: string }>;
};

export type OmsWarehouseOverview = {
  id: string;
  warehouseCode: string;
  code: string;
  name?: string;
  status: string;
  facilityId?: string | null;
  facilityCode?: string | null;
  facilityName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  address?: Record<string, unknown>;
  region?: string | null;
  inventoryUnits: number;
  activeSkus: number;
  orders: number;
  asns: number;
  activityCount: number;
  lastWmsEventAt?: string | null;
  lastWmsEventType?: string | null;
  connectedAt?: string;
};

export type OmsWarehouseDetail = {
  warehouse: OmsWarehouseOverview;
  inventory: Array<{ id: string; sku: string; title?: string; available: number; inbound: number; received: number; orders: number; shippedToday: number; openAsnsCount: number; receiving: number; updatedAt?: string }>;
  orders: Array<{ id: string; publicId?: string; orderNumber?: string; customer?: string | null; channel?: string; status?: string; total?: number; placedAt?: string; createdAt?: string }>;
  asns: Array<{ id: string; publicId?: string; asnNumber?: string; status?: string; shipmentPlanId?: string; shipmentTitle?: string; units?: number; createdAt?: string; updatedAt?: string }>;
  shipmentPlans: Array<{ id: string; publicId?: string; title?: string; status?: string; units?: number; estimatedArrivalDate?: string; updatedAt?: string }>;
  wmsEvents: Array<{ id: string; eventType?: string; entityType?: string; entityId?: string; status?: string; payload?: Record<string, unknown>; receivedAt?: string }>;
  ledger: Array<{ id: string; entity_type?: string; entity_id?: string; event_type?: string; source_system?: string; summary?: string; payload?: Record<string, unknown>; confidence?: number; createdAt?: string }>;
  cortex: { readiness?: string; signals?: string[]; recommendations?: string[] };
};

export type OmsSkuDetail = {
  id: string;
  sku: string;
  title?: string;
  subtitle?: string;
  description?: string;
  asin?: string;
  upc?: string | null;
  ean?: string | null;
  brand?: string | null;
  category?: string | null;
  subCategory?: string | null;
  image?: string | null;
  images?: string[];
  supplierId?: string | null;
  dimensions?: { length?: number; width?: number; height?: number } | null;
  weight?: number | null;
  price?: number;
  cost?: number;
  margin?: number;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  amazon?: Record<string, unknown> | null;
  keepa?: Record<string, unknown> | null;
  enrichmentState?: string;
  enrichmentMarker?: string;
  keepaUnavailable?: boolean;
  fulfillmentEconomics?: SkuFulfillmentEconomics[];
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

export type SkuFulfillmentEconomics = {
  id?: string;
  itemId?: string;
  sku?: string;
  workflowType: 'FBA' | 'FBW' | 'FBM' | 'DTC' | string;
  anchorWarehouseCode?: string | null;
  rateShopScope?: string | null;
  networkPolicy?: Record<string, any>;
  sourceQuality?: string | null;
  confidence?: number;
  currency?: string;
  quantity?: number;
  costs?: Record<string, any>;
  blockers?: string[];
  sourceLabels?: string[];
  quantityRecommendation?: Record<string, any>;
  pricingPayload?: Record<string, any> & {
    networkComparison?: {
      basis?: string;
      heatmapStrategy?: string;
      note?: string;
      demandHeatmap?: Record<string, any>;
      singleWarehouse?: Record<string, any>;
      optimizedTwoNode?: Record<string, any>;
    };
  };
  generatedAt?: string | null;
  expiresAt?: string | null;
  cacheState?: string;
};

export type OmsOrder = {
  id: string;
  publicId?: string;
  displayId?: string;
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

export type OmsAsn = {
  id: string;
  publicId?: string;
  displayId?: string;
  asnNumber?: string;
  status: string;
  shipmentPlanId?: string;
  shipmentDisplayId?: string | null;
  shipmentTitle?: string;
  shipmentStatus?: string | null;
  supplierId?: string | null;
  supplierDisplayId?: string | null;
  supplierName?: string | null;
  facilityCode?: string | null;
  facilityName?: string | null;
  estimatedArrivalDate?: string;
  units?: number;
  createdAt?: string;
  updatedAt?: string;
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

export type SupplierPickupProfile = {
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
  address?: Record<string, unknown>;
};

export type OmsSupplier = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  website?: string | null;
  notes?: string | null;
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
  pickupProfile?: SupplierPickupProfile;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type SupplierActivityRecord = {
  id: string;
  type: 'sku' | 'shipment_plan' | 'asn' | 'bol' | 'label' | 'order' | 'invoice' | 'activity' | 'ledger' | string;
  title: string;
  subtitle?: string;
  status?: string;
  units?: number;
  amount?: number;
  confidence?: number | null;
  date?: string;
  summary?: string;
  target?: string;
  targetId?: string;
};

export type SupplierActivityResponse = {
  supplier: OmsSupplier;
  summary: {
    skus: number;
    shipmentPlans: number;
    asns: number;
    documents: number;
    orderCount: number;
    orderUnits: number;
    shipmentUnits: number;
    invoiceAmount: number;
    lastActivityAt?: string;
  };
  records: SupplierActivityRecord[];
};

export type HeatmapResponse = {
  states: Array<{ state: string; demand: number; revenue: number; risk?: number; orders?: number }>;
  warehouses: Array<{
    id: string;
    name?: string;
    code?: string;
    city?: string | null;
    state?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    inventoryUnits?: number;
    activeSkus?: number;
    capacity?: number;
    region?: string;
    status?: string;
  }>;
  itemStates?: Array<{ itemId?: string | null; sku: string; title?: string; state: string; orders: number; units: number; revenue: number }>;
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
    source?: string;
    runId?: string;
  }>;
  summary: { openFindings?: number; estimatedRefunds?: number; optimizedServiceSavings?: number; labels30d?: number; lateDeliveries?: number };
  cortex?: {
    available?: boolean;
    status?: string;
    featureEnabled?: boolean;
    credentialActive?: boolean;
    configured?: boolean;
    message?: string;
  };
};

export type LabelAuditCsvRow = Record<string, string | number | null | undefined>;

export type LabelAuditRun = {
  id: string;
  publicId: string;
  filename?: string | null;
  status: string;
  rowCount: number;
  findingsCount: number;
  estimatedRefunds: number;
  optimizedServiceSavings: number;
  missingEvidenceCount: number;
  inputSummary?: Record<string, unknown>;
  resultSummary?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
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
  readiness?: IntelligenceReadiness;
  recommendations?: OmsRecommendation[];
};

export type CortexTask = {
  id: string;
  publicId?: string;
  dedupeKey?: string;
  source: string;
  screen: string;
  entityType?: string | null;
  entityId?: string | null;
  title: string;
  detail?: string;
  priority: 'high' | 'normal' | 'low' | string;
  status: 'open' | 'done' | 'dismissed' | string;
  actionLabel?: string | null;
  actionTarget?: string | null;
  evidence?: Record<string, unknown>;
  recommendationId?: string | null;
  completedAt?: string;
  dismissedAt?: string;
  autoCompletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CortexChatThread = {
  id: string;
  publicId?: string;
  screen: string;
  entityType?: string | null;
  entityId?: string | null;
  title: string;
  status: string;
  lastMessageAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CortexChatMessage = {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  sources?: Array<Record<string, unknown>>;
  tasks?: Array<Record<string, unknown>>;
  confidence?: number | null;
  readinessNotes?: string | null;
  cortexStatus?: string;
  createdAt?: string;
};

export type CortexChatResponse = {
  thread?: CortexChatThread | null;
  message?: CortexChatMessage | null;
  context?: { screen?: string; readiness?: IntelligenceReadiness; tasks?: CortexTask[]; recommendations?: OmsRecommendation[] };
  cortex?: {
    ok?: boolean;
    status?: number;
    health?: { available?: boolean; chatIntegrated?: boolean; status?: number; reason?: string };
  };
};

export type IntelligenceReadiness = {
  score: number;
  posture: 'ready' | 'limited' | 'needs_data' | string;
  sourceMode: 'marketplace_primary' | 'marketplace_plus_csv' | 'csv_fallback' | 'manual_only' | string;
  primarySource: string;
  counts: Record<string, number>;
  blockers: string[];
  sourcePriority: string[];
  cortex?: { configured?: boolean; cortexApiUrl?: string };
  persistence?: string;
};

export type OmsRecommendation = {
  id: string;
  publicId?: string;
  runId?: string;
  recommendationType: string;
  entityType?: string;
  entityId?: string;
  title: string;
  summary: string;
  currentValue: Record<string, unknown>;
  optimizedValue: Record<string, unknown>;
  estimatedImpact: Record<string, unknown>;
  requiredAction?: string;
  approvalState: string;
  wmsTruthState: string;
  confidence?: number | null;
  sourceSummary?: Record<string, unknown>;
  status: string;
  rejectionReason?: string;
  createdAt?: string;
};

export type IntelligenceRun = {
  id: string;
  publicId?: string;
  runType: string;
  status: string;
  sourceSummary?: IntelligenceReadiness;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  confidence?: number | null;
  cortexStatus?: string;
  error?: string | null;
  createdAt?: string;
  completedAt?: string;
};

export type ProductResearchResult = {
  id: string;
  publicId?: string;
  runId?: string;
  itemId?: string | null;
  sku: string;
  status: string;
  input: Record<string, unknown>;
  result: {
    sku: string;
    title?: string;
    asin?: string | null;
    opportunityScore?: number;
    productRisk?: string;
    marketplaceReadiness?: string;
    margin?: Record<string, unknown>;
    fulfillment?: Record<string, unknown>;
    recommendedAction?: string;
    missingData?: string[];
  };
  confidence?: number | null;
  createdAt?: string;
};

export type AmazonItemProfile = {
  id?: string;
  itemId?: string;
  channelConnectionId?: string | null;
  marketplaceId?: string;
  sellerSku?: string;
  asin?: string | null;
  title?: string;
  listingStatus?: string;
  fulfillmentChannel?: string;
  availableFbaQty?: number;
  inboundWorkingQty?: number;
  inboundShippedQty?: number;
  inboundReceivingQty?: number;
  reservedQty?: number;
  syncStatus?: string;
  lastAmazonSyncAt?: string | null;
  blockers?: string[];
  fbaEligible?: boolean;
  identityState?: string;
  raw?: Record<string, unknown>;
};

export type SellerOptimizationSummary = {
  id: string;
  publicId?: string;
  runId?: string;
  status: string;
  summary: Record<string, unknown>;
  businessDouble?: Record<string, unknown>;
  inventoryPlan?: Record<string, unknown>;
  confidence?: number | null;
  createdAt?: string;
};

export const fetchCommandCenter = (range: OmsRange) =>
  omsFetch<CommandCenterFull>(`/command-center?range=${range}`);

export const fetchBusinessDouble = () => omsFetch<BusinessDoubleResponse>('/business-double');

export const approveBusinessDouble = (planId: string) =>
  omsFetch<{ approved: boolean; planId: string }>(`/business-double/${encodeURIComponent(planId)}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

const marketplaceQuery = (params?: MarketplaceFilterParams) => {
  const qs = new URLSearchParams();
  if (params?.channel) qs.set('channel', params.channel);
  if (params?.channelAccountId) qs.set('channelAccountId', params.channelAccountId);
  return qs;
};

export const fetchInventoryPlan = (horizon: '6m' | '3m' = '6m', filter?: MarketplaceFilterParams) => {
  const qs = marketplaceQuery(filter);
  qs.set('horizon', horizon);
  return omsFetch<InventoryPlanFull>(`/inventory-plan?${qs.toString()}`);
};

export const fetchOmsSkus = (filter?: MarketplaceFilterParams) => {
  const qs = marketplaceQuery(filter);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return omsFetch<{ skus: OmsSku[]; total: number }>(`/skus${suffix}`);
};

export const fetchOmsSkuDetail = (skuId: string) =>
  omsFetch<OmsSkuDetail>(`/skus/${encodeURIComponent(skuId)}`);

export type OmsSkuEnrichmentUpdate = {
  title?: string | null;
  subtitle?: string | null;
  brand?: string | null;
  description?: string | null;
  size?: string | null;
  weight?: number | null;
  dimensions?: { length?: number | null; width?: number | null; height?: number | null };
  upc?: string | null;
  ean?: string | null;
  asin?: string | null;
  images?: string[];
  price?: number | null;
  cost?: number | null;
  category?: string | null;
  subCategory?: string | null;
  supplierId?: string | null;
  marketplaceSource?: string | null;
};

export const updateOmsSkuEnrichment = (skuId: string, payload: OmsSkuEnrichmentUpdate) =>
  omsFetch<OmsSkuDetail>(`/skus/${encodeURIComponent(skuId)}/enrichment`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const fetchOmsOrders = (filter?: MarketplaceFilterParams) => {
  const qs = marketplaceQuery(filter);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return omsFetch<{ orders: OmsOrder[] }>(`/orders${suffix}`);
};

export const fetchOmsAsns = () => omsFetch<{ asns: OmsAsn[] }>('/asns');

export const cancelOrder = (id: string, reason?: string) =>
  apiFetch<{ order: OmsOrder; success: boolean }>(`/orders/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || 'Cancelled from OMS' }),
  });

export const cancelAsn = (id: string, reason?: string) =>
  apiFetch<{ asn: OmsAsn; success: boolean }>(`/asn/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || 'Cancelled from OMS' }),
  });

export const stopAsn = (id: string, reason?: string) =>
  apiFetch<{ asn: OmsAsn; success: boolean }>(`/asn/${encodeURIComponent(id)}/stop`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || 'Stopped before warehouse execution' }),
  });

export const fetchOmsCustomers = () => omsFetch<{ customers: OmsCustomer[] }>('/customers');

export const fetchOmsSuppliers = () =>
  omsFetch<{ suppliers: OmsSupplier[]; locations: Array<Record<string, unknown>> }>('/suppliers');

export const fetchOmsSupplierActivity = (supplierId: string) =>
  omsFetch<SupplierActivityResponse>(`/suppliers/${encodeURIComponent(supplierId)}/activity`);

export const fetchHeatmap = () => omsFetch<HeatmapResponse>('/heatmap');

export const fetchWarehouseOverview = () => omsFetch<{ warehouses: OmsWarehouseOverview[]; total: number }>('/warehouses/overview');

export const fetchWarehouseDetail = (warehouseCode: string) =>
  omsFetch<OmsWarehouseDetail>(`/warehouses/${encodeURIComponent(warehouseCode)}/detail`);

export const fetchLabelAudit = () => omsFetch<LabelAuditResponse>('/label-audit');

export const createLabelAuditRun = (body: { filename?: string; rows: LabelAuditCsvRow[] }) =>
  omsFetch<{ run: LabelAuditRun; findings: LabelAuditResponse['findings'] }>('/label-audit/runs', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const fetchLabelAuditRuns = () => omsFetch<{ runs: LabelAuditRun[] }>('/label-audit/runs');

export const fetchLabelAuditRun = (id: string) =>
  omsFetch<{ run: LabelAuditRun; findings: LabelAuditResponse['findings'] }>(`/label-audit/runs/${encodeURIComponent(id)}`);

export const fetchBillingProfit = () => omsFetch<BillingProfitResponse>('/billing-profit');

export const fetchLedger = () => omsFetch<LedgerResponse>('/ledger');

export const fetchCopilotContext = (screen: string) =>
  omsFetch<CopilotContext>(`/intelligence/copilot/context?screen=${encodeURIComponent(screen)}`);

export const sendCortexChat = (body: { screen: string; message: string; threadId?: string | null; entityType?: string; entityId?: string }) =>
  omsFetch<CortexChatResponse>('/intelligence/cortex/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const fetchCortexChatHealth = (screen = 'command') =>
  omsFetch<{ ok: boolean; status?: number; health?: NonNullable<CortexChatResponse['cortex']>['health'] }>(
    `/intelligence/cortex/health?screen=${encodeURIComponent(screen)}`
  );

export const fetchCortexChatThreads = (screen?: string) => {
  const qs = new URLSearchParams();
  if (screen) qs.set('screen', screen);
  return omsFetch<{ threads: CortexChatThread[] }>(`/intelligence/cortex/chat/threads?${qs.toString()}`);
};

export const fetchCortexChatThread = (id: string) =>
  omsFetch<{ thread: CortexChatThread; messages: CortexChatMessage[] }>(`/intelligence/cortex/chat/threads/${encodeURIComponent(id)}`);

export const fetchCortexTasks = (params?: { status?: string; screen?: string; refresh?: boolean; limit?: number }) => {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.screen) qs.set('screen', params.screen);
  if (params?.refresh) qs.set('refresh', 'true');
  if (params?.limit) qs.set('limit', String(params.limit));
  return omsFetch<{ tasks: CortexTask[] }>(`/intelligence/tasks?${qs.toString()}`);
};

export const refreshCortexTasks = () =>
  omsFetch<{ tasks: CortexTask[]; readiness?: IntelligenceReadiness }>('/intelligence/tasks/refresh', {
    method: 'POST',
    body: JSON.stringify({}),
  });

export const completeCortexTask = (id: string) =>
  omsFetch<{ task: CortexTask }>(`/intelligence/tasks/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

export const dismissCortexTask = (id: string) =>
  omsFetch<{ task: CortexTask }>(`/intelligence/tasks/${encodeURIComponent(id)}/dismiss`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

export const fetchIntelligenceReadiness = () =>
  omsFetch<IntelligenceReadiness>('/intelligence/readiness');

export const runProductResearch = (body: Record<string, unknown>) =>
  omsFetch<{ run: IntelligenceRun; result: ProductResearchResult; recommendation?: OmsRecommendation }>('/intelligence/product-research/runs', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const runBulkProductResearch = (body: { filename?: string; rows: Array<Record<string, unknown>> }) =>
  omsFetch<{ runId: string; status: string; rowCount: number; results: ProductResearchResult[] }>('/intelligence/product-research/bulk', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const fetchProductResearchRuns = () =>
  omsFetch<{ runs: IntelligenceRun[] }>('/intelligence/product-research/runs');

export const fetchProductResearchResult = (skuId: string) =>
  omsFetch<ProductResearchResult>(`/intelligence/product-research/results/${encodeURIComponent(skuId)}`);

export const runSellerOptimization = (body: Record<string, unknown> = {}) =>
  omsFetch<{
    run: IntelligenceRun;
    optimization: SellerOptimizationSummary;
    recommendations: OmsRecommendation[];
    readiness: IntelligenceReadiness;
  }>('/intelligence/seller-optimization/runs', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const fetchLatestOptimization = () =>
  omsFetch<{ latest?: SellerOptimizationSummary | null; readiness: IntelligenceReadiness; recommendations: OmsRecommendation[] }>('/intelligence/latest-optimization');

export const fetchRunStatus = (runId: string) =>
  omsFetch<IntelligenceRun>(`/intelligence/runs/${encodeURIComponent(runId)}/status`);

export const fetchRecommendations = (params?: { screen?: string; status?: string; entityType?: string; limit?: number }) => {
  const qs = new URLSearchParams();
  if (params?.screen) qs.set('screen', params.screen);
  if (params?.status) qs.set('status', params.status);
  if (params?.entityType) qs.set('entityType', params.entityType);
  if (params?.limit) qs.set('limit', String(params.limit));
  return omsFetch<{ recommendations: OmsRecommendation[] }>(`/intelligence/recommendations?${qs.toString()}`);
};

export const approveRecommendation = (id: string, body: Record<string, unknown> = {}) =>
  omsFetch<{ recommendation: OmsRecommendation }>(`/intelligence/recommendations/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const rejectRecommendation = (id: string, reason: string) =>
  omsFetch<{ recommendation: OmsRecommendation }>(`/intelligence/recommendations/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

export type AmazonListingValidation = {
  required: Array<{ key: string; label: string }>;
  errors: string[];
  warnings: string[];
};

export type AmazonListingDraftResponse = {
  draft: Record<string, unknown>;
  validation: AmazonListingValidation;
};

export const syncAmazonItems = (body: Record<string, unknown> = {}) =>
  apiFetch<{ synced: number; providerStatus: string; items: Array<Record<string, unknown>> }>('/amazon/items/sync', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const refreshAmazonItem = (itemId: string, body: Record<string, unknown> = {}) =>
  apiFetch<{ item: Record<string, unknown> | null }>(`/amazon/items/${encodeURIComponent(itemId)}/refresh`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const createAmazonListingDraft = (body: Record<string, unknown>) =>
  apiFetch<AmazonListingDraftResponse>('/amazon/listings/drafts', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const validateAmazonListingDraft = (draftId: string, payload: Record<string, unknown>) =>
  apiFetch<AmazonListingDraftResponse>(`/amazon/listings/drafts/${encodeURIComponent(draftId)}/validate`, {
    method: 'POST',
    body: JSON.stringify({ payload }),
  });

export const publishAmazonListingDraft = (draftId: string, payload: Record<string, unknown>) =>
  apiFetch<{ draft: Record<string, unknown>; submissionResult: Record<string, unknown> }>(`/amazon/listings/drafts/${encodeURIComponent(draftId)}/publish`, {
    method: 'POST',
    body: JSON.stringify({ payload }),
  });

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

export const fetchShipmentPalletLabels = async (draftId: string): Promise<Blob> => {
  const res = await authFetch(apiUrl(`/api/v1/oms/shipment-wizard/drafts/${encodeURIComponent(draftId)}/pallet-labels.pdf`), {
    headers: { Accept: 'application/pdf' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Failed to fetch pallet labels (${res.status})`);
  }
  return res.blob();
};

export const retryShipmentVendorEmail = (draftId: string) =>
  omsFetch<{ status: 'sent' | 'queued' | 'failed' | 'not_configured'; recipient?: string | null; reason?: string }>(
    `/shipment-wizard/drafts/${encodeURIComponent(draftId)}/vendor-email/retry`,
    { method: 'POST' },
  );

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
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
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

export type UploadedAttachment = UploadedImage & {
  filename?: string;
  purpose?: string;
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

export const uploadSupportAttachment = async (file: File) =>
  apiFetch<UploadedAttachment>('/uploads/files', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      dataBase64: await fileToBase64(file),
      purpose: 'support-attachment',
    }),
  });

export const fetchSkuFulfillmentEconomics = (
  skuId: string,
  workflowType: 'FBA' | 'FBW' | 'FBM' | 'DTC' | string = 'DTC',
) =>
  apiFetch<{ skuId: string; sku: string; workflowType: string; economics: SkuFulfillmentEconomics | null; status: string }>(
    `/skus/${encodeURIComponent(skuId)}/fulfillment-economics?workflowType=${encodeURIComponent(workflowType)}`,
  );

export const refreshSkuFulfillmentEconomics = (
  skuId: string,
  body: {
    workflowType?: 'FBA' | 'FBW' | 'FBM' | 'DTC' | string;
    serviceWorkflow?: 'prep' | 'dtc_fbm' | string;
    marketplaceType?: 'FBA' | 'FBW' | 'FBM' | 'DTC' | string;
    quantity?: number;
    unitsPerCarton?: number;
    cartons?: number;
    item?: Record<string, unknown>;
  } = {},
) =>
  apiFetch<{ skuId: string; sku: string; workflowType: string; economics: SkuFulfillmentEconomics | null; status: string; cortex?: unknown }>(
    `/skus/${encodeURIComponent(skuId)}/fulfillment-economics/refresh`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );

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
  publicId?: string;
  displayId?: string;
  subject: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  entityDisplayId?: string;
  linkedEntityDisplayId?: string;
  channel?: string;
  priority: string;
  status: string;
  owner?: string;
  messagesCount?: number;
  attachmentsCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type SupportTicketMessage = {
  id: string;
  publicId?: string;
  ticketId: string;
  authorType: string;
  authorName?: string;
  body: string;
  attachments?: UploadedAttachment[];
  createdAt?: string;
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

export const fetchTicketDetail = (id: string) =>
  apiFetch<{ ticket: SupportTicket; messages: SupportTicketMessage[] }>(`/support/tickets/${encodeURIComponent(id)}`);

export const addTicketMessage = (
  id: string,
  body: { body?: string; attachments?: UploadedAttachment[]; authorType?: string; authorName?: string },
) =>
  apiFetch<{ message: SupportTicketMessage }>(`/support/tickets/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
