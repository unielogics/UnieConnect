import React, { useEffect, useState } from 'react';
import { Icon } from './icons';
import { completeCortexTask, dismissCortexTask, fetchCortexChatHealth, fetchCortexTasks, CortexTask } from '../../lib/oms';

export const TITLE_MAP: Record<string, [string, string]> = {
  command: ['Command Center', 'Live operating cockpit'],
  double: ['Business Double', 'Current vs. optimized — single approval surface'],
  plan: ['Inventory Plan', '6-month dynamic AI plan'],
  'product-research': ['Product Research', 'Cortex enrichment for individual products and CSV catalogs'],
  skus: ['SKUs', 'Every product, every warehouse'],
  warehouses: ['Warehouses', 'Inventory, WMS activity, and Cortex signals'],
  'sku-detail': ['SKU detail', 'History, billing, channels, shipments'],
  orders: ['Orders', 'Marketplace orders enriched with WMS'],
  customers: ['Customers', 'Unified buyer profiles + LTV'],
  suppliers: ['My Suppliers', 'Vendors, terms, shipment plans'],
  shipments: ['Shipment Plans', 'Inbound plans & receipt status'],
  heatmap: ['US Heatmap', 'Demand & warehouse coverage'],
  labels: ['Carrier Label Audit', 'Late deliveries & refund opportunities'],
  marketplace: ['Marketplace', 'AI bots, automations, and widgets'],
  billing: ['Billing & Profit', 'Current vs optimized cost'],
  audits: ['Audits & Claims', 'Autonomous refund opportunities'],
  support: ['Support', 'Tickets tied to real entities'],
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
}: {
  section: string;
  copilotOpen: boolean;
  onToggleCopilot: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenProfile?: () => void;
  onNavigate?: (target: string, payload?: string) => void;
}) => {
  const [title] = TITLE_MAP[section] || ['', ''];
  const [tasksOpen, setTasksOpen] = useState(false);
  const [tasks, setTasks] = useState<CortexTask[]>([]);
  const [cortexHealth, setCortexHealth] = useState<'online' | 'offline' | 'checking'>('checking');

  const loadTasks = (refresh = false) => {
    fetchCortexTasks({ status: 'open', refresh, limit: 12 })
      .then((r) => setTasks(r.tasks || []))
      .catch(() => setTasks([]));
  };

  useEffect(() => {
    loadTasks(true);
  }, [section]);

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
    if (action === 'done') await completeCortexTask(task.id).catch(() => null);
    else await dismissCortexTask(task.id).catch(() => null);
    loadTasks(false);
  };
  const highTaskCount = tasks.filter((task) => task.priority === 'high').length;
  const workAreas = Array.from(new Set(tasks.map((task) => task.actionTarget || task.screen).filter(Boolean))).slice(0, 3);

  return (
    <header className="topbar">
      <div className="crumbs">
        <span className="crumb">Unielogics ops</span>
        <span className="crumb-sep">/</span>
        <span className="crumb current">{title}</span>
        <span className="crumb-status">
          <span className="dot" />
          All systems live
        </span>
      </div>

      <div className="topbar-search">
        <Icon name="search" className="search-icon" />
        <input placeholder="Search SKUs, orders, ASNs, invoices, tickets…" />
        <kbd>⌘K</kbd>
      </div>

      <button
        className="icon-btn"
        data-hint={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        onClick={onToggleTheme}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>
      <div className="topbar-task-wrap">
        <button className="icon-btn" data-hint="Cortex task inbox" onClick={() => setTasksOpen((v) => !v)}>
          <Icon name="bell" />
          {tasks.length > 0 && <span className="pip" />}
        </button>
        {tasksOpen && (
          <div className="task-popover">
            <div className="task-popover-head">
              <div>
                <strong>Cortex tasks</strong>
                <span>{tasks.length} open</span>
              </div>
              <button className="icon-btn" data-hint="Refresh" onClick={() => loadTasks(true)}><Icon name="refresh" size={13} /></button>
            </div>
            {tasks.length > 0 && (
              <div className="task-popover-summary">
                <span><strong>{highTaskCount}</strong> high priority</span>
                <span><strong>{workAreas.length}</strong> work areas</span>
                <span>{workAreas.map((area) => String(area).replace(/-/g, ' ')).join(' · ')}</span>
              </div>
            )}
            <div className="task-popover-list">
              {tasks.length === 0 ? (
                <div className="task-empty">No open Cortex tasks.</div>
              ) : tasks.map((task) => (
                <div key={task.id} className="task-popover-item">
                  <button
                    className="task-popover-main"
                    onClick={() => {
                      if (task.actionTarget && onNavigate) onNavigate(task.actionTarget, task.entityId || undefined);
                      setTasksOpen(false);
                    }}
                  >
                    <span className={`task-priority ${task.priority}`}>{task.priority}</span>
                    <strong>{task.title}</strong>
                    <span className="task-popover-meta">
                      <span>{String(task.actionTarget || task.screen || 'command').replace(/-/g, ' ')}</span>
                      {task.source && <span>{task.source}</span>}
                    </span>
                    {task.detail && <small>{task.detail}</small>}
                    <small className="task-action-copy">{task.actionLabel || 'Open task'}</small>
                  </button>
                  <div className="task-popover-actions">
                    <button className="icon-btn" data-hint="Done" onClick={() => updateTask(task, 'done')}><Icon name="check" size={13} /></button>
                    <button className="icon-btn" data-hint="Dismiss" onClick={() => updateTask(task, 'dismiss')}><Icon name="x" size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <button className="icon-btn" data-hint="Settings" onClick={onOpenProfile}>
        <Icon name="settings" />
      </button>

      <button
        className={`copilot-btn ${copilotOpen ? 'active' : ''}`}
        onClick={onToggleCopilot}
        data-hint={cortexHealth === 'online' ? 'Cortex online' : cortexHealth === 'offline' ? 'Cortex offline' : 'Checking Cortex'}
      >
        <span className={`ai-dot ${cortexHealth}`} />
        Cortex
      </button>
    </header>
  );
};
