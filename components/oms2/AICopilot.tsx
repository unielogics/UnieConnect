import React, { useEffect, useState } from 'react';
import { Icon } from './icons';
import { Chip, Confidence } from './ui';
import {
  fetchCopilotContext,
  fetchCortexChatThread,
  fetchCortexChatThreads,
  fetchCortexChatHealth,
  fetchCortexTasks,
  sendCortexChat,
  CopilotContext,
  CortexChatMessage,
  CortexChatThread,
} from '../../lib/oms';

type Msg = { role: 'ai' | 'user'; body: React.ReactNode; muted?: boolean };

const messageToHistory = (m: CortexChatMessage): Msg => ({
  role: m.role === 'user' ? 'user' : 'ai',
  muted: m.cortexStatus === 'degraded',
  body: (
    <>
      <div>{m.content}</div>
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
  cortexAvailable,
}: {
  section: string;
  onClose: () => void;
  cortexAvailable?: boolean;
}) => {
  const [ctx, setCtx] = useState<CopilotContext | null>(null);
  const [history, setHistory] = useState<Msg[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<CortexChatThread[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [cortexHealth, setCortexHealth] = useState<'online' | 'offline' | 'checking'>(cortexAvailable ? 'checking' : 'offline');
  const [pending, setPending] = useState(false);

  const loadThreads = () => {
    fetchCortexChatThreads(section)
      .then((r) => setThreads((r.threads || []).slice(0, 5)))
      .catch(() => setThreads([]));
  };

  const startNewThread = () => {
    setThreadId(null);
    setHistory([
      { role: 'ai', body: ctx?.summary || 'Cortex is grounded in this OMS account. Ask about the current screen, tasks, SKUs, orders, warehouses, audits, or readiness.' },
      ...(ctx?.posture ? [{ role: 'ai' as const, body: <>Posture: <strong>{ctx.posture}</strong>. I will only ask you when something material changes.</> }] : []),
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
    setCortexHealth(cortexAvailable ? 'checking' : 'offline');
    if (cortexAvailable) {
      fetchCortexChatHealth(section)
        .then((res) => setCortexHealth(res.ok ? 'online' : 'offline'))
        .catch(() => setCortexHealth('offline'));
    }
    fetchCopilotContext(section)
      .then((c) => {
        setCtx(c);
        setHistory([
          { role: 'ai', body: c.summary || 'Cortex is grounded in this OMS account. Ask about the current screen, tasks, SKUs, orders, warehouses, audits, or readiness.' },
          ...(c.posture ? [{ role: 'ai' as const, body: <>Posture: <strong>{c.posture}</strong>. I will only ask you when something material changes.</> }] : []),
        ]);
      })
      .catch(() => {
        setHistory([{ role: 'ai', body: 'Cortex context is temporarily unavailable. Operating views remain fully functional.', muted: true }]);
      });
    fetchCortexTasks({ status: 'open', screen: section, refresh: true, limit: 8 })
      .then((r) => setTaskCount((r.tasks || []).length))
      .catch(() => setTaskCount(0));
    loadThreads();
  }, [section]);

  const send = async (q: string) => {
    if (!q) return;
    setHistory((h) => [...h, { role: 'user', body: q }]);
    setPending(true);
    try {
      const res = await sendCortexChat({ screen: section, message: q, threadId });
      if (res.thread?.id) setThreadId(res.thread.id);
      if (res.context?.tasks) setTaskCount(res.context.tasks.length);
      setCortexHealth(res.cortex?.ok ? 'online' : 'offline');
      setHistory((h) => [
        ...h,
        {
          role: 'ai',
          muted: res.cortex?.ok === false,
          body: (
            <>
              <div>{res.message?.content || 'Cortex returned no answer.'}</div>
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
        {loadingThread && (
          <div className="ai-msg">
            <div className="ai-avatar">CX</div>
            <div className="ai-body pulsing">Opening thread...</div>
          </div>
        )}
        {history.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role === 'user' ? 'user' : ''} ${m.muted ? 'muted' : ''}`}>
            <div className="ai-avatar">{m.role === 'user' ? 'You' : 'CX'}</div>
            <div className="ai-body">{m.body}</div>
          </div>
        ))}

        {taskCount > 0 && (
          <div className="ai-card cortex-context-card">
            <h4>Account context</h4>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {taskCount} open readiness item{taskCount === 1 ? '' : 's'} are available in notifications. Ask Cortex about them, or use the bell for the task inbox.
            </div>
          </div>
        )}

        {(ctx?.latestSignals || []).map((s, i) => (
          <div key={i} className="ai-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <h4>{s.title || 'Signal'}</h4>
              {s.confidence != null && <Confidence value={s.confidence} />}
            </div>
            {s.detail && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.detail}</div>}
            <div className="source">Source: Cortex · {section}</div>
          </div>
        ))}

        {pending && (
          <div className="ai-msg">
            <div className="ai-avatar">CX</div>
            <div className="ai-body pulsing">Thinking...</div>
          </div>
        )}
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
