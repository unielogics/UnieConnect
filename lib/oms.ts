import { apiUrl, TOKEN_KEY } from './api';

export type OmsRange = 'today' | '7d' | '30d';

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
    currentMetrics: Record<string, number>;
    optimizedMetrics: Record<string, number>;
    savings: Record<string, number>;
    autonomousAfterApproval: string[];
    approvalRequiredFor: string[];
  };
  latestApproved?: unknown;
  persistence: string;
};
