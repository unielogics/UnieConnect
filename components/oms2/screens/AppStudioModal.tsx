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
  revokeOmsApiKey,
  rotateOmsApiKey,
  runWorkflow,
} from '../../../lib/oms-customization';

type StudioTab = 'apps' | 'employees' | 'workflows' | 'templates' | 'keys' | 'runs';
type StudioMode = 'guided' | 'manage';

const DEFAULT_SCOPES = ['oms:read', 'workflows:run', 'events:write'];
const DATA_SOURCES = ['oms', 'wms', 'cortex', 'marketplaces', 'billing'];
const ACTIONS = ['recommend', 'create_ticket', 'write_ledger', 'draft_shipment_plan', 'notify_user'];
const TRIGGERS = [
  { id: 'manual', label: 'Manual run' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'oms_event', label: 'OMS event' },
  { id: 'wms_event', label: 'WMS event' },
  { id: 'webhook', label: 'Inbound API/Webhook' },
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
const STEPS = [
  'API keys',
  'Template',
  'External API',
  'AI employee',
  'Guardrails',
  'Test event',
  'Deploy',
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
  <label className="studio-field">
    <span>{label}</span>
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
  <div className="studio-empty">{children}</div>
);

const templateName = (feature: Feature) => feature.name || feature.id;

export const AppStudioModal = ({ onClose }: { onClose: () => void }) => {
  const [mode, setMode] = useState<StudioMode>('guided');
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<StudioTab>('keys');
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
  const [testResult, setTestResult] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<string | null>(null);

  const [appName, setAppName] = useState('Inventory exception app');
  const [appDescription, setAppDescription] = useState('Routes inventory and order exceptions into OMS workflows.');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [connectionName, setConnectionName] = useState('Custom WMS');
  const [externalBaseUrl, setExternalBaseUrl] = useState('');
  const [externalAuthMethod, setExternalAuthMethod] = useState('api_key');
  const [sampleEventType, setSampleEventType] = useState('inventory.updated');
  const [samplePayload, setSamplePayload] = useState('{"sku":"SKU-100","available":240,"warehouseCode":"NJ-01"}');
  const [employeeName, setEmployeeName] = useState('Inventory Operations Analyst');
  const [employeeRole, setEmployeeRole] = useState('Operations AI employee');
  const [employeeInstructions, setEmployeeInstructions] = useState('Watch inventory, order, and WMS events. Draft recommendations, tickets, and shipment plans when action is needed.');
  const [workflowName, setWorkflowName] = useState('Inventory event intake');
  const [workflowTrigger, setWorkflowTrigger] = useState('webhook');
  const [workflowAction, setWorkflowAction] = useState('recommend');
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
      setTemplates((featureRes.features || []).filter((feature) => !feature.isStandard));
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
      { label: 'API keys', value: keys.filter((key) => key.status === 'active').length },
      { label: 'Private apps', value: apps.filter((app) => app.status !== 'archived').length },
      { label: 'AI employees', value: employees.filter((employee) => employee.status === 'active').length },
      { label: 'Active workflows', value: workflows.filter((workflow) => workflow.status === 'active').length },
    ],
    [apps, employees, keys, workflows]
  );

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
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

  const rotateKey = async (key: OmsApiKey) => {
    setBusy(`rotate:${key.id}`);
    try {
      const result = await rotateOmsApiKey(key.id);
      setCreatedKey(result.apiKey);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const revokeKey = async (key: OmsApiKey) => {
    setBusy(`revoke:${key.id}`);
    try {
      await revokeOmsApiKey(key.id);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const submitApp = async () => {
    if (!appName.trim()) return null;
    const result = await createOmsApp({
      name: appName.trim(),
      description: appDescription.trim(),
      icon: 'grid',
      status: 'active',
      templateFeatureId: selectedTemplateId || undefined,
      config: {
        createdFrom: 'guided_app_studio',
        sourceTemplate: selectedTemplateId || null,
        connection: { name: connectionName, baseUrl: externalBaseUrl, authMethod: externalAuthMethod },
      },
    });
    return result.app;
  };

  const submitEmployee = async (appId?: string) => {
    if (!employeeName.trim()) return null;
    const body: any = {
      name: employeeName.trim(),
      role: employeeRole.trim(),
      instructions: employeeInstructions.trim(),
      allowedDataSources: DATA_SOURCES,
      allowedActions: ACTIONS,
    };
    if (appId) body.appId = appId;
    const result = await createAiEmployee(body);
    return result.employee;
  };

  const submitWorkflow = async (appId?: string, employeeId?: string) => {
    if (!workflowName.trim()) return null;
    const parsedPayload = parseSamplePayload();
    const body: any = {
      name: workflowName.trim(),
      description: `${connectionName || 'External'} ${TRIGGERS.find((trigger) => trigger.id === workflowTrigger)?.label || workflowTrigger}`,
      triggerType: workflowTrigger,
      triggerConfig: {
        eventType: sampleEventType.trim() || 'inventory.updated',
        sourceSystem: connectionName.trim() || 'external_api',
        externalApi: {
          baseUrl: externalBaseUrl.trim(),
          authMethod: externalAuthMethod,
        },
      },
      definition: {
        mode: 'guided_no_code',
        samplePayload: parsedPayload,
        steps: [
          {
            type: workflowAction,
            label: ACTION_TYPES.find((action) => action.id === workflowAction)?.label || workflowAction,
          },
        ],
      },
      status: 'active',
    };
    if (appId) body.appId = appId;
    if (employeeId) body.aiEmployeeId = employeeId;
    const result = await createWorkflow(body);
    return result.workflow;
  };

  const deployGuidedApp = async () => {
    setBusy('deploy');
    setDeployResult(null);
    try {
      let app: OmsCustomApp | null = null;
      if (selectedTemplateId) {
        const installed = await installOmsAppTemplate(selectedTemplateId, {
          name: appName.trim() || selectedTemplate?.name,
          config: {
            createdFrom: 'guided_app_studio',
            connection: { name: connectionName, baseUrl: externalBaseUrl, authMethod: externalAuthMethod },
          },
        });
        app = installed.app;
      } else {
        app = await submitApp();
      }
      const employee = await submitEmployee(app?.id);
      const workflow = await submitWorkflow(app?.id, employee?.id);
      setDeployResult(`Deployed ${app?.name || 'custom app'} with ${employee?.name || 'no AI employee'} and ${workflow?.name || 'no workflow'}.`);
      await load();
      setStep(6);
    } finally {
      setBusy(null);
    }
  };

  const installTemplate = async (feature: Feature) => {
    setBusy(`template:${feature.id}`);
    try {
      await installOmsAppTemplate(feature.id);
      setMode('manage');
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
      setMode('manage');
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

  const parseSamplePayload = () => {
    try {
      return JSON.parse(samplePayload || '{}');
    } catch {
      return { raw: samplePayload };
    }
  };

  const testSampleEvent = () => {
    const payload = parseSamplePayload();
    setTestResult(
      JSON.stringify(
        {
          accepted: true,
          eventType: sampleEventType.trim() || 'inventory.updated',
          sourceSystem: connectionName.trim() || 'external_api',
          matchedWorkflow: workflowName.trim() || 'Inventory event intake',
          action: workflowAction,
          payload,
        },
        null,
        2
      )
    );
  };

  const renderKeysPanel = () => (
    <div className="studio-two-col">
      <Panel title="Create integration key" meta={<Chip tone="amber" dot={false}>Shown once</Chip>}>
        <Field label="Key name">
          <input style={inputStyle} value={apiKeyName} onChange={(e) => setApiKeyName(e.target.value)} />
        </Field>
        <div className="studio-scope-grid">
          {(availableScopes.length ? availableScopes : DEFAULT_SCOPES).map((scope) => (
            <button key={scope} className={`chip ${selectedScopes.includes(scope) ? 'purple' : 'outline'}`} onClick={() => toggleScope(scope)} type="button">
              {scope}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={submitApiKey} disabled={busy === 'api-key' || selectedScopes.length === 0}>
          <Icon name="settings" size={13} /> Create API key
        </button>
        {createdKey && (
          <div className="studio-secret">
            {createdKey}
          </div>
        )}
      </Panel>
      <Panel title="Active keys">
        {keys.length === 0 ? (
          <EmptyHint>Create a key before connecting a WMS, ERP, carrier, or custom app.</EmptyHint>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Name</th><th>Prefix</th><th>Scopes</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td>{key.name}</td>
                    <td className="mono">{key.prefix}</td>
                    <td>{key.scopes.slice(0, 3).map((scope) => <Chip key={scope} dot={false}>{scope}</Chip>)}</td>
                    <td><StatusChip status={key.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn ghost sm" onClick={() => rotateKey(key)} disabled={busy === `rotate:${key.id}`}>Rotate</button>
                        {key.status !== 'revoked' && (
                          <button className="btn ghost sm" onClick={() => revokeKey(key)} disabled={busy === `revoke:${key.id}`}>Revoke</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );

  const renderGuidedStep = () => {
    if (step === 0) {
      return (
        <div className="studio-step-content">
          <div>
            <h3>Start with API access</h3>
            <p>Most custom OMS work starts by letting a marketplace app, WMS, ERP, or private system talk to UnieConnect.</p>
          </div>
          {renderKeysPanel()}
        </div>
      );
    }
    if (step === 1) {
      return (
        <div className="studio-step-content">
          <div>
            <h3>Choose a starting point</h3>
            <p>Install a template when the workflow is close to a known pattern, or start clean for a private app.</p>
          </div>
          <div className="studio-template-grid">
            <button className={`studio-template ${!selectedTemplateId ? 'active' : ''}`} onClick={() => setSelectedTemplateId('')}>
              <Icon name="plus" size={16} />
              <strong>Start from scratch</strong>
              <span>Build a private app with your own API and workflow rules.</span>
            </button>
            {templates.slice(0, 6).map((template) => (
              <button
                key={template.id}
                className={`studio-template ${selectedTemplateId === template.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedTemplateId(template.id);
                  setAppName(templateName(template));
                  setAppDescription(template.description || '');
                }}
              >
                <Icon name={template.metadata?.navIcon || 'grid'} size={16} />
                <strong>{templateName(template)}</strong>
                <span>{template.description}</span>
              </button>
            ))}
          </div>
          <div className="studio-two-col">
            <Field label="App name">
              <input style={inputStyle} value={appName} onChange={(e) => setAppName(e.target.value)} />
            </Field>
            <Field label="Description">
              <input style={inputStyle} value={appDescription} onChange={(e) => setAppDescription(e.target.value)} />
            </Field>
          </div>
        </div>
      );
    }
    if (step === 2) {
      return (
        <div className="studio-step-content">
          <div>
            <h3>Connect a third-party API or webhook</h3>
            <p>Use this to connect custom WMS feeds, ERP updates, warehouse events, carrier events, or private seller systems.</p>
          </div>
          <div className="studio-two-col">
            <Panel title="Connection">
              <Field label="Connection name">
                <input style={inputStyle} value={connectionName} onChange={(e) => setConnectionName(e.target.value)} />
              </Field>
              <Field label="External API base URL">
                <input style={inputStyle} value={externalBaseUrl} onChange={(e) => setExternalBaseUrl(e.target.value)} placeholder="https://api.partner-system.com" />
              </Field>
              <Field label="Auth method">
                <select style={inputStyle} value={externalAuthMethod} onChange={(e) => setExternalAuthMethod(e.target.value)}>
                  <option value="api_key">API key</option>
                  <option value="bearer">Bearer token</option>
                  <option value="basic">Basic auth</option>
                  <option value="webhook_signature">Webhook signature</option>
                </select>
              </Field>
            </Panel>
            <Panel title="Webhook contract" meta={<Chip dot={false}>events:write</Chip>}>
              <div className="studio-code">{`POST /api/v1/oms/events
Authorization: Bearer uc_xxxxxxxxxx
Idempotency-Key: your-event-id

{
  "eventType": "${sampleEventType}",
  "sourceSystem": "${connectionName || 'external_api'}",
  "payload": ${samplePayload || '{}'}
}`}</div>
            </Panel>
          </div>
        </div>
      );
    }
    if (step === 3) {
      return (
        <div className="studio-step-content">
          <div>
            <h3>Assign the AI employee and workflow</h3>
            <p>The AI employee explains the job. The workflow tells the system when to act and what it can do.</p>
          </div>
          <div className="studio-two-col">
            <Panel title="AI employee">
              <Field label="Name">
                <input style={inputStyle} value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} />
              </Field>
              <Field label="Role">
                <input style={inputStyle} value={employeeRole} onChange={(e) => setEmployeeRole(e.target.value)} />
              </Field>
              <Field label="Instructions">
                <textarea style={textareaStyle} value={employeeInstructions} onChange={(e) => setEmployeeInstructions(e.target.value)} />
              </Field>
            </Panel>
            <Panel title="Workflow">
              <Field label="Workflow name">
                <input style={inputStyle} value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} />
              </Field>
              <Field label="Trigger">
                <select style={inputStyle} value={workflowTrigger} onChange={(e) => setWorkflowTrigger(e.target.value)}>
                  {TRIGGERS.map((trigger) => <option key={trigger.id} value={trigger.id}>{trigger.label}</option>)}
                </select>
              </Field>
              <Field label="Primary action">
                <select style={inputStyle} value={workflowAction} onChange={(e) => setWorkflowAction(e.target.value)}>
                  {ACTION_TYPES.map((action) => <option key={action.id} value={action.id}>{action.label}</option>)}
                </select>
              </Field>
            </Panel>
          </div>
        </div>
      );
    }
    if (step === 4) {
      return (
        <div className="studio-step-content">
          <div>
            <h3>Guardrails and approval rules</h3>
            <p>Safe OMS actions can run automatically. WMS work changes, TMS dispatch, carrier purchases, and billing claims pause for approval.</p>
          </div>
          <div className="studio-rule-grid">
            {[
              ['Automatic', 'Read OMS data, create tickets, write ledger events, draft plans, notify users.'],
              ['Approval required', 'WMS task changes, driver dispatch, carrier purchases, refunds, inventory execution.'],
              ['Always logged', 'Every run stores input, output, confidence, approval state, and ledger references.'],
            ].map(([title, body]) => (
              <div key={title} className="card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (step === 5) {
      return (
        <div className="studio-step-content">
          <div>
            <h3>Test the event mapping</h3>
            <p>Validate the event shape before deploying the app. This checks the payload and shows the workflow match.</p>
          </div>
          <div className="studio-two-col">
            <Panel title="Sample event">
              <Field label="Event type">
                <input style={inputStyle} value={sampleEventType} onChange={(e) => setSampleEventType(e.target.value)} />
              </Field>
              <Field label="Payload JSON">
                <textarea style={textareaStyle} value={samplePayload} onChange={(e) => setSamplePayload(e.target.value)} />
              </Field>
              <button className="btn primary" onClick={testSampleEvent}><Icon name="play" size={13} /> Test event</button>
            </Panel>
            <Panel title="Test result">
              <div className="studio-code">{testResult || 'Run a test to preview how this app will map the event.'}</div>
            </Panel>
          </div>
        </div>
      );
    }
    return (
      <div className="studio-step-content">
        <div>
          <h3>Deploy app</h3>
          <p>Create the private app, AI employee, and workflow. The workflow starts active and guarded.</p>
        </div>
        <div className="studio-deploy-card">
          <div>
            <div className="metric-label">App</div>
            <div className="strong">{appName || selectedTemplate?.name || 'Private OMS app'}</div>
          </div>
          <div>
            <div className="metric-label">Event</div>
            <div className="strong">{sampleEventType || 'inventory.updated'}</div>
          </div>
          <div>
            <div className="metric-label">Action</div>
            <div className="strong">{ACTION_TYPES.find((action) => action.id === workflowAction)?.label || workflowAction}</div>
          </div>
          <button className="btn primary" onClick={deployGuidedApp} disabled={busy === 'deploy'}>
            <Icon name="save" size={13} /> Deploy app
          </button>
        </div>
        {deployResult && <div className="studio-success">{deployResult}</div>}
      </div>
    );
  };

  const renderManage = () => (
    <div style={{ display: 'grid', gap: 18 }}>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'keys', label: 'API Keys', count: keys.length },
          { id: 'apps', label: 'My Apps', count: apps.length },
          { id: 'employees', label: 'AI Employees', count: employees.length },
          { id: 'workflows', label: 'Workflows', count: workflows.length },
          { id: 'templates', label: 'Templates', count: templates.length },
          { id: 'runs', label: 'Run History', count: runs.length },
        ]}
      />

      {tab === 'keys' && renderKeysPanel()}

      {tab === 'apps' && (
        <div className="studio-two-col">
          <Panel title="Create private app" meta={<Chip dot={false}>No-code + API</Chip>}>
            <Field label="App name">
              <input style={inputStyle} value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Backorder Control Tower" />
            </Field>
            <Field label="Description">
              <textarea style={textareaStyle} value={appDescription} onChange={(e) => setAppDescription(e.target.value)} />
            </Field>
            <button className="btn primary" onClick={async () => { setBusy('app'); try { await submitApp(); await load(); } finally { setBusy(null); } }} disabled={busy === 'app' || !appName.trim()}>
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
                        <td>{app.status !== 'archived' && <button className="btn ghost sm" onClick={() => archiveOmsApp(app.id).then(load)}>Archive</button>}</td>
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
        <div className="studio-two-col">
          <Panel title="Create AI employee" meta={<Chip tone="purple" dot={false}>Guarded</Chip>}>
            <Field label="Name"><input style={inputStyle} value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} /></Field>
            <Field label="Role"><input style={inputStyle} value={employeeRole} onChange={(e) => setEmployeeRole(e.target.value)} /></Field>
            <Field label="Instructions"><textarea style={textareaStyle} value={employeeInstructions} onChange={(e) => setEmployeeInstructions(e.target.value)} /></Field>
            <button className="btn primary" onClick={async () => { setBusy('employee'); try { await submitEmployee(); await load(); } finally { setBusy(null); } }} disabled={busy === 'employee' || !employeeName.trim()}>
              <Icon name="sparkle" size={13} /> Create employee
            </button>
          </Panel>
          <Panel title="AI employees">
            {employees.length === 0 ? <EmptyHint>No AI employees yet.</EmptyHint> : (
              <div style={{ display: 'grid', gap: 10 }}>
                {employees.map((employee) => (
                  <div key={employee.id} className="card" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div><div style={{ fontWeight: 800 }}>{employee.name}</div><div className="muted">{employee.role}</div></div>
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
        <div className="studio-two-col">
          <Panel title="Create workflow" meta={<Chip tone="amber" dot={false}>Approval gates active</Chip>}>
            <Field label="Workflow name"><input style={inputStyle} value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} /></Field>
            <Field label="Trigger"><select style={inputStyle} value={workflowTrigger} onChange={(e) => setWorkflowTrigger(e.target.value)}>{TRIGGERS.map((trigger) => <option key={trigger.id} value={trigger.id}>{trigger.label}</option>)}</select></Field>
            <Field label="Action"><select style={inputStyle} value={workflowAction} onChange={(e) => setWorkflowAction(e.target.value)}>{ACTION_TYPES.map((action) => <option key={action.id} value={action.id}>{action.label}</option>)}</select></Field>
            <button className="btn primary" onClick={async () => { setBusy('workflow'); try { await submitWorkflow(); await load(); } finally { setBusy(null); } }} disabled={busy === 'workflow' || !workflowName.trim()}>
              <Icon name="bolt" size={13} /> Create workflow
            </button>
          </Panel>
          <Panel title="Workflows">
            {workflows.length === 0 ? <EmptyHint>No workflows yet.</EmptyHint> : (
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
          <div className="studio-template-grid">
            {templates.map((template) => (
              <button key={template.id} className="studio-template" onClick={() => installTemplate(template)} disabled={busy === `template:${template.id}`}>
                <Icon name={template.metadata?.navIcon || 'grid'} size={16} />
                <strong>{template.name}</strong>
                <span>{template.description}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'runs' && (
        <Panel title="Workflow run history" meta={<button className="btn sm" onClick={load}><Icon name="refresh" size={12} /> Refresh</button>}>
          {runs.length === 0 ? <EmptyHint>No workflow runs yet.</EmptyHint> : (
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
                      <td>{runItem.approvalState === 'required' && <button className="btn primary sm" onClick={() => approve(runItem)} disabled={busy === `approve:${runItem.id}`}>Approve</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );

  return (
    <Modal
      title="App Studio"
      subtitle="Create API access, connect outside systems, and deploy guarded AI workflows for this OMS account."
      onClose={onClose}
      fullscreen
      chrome={<Chip tone="purple" dot={false}>Core setup</Chip>}
    >
      {err ? (
        <ErrorState message={err} onRetry={load} />
      ) : loading ? (
        <Loading rows={8} />
      ) : (
        <div className="studio-root">
          <div className="studio-topline">
            <div className="studio-stat-grid">
              {stats.map((stat) => (
                <div key={stat.label} className="metric-card">
                  <div className="metric-label">{stat.label}</div>
                  <div className="metric-value">{stat.value}</div>
                </div>
              ))}
            </div>
            <div className="studio-mode-switch">
              <button className={`btn ${mode === 'guided' ? 'primary' : ''}`} onClick={() => setMode('guided')}>
                <Icon name="play" size={12} /> Guided setup
              </button>
              <button className={`btn ${mode === 'manage' ? 'primary' : ''}`} onClick={() => setMode('manage')}>
                <Icon name="settings" size={12} /> Manage existing
              </button>
            </div>
          </div>

          {mode === 'guided' ? (
            <div className="studio-layout">
              <div className="studio-stepper">
                {STEPS.map((label, idx) => (
                  <button
                    key={label}
                    className={`studio-step ${step === idx ? 'active' : ''} ${step > idx ? 'done' : ''}`}
                    onClick={() => setStep(idx)}
                  >
                    <span>{step > idx ? <Icon name="check" size={11} /> : idx + 1}</span>
                    <strong>{label}</strong>
                  </button>
                ))}
              </div>
              <div className="studio-guide-card">
                {renderGuidedStep()}
                <div className="studio-nav-actions">
                  <button className="btn" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>Back</button>
                  {step < STEPS.length - 1 ? (
                    <button className="btn primary" onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}>
                      Next <Icon name="arrowRight" size={12} />
                    </button>
                  ) : (
                    <button className="btn primary" onClick={deployGuidedApp} disabled={busy === 'deploy'}>
                      <Icon name="save" size={12} /> Deploy app
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : renderManage()}
        </div>
      )}
    </Modal>
  );
};
