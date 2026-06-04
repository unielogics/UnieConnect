import React, { useEffect, useState } from 'react';
import { Icon } from './icons';
import { Chip, Confidence } from './ui';
import {
  completeCortexTask,
  dismissCortexTask,
  fetchCopilotContext,
  fetchCortexTasks,
  sendCortexChat,
  CopilotContext,
  CortexTask,
} from '../../lib/oms';

type Msg = { role: 'ai' | 'user'; body: React.ReactNode; degraded?: boolean };

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
  const [tasks, setTasks] = useState<CortexTask[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setThreadId(null);
    fetchCopilotContext(section)
      .then((c) => {
        setCtx(c);
        setHistory([
          { role: 'ai', body: c.summary || 'Cortex is grounded in this OMS account. Ask about the current screen, tasks, SKUs, orders, warehouses, audits, or readiness.' },
          ...(c.posture ? [{ role: 'ai' as const, body: <>Posture: <strong>{c.posture}</strong>. I will only ask you when something material changes.</> }] : []),
        ]);
      })
      .catch(() => {
        setHistory([{ role: 'ai', body: 'Cortex context is temporarily unavailable. Operating views remain fully functional.', degraded: true }]);
      });
    fetchCortexTasks({ status: 'open', screen: section, refresh: true, limit: 8 })
      .then((r) => setTasks(r.tasks || []))
      .catch(() => setTasks([]));
  }, [section]);

  const refreshTasks = () => {
    fetchCortexTasks({ status: 'open', screen: section, limit: 8 }).then((r) => setTasks(r.tasks || [])).catch(() => {});
  };

  const decideTask = async (task: CortexTask, action: 'done' | 'dismiss') => {
    try {
      if (action === 'done') await completeCortexTask(task.id);
      else await dismissCortexTask(task.id);
      refreshTasks();
    } catch {
      /* keep drawer usable if a task action fails */
    }
  };

  const send = async (q: string) => {
    if (!q) return;
    setHistory((h) => [...h, { role: 'user', body: q }]);
    setPending(true);
    try {
      const res = await sendCortexChat({ screen: section, message: q, threadId });
      if (res.thread?.id) setThreadId(res.thread.id);
      if (res.context?.tasks) setTasks(res.context.tasks);
      setHistory((h) => [
        ...h,
        {
          role: 'ai',
          degraded: res.cortex?.ok === false,
          body: (
            <>
              <div>{res.message?.content || 'Cortex returned no answer.'}</div>
              {res.message?.readinessNotes && <div className="source">Readiness: {res.message.readinessNotes}</div>}
              {res.message?.confidence != null && <div style={{ marginTop: 6 }}><Confidence value={res.message.confidence} /></div>}
            </>
          ),
        },
      ]);
    } catch {
      setHistory((h) => [...h, { role: 'ai', body: 'Cortex chat is unavailable right now. No cross-account data was used or exposed.', degraded: true }]);
    } finally {
      setPending(false);
    }
  };

  const prompts = ctx?.recommendedPrompts?.length
    ? ctx.recommendedPrompts
    : ['What tasks are blocking Cortex readiness?', 'Compare current vs optimized decisions', 'Which SKUs need enrichment?', 'Audit recent carrier labels'];

  return (
    <aside className="copilot">
      <div className="copilot-head">
        <div className="copilot-title">
          <span className="ai-dot" />
          Cortex
          <Chip tone={cortexAvailable ? 'purple' : 'amber'} dot={false}>
            {cortexAvailable ? 'Cortex live' : 'Cortex degraded'}
          </Chip>
        </div>
        <button className="icon-btn" onClick={onClose} data-hint="Close">
          <Icon name="x" />
        </button>
      </div>

      <div className="copilot-body">
        {history.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role === 'user' ? 'user' : ''} ${m.degraded ? 'degraded' : ''}`}>
            <div className="ai-avatar">{m.role === 'user' ? 'You' : 'CX'}</div>
            <div className="ai-body">{m.body}</div>
          </div>
        ))}

        {tasks.length > 0 && (
          <div className="ai-card cortex-task-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <h4>Active Cortex tasks</h4>
              <Chip tone="purple" dot={false}>{tasks.length}</Chip>
            </div>
            {tasks.slice(0, 5).map((task) => (
              <div key={task.id} className="cortex-task-mini">
                <div>
                  <strong>{task.title}</strong>
                  {task.detail && <div>{task.detail}</div>}
                  <span className={`task-priority ${task.priority}`}>{task.priority}</span>
                </div>
                <div className="task-mini-actions">
                  <button className="icon-btn" data-hint="Mark done" onClick={() => decideTask(task, 'done')}><Icon name="check" size={13} /></button>
                  <button className="icon-btn" data-hint="Dismiss" onClick={() => decideTask(task, 'dismiss')}><Icon name="x" size={13} /></button>
                </div>
              </div>
            ))}
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
