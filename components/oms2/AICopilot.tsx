import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { Chip, Confidence } from './ui';
import {
  fetchCopilotContext,
  fetchCortexChatThread,
  fetchCortexChatThreads,
  fetchCortexChatHealth,
  getLatestCortexHealth,
  CORTEX_HEALTH_CHANGED_EVENT,
  CortexHealthState,
  CortexHealthEventDetail,
  notifyCortexHealthChanged,
  sendCortexChat,
  CopilotContext,
  CortexChatMessage,
  CortexChatResponse,
  CortexChatThread,
} from '../../lib/oms';

type ChatAction = {
  id?: string;
  dedupeKey?: string;
  title?: string;
  priority?: string;
  screen?: string;
  actionTarget?: string;
  actionLabel?: string;
  entityType?: string;
  entityId?: string;
  navigationPayload?: string;
};

type Msg = {
  role: 'ai' | 'user';
  body: React.ReactNode;
  plainText?: string;
  muted?: boolean;
  sources?: Array<Record<string, unknown>>;
  actions?: ChatAction[];
  readinessNote?: string | null;
  createdAt?: string;
};

const SOURCE_DESTINATIONS: Record<string, string> = {
  oms_asns: 'shipments',
  oms_billing: 'billing',
  oms_business_double: 'double',
  oms_context_samples: 'command',
  oms_cortex_tasks: 'command',
  oms_customers: 'customers',
  oms_data_readiness: 'command',
  oms_demand_heatmap: 'heatmap',
  oms_execution_ledger: 'ledger',
  oms_inventory_plan: 'plan',
  oms_label_audits: 'labels',
  oms_marketplace_apps: 'marketplace',
  oms_marketplace_connections: 'connections',
  oms_orders: 'orders',
  oms_recommendations: 'command',
  oms_returns: 'returns',
  oms_shipment_plans: 'shipments',
  oms_skus: 'skus',
  oms_suppliers: 'suppliers',
  oms_support_tickets: 'support',
  oms_warehouses: 'warehouses',
};

const SOURCE_LABELS: Record<string, string> = {
  oms_asns: 'ASNs',
  oms_billing: 'Billing evidence',
  oms_business_double: 'Business Double',
  oms_customers: 'Customers',
  oms_demand_heatmap: 'Demand heatmap',
  oms_execution_ledger: 'Execution ledger',
  oms_inventory_plan: 'Inventory plan',
  oms_label_audits: 'Label audits',
  oms_marketplace_apps: 'Marketplace apps',
  oms_orders: 'Orders',
  oms_recommendations: 'Cortex decisions',
  oms_returns: 'Returns',
  oms_shipment_plans: 'Shipment plans',
  oms_skus: 'SKUs',
  oms_suppliers: 'Suppliers',
  oms_support_tickets: 'Support activity',
  oms_warehouses: 'Warehouses',
};

const sourceLabel = (source: Record<string, unknown>) => {
  if (source.label) return String(source.label);
  const sourceName = String(source.source || 'oms');
  const name = sourceName.replace(/^oms_/, '').replace(/_/g, ' ');
  if (sourceName === 'oms_data_readiness') return `Readiness ${source.readinessScore ?? '—'}%`;
  if (sourceName === 'oms_cortex_tasks') return `Tasks ${source.count ?? 0}`;
  if (sourceName === 'oms_marketplace_connections') {
    const channel = String(source.channel || '').trim();
    return channel && channel !== 'all'
      ? `${channel.charAt(0).toUpperCase()}${channel.slice(1)} connection`
      : 'Marketplace connections';
  }
  if (sourceName === 'oms_context_samples') {
    const parts = [
      source.skus != null ? `${source.skus} SKUs` : '',
      source.orders != null ? `${source.orders} orders` : '',
      source.warehouses != null ? `${source.warehouses} WHs` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'OMS context';
  }
  return SOURCE_LABELS[sourceName] || name;
};

const sourceTarget = (source: Record<string, unknown>) => {
  const target = String(source.screen || '').trim();
  if (target) return target;
  return SOURCE_DESTINATIONS[String(source.source || '')] || null;
};

const sourcePayload = (source: Record<string, unknown>) => {
  const payload = String(source.navigationPayload || source.entityId || '').trim();
  if (payload) return payload;
  return source.source === 'oms_cortex_tasks' ? 'focus:cortex-tasks' : undefined;
};

const humanizeScreen = (screen?: string | null) =>
  String(screen || 'command')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const humanizeChatTimestamp = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const chatTimeLabel = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const threadTimeLabel = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const now = new Date();
  const sameDay = parsed.getFullYear() === now.getFullYear()
    && parsed.getMonth() === now.getMonth()
    && parsed.getDate() === now.getDate();
  return sameDay
    ? parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const activeThreadKey = (screen: string, entityType?: string | null, entityId?: string | null) =>
  `unie:cortex-active-thread:${encodeURIComponent([screen || 'command', entityType || '', entityId || ''].join(':'))}`;

const createChatRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const cortexDisplayText = (text?: string | null) =>
  String(text || '')
    .split(/\n{1,2}(?:Sources|Suggested actions|Readiness notes|Confidence):?/i, 1)[0]
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
  'marketplace health',
  'order flow',
  'warehouse evidence',
  'financial evidence',
  'intelligence readiness',
  'first priority',
  'first action',
  'why',
  'action',
  'next step',
  'other recorded changes',
  'what is holding it back',
  'what becomes measurable',
  'what this means',
  'readiness',
  'data quality',
  'connected data',
  'synchronized data',
  'attention required',
  'expected impact',
  'missing evidence',
  'missing inputs',
  'cost concentration',
  'profitability blind spot',
  'cost baseline',
  'warehouse baseline',
  'next steps',
  'current evidence',
  'suggested change',
  'measurable impact',
]);

const ANSWER_LEAD_LABELS = new Set([
  'account snapshot',
  'recent account activity',
  'recommended two-week sequence',
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
              <AnswerBlockContent content={block.content} />
            </section>
          );
        }
        if (!label && index === 0 && ANSWER_LEAD_LABELS.has(block.content.trim().toLowerCase())) {
          return <div key={index} className="ai-answer-lead">{block.content}</div>;
        }
        return <AnswerBlockContent key={index} content={block.content} />;
      })}
    </div>
  );
};

const AnswerBlockContent = ({ content }: { content: string }) => {
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
  const unordered = lines.length > 1 && lines.every((line) => /^[-*]\s+/.test(line));
  const ordered = lines.length > 1 && lines.every((line) => /^\d+[.)]\s+/.test(line));
  if (unordered) {
    return <ul>{lines.map((line, index) => <li key={index}>{line.replace(/^[-*]\s+/, '')}</li>)}</ul>;
  }
  if (ordered) {
    return <ol>{lines.map((line, index) => <li key={index}>{line.replace(/^\d+[.)]\s+/, '')}</li>)}</ol>;
  }
  return <p>{content}</p>;
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

const visibleReadinessNote = (content?: string | null, note?: string | null) => {
  const normalized = cortexDisplayText(note);
  if (!normalized || /answer generated from this account/i.test(normalized)) return null;
  return cortexDisplayText(content).toLowerCase().includes(normalized.toLowerCase()) ? null : normalized;
};

const messageToHistory = (m: CortexChatMessage): Msg => ({
  role: m.role === 'user' ? 'user' : 'ai',
  plainText: m.role === 'assistant' ? cortexDisplayText(m.content) : undefined,
  muted: shouldMuteMessage(m),
  sources: m.sources,
  actions: (m.tasks || []) as ChatAction[],
  readinessNote: visibleReadinessNote(m.content, m.readinessNotes),
  createdAt: m.createdAt,
  body: (
    <>
      <CortexAnswer text={m.content} />
      {m.confidence != null && <AnswerConfidence value={m.confidence} />}
    </>
  ),
});

const CopilotInput = ({ onSubmit, disabled }: { onSubmit: (q: string) => void; disabled?: boolean }) => {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  }, [text]);

  const submit = () => {
    const q = text.trim();
    if (!q || disabled) return;
    onSubmit(q);
    setText('');
  };
  return (
    <form className="copilot-composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <textarea
        ref={inputRef}
        className="copilot-input"
        aria-label="Ask Cortex"
        placeholder="Ask Cortex about this account or what you see on this screen"
        rows={1}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as KeyboardEvent).isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button
        type="submit"
        className="icon-btn copilot-send-btn"
        disabled={disabled || !text.trim()}
        aria-label="Send message"
        data-hint="Send message"
      >
        <Icon name="arrowUp" size={15} />
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
  const [contextLoading, setContextLoading] = useState(true);
  const [cortexHealth, setCortexHealth] = useState<CortexHealthState>(() => getLatestCortexHealth()?.status || 'checking');
  const [cortexLatencyMs, setCortexLatencyMs] = useState<number | null>(() => getLatestCortexHealth()?.latencyMs ?? null);
  const [pending, setPending] = useState(false);
  const [pendingStage, setPendingStage] = useState<'reading' | 'comparing' | 'writing'>('reading');
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const requestInFlightRef = useRef(false);
  const conversationEpochRef = useRef(0);
  const threadListRequestRef = useRef(0);
  const chatAbortRef = useRef<AbortController | null>(null);
  const threadStorageKey = activeThreadKey(section, entityType, entityId);
  const screenLabel = humanizeScreen(section);

  const navigateFromCortex = (target: string, payload?: string) => {
    if (!onNavigate) return;
    onNavigate(target, payload);
    onClose();
  };

  const rememberActiveThread = (id?: string | null) => {
    try {
      if (id) window.sessionStorage.setItem(threadStorageKey, id);
      else window.sessionStorage.removeItem(threadStorageKey);
    } catch {
      /* Session storage is optional; server-side thread history remains authoritative. */
    }
  };

  const welcomeMessage = () => {
    const conversationalScreenLabel = String(section || 'this screen').replace(/-/g, ' ');
    return entityId
      ? `Ask Cortex about this ${entityType || 'record'}. Answers are grounded in this account and the active ${conversationalScreenLabel} context.`
      : `Ask Cortex about this account or the ${conversationalScreenLabel} screen. Answers use the account's current OMS data.`;
  };

  const loadThreads = () => {
    const requestId = ++threadListRequestRef.current;
    setThreadsLoading(true);
    setThreadListError(null);
    fetchCortexChatThreads(section, entityType, entityId)
      .then((r) => {
        if (threadListRequestRef.current !== requestId) return;
        setThreads((r.threads || []).slice(0, 5));
      })
      .catch((error: any) => {
        if (threadListRequestRef.current !== requestId) return;
        setThreadListError(error?.message || 'Chat history could not be loaded.');
      })
      .finally(() => {
        if (threadListRequestRef.current === requestId) setThreadsLoading(false);
      });
  };

  const startNewThread = () => {
    if (requestInFlightRef.current || loadingThread) return;
    conversationEpochRef.current += 1;
    setThreadOpenError(null);
    setFailedThreadId(null);
    setThreadId(null);
    rememberActiveThread(null);
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
      rememberActiveThread(r.thread.id);
      const restored = (r.messages || []).filter((m) => m.role !== 'system').map(messageToHistory);
      setHistory(restored.length ? restored : [{ role: 'ai', body: welcomeMessage() }]);
    } catch (error: any) {
      if (conversationEpochRef.current !== epoch) return;
      setThreadOpenError(error?.message || 'That thread could not be opened.');
      setFailedThreadId(id);
    } finally {
      if (conversationEpochRef.current === epoch) setLoadingThread(false);
    }
  };

  useEffect(() => {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    conversationEpochRef.current += 1;
    requestInFlightRef.current = false;
    setPending(false);
    setLoadingThread(false);
    setThreadId(null);
    setThreads([]);
    setHistory([]);
    setCtx(null);
    setContextLoading(true);
    let cancelled = false;
    let savedThreadId = '';
    try {
      savedThreadId = window.sessionStorage.getItem(threadStorageKey) || '';
    } catch {
      savedThreadId = '';
    }
    const restoreEpoch = conversationEpochRef.current;
    const shareHealth = (status: CortexHealthState, latencyMs?: number, checkedAt?: string) => {
      if (cancelled) return;
      setCortexHealth(status);
      if (Number.isFinite(latencyMs)) setCortexLatencyMs(Number(latencyMs));
      else if (status !== 'online') setCortexLatencyMs(null);
      notifyCortexHealthChanged(status, { latencyMs, checkedAt });
    };
    const checkHealth = (showChecking = false) => {
      if (showChecking) {
        setCortexHealth((current) => current === 'online' || current === 'offline' ? current : 'checking');
      }
      fetchCortexChatHealth(section)
        .then((res) => {
          shareHealth(res.ok ? 'online' : 'offline', res.health?.latencyMs, res.health?.checkedAt);
        })
        .catch(() => {
          // Transport uncertainty should not advertise a service outage.
          // Keep a confirmed green state, or remain neutral while checking.
          if (!cancelled) setCortexHealth((current) => current === 'online' ? current : 'checking');
        });
    };
    const onSharedHealth = (event: Event) => {
      const detail = (event as CustomEvent<CortexHealthEventDetail>).detail;
      if (!cancelled && detail?.status) {
        setCortexHealth(detail.status);
        if (Number.isFinite(detail.latencyMs)) setCortexLatencyMs(Number(detail.latencyMs));
        else if (detail.status !== 'online') setCortexLatencyMs(null);
      }
    };
    const onFocus = () => checkHealth(false);
    checkHealth(true);
    window.addEventListener('focus', onFocus);
    window.addEventListener(CORTEX_HEALTH_CHANGED_EVENT, onSharedHealth);
    const healthTimer = window.setInterval(() => checkHealth(false), 60000);
    fetchCopilotContext(section)
      .then((c) => {
        if (cancelled) return;
        setCtx(c);
        if (!savedThreadId) setHistory([{ role: 'ai', body: welcomeMessage() }]);
      })
      .catch(() => {
        if (cancelled) return;
        setCtx(null);
        if (!savedThreadId) setHistory([{ role: 'ai', body: welcomeMessage() }]);
      })
      .finally(() => {
        if (!cancelled) setContextLoading(false);
      });
    if (savedThreadId) {
      setLoadingThread(true);
      fetchCortexChatThread(savedThreadId)
        .then((r) => {
          if (cancelled || conversationEpochRef.current !== restoreEpoch) return;
          setThreadId(r.thread.id);
          const restored = (r.messages || []).filter((m) => m.role !== 'system').map(messageToHistory);
          setHistory(restored.length ? restored : [{ role: 'ai', body: welcomeMessage() }]);
        })
        .catch(() => {
          if (cancelled || conversationEpochRef.current !== restoreEpoch) return;
          rememberActiveThread(null);
          setHistory([{ role: 'ai', body: welcomeMessage() }]);
        })
        .finally(() => {
          if (!cancelled && conversationEpochRef.current === restoreEpoch) setLoadingThread(false);
        });
    }
    loadThreads();
    return () => {
      cancelled = true;
      threadListRequestRef.current += 1;
      chatAbortRef.current?.abort();
      chatAbortRef.current = null;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(CORTEX_HEALTH_CHANGED_EVENT, onSharedHealth);
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

  const send = async (q: string, appendUser = true, requestId = createChatRequestId()) => {
    if (!q || requestInFlightRef.current || loadingThread) return;
    requestInFlightRef.current = true;
    let controller = new AbortController();
    chatAbortRef.current = controller;
    let timeout = window.setTimeout(() => controller.abort('timeout'), 45000);
    const epoch = conversationEpochRef.current;
    const request = {
      screen: section,
      message: q,
      threadId,
      entityType: entityType || undefined,
      entityId: entityId || undefined,
      requestId,
    };
    if (appendUser) setHistory((h) => [...h, { role: 'user', body: q, createdAt: new Date().toISOString() }]);
    setPending(true);
    try {
      const res = await sendCortexChat(request, controller.signal);
      applyChatResponse(res, epoch);
    } catch (error: any) {
      if (conversationEpochRef.current !== epoch) return;
      const aborted = controller.signal.aborted || error?.name === 'AbortError';
      const timedOut = aborted && controller.signal.reason === 'timeout';
      const stoppedByUser = aborted && !timedOut;
      let finalError = error;
      let finalTimedOut = timedOut;
      let finalStoppedByUser = stoppedByUser;
      if (timedOut) {
        // The backend continues the account-scoped request after the browser's
        // first wait expires. Reusing the request ID replays that stored answer
        // without duplicating the user's message or starting a second model run.
        window.clearTimeout(timeout);
        controller = new AbortController();
        chatAbortRef.current = controller;
        timeout = window.setTimeout(() => controller.abort('recovery-timeout'), 12000);
        setPendingStage('writing');
        try {
          const recovered = await sendCortexChat(request, controller.signal);
          applyChatResponse(recovered, epoch);
          return;
        } catch (recoveryError: any) {
          finalError = recoveryError;
          const recoveryAborted = controller.signal.aborted || recoveryError?.name === 'AbortError';
          finalTimedOut = recoveryAborted && controller.signal.reason === 'recovery-timeout';
          finalStoppedByUser = recoveryAborted && !finalTimedOut;
        }
      }
      const stillProcessing = /still preparing the original answer/i.test(String(finalError?.message || ''));
      if (!finalStoppedByUser) {
        fetchCortexChatHealth(section)
          .then((health) => {
            const nextHealth = health.ok ? 'online' : 'offline';
            setCortexHealth(nextHealth);
            if (Number.isFinite(health.health?.latencyMs)) setCortexLatencyMs(Number(health.health?.latencyMs));
            notifyCortexHealthChanged(nextHealth, { latencyMs: health.health?.latencyMs, checkedAt: health.health?.checkedAt });
          })
          .catch(() => {
            setCortexHealth((current) => current === 'online' ? current : 'checking');
          });
      }
      setHistory((h) => [
        ...h,
        {
          role: 'ai',
          muted: true,
          createdAt: new Date().toISOString(),
          body: (
            <>
              <CortexAnswer text={stillProcessing
                ? 'Cortex is still preparing the original answer. Retry shortly; the question will not be duplicated.'
                : finalTimedOut
                ? 'That answer took longer than expected. Your question is still here and can be retried.'
                : finalStoppedByUser
                  ? 'That response was stopped. Your question remains in this account thread and can be retried.'
                  : 'Cortex could not complete that answer. Account data remains isolated and no unrelated data was used.'} />
              <div className="ai-answer-actions">
                <button
                  className="ai-answer-action"
                  onClick={() => {
                    setHistory((current) => current.slice(0, -1));
                    void send(q, false, requestId);
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
      window.clearTimeout(timeout);
      if (conversationEpochRef.current === epoch) {
        requestInFlightRef.current = false;
        if (chatAbortRef.current === controller) chatAbortRef.current = null;
        setPending(false);
      }
    }
  };

  const prompts = ctx?.recommendedPrompts?.length
    ? ctx.recommendedPrompts
    : ['Summarize what is happening in my account', 'Where am I losing money right now?', 'Which orders need attention?', 'Is the AI plan ready for approval?'];
  const showSuggestedPrompts = !pending && !loadingThread && history.every((message) => message.role !== 'user');

  const copyAnswer = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageIndex(index);
      window.setTimeout(() => setCopiedMessageIndex((current) => current === index ? null : current), 1800);
    } catch {
      setCopiedMessageIndex(null);
    }
  };

  const applyChatResponse = (res: CortexChatResponse, epoch: number) => {
    if (conversationEpochRef.current !== epoch) return false;
    if (res.thread?.id) {
      setThreadId(res.thread.id);
      rememberActiveThread(res.thread.id);
    }
    const responseHealth = res.cortex?.health;
    const cortexUnavailable = responseHealth?.available === false;
    // Account-fact fast paths intentionally skip the live model route. Do not
    // let those local, grounded answers overwrite separately polled health.
    if (responseHealth?.reason !== 'account_grounded_answer' && typeof responseHealth?.available === 'boolean') {
      const nextHealth = cortexUnavailable ? 'offline' : 'online';
      setCortexHealth(nextHealth);
      if (Number.isFinite(responseHealth?.latencyMs)) setCortexLatencyMs(Number(responseHealth?.latencyMs));
      notifyCortexHealthChanged(nextHealth, { latencyMs: responseHealth?.latencyMs, checkedAt: responseHealth?.checkedAt });
    }
    setHistory((h) => [
      ...h,
      {
        role: 'ai',
        plainText: cortexDisplayText(res.message?.content || 'Cortex returned no answer.'),
        muted: cortexUnavailable,
        sources: res.message?.sources,
        actions: (res.message?.tasks || []) as ChatAction[],
        readinessNote: visibleReadinessNote(res.message?.content, res.message?.readinessNotes),
        createdAt: res.message?.createdAt || new Date().toISOString(),
        body: (
          <>
            <CortexAnswer text={res.message?.content || 'Cortex returned no answer.'} />
            {res.message?.confidence != null && <AnswerConfidence value={res.message.confidence} />}
          </>
        ),
      },
    ]);
    loadThreads();
    return true;
  };

  return (
    <aside className="copilot" aria-label="Cortex account assistant">
      <div className="copilot-head">
        <div className="copilot-title">
          <span className={`ai-dot ${cortexHealth}`} />
          <div className="copilot-title-copy">
            <div className="copilot-title-line">
              <strong>Cortex</strong>
              <Chip tone={cortexHealth === 'online' ? 'green' : cortexHealth === 'offline' ? 'red' : 'amber'} dot={false}>
                {cortexHealth === 'online'
                  ? `Ready${cortexLatencyMs != null ? ` · ${cortexLatencyMs} ms` : ''}`
                  : cortexHealth === 'offline' ? 'Unavailable' : 'Checking'}
              </Chip>
            </div>
            {contextLoading
              ? <span className="copilot-entity-context">Loading account context...</span>
              : entityId
              ? <span className="copilot-entity-context" title={`${screenLabel} · ${entityId}`}>Focused on this {entityType || 'record'} · {screenLabel}</span>
              : <span className="copilot-entity-context">Account intelligence · {screenLabel}</span>}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} data-hint="Close" aria-label="Close Cortex">
          <Icon name="x" />
        </button>
      </div>
      <div className="copilot-thread-bar">
        <button
          type="button"
          className={`copilot-thread-pill ${!threadId ? 'active' : ''}`}
          onClick={startNewThread}
          disabled={pending || loadingThread}
          aria-current={!threadId ? 'true' : undefined}
          aria-label="Start a new Cortex conversation"
        >
          <Icon name="plus" size={11} /> New
        </button>
        {threads.map((thread) => (
          <button
            key={thread.id}
            className={`copilot-thread-pill ${threadId === thread.id ? 'active' : ''}`}
            onClick={() => openThread(thread.id)}
            title={`${thread.title || 'Cortex thread'} · ${humanizeChatTimestamp(thread.lastMessageAt || thread.createdAt)}`}
            disabled={pending || loadingThread}
            type="button"
            aria-current={threadId === thread.id ? 'true' : undefined}
          >
            <span className="copilot-thread-name">{thread.title || 'Cortex thread'}</span>
            <time dateTime={thread.lastMessageAt || thread.createdAt}>{threadTimeLabel(thread.lastMessageAt || thread.createdAt)}</time>
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

      <div className="copilot-body" role="log" aria-live="polite" aria-relevant="additions text">
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
              {m.role === 'ai' && m.readinessNote ? (
                <div className="ai-readiness-note">
                  <Icon name="info" size={11} />
                  <span>{m.readinessNote}</span>
                </div>
              ) : null}
              {m.role === 'ai' && m.sources?.length ? (
                <div className="ai-sources">
                  {m.sources.slice(0, 4).map((source, idx) => {
                    const target = sourceTarget(source);
                    return target ? (
                      <button
                        key={idx}
                        type="button"
                        title={`Open ${sourceLabel(source)}`}
                        onClick={() => navigateFromCortex(target, sourcePayload(source))}
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
                      title={action.actionLabel || action.title || 'Open'}
                      aria-label={action.actionLabel || action.title || 'Open Cortex action'}
                      onClick={() => navigateFromCortex(
                        action.actionTarget || action.screen || 'command',
                        action.navigationPayload || action.entityId || undefined,
                      )}
                    >
                      <Icon name="arrowRight" size={11} /> {action.actionLabel || action.title || 'Open'}
                    </button>
                  ))}
                </div>
              ) : null}
              {(m.createdAt || (m.role === 'ai' && m.plainText)) ? (
                <div className="ai-msg-meta">
                  {m.createdAt ? (
                    <time className="ai-msg-time" dateTime={m.createdAt} title={humanizeChatTimestamp(m.createdAt)}>
                      {chatTimeLabel(m.createdAt)}
                    </time>
                  ) : null}
                  {m.role === 'ai' && m.plainText ? (
                    <button
                      type="button"
                      className="ai-copy-answer"
                      aria-label={copiedMessageIndex === i ? 'Cortex answer copied' : 'Copy Cortex answer'}
                      data-hint={copiedMessageIndex === i ? 'Copied' : 'Copy answer'}
                      onClick={() => void copyAnswer(m.plainText || '', i)}
                    >
                      <Icon name={copiedMessageIndex === i ? 'check' : 'copy'} size={11} />
                    </button>
                  ) : null}
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
              <button type="button" className="ai-thinking-stop" onClick={() => chatAbortRef.current?.abort('user')}>
                Stop response
              </button>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="copilot-scroll-anchor" />
      </div>

      <div className="copilot-foot">
        {showSuggestedPrompts ? (
          <div className="copilot-chips" aria-label="Suggested questions">
            {prompts.slice(0, 4).map((ex) => (
              <button key={ex} className="copilot-chip" onClick={() => send(ex)} disabled={pending || loadingThread}>
                {ex}
              </button>
            ))}
          </div>
        ) : null}
        <CopilotInput onSubmit={send} disabled={pending || loadingThread} />
      </div>
    </aside>
  );
};
