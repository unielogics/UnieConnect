import { apiUrl, authFetch, TOKEN_KEY } from './api';

export interface Feature {
  id: string;
  name: string;
  slug: string;
  description: string;
  longDescription?: string;
  category: string;
  icon?: string;
  screenshots?: string[];
  pricing: {
    type: 'free' | 'one-time' | 'subscription';
    amount?: number;
    currency?: string;
    trialDays?: number;
  };
  tags: string[];
  isActive: boolean;
  isStandard: boolean;
  metadata?: {
    route?: string;
    navLabel?: string;
    navIcon?: string;
    navOrder?: number;
    appType?: string;
    appStore?: boolean;
    navGroup?: string;
    navGroupLabel?: string;
    unlockedScreens?: string[];
    requiredConnections?: string[];
    setupSteps?: string[];
    summary?: string;
  };
  payload?: Record<string, unknown>;
  unlockedScreens?: string[];
  requiredConnections?: string[];
  setupSteps?: string[];
  userStatus?: string;
  enabledAt?: string;
  isEnabled?: boolean;
}

export interface FeaturesResponse {
  features: Feature[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  categories?: string[];
}

export async function fetchFeatures(params?: {
  search?: string;
  category?: string;
  isStandard?: boolean;
  pricingType?: string;
  page?: number;
  limit?: number;
}): Promise<FeaturesResponse> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.set('search', params.search);
  if (params?.category) queryParams.set('category', params.category);
  if (params?.isStandard !== undefined) queryParams.set('isStandard', String(params.isStandard));
  if (params?.pricingType) queryParams.set('pricingType', params.pricingType);
  if (params?.page) queryParams.set('page', String(params.page));
  if (params?.limit) queryParams.set('limit', String(params.limit));

  const url = `${apiUrl('/api/v1/features')}?${queryParams.toString()}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await authFetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch features: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchMarketplaceFeatures(params?: {
  search?: string;
  category?: string;
  pricingType?: string;
  page?: number;
  limit?: number;
}): Promise<FeaturesResponse> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.set('search', params.search);
  if (params?.category) queryParams.set('category', params.category);
  if (params?.pricingType) queryParams.set('pricingType', params.pricingType);
  if (params?.page) queryParams.set('page', String(params.page));
  if (params?.limit) queryParams.set('limit', String(params.limit));

  const url = `${apiUrl('/api/v1/features/marketplace')}?${queryParams.toString()}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await authFetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch marketplace features: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchFeature(idOrSlug: string): Promise<Feature> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const url = apiUrl(`/api/v1/features/${idOrSlug}`);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await authFetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch feature: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchUserFeatures(): Promise<{ features: Feature[] }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  const url = apiUrl('/api/v1/user/features');
  const res = await authFetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token.trim()}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch user features: ${res.statusText}`);
  }
  return res.json();
}

export async function enableFeature(idOrSlug: string): Promise<{ success: boolean; message: string; feature: Feature }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  const url = apiUrl(`/api/v1/features/${idOrSlug}/enable`);
  const res = await authFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error || `Failed to enable feature: ${res.statusText}`);
  }
  return res.json();
}

export async function disableFeature(idOrSlug: string): Promise<{ success: boolean; message: string; feature: Feature }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  const url = apiUrl(`/api/v1/features/${idOrSlug}/disable`);
  const res = await authFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error || `Failed to disable feature: ${res.statusText}`);
  }
  return res.json();
}

export async function purchaseFeature(
  idOrSlug: string,
  paymentMethodId?: string
): Promise<{ success: boolean; message: string; feature: Feature }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  const url = apiUrl(`/api/v1/features/${idOrSlug}/purchase`);
  const res = await authFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ paymentMethodId }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error || `Failed to purchase feature: ${res.statusText}`);
  }
  return res.json();
}
