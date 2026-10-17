import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { Chip, Confidence } from './ui';
import {
  fetchCopilotContext,
  fetchCortexChatThread,
  fetchCortexChatThreads,
  fetchCortexChatHealth,
  sendCortexChat,
  CopilotContext,
  CortexChatMessage,
  CortexChatThread,
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
  if (source.label) return String(source.label);
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

const sourceTarget = (source: Record<string, unknown>) => {
  const target = String(source.screen || '').trim();
  return target || null;
};

const humanizeChatTimestamp = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const cortexDisplayText = (text?: string | null) =>
  String(text || '')
    .replace(/\bNVIDIA\s*NIM\b/gi, 'Cortex')
    .replace(/\bNIM\b/g, 'Cortex')
    .replace(/\bNVIDIA\b/gi, 'Cortex')
    .replace(/\blive Cortex\b/gi, 'Cortex')
    .replace(/\bCortex\/Cortex\b/gi, 'Cortex')
    .replace(/(?:Note:\s*)?Cortex did not respond, so this answer was generated from this account'?s scoped OMS data only\.?/gi, 'Answer generated from this account\u2019s scoped OMS data.')
    .replace(/Cortex response unavailable; used scoped OMS fallback\.?/gi, 'Answer generated from this account\u2019s scoped OMS data.')
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g, humanizeChatTimestamp)
    .replace(/\b(confidence(?: score| level)?\s*(?:is|:)?\s*)(0(?:\.\d+))\b/gi, (_match, prefix, value) => `${prefix}${Math.round(Number(value) * 100)}%`)
    .replace(/[ \t]+([,.;!?])/g, '$1')
    .replace(/([.!?])(?:\s*\1)+/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/Cortex could not produce a live response right now\.\s*/gi, '')
    .replace(/live Cortex\/Cortex did not respond, so this answer was generated from this account's scoped OMS data only\./gi, 'Answer generated from this account’s scoped OMS data.')
    .replace(/live Cortex response unavailable; used scoped OMS fallback\./gi, 'Answer generated from this account’s scoped OMS data.')
    .trim();

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
  entityType,
  entityId,
  onClose,
  onNavigate,
}: {
  section: string;
  entityType?: string | null;
  entityId?: string | null;
  onClose: () => void;
  onNavigate?: (target: string, payload?: string) => void;
}) => {
  const [ctx, setCtx] = useState<CopilotContext | null>(null);
  const [history, setHistory] = useState<Msg[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<CortexChatThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadListError, setThreadListError] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [cortexHealth, setCortexHealth] = useState<'online' | 'offline' | 'checking'>('checking');
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadThreads = () => {
    setThreadsLoading(true);
    setThreadListError(null);
    fetchCortexChatThreads(section, entityType, entityId)
      .then((r) => setThreads((r.threads || []).slice(0, 5)))
      .catch((error: any) => setThreadListError(error?.message || 'Chat history could not be loaded.'))
      .finally(() => setThreadsLoading(false));
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
    const healthTimer = window.setInterval(() => checkHealth(false), 60000);
    fetchCopilotContext(section)
      .then((c) => {
        if (cancelled) return;
        setCtx(c);
        setHistory([
          { role: 'ai', body: c.summary || 'Cortex is grounded in this OMS account. Ask about the current screen, tasks, SKUs, orders, warehouses, audits, or readiness.' },
        ]);
      })
      .catch(() => {
        if (cancelled) return;
        setHistory([{ role: 'ai', body: 'Cortex context is temporarily unavailable. Operating views remain fully functional.', muted: true }]);
      });
    loadThreads();
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(healthTimer);
    };
  }, [section, entityType, entityId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [history.length, pending, loadingThread]);

  const send = async (q: string) => {
    if (!q) return;
    setHistory((h) => [...h, { role: 'user', body: q }]);
    setPending(true);
    try {
      const res = await sendCortexChat({
        screen: section,
        message: q,
        threadId,
        entityType: entityType || undefined,
        entityId: entityId || undefined,
      });
      if (res.thread?.id) setThreadId(res.thread.id);
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
      setHistory((h) => [
        ...h,
        {
          role: 'ai',
          muted: true,
          body: (
            <>
              <div className="ai-answer-text">Cortex chat is unavailable right now. No cross-account data was used or exposed.</div>
              <div className="ai-answer-actions">
                <button className="ai-answer-action" onClick={() => send(q)}>
                  <Icon name="refresh" size={11} /> Retry
                </button>
              </div>
            </>
          ),
        },
      ]);
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
            {cortexHealth === 'online' ? 'Cortex ready' : cortexHealth === 'offline' ? 'Cortex unavailable' : 'Checking Cortex'}
          </Chip>
          {entityId ? <span className="copilot-entity-context" title={entityId}>Focused on this {entityType || 'record'}</span> : null}
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
        {threadsLoading && threads.length === 0 ? (
          <span className="copilot-thread-pill" aria-live="polite">Loading history...</span>
        ) : threadListError ? (
          <button className="copilot-thread-pill" onClick={loadThreads} title={threadListError}>
            <Icon name="warning" size={11} /> Retry history
          </button>
        ) : null}
      </div>

      <div className="copilot-body">
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
                  {m.sources.slice(0, 4).map((source, idx) => {
                    const target = sourceTarget(source);
                    return target ? (
                      <button
                        key={idx}
                        type="button"
                        title={`Open ${sourceLabel(source)}`}
                        onClick={() => onNavigate?.(target)}
                      >
                        <Icon name="arrowRight" size={10} /> {sourceLabel(source)}
                      </button>
                    ) : <span key={idx}>{sourceLabel(source)}</span>;
                  })}
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
