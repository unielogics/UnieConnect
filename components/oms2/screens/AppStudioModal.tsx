import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, ErrorState, Loading, Modal, StatusChip, Tabs } from '../ui';
import { Feature, fetchMarketplaceFeatures } from '../../../lib/features';
import {
  OmsAiEmployee,
  OmsApiKey,
  OmsCustomApp,
  OmsWorkflow,
  OmsWorkflowRun,
  approveWorkflowRun,
  archiveOmsApp,
  createAiEmployee,
  createOmsApiKey,
  createOmsApp,
  createWorkflow,
  fetchAiEmployees,
  fetchOmsApiKeys,
  fetchOmsApps,
  fetchWorkflowRuns,
  fetchWorkflows,
  installOmsAppTemplate,
  runWorkflow,
} from '../../../lib/oms-customization';

type StudioTab = 'apps' | 'employees' | 'workflows' | 'templates' | 'keys' | 'runs';

const DEFAULT_SCOPES = ['oms:read', 'workflows:run', 'events:write'];
const DATA_SOURCES = ['oms', 'wms', 'cortex', 'marketplaces', 'billing'];
const ACTIONS = ['recommend', 'create_ticket', 'write_ledger', 'draft_shipment_plan', 'notify_user'];
const TRIGGERS = [
  { id: 'manual', label: 'Manual' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'oms_event', label: 'OMS event' },
  { id: 'wms_event', label: 'WMS event' },
  { id: 'webhook', label: 'API/Webhook' },
];
const ACTION_TYPES = [
  { id: 'recommend', label: 'Generate recommendation' },
  { id: 'create_ticket', label: 'Create support ticket' },
  { id: 'write_ledger', label: 'Write ledger event' },
  { id: 'draft_shipment_plan', label: 'Draft shipment plan' },
  { id: 'notify_user', label: 'Notify user' },
  { id: 'tms_dispatch', label: 'Dispatch driver (approval)' },
  { id: 'wms_task_update', label: 'Update WMS work (approval)' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 34,
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--bg-elev)',
  padding: '0 10px',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 86,
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--bg-elev)',
  padding: 10,
  resize: 'vertical',
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label style={{ display: 'grid', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
    {label}
    {children}
  </label>
);

const Panel = ({ title, meta, children }: { title: string; meta?: React.ReactNode; children: React.ReactNode }) => (
  <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
      {meta}
    </div>
    {children}
  </div>
);

const EmptyHint = ({ children }: { children: React.ReactNode }) => (
  <div style={{ padding: 18, border: '1px dashed var(--border-strong)', borderRadius: 10, color: 'var(--text-secondary)' }}>
    {children}
  </div>
);

export const AppStudioModal = ({ onClose }: { onClose: () => void }) => {
  const [tab, setTab] = useState<StudioTab>('apps');
  const [apps, setApps] = useState<OmsCustomApp[]>([]);
  const [employees, setEmployees] = useState<OmsAiEmployee[]>([]);
  const [workflows, setWorkflows] = useState<OmsWorkflow[]>([]);
  const [runs, setRuns] = useState<OmsWorkflowRun[]>([]);
  const [keys, setKeys] = useState<OmsApiKey[]>([]);
  const [availableScopes, setAvailableScopes] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const [appName, setAppName] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeRole, setEmployeeRole] = useState('Operations AI employee');
  const [employeeInstructions, setEmployeeInstructions] = useState('');
  const [employeeAppId, setEmployeeAppId] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const [workflowTrigger, setWorkflowTrigger] = useState('manual');
  const [workflowAction, setWorkflowAction] = useState('recommend');
  const [workflowAppId, setWorkflowAppId] = useState('');
  const [workflowEmployeeId, setWorkflowEmployeeId] = useState('');
  const [apiKeyName, setApiKeyName] = useState('OMS integration key');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(DEFAULT_SCOPES);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [appRes, employeeRes, workflowRes, runRes, keyRes, featureRes] = await Promise.all([
        fetchOmsApps(),
        fetchAiEmployees(),
        fetchWorkflows(),
        fetchWorkflowRuns(100),
        fetchOmsApiKeys(),
        fetchMarketplaceFeatures({ limit: 100 }),
      ]);
      setApps(appRes.apps || []);
      setEmployees(employeeRes.employees || []);
      setWorkflows(workflowRes.workflows || []);
      setRuns(runRes.runs || []);
      setKeys(keyRes.apiKeys || []);
      setAvailableScopes(keyRes.availableScopes || []);
      setTemplates(featureRes.features || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load App Studio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(
    () => [
      { label: 'Private apps', value: apps.filter((a) => a.status !== 'archived').length },
      { label: 'AI employees', value: employees.filter((e) => e.status === 'active').length },
      { label: 'Active workflows', value: workflows.filter((w) => w.status === 'active').length },
      { label: 'Guarded runs', value: runs.filter((r) => r.approvalState === 'required').length },
    ],
    [apps, employees, workflows, runs]
  );

  const submitApp = async () => {
    if (!appName.trim()) return;
    setBusy('app');
    try {
      await createOmsApp({
        name: appName.trim(),
        description: appDescription.trim(),
        icon: 'grid',
        status: 'active',
        config: { createdFrom: 'app_studio' },
      });
      setAppName('');
      setAppDescription('');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const submitEmployee = async () => {
    if (!employeeName.trim()) return;
    setBusy('employee');
    try {
      const body: any = {
        name: employeeName.trim(),
        role: employeeRole.trim(),
        instructions: employeeInstructions.trim(),
        allowedDataSources: DATA_SOURCES,
        allowedActions: ACTIONS,
      };
      if (employeeAppId) body.appId = employeeAppId;
      await createAiEmployee(body);
      setEmployeeName('');
      setEmployeeInstructions('');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const submitWorkflow = async () => {
    if (!workflowName.trim()) return;
    setBusy('workflow');
    try {
      const body: any = {
        name: workflowName.trim(),
        description: `${TRIGGERS.find((t) => t.id === workflowTrigger)?.label || workflowTrigger} automation`,
        triggerType: workflowTrigger,
        triggerConfig: workflowTrigger.endsWith('event') ? { eventType: 'inventory.updated' } : {},
        definition: {
          mode: 'no_code',
          steps: [
            {
              type: workflowAction,
              label: ACTION_TYPES.find((a) => a.id === workflowAction)?.label || workflowAction,
            },
          ],
        },
        status: 'active',
      };
      if (workflowAppId) body.appId = workflowAppId;
      if (workflowEmployeeId) body.aiEmployeeId = workflowEmployeeId;
      await createWorkflow(body);
      setWorkflowName('');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const submitApiKey = async () => {
    setBusy('api-key');
    try {
      const result = await createOmsApiKey({ name: apiKeyName.trim() || 'OMS integration key', scopes: selectedScopes });
      setCreatedKey(result.apiKey);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const installTemplate = async (feature: Feature) => {
    setBusy(`template:${feature.id}`);
    try {
      await installOmsAppTemplate(feature.id);
      setTab('apps');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const run = async (workflow: OmsWorkflow) => {
    setBusy(`run:${workflow.id}`);
    try {
      await runWorkflow(workflow.id, { source: 'app_studio_manual_run' });
      setTab('runs');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const approve = async (runItem: OmsWorkflowRun) => {
    if (!runItem.workflowId) return;
    setBusy(`approve:${runItem.id}`);
    try {
      await approveWorkflowRun(runItem.workflowId, runItem.id);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  };

  return (
    <Modal
      title="App Studio"
      subtitle="Build private OMS apps, guarded AI employees, workflows, and scoped APIs for this account."
      onClose={onClose}
      fullscreen
      chrome={<Chip tone="purple" dot={false}>Guarded autonomy</Chip>}
    >
      {err ? (
        <ErrorState message={err} onRetry={load} />
      ) : loading ? (
        <Loading rows={8} />
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            {stats.map((s) => (
              <div key={s.label} className="metric-card">
                <div className="metric-label">{s.label}</div>
                <div className="metric-value">{s.value}</div>
              </div>
            ))}
          </div>

          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'apps', label: 'My Apps', count: apps.length },
              { id: 'employees', label: 'AI Employees', count: employees.length },
              { id: 'workflows', label: 'Workflows', count: workflows.length },
              { id: 'templates', label: 'Templates', count: templates.length },
              { id: 'keys', label: 'API Keys', count: keys.length },
              { id: 'runs', label: 'Run History', count: runs.length },
            ]}
          />

          {tab === 'apps' && (
            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 14, alignItems: 'start' }}>
              <Panel title="Create private app" meta={<Chip dot={false}>No-code + API</Chip>}>
                <Field label="App name">
                  <input style={inputStyle} value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Backorder Control Tower" />
                </Field>
                <Field label="Description">
                  <textarea style={textareaStyle} value={appDescription} onChange={(e) => setAppDescription(e.target.value)} placeholder="What should this app help this seller operate?" />
                </Field>
                <button className="btn primary" onClick={submitApp} disabled={busy === 'app' || !appName.trim()}>
                  <Icon name="plus" size={13} /> Create app
                </button>
              </Panel>
              <Panel title="Private apps" meta={<button className="btn sm" onClick={load}><Icon name="refresh" size={12} /> Refresh</button>}>
                {apps.length === 0 ? (
                  <EmptyHint>Create an app or install a template to start customizing this OMS account.</EmptyHint>
                ) : (
                  <div className="table-wrap">
                    <table className="data">
                      <thead><tr><th>App</th><th>Status</th><th>Visibility</th><th>Updated</th><th /></tr></thead>
                      <tbody>
                        {apps.map((app) => (
                          <tr key={app.id}>
                            <td><span className="strong">{app.name}</span><div className="muted">{app.description || 'Private account app'}</div></td>
                            <td><StatusChip status={app.status} /></td>
                            <td><Chip dot={false}>{app.visibility}</Chip></td>
                            <td>{app.updatedAt ? new Date(app.updatedAt).toLocaleDateString() : '-'}</td>
                            <td>
                              {app.status !== 'archived' && (
                                <button className="btn ghost sm" onClick={() => archiveOmsApp(app.id).then(load)}>Archive</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>
          )}

          {tab === 'employees' && (
            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 14, alignItems: 'start' }}>
              <Panel title="Create AI employee" meta={<Chip tone="purple" dot={false}>Guarded</Chip>}>
                <Field label="Name">
                  <input style={inputStyle} value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="Inventory Placement Analyst" />
                </Field>
                <Field label="Role">
                  <input style={inputStyle} value={employeeRole} onChange={(e) => setEmployeeRole(e.target.value)} />
                </Field>
                <Field label="App">
                  <select style={inputStyle} value={employeeAppId} onChange={(e) => setEmployeeAppId(e.target.value)}>
                    <option value="">No app binding</option>
                    {apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
                  </select>
                </Field>
                <Field label="Instructions">
                  <textarea style={textareaStyle} value={employeeInstructions} onChange={(e) => setEmployeeInstructions(e.target.value)} placeholder="Describe how this AI employee should help the business." />
                </Field>
                <button className="btn primary" onClick={submitEmployee} disabled={busy === 'employee' || !employeeName.trim()}>
                  <Icon name="sparkle" size={13} /> Create employee
                </button>
              </Panel>
              <Panel title="AI employees">
                {employees.length === 0 ? (
                  <EmptyHint>No AI employees yet.</EmptyHint>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {employees.map((employee) => (
                      <div key={employee.id} className="card" style={{ padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <div style={{ fontWeight: 800 }}>{employee.name}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{employee.role}</div>
                          </div>
                          <StatusChip status={employee.status} />
                        </div>
                        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Chip tone="purple" dot={false}>{employee.autonomyLevel}</Chip>
                          {employee.allowedDataSources.slice(0, 4).map((source) => <Chip key={source} dot={false}>{source}</Chip>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          )}

          {tab === 'workflows' && (
            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 14, alignItems: 'start' }}>
              <Panel title="Create workflow" meta={<Chip tone="amber" dot={false}>Approval gates active</Chip>}>
                <Field label="Workflow name">
                  <input style={inputStyle} value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} placeholder="Low cover replenishment monitor" />
                </Field>
                <Field label="Trigger">
                  <select style={inputStyle} value={workflowTrigger} onChange={(e) => setWorkflowTrigger(e.target.value)}>
                    {TRIGGERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Action">
                  <select style={inputStyle} value={workflowAction} onChange={(e) => setWorkflowAction(e.target.value)}>
                    {ACTION_TYPES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </Field>
                <Field label="App">
                  <select style={inputStyle} value={workflowAppId} onChange={(e) => setWorkflowAppId(e.target.value)}>
                    <option value="">No app binding</option>
                    {apps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
                  </select>
                </Field>
                <Field label="AI employee">
                  <select style={inputStyle} value={workflowEmployeeId} onChange={(e) => setWorkflowEmployeeId(e.target.value)}>
                    <option value="">No employee binding</option>
                    {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                  </select>
                </Field>
                <button className="btn primary" onClick={submitWorkflow} disabled={busy === 'workflow' || !workflowName.trim()}>
                  <Icon name="bolt" size={13} /> Create workflow
                </button>
              </Panel>
              <Panel title="Workflows">
                {workflows.length === 0 ? (
                  <EmptyHint>No workflows yet.</EmptyHint>
                ) : (
                  <div className="table-wrap">
                    <table className="data">
                      <thead><tr><th>Workflow</th><th>Trigger</th><th>Status</th><th>Version</th><th /></tr></thead>
                      <tbody>
                        {workflows.map((workflow) => (
                          <tr key={workflow.id}>
                            <td><span className="strong">{workflow.name}</span><div className="muted">{workflow.description || 'No-code guarded workflow'}</div></td>
                            <td><Chip dot={false}>{workflow.triggerType}</Chip></td>
                            <td><StatusChip status={workflow.status} /></td>
                            <td>v{workflow.version}</td>
                            <td><button className="btn sm" onClick={() => run(workflow)} disabled={busy === `run:${workflow.id}`}><Icon name="play" size={11} /> Run</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>
          )}

          {tab === 'templates' && (
            <Panel title="Admin templates" meta={<Chip dot={false}>Private install</Chip>}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {templates.map((template) => (
                  <div key={template.id} className="card" style={{ padding: 14, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{template.name}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{template.description}</div>
                      </div>
                      <Chip dot={false}>{template.category}</Chip>
                    </div>
                    <button className="btn primary sm" onClick={() => installTemplate(template)} disabled={busy === `template:${template.id}`}>
                      <Icon name="plus" size={11} /> Install private app
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {tab === 'keys' && (
            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 14, alignItems: 'start' }}>
              <Panel title="Create API key" meta={<Chip tone="amber" dot={false}>Shown once</Chip>}>
                <Field label="Key name">
                  <input style={inputStyle} value={apiKeyName} onChange={(e) => setApiKeyName(e.target.value)} />
                </Field>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(availableScopes.length ? availableScopes : DEFAULT_SCOPES).map((scope) => (
                    <button key={scope} className={`chip ${selectedScopes.includes(scope) ? 'purple' : 'outline'}`} onClick={() => toggleScope(scope)} type="button">
                      {scope}
                    </button>
                  ))}
                </div>
                <button className="btn primary" onClick={submitApiKey} disabled={busy === 'api-key' || selectedScopes.length === 0}>
                  <Icon name="settings" size={13} /> Create key
                </button>
                {createdKey && (
                  <div style={{ padding: 12, borderRadius: 8, background: 'var(--amber-soft)', color: 'var(--amber-text)', fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>
                    {createdKey}
                  </div>
                )}
              </Panel>
              <Panel title="Scoped keys">
                {keys.length === 0 ? (
                  <EmptyHint>No API keys yet.</EmptyHint>
                ) : (
                  <div className="table-wrap">
                    <table className="data">
                      <thead><tr><th>Name</th><th>Prefix</th><th>Scopes</th><th>Status</th><th>Last used</th></tr></thead>
                      <tbody>
                        {keys.map((key) => (
                          <tr key={key.id}>
                            <td>{key.name}</td>
                            <td className="mono">{key.prefix}</td>
                            <td>{key.scopes.slice(0, 3).map((s) => <Chip key={s} dot={false}>{s}</Chip>)}</td>
                            <td><StatusChip status={key.status} /></td>
                            <td>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>
          )}

          {tab === 'runs' && (
            <Panel title="Workflow run history" meta={<button className="btn sm" onClick={load}><Icon name="refresh" size={12} /> Refresh</button>}>
              {runs.length === 0 ? (
                <EmptyHint>No workflow runs yet.</EmptyHint>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>When</th><th>Workflow</th><th>Trigger</th><th>Status</th><th>Approval</th><th /></tr></thead>
                    <tbody>
                      {runs.map((runItem) => (
                        <tr key={runItem.id}>
                          <td>{runItem.createdAt ? new Date(runItem.createdAt).toLocaleString() : '-'}</td>
                          <td>{runItem.workflowName || runItem.workflowId || '-'}</td>
                          <td><Chip dot={false}>{runItem.triggerType}</Chip></td>
                          <td><StatusChip status={runItem.status} /></td>
                          <td><StatusChip status={runItem.approvalState} /></td>
                          <td>
                            {runItem.approvalState === 'required' && (
                              <button className="btn primary sm" onClick={() => approve(runItem)} disabled={busy === `approve:${runItem.id}`}>
                                Approve
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
        </div>
      )}
    </Modal>
  );
};
