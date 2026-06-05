import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { Chip, Confidence } from './ui';
import {
  completeCortexTask,
  fetchCopilotContext,
  fetchCortexChatThread,
  fetchCortexChatThreads,
  fetchCortexChatHealth,
  fetchCortexTasks,
  dismissCortexTask,
  sendCortexChat,
  CopilotContext,
  CortexChatMessage,
  CortexChatThread,
  CortexTask,
} from '../../lib/oms';

type ChatAction = {
  id?: string;
  title?: string;
  priority?: string;
  screen?: string;
  actionTarget?: string;
  actionLabel?: string;
  entityId?: string;
};

type Msg = {
  role: 'ai' | 'user';
  body: React.ReactNode;
  muted?: boolean;
  sources?: Array<Record<string, unknown>>;
  actions?: ChatAction[];
};

const sourceLabel = (source: Record<string, unknown>) => {
  const name = String(source.source || 'oms').replace(/^oms_/, '').replace(/_/g, ' ');
  if (source.source === 'oms_data_readiness') return `readiness ${source.readinessScore ?? '—'}%`;
  if (source.source === 'oms_cortex_tasks') return `tasks ${source.count ?? 0}`;
  if (source.source === 'oms_recommendations') return `signals ${source.count ?? 0}`;
  if (source.source === 'oms_context_samples') {
    const parts = [
      source.skus != null ? `${source.skus} SKUs` : '',
      source.orders != null ? `${source.orders} orders` : '',
      source.warehouses != null ? `${source.warehouses} WHs` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'OMS context';
  }
  return name;
};

const cortexDisplayText = (text?: string | null) =>
  String(text || '')
    .replace(/\bNVIDIA\s*NIM\b/gi, 'Cortex')
    .replace(/\bNIM\b/g, 'Cortex')
    .replace(/\bNVIDIA\b/gi, 'Cortex')
    .replace(/Cortex could not produce a live response right now\.\s*/gi, '')
    .replace(/live Cortex\/Cortex did not respond, so this answer was generated from this account's scoped OMS data only\./gi, 'Answer generated from this account’s scoped OMS data.')
    .replace(/live Cortex response unavailable; used scoped OMS fallback\./gi, 'Answer generated from this account’s scoped OMS data.');

const shouldMuteMessage = (m: CortexChatMessage) => {
  const content = String(m.content || '').toLowerCase();
  return content.includes('cortex is not available') || content.includes('cortex chat is unavailable');
};

const messageToHistory = (m: CortexChatMessage): Msg => ({
  role: m.role === 'user' ? 'user' : 'ai',
  muted: shouldMuteMessage(m),
  sources: m.sources,
  actions: (m.tasks || []) as ChatAction[],
  body: (
    <>
      <div className="ai-answer-text">{cortexDisplayText(m.content)}</div>
      {m.confidence != null && <div style={{ marginTop: 6 }}><Confidence value={m.confidence} /></div>}
    </>
  ),
});

const CopilotInput = ({ onSubmit, disabled }: { onSubmit: (q: string) => void; disabled?: boolean }) => {
  const [text, setText] = useState('');
  const submit = () => {
    const q = text.trim();
    if (q && !disabled) onSubmit(q);
    setText('');
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ position: 'relative' }}>
      <textarea
        className="copilot-input"
        placeholder="Ask Cortex about this account, screen, SKUs, orders, warehouses, or tasks"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button type="submit" className="btn ai sm" disabled={disabled} style={{ position: 'absolute', right: 8, bottom: 8 }}>
        <Icon name="sparkle" size={12} /> Ask
      </button>
    </form>
  );
};

export const AICopilot = ({
  section,
  onClose,
  onNavigate,
  cortexAvailable,
}: {
  section: string;
  onClose: () => void;
  onNavigate?: (target: string, payload?: string) => void;
  cortexAvailable?: boolean;
}) => {
  const [ctx, setCtx] = useState<CopilotContext | null>(null);
  const [history, setHistory] = useState<Msg[]>([]);
  const [tasks, setTasks] = useState<CortexTask[]>([]);
  const [taskScope, setTaskScope] = useState<'screen' | 'account'>('screen');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<CortexChatThread[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [cortexHealth, setCortexHealth] = useState<'online' | 'offline' | 'checking'>(
    cortexAvailable === false ? 'offline' : 'checking'
  );
  const [pending, setPending] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadThreads = () => {
    fetchCortexChatThreads(section)
      .then((r) => setThreads((r.threads || []).slice(0, 5)))
      .catch(() => setThreads([]));
  };

  const loadTasks = (refresh = false) => {
    fetchCortexTasks({ status: 'open', screen: section, refresh, limit: 8 })
      .then((r) => {
        if (r.tasks?.length) {
          setTaskScope('screen');
          setTasks(r.tasks || []);
          return;
        }
        fetchCortexTasks({ status: 'open', refresh: false, limit: 8 })
          .then((accountTasks) => {
            setTaskScope('account');
            setTasks(accountTasks.tasks || []);
          })
          .catch(() => setTasks([]));
      })
      .catch(() => setTasks([]));
  };

  const updateTask = async (task: CortexTask, action: 'done' | 'dismiss') => {
    if (action === 'done') await completeCortexTask(task.id).catch(() => null);
    else await dismissCortexTask(task.id).catch(() => null);
    loadTasks(false);
  };

  const startNewThread = () => {
    setThreadId(null);
    setHistory([
      { role: 'ai', body: ctx?.summary || 'Cortex is grounded in this OMS account. Ask about the current screen, tasks, SKUs, orders, warehouses, audits, or readiness.' },
    ]);
  };

  const openThread = async (id: string) => {
    setLoadingThread(true);
    try {
      const r = await fetchCortexChatThread(id);
      setThreadId(r.thread.id);
      setHistory((r.messages || []).filter((m) => m.role !== 'system').map(messageToHistory));
    } catch {
      setHistory((h) => [...h, { role: 'ai', body: 'I could not open that thread. Start a new question or try again.', muted: true }]);
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    setThreadId(null);
    setThreads([]);
    setCortexHealth(cortexAvailable === false ? 'offline' : 'checking');
    if (cortexAvailable !== false) {
      fetchCortexChatHealth(section)
        .then((res) => setCortexHealth(res.ok ? 'online' : 'offline'))
        .catch(() => null);
    }
    fetchCopilotContext(section)
      .then((c) => {
        setCtx(c);
        if (cortexAvailable !== false) setCortexHealth('online');
        setHistory([
          { role: 'ai', body: c.summary || 'Cortex is grounded in this OMS account. Ask about the current screen, tasks, SKUs, orders, warehouses, audits, or readiness.' },
        ]);
      })
      .catch(() => {
        setHistory([{ role: 'ai', body: 'Cortex context is temporarily unavailable. Operating views remain fully functional.', muted: true }]);
      });
    loadTasks(true);
    loadThreads();
  }, [section]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [history.length, pending, loadingThread]);

  const send = async (q: string) => {
    if (!q) return;
    setHistory((h) => [...h, { role: 'user', body: q }]);
    setPending(true);
    try {
      const res = await sendCortexChat({ screen: section, message: q, threadId });
      if (res.thread?.id) setThreadId(res.thread.id);
      if (res.context?.tasks) {
        setTaskScope('account');
        setTasks(res.context.tasks);
      }
      const cortexUnavailable = res.cortex?.health?.available === false;
      setCortexHealth(cortexUnavailable ? 'offline' : 'online');
      setHistory((h) => [
        ...h,
        {
          role: 'ai',
          muted: cortexUnavailable,
          sources: res.message?.sources,
          actions: (res.message?.tasks || []) as ChatAction[],
          body: (
            <>
              <div className="ai-answer-text">{cortexDisplayText(res.message?.content || 'Cortex returned no answer.')}</div>
              {res.message?.confidence != null && <div style={{ marginTop: 6 }}><Confidence value={res.message.confidence} /></div>}
            </>
          ),
        },
      ]);
      loadThreads();
    } catch {
      setCortexHealth('offline');
      setHistory((h) => [...h, { role: 'ai', body: 'Cortex chat is unavailable right now. No cross-account data was used or exposed.', muted: true }]);
    } finally {
      setPending(false);
    }
  };

  const prompts = ctx?.recommendedPrompts?.length
    ? ctx.recommendedPrompts
    : ['What should I work on next?', 'Which SKUs need enrichment?', 'Audit recent carrier labels', 'What tasks are blocking Cortex readiness?'];

  return (
    <aside className="copilot">
      <div className="copilot-head">
        <div className="copilot-title">
          <span className={`ai-dot ${cortexHealth}`} />
          Cortex
          <Chip tone={cortexHealth === 'online' ? 'green' : cortexHealth === 'offline' ? 'red' : 'amber'} dot={false}>
            {cortexHealth === 'online' ? 'Cortex online' : cortexHealth === 'offline' ? 'Cortex offline' : 'Checking Cortex'}
          </Chip>
        </div>
        <button className="icon-btn" onClick={onClose} data-hint="Close">
          <Icon name="x" />
        </button>
      </div>
      <div className="copilot-thread-bar">
        <button className={`copilot-thread-pill ${!threadId ? 'active' : ''}`} onClick={startNewThread}>
          <Icon name="plus" size={11} /> New
        </button>
        {threads.map((thread) => (
          <button
            key={thread.id}
            className={`copilot-thread-pill ${threadId === thread.id ? 'active' : ''}`}
            onClick={() => openThread(thread.id)}
            title={thread.title}
          >
            {thread.title || 'Cortex thread'}
          </button>
        ))}
      </div>

      <div className="copilot-body">
        {tasks.length > 0 && (
          <div className={`ai-card cortex-task-card ${guidanceOpen ? 'open' : 'collapsed'}`}>
            <button className="cortex-guidance-toggle" onClick={() => setGuidanceOpen((open) => !open)}>
              <span>
                <strong>{taskScope === 'screen' ? 'Screen guidance' : 'Account guidance'}</strong>
                <small>Tasks stay in notifications and Command Center. Open here only when you need direction.</small>
              </span>
              <span className="guidance-toggle-right">
                <Chip tone={tasks.some((task) => task.priority === 'high') ? 'red' : 'purple'} dot={false}>
                  {tasks.length} open
                </Chip>
                <Icon name={guidanceOpen ? 'chevronUp' : 'chevronDown'} size={12} />
              </span>
            </button>
            {guidanceOpen && tasks.slice(0, 3).map((task) => (
              <div key={task.id} className="cortex-task-mini">
                <div>
                  <span className={`task-priority ${task.priority}`}>{task.priority}</span>
                  <strong>{task.title}</strong>
                  {task.detail && <span>{task.detail}</span>}
                </div>
                <div className="task-mini-actions">
                  <button
                    className="btn ghost sm task-action-label"
                    title={task.actionLabel || 'Open'}
                    onClick={() => onNavigate?.(task.actionTarget || task.screen || 'command', task.entityId || undefined)}
                  >
                    <Icon name="arrowRight" size={12} /> {task.actionLabel || 'Open'}
                  </button>
                  <button className="icon-btn" data-hint="Done" onClick={() => updateTask(task, 'done')}>
                    <Icon name="check" size={13} />
                  </button>
                  <button className="icon-btn" data-hint="Dismiss" onClick={() => updateTask(task, 'dismiss')}>
                    <Icon name="x" size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(ctx?.latestSignals || []).length > 0 && (
          <div className={`ai-card cortex-signal-card ${signalsOpen ? 'open' : 'collapsed'}`}>
            <button className="cortex-guidance-toggle" onClick={() => setSignalsOpen((open) => !open)}>
              <span>
                <strong>Latest signals</strong>
                <small>{ctx?.latestSignals?.length || 0} account signal{(ctx?.latestSignals?.length || 0) === 1 ? '' : 's'} available</small>
              </span>
              <span className="guidance-toggle-right">
                <Chip tone="purple" dot={false}>{ctx?.latestSignals?.length || 0}</Chip>
                <Icon name={signalsOpen ? 'chevronUp' : 'chevronDown'} size={12} />
              </span>
            </button>
            {signalsOpen && (ctx?.latestSignals || []).slice(0, 3).map((s, i) => (
              <div key={i} className="cortex-signal-mini">
                <div>
                  <strong>{s.title || 'Signal'}</strong>
                  {s.detail && <span>{s.detail}</span>}
                  <small>Source: Cortex · {section}</small>
                </div>
                {s.confidence != null && <Confidence value={s.confidence} />}
              </div>
            ))}
          </div>
        )}

        {loadingThread && (
          <div className="ai-msg">
            <div className="ai-avatar">CX</div>
            <div className="ai-body pulsing">Opening thread...</div>
          </div>
        )}
        {history.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role === 'user' ? 'user' : ''} ${m.muted ? 'muted' : ''}`}>
            <div className="ai-avatar">{m.role === 'user' ? 'You' : 'CX'}</div>
            <div className="ai-body">
              {m.body}
              {m.role === 'ai' && m.sources?.length ? (
                <div className="ai-sources">
                  {m.sources.slice(0, 4).map((source, idx) => (
                    <span key={idx}>{sourceLabel(source)}</span>
                  ))}
                </div>
              ) : null}
              {m.role === 'ai' && m.actions?.length ? (
                <div className="ai-answer-actions">
                  {m.actions.slice(0, 3).map((action, idx) => (
                    <button
                      key={`${action.id || action.title || 'action'}-${idx}`}
                      className="ai-answer-action"
                      onClick={() => onNavigate?.(action.actionTarget || action.screen || 'command', action.entityId || undefined)}
                    >
                      <Icon name="arrowRight" size={11} /> {action.actionLabel || action.title || 'Open'}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {pending && (
          <div className="ai-msg">
            <div className="ai-avatar">CX</div>
            <div className="ai-body pulsing">Thinking...</div>
          </div>
        )}
        <div ref={bottomRef} className="copilot-scroll-anchor" />
      </div>

      <div className="copilot-foot">
        <div className="copilot-chips">
          {prompts.map((ex) => (
            <button key={ex} className="copilot-chip" onClick={() => send(ex)}>
              {ex}
            </button>
          ))}
        </div>
        <CopilotInput onSubmit={send} disabled={pending} />
      </div>
    </aside>
  );
};
