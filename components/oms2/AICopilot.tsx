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

const ANSWER_SECTION_LABELS = new Set([
  'account snapshot',
  'first priority',
  'first action',
  'why',
  'action',
  'next step',
  'what is holding it back',
  'readiness',
  'connected data',
  'synchronized data',
  'attention required',
  'expected impact',
]);

type ParsedAnswerBlock = { label?: string; content: string };

const parseAnswerBlocks = (text?: string | null): ParsedAnswerBlock[] => {
  const sectionNames = Array.from(ANSWER_SECTION_LABELS)
    .sort((a, b) => b.length - a.length)
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const sectionPattern = new RegExp(`(^|[.!?]\\s+|\\n+)(${sectionNames}):\\s*`, 'gi');

  return cortexDisplayText(text)
    .split(/\n{2,}/)
    .filter(Boolean)
    .flatMap((block): ParsedAnswerBlock[] => {
      const matches = Array.from(block.matchAll(sectionPattern));
      if (!matches.length) return [{ content: block }];

      const parsed: ParsedAnswerBlock[] = [];
      const firstBoundary = matches[0][1] || '';
      const prefixEnd = (matches[0].index || 0) + (/[.!?]/.test(firstBoundary) ? 1 : 0);
      const prefix = block.slice(0, prefixEnd).trim();
      if (prefix) parsed.push({ content: prefix });

      matches.forEach((match, index) => {
        const next = matches[index + 1];
        const nextBoundary = next?.[1] || '';
        const contentStart = (match.index || 0) + match[0].length;
        const contentEnd = next
          ? (next.index || 0) + (/[.!?]/.test(nextBoundary) ? 1 : 0)
          : block.length;
        const content = block.slice(contentStart, contentEnd).trim();
        if (content) parsed.push({ label: match[2].trim(), content });
      });
      return parsed;
    });
};

const CortexAnswer = ({ text }: { text?: string | null }) => {
  const blocks = parseAnswerBlocks(text);
  return (
    <div className="ai-answer-text">
      {blocks.map((block, index) => {
        const label = block.label || '';
        const normalizedLabel = label.toLowerCase();
        if (label && ANSWER_SECTION_LABELS.has(normalizedLabel)) {
          const sectionClass = normalizedLabel.replace(/[^a-z0-9]+/g, '-');
          return (
            <section key={`${normalizedLabel}-${index}`} className={`ai-answer-section ${sectionClass}`}>
              <span>{label}</span>
              <div>{block.content}</div>
            </section>
          );
        }
        return <p key={index}>{block.content}</p>;
      })}
    </div>
  );
};

const AnswerConfidence = ({ value }: { value: number }) => (
  <div className="ai-answer-confidence" title="Confidence based on the account evidence available for this answer">
    <span>Answer confidence</span>
    <Confidence value={value} />
  </div>
);

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
      <CortexAnswer text={m.content} />
      {m.confidence != null && <AnswerConfidence value={m.confidence} />}
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
  const [threadOpenError, setThreadOpenError] = useState<string | null>(null);
  const [failedThreadId, setFailedThreadId] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [cortexHealth, setCortexHealth] = useState<'online' | 'offline' | 'checking'>('checking');
  const [pending, setPending] = useState(false);
  const [pendingStage, setPendingStage] = useState<'reading' | 'comparing' | 'writing'>('reading');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const requestInFlightRef = useRef(false);
  const conversationEpochRef = useRef(0);

  const welcomeMessage = () => {
    const screenLabel = String(section || 'this screen').replace(/-/g, ' ');
    return entityId
      ? `Ask Cortex about this ${entityType || 'record'}. Answers are grounded in this account and the active ${screenLabel} context.`
      : `Ask Cortex about this account or the ${screenLabel} screen. Answers use the account's current OMS data.`;
  };

  const loadThreads = () => {
    setThreadsLoading(true);
    setThreadListError(null);
    fetchCortexChatThreads(section, entityType, entityId)
      .then((r) => setThreads((r.threads || []).slice(0, 5)))
      .catch((error: any) => setThreadListError(error?.message || 'Chat history could not be loaded.'))
      .finally(() => setThreadsLoading(false));
  };

  const startNewThread = () => {
    if (requestInFlightRef.current || loadingThread) return;
    conversationEpochRef.current += 1;
    setThreadOpenError(null);
    setFailedThreadId(null);
    setThreadId(null);
    setHistory([{ role: 'ai', body: welcomeMessage() }]);
  };

  const openThread = async (id: string) => {
    if (requestInFlightRef.current || loadingThread) return;
    const epoch = ++conversationEpochRef.current;
    setLoadingThread(true);
    setThreadOpenError(null);
    setFailedThreadId(null);
    try {
      const r = await fetchCortexChatThread(id);
      if (conversationEpochRef.current !== epoch) return;
      setThreadId(r.thread.id);
      setHistory((r.messages || []).filter((m) => m.role !== 'system').map(messageToHistory));
    } catch (error: any) {
      if (conversationEpochRef.current !== epoch) return;
      setThreadOpenError(error?.message || 'That thread could not be opened.');
      setFailedThreadId(id);
    } finally {
      if (conversationEpochRef.current === epoch) setLoadingThread(false);
    }
  };

  useEffect(() => {
    conversationEpochRef.current += 1;
    requestInFlightRef.current = false;
    setPending(false);
    setLoadingThread(false);
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
        setHistory([{ role: 'ai', body: welcomeMessage() }]);
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

  useEffect(() => {
    if (!pending) {
      setPendingStage('reading');
      return;
    }
    setPendingStage('reading');
    const compareTimer = window.setTimeout(() => setPendingStage('comparing'), 2500);
    const writeTimer = window.setTimeout(() => setPendingStage('writing'), 7500);
    return () => {
      window.clearTimeout(compareTimer);
      window.clearTimeout(writeTimer);
    };
  }, [pending]);

  const send = async (q: string, appendUser = true) => {
    if (!q || requestInFlightRef.current || loadingThread) return;
    requestInFlightRef.current = true;
    const epoch = conversationEpochRef.current;
    if (appendUser) setHistory((h) => [...h, { role: 'user', body: q }]);
    setPending(true);
    try {
      const res = await sendCortexChat({
        screen: section,
        message: q,
        threadId,
        entityType: entityType || undefined,
        entityId: entityId || undefined,
      });
      if (conversationEpochRef.current !== epoch) return;
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
              <CortexAnswer text={res.message?.content || 'Cortex returned no answer.'} />
              {res.message?.confidence != null && <AnswerConfidence value={res.message.confidence} />}
            </>
          ),
        },
      ]);
      loadThreads();
    } catch {
      if (conversationEpochRef.current !== epoch) return;
      setCortexHealth('offline');
      setHistory((h) => [
        ...h,
        {
          role: 'ai',
          muted: true,
          body: (
            <>
              <CortexAnswer text="Cortex chat is unavailable right now. No cross-account data was used or exposed." />
              <div className="ai-answer-actions">
                <button
                  className="ai-answer-action"
                  onClick={() => {
                    setHistory((current) => current.slice(0, -1));
                    void send(q, false);
                  }}
                >
                  <Icon name="refresh" size={11} /> Retry
                </button>
              </div>
            </>
          ),
        },
      ]);
    } finally {
      if (conversationEpochRef.current === epoch) {
        requestInFlightRef.current = false;
        setPending(false);
      }
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
        <button className={`copilot-thread-pill ${!threadId ? 'active' : ''}`} onClick={startNewThread} disabled={pending || loadingThread}>
          <Icon name="plus" size={11} /> New
        </button>
        {threads.map((thread) => (
          <button
            key={thread.id}
            className={`copilot-thread-pill ${threadId === thread.id ? 'active' : ''}`}
            onClick={() => openThread(thread.id)}
            title={thread.title}
            disabled={pending || loadingThread}
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
        {threadOpenError && failedThreadId ? (
          <button className="copilot-thread-pill" onClick={() => openThread(failedThreadId)} title={threadOpenError}>
            <Icon name="refresh" size={11} /> Retry thread
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
            <div className="ai-body ai-thinking" role="status" aria-live="polite">
              <strong>
                {pendingStage === 'reading'
                  ? 'Reading account context'
                  : pendingStage === 'comparing'
                    ? 'Comparing account signals'
                    : 'Preparing a grounded answer'}
              </strong>
              <span>
                {pendingStage === 'reading'
                  ? 'Loading the records relevant to your question.'
                  : pendingStage === 'comparing'
                    ? 'Checking current evidence, readiness, and related activity.'
                    : 'Turning the evidence into a clear answer and next action.'}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="copilot-scroll-anchor" />
      </div>

      <div className="copilot-foot">
        <div className="copilot-chips">
          {prompts.map((ex) => (
            <button key={ex} className="copilot-chip" onClick={() => send(ex)} disabled={pending || loadingThread}>
              {ex}
            </button>
          ))}
        </div>
        <CopilotInput onSubmit={send} disabled={pending || loadingThread} />
      </div>
    </aside>
  );
};
