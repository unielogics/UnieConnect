import { omsFetch } from './oms';

export type OmsCustomApp = {
  id: string;
  templateFeatureId?: string | null;
  name: string;
  description?: string | null;
  icon: string;
  status: 'draft' | 'active' | 'paused' | 'archived' | string;
  visibility: 'private' | string;
  config: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type OmsAiEmployee = {
  id: string;
  appId?: string | null;
  name: string;
  role: string;
  instructions: string;
  autonomyLevel: 'guarded' | string;
  allowedDataSources: string[];
  allowedActions: string[];
  status: 'active' | 'paused' | string;
  config: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type OmsWorkflow = {
  id: string;
  appId?: string | null;
  aiEmployeeId?: string | null;
  name: string;
  description?: string | null;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  definition: Record<string, unknown>;
  guardrailPolicy: Record<string, unknown>;
  status: 'draft' | 'active' | 'paused' | string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
};

export type OmsWorkflowRun = {
  id: string;
  workflowId?: string | null;
  appId?: string | null;
  aiEmployeeId?: string | null;
  workflowName?: string | null;
  status: string;
  triggerType: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error?: string | null;
  confidence?: number | null;
  approvalState: string;
  createdAt?: string;
  completedAt?: string;
};

export type OmsApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  status: string;
  lastUsedAt?: string | null;
  createdAt?: string;
};

export const fetchOmsApps = () => omsFetch<{ apps: OmsCustomApp[] }>('/apps');

export const createOmsApp = (body: {
  name: string;
  description?: string;
  icon?: string;
  status?: string;
  templateFeatureId?: string;
  config?: Record<string, unknown>;
}) => omsFetch<{ app: OmsCustomApp }>('/apps', { method: 'POST', body: JSON.stringify(body) });

export const installOmsAppTemplate = (templateFeatureId: string, body?: { name?: string; config?: Record<string, unknown> }) =>
  omsFetch<{ app: OmsCustomApp }>(`/apps/${encodeURIComponent(templateFeatureId)}/install-template`, {
    method: 'POST',
    body: JSON.stringify(body || {}),
  });

export const archiveOmsApp = (id: string) =>
  omsFetch<{ success: boolean; app: OmsCustomApp }>(`/apps/${encodeURIComponent(id)}/archive`, { method: 'POST' });

export const fetchAiEmployees = () => omsFetch<{ employees: OmsAiEmployee[] }>('/ai-employees');

export const createAiEmployee = (body: {
  name: string;
  role?: string;
  instructions?: string;
  appId?: string;
  allowedDataSources?: string[];
  allowedActions?: string[];
}) => omsFetch<{ employee: OmsAiEmployee }>('/ai-employees', { method: 'POST', body: JSON.stringify(body) });

export const fetchWorkflows = () => omsFetch<{ workflows: OmsWorkflow[] }>('/workflows');

export const createWorkflow = (body: {
  name: string;
  description?: string;
  appId?: string;
  aiEmployeeId?: string;
  triggerType: string;
  triggerConfig?: Record<string, unknown>;
  definition: Record<string, unknown>;
  status?: string;
}) => omsFetch<{ workflow: OmsWorkflow }>('/workflows', { method: 'POST', body: JSON.stringify(body) });

export const runWorkflow = (id: string, input?: Record<string, unknown>) =>
  omsFetch<{ run: OmsWorkflowRun; duplicate?: boolean }>(`/workflows/${encodeURIComponent(id)}/run`, {
    method: 'POST',
    body: JSON.stringify({ input: input || {} }),
  });

export const approveWorkflowRun = (workflowId: string, runId: string) =>
  omsFetch<{ run: OmsWorkflowRun }>(`/workflows/${encodeURIComponent(workflowId)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ runId }),
  });

export const fetchWorkflowRuns = (limit = 100) =>
  omsFetch<{ runs: OmsWorkflowRun[] }>(`/workflow-runs?limit=${limit}`);

export const fetchOmsApiKeys = () => omsFetch<{ apiKeys: OmsApiKey[]; availableScopes: string[] }>('/api-keys');

export const createOmsApiKey = (body: { name: string; scopes: string[] }) =>
  omsFetch<{ apiKey: string; key: OmsApiKey; warning: string }>('/api-keys', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const rotateOmsApiKey = (id: string) =>
  omsFetch<{ apiKey: string; key: OmsApiKey; warning: string }>(`/api-keys/${encodeURIComponent(id)}/rotate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

export const revokeOmsApiKey = (id: string) =>
  omsFetch<{ success: boolean; key: OmsApiKey }>(`/api-keys/${encodeURIComponent(id)}/revoke`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
