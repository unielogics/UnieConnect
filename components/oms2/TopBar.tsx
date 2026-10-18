import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import {
  CORTEX_TASKS_CHANGED_EVENT,
  completeCortexTask,
  dismissCortexTask,
  fetchCortexChatHealth,
  fetchCortexTasks,
  notifyCortexTasksChanged,
  searchOms,
  CortexTask,
  CortexTaskSummary,
  OmsGlobalSearchResult,
} from '../../lib/oms';

export const TITLE_MAP: Record<string, [string, string]> = {
  command: ['Command Center', 'Live operating cockpit'],
  double: ['Business Double', 'Current vs. optimized — single approval surface'],
  plan: ['Inventory Plan', '6-month dynamic AI plan'],
  'product-research': ['Product Research', 'Cortex enrichment for individual products and CSV catalogs'],
  skus: ['SKUs', 'Every product, every warehouse'],
  warehouses: ['Warehouses', 'Inventory, WMS activity, and Cortex signals'],
  'sku-detail': ['SKU detail', 'History, billing, channels, shipments'],
  orders: ['Orders', 'Marketplace orders enriched with WMS'],
  returns: ['Returns', 'RMAs, inspection, and disposition'],
  customers: ['Customers', 'Unified buyer profiles + LTV'],
  suppliers: ['My Suppliers', 'Vendors, terms, shipment plans'],
  shipments: ['Shipment Plans', 'Inbound plans & receipt status'],
  heatmap: ['US Heatmap', 'Demand & warehouse coverage'],
  labels: ['Carrier Label Audit', 'Late deliveries & refund opportunities'],
  marketplace: ['Marketplace', 'AI bots, automations, and widgets'],
  billing: ['Billing & Profit', 'Current vs optimized cost'],
  audits: ['Audits & Claims', 'Autonomous refund opportunities'],
  support: ['Support', 'Tickets tied to real entities'],
  inbox: ['Inbox', 'Account notifications and operating events'],
  connections: ['Connections', 'Marketplaces, WMS, Cortex, carriers'],
  ledger: ['Intelligence Ledger', 'Source → finding → action → outcome'],
  profile: ['Profile Settings', 'Account, billing, and security'],
};

export const TopBar = ({
  section,
  copilotOpen,
  onToggleCopilot,
  theme,
  onToggleTheme,
  onOpenProfile,
  onNavigate,
  onSelectSearchResult,
}: {
  section: string;
  copilotOpen: boolean;
  onToggleCopilot: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenProfile?: () => void;
  onNavigate?: (target: string, payload?: string) => void;
  onSelectSearchResult?: (result: OmsGlobalSearchResult) => void;
}) => {
  const [title] = TITLE_MAP[section] || ['', ''];
  const [tasksOpen, setTasksOpen] = useState(false);
  const [tasks, setTasks] = useState<CortexTask[]>([]);
  const [taskTotal, setTaskTotal] = useState(0);
  const [taskSummary, setTaskSummary] = useState<CortexTaskSummary>({ highPriority: 0, workAreas: [], sources: [] });
  const [tasksLoading, setTasksLoading] = useState(true);
  const [cortexHealth, setCortexHealth] = useState<'online' | 'offline' | 'checking'>('checking');
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskNotice, setTaskNotice] = useState<{ tone: 'info' | 'success'; text: string } | null>(null);
  const [taskUpdatingId, setTaskUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OmsGlobalSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const taskWrapRef = useRef<HTMLDivElement>(null);
  const taskButtonRef = useRef<HTMLButtonElement>(null);

  const loadTasks = async (refresh = false) => {
    setTasksLoading(true);
    setTaskError(null);
    try {
      const r = await fetchCortexTasks({ status: 'open', refresh, limit: 12 });
      setTasks(r.tasks || []);
      setTaskTotal(r.total ?? r.tasks?.length ?? 0);
      setTaskSummary(r.summary || { highPriority: 0, workAreas: [], sources: [] });
    } catch (error: any) {
      setTaskError(error?.message || 'Cortex tasks could not be loaded.');
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const refreshTasks = (refresh = false) => {
      setTasksLoading(true);
      setTaskError(null);
      fetchCortexTasks({ status: 'open', refresh, limit: 12 })
        .then((r) => {
          if (!cancelled) {
            setTasks(r.tasks || []);
            setTaskTotal(r.total ?? r.tasks?.length ?? 0);
            setTaskSummary(r.summary || { highPriority: 0, workAreas: [], sources: [] });
          }
        })
        .catch((error: any) => {
          if (!cancelled) setTaskError(error?.message || 'Cortex tasks could not be loaded.');
        })
        .finally(() => {
          if (!cancelled) setTasksLoading(false);
        });
    };
    const onFocus = () => refreshTasks(false);
    const onTasksChanged = () => refreshTasks(false);
    refreshTasks(true);
    window.addEventListener('focus', onFocus);
    window.addEventListener(CORTEX_TASKS_CHANGED_EVENT, onTasksChanged);
    const timer = window.setInterval(() => refreshTasks(false), 90000);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(CORTEX_TASKS_CHANGED_EVENT, onTasksChanged);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    window.addEventListener('keydown', onShortcut);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onShortcut);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, []);

  useEffect(() => {
    if (!tasksOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setTasksOpen(false);
      taskButtonRef.current?.focus();
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!taskWrapRef.current?.contains(event.target as Node)) setTasksOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [tasksOpen]);

  useEffect(() => {
    const query = searchQuery.trim();
    setActiveSearchIndex(0);
    if (query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError('');
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError('');
      searchOms(query, controller.signal)
        .then((response) => setSearchResults(response.results || []))
        .catch((error: any) => {
          if (error?.name !== 'AbortError') setSearchError(error?.message || 'Search is unavailable.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const chooseSearchResult = (result: OmsGlobalSearchResult) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    onSelectSearchResult?.(result);
  };

  useEffect(() => {
    let cancelled = false;
    const checkHealth = (showChecking = false) => {
      if (showChecking) setCortexHealth('checking');
      fetchCortexChatHealth(section)
        .then((res) => {
          if (!cancelled) setCortexHealth(res.ok ? 'online' : 'offline');
        })
        .catch(() => {
          if (!cancelled) setCortexHealth('offline');
        });
    };
    const onFocus = () => checkHealth(false);
    checkHealth(true);
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(() => checkHealth(false), 60000);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, [section]);

  const updateTask = async (task: CortexTask, action: 'done' | 'dismiss') => {
    setTaskUpdatingId(task.id);
    setTaskError(null);
    setTaskNotice(null);
    try {
      if (action === 'done') {
        const result = await completeCortexTask(task.id);
        setTaskNotice({
          tone: result.verified ? 'success' : 'info',
          text: result.verified
            ? (result.message || 'Cortex verified the account evidence and completed this task.')
            : `${result.message || 'Cortex still detects this blocker.'}${task.actionLabel ? ` Next: ${task.actionLabel}.` : ''}`,
        });
      } else {
        await dismissCortexTask(task.id);
        setTaskNotice({ tone: 'success', text: 'Task dismissed from the active inbox.' });
      }
      await loadTasks(true);
      notifyCortexTasksChanged();
    } catch (error: any) {
      setTaskError(error?.message || 'The task could not be updated.');
    } finally {
      setTaskUpdatingId(null);
    }
  };
  const completionLabel = (task: CortexTask) =>
    task.source === 'readiness' || task.source === 'connection_health' ? 'Verify completion' : 'Mark done';
  const taskNavigationPayload = (task: CortexTask) => {
    if (task.dedupeKey === 'readiness:sku-unit-cost') return 'filter:missing-cost';
    if (task.dedupeKey === 'readiness:sku-dimensions-weight') return 'filter:missing-dimensions';
    if (task.dedupeKey === 'readiness:supplier-pickup-profiles') return 'filter:missing-pickup';
    return task.entityId || undefined;
  };
  const highTaskCount = taskSummary.highPriority;
  const workAreas = taskSummary.workAreas.slice(0, 3);
  return (
    <header className="topbar">
      <div className="crumbs">
        <span className="crumb">Unielogics ops</span>
        <span className="crumb-sep">/</span>
        <span className="crumb current">{title}</span>
      </div>

      <div className="topbar-search" ref={searchRef}>
        <Icon name="search" className="search-icon" />
        <input
          ref={searchInputRef}
          value={searchQuery}
          placeholder="Search SKUs, orders, ASNs, invoices, tickets..."
          aria-label="Search account records"
          aria-expanded={searchOpen}
          aria-controls="oms-global-search-results"
          onFocus={() => { setSearchOpen(true); setTasksOpen(false); }}
          onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && searchResults.length) {
              event.preventDefault();
              setActiveSearchIndex((index) => (index + 1) % searchResults.length);
            } else if (event.key === 'ArrowUp' && searchResults.length) {
              event.preventDefault();
              setActiveSearchIndex((index) => (index - 1 + searchResults.length) % searchResults.length);
            } else if (event.key === 'Enter' && searchResults[activeSearchIndex]) {
              event.preventDefault();
              chooseSearchResult(searchResults[activeSearchIndex]);
            }
          }}
        />
        {searchQuery ? (
          <button className="search-clear" data-hint="Clear search" onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}>
            <Icon name="x" size={13} />
          </button>
        ) : <kbd>Ctrl K</kbd>}
        {searchOpen && (
          <div className="global-search-results" id="oms-global-search-results" role="listbox">
            {searchQuery.trim().length < 2 ? (
              <div className="global-search-state">Type at least two characters to search this account.</div>
            ) : searchLoading ? (
              <div className="global-search-state">Searching account records...</div>
            ) : searchError ? (
              <div className="global-search-state error"><Icon name="warning" size={13} /> {searchError}</div>
            ) : searchResults.length === 0 ? (
              <div className="global-search-state">No matching records in this account.</div>
            ) : searchResults.map((result, index) => (
              <button
                key={`${result.type}-${result.id}`}
                className={`global-search-result ${index === activeSearchIndex ? 'active' : ''}`}
                role="option"
                aria-selected={index === activeSearchIndex}
                onMouseEnter={() => setActiveSearchIndex(index)}
                onClick={() => chooseSearchResult(result)}
              >
                <span className={`search-type-icon ${result.type}`}>
                  <Icon name={result.type === 'sku' ? 'box' : result.type === 'order' ? 'orders' : result.type === 'asn' ? 'shipments' : result.type === 'invoice' ? 'billing' : 'support'} size={14} />
                </span>
                <span className="search-result-copy">
                  <strong>{result.label}</strong>
                  <small>{result.description}</small>
                </span>
                <span className="search-result-type">{result.type}</span>
                {result.status ? <span className="search-result-status">{result.status.replace(/_/g, ' ')}</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        className="icon-btn"
        data-hint={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        onClick={onToggleTheme}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>
      <div className="topbar-task-wrap" ref={taskWrapRef}>
        <button
          ref={taskButtonRef}
          className="icon-btn"
          data-hint="Cortex task inbox"
          aria-label="Cortex task inbox"
          aria-haspopup="dialog"
          aria-expanded={tasksOpen}
          aria-controls="cortex-task-popover"
          onClick={() => {
            setSearchOpen(false);
            setTasksOpen((v) => !v);
          }}
        >
          <Icon name="bell" />
          {taskTotal > 0 && (
            <span className={`task-count-badge ${highTaskCount ? 'urgent' : ''}`}>
              {taskTotal > 99 ? '99+' : taskTotal}
            </span>
          )}
        </button>
        {tasksOpen && (
          <div className="task-popover" id="cortex-task-popover" role="dialog" aria-label="Cortex task inbox">
            <div className="task-popover-head">
              <div>
                <strong>Cortex tasks</strong>
                <span>{tasksLoading && tasks.length === 0 ? 'Loading...' : `${taskTotal} open`}</span>
              </div>
              <div className="task-popover-head-actions">
                <button className="icon-btn" aria-label="Refresh Cortex tasks" data-hint="Refresh" onClick={() => loadTasks(true)}><Icon name="refresh" size={13} /></button>
                <button className="icon-btn" aria-label="Close Cortex task inbox" data-hint="Close" onClick={() => { setTasksOpen(false); taskButtonRef.current?.focus(); }}><Icon name="x" size={13} /></button>
              </div>
            </div>
            {tasks.length > 0 && (
              <div className="task-popover-summary">
                <span><strong>{highTaskCount}</strong> high priority</span>
                <span><strong>{taskSummary.workAreas.length}</strong> work areas</span>
                <span>{workAreas.map((area) => String(area).replace(/-/g, ' ')).join(' · ')}</span>
              </div>
            )}
            {taskError && <div className="task-popover-error" role="alert"><Icon name="warning" size={12} /> {taskError}</div>}
            {taskNotice && (
              <div className={`task-popover-notice ${taskNotice.tone}`} role="status">
                <Icon name={taskNotice.tone === 'success' ? 'check' : 'info'} size={12} /> {taskNotice.text}
              </div>
            )}
            <div className="task-popover-list">
              {tasksLoading && tasks.length === 0 ? (
                <div className="task-empty">Loading account tasks...</div>
              ) : taskError && tasks.length === 0 ? (
                <div className="task-empty">
                  Task status is unavailable.
                  <button className="btn ghost sm" onClick={() => loadTasks(false)}><Icon name="refresh" size={11} /> Retry</button>
                </div>
              ) : tasks.length === 0 ? (
                <div className="task-empty">No open Cortex tasks.</div>
              ) : tasks.map((task) => (
                <div key={task.id} className="task-popover-item">
                  <button
                    className="task-popover-main"
                    disabled={taskUpdatingId === task.id}
                    onClick={() => {
                      if (onNavigate) onNavigate(task.actionTarget || task.screen || 'command', taskNavigationPayload(task));
                      setTasksOpen(false);
                    }}
                  >
                    <span className={`task-priority ${task.priority}`}>{task.priority}</span>
                    <strong>{task.title}</strong>
                    <span className="task-popover-meta">
                      <span>{String(task.actionTarget || task.screen || 'command').replace(/-/g, ' ')}</span>
                      {task.source && <span>{task.source.replace(/_/g, ' ')}</span>}
                    </span>
                    {task.detail && <small>{task.detail}</small>}
                    <small className="task-action-copy">{task.actionLabel || 'Open task'}</small>
                  </button>
                  <div className="task-popover-actions">
                    <button className="icon-btn" data-hint={completionLabel(task)} aria-label={completionLabel(task)} disabled={taskUpdatingId === task.id} onClick={() => updateTask(task, 'done')}><Icon name="check" size={13} /></button>
                    <button className="icon-btn" data-hint="Dismiss" aria-label="Dismiss task" disabled={taskUpdatingId === task.id} onClick={() => updateTask(task, 'dismiss')}><Icon name="x" size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="task-popover-footer">
              <span>{taskTotal > tasks.length ? `Showing ${tasks.length} of ${taskTotal} open tasks` : 'Account-wide readiness and connection work'}</span>
              <button className="btn ghost sm" onClick={() => { onNavigate?.('command'); setTasksOpen(false); }}>
                Open full inbox <Icon name="arrowRight" size={11} />
              </button>
            </div>
          </div>
        )}
      </div>
      <button className="icon-btn" data-hint="Settings" onClick={() => { setTasksOpen(false); onOpenProfile?.(); }}>
        <Icon name="settings" />
      </button>

      <button
        className={`copilot-btn ${copilotOpen ? 'active' : ''}`}
        onClick={() => { setTasksOpen(false); onToggleCopilot(); }}
        aria-label={`Cortex, ${cortexHealth === 'online' ? 'ready' : cortexHealth === 'offline' ? 'unavailable' : 'checking status'}`}
        data-hint={cortexHealth === 'online' ? 'Cortex ready' : cortexHealth === 'offline' ? 'Cortex unavailable' : 'Checking Cortex'}
      >
        <span className={`ai-dot ${cortexHealth}`} />
        Cortex
      </button>
    </header>
  );
};
