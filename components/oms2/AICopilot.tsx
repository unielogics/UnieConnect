import React, { useEffect, useState } from 'react';
import { Icon } from './icons';
import { Chip, Confidence } from './ui';
import { fetchCopilotContext, CopilotContext } from '../../lib/oms';

type Msg = { role: 'ai' | 'user'; body: React.ReactNode };

const CopilotInput = ({ onSubmit }: { onSubmit: (q: string) => void }) => {
  const [text, setText] = useState('');
  const submit = () => {
    const q = text.trim();
    if (q) onSubmit(q);
    setText('');
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ position: 'relative' }}>
      <textarea
        className="copilot-input"
        placeholder="Ask Copilot — try 'simulate moving fast-movers to 4 nodes'"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button type="submit" className="btn ai sm" style={{ position: 'absolute', right: 8, bottom: 8 }}>
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
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetchCopilotContext(section)
      .then((c) => {
        setCtx(c);
        setHistory([
          { role: 'ai', body: c.summary || 'I am monitoring marketplaces and WMS feeds. Ask me anything about this screen.' },
          ...(c.posture ? [{ role: 'ai' as const, body: <>Posture: <strong>{c.posture}</strong>. I will only ask you when something material changes.</> }] : []),
        ]);
      })
      .catch(() => {
        setHistory([{ role: 'ai', body: 'Copilot context is temporarily unavailable. Operating views remain fully functional.' }]);
      });
  }, [section]);

  const send = (q: string) => {
    if (!q) return;
    setHistory((h) => [...h, { role: 'user', body: q }]);
    setPending(true);
    fetchCopilotContext(section)
      .then((c) => {
        const sig = (c.latestSignals || [])[0];
        setHistory((h) => [
          ...h,
          {
            role: 'ai',
            body: sig ? (
              <>
                <strong>{sig.title}</strong>
                {sig.detail ? ` — ${sig.detail}` : ''}
              </>
            ) : (
              c.summary || 'No new signal for that on the current screen.'
            ),
          },
        ]);
      })
      .catch(() => setHistory((h) => [...h, { role: 'ai', body: 'I could not reach Cortex just now — try again shortly.' }]))
      .finally(() => setPending(false));
  };

  const prompts = ctx?.recommendedPrompts?.length
    ? ctx.recommendedPrompts
    : ['Why is storage climbing?', 'Compare current vs. optimized', 'Which SKUs stock out in 14d?', 'Audit recent carrier invoices'];

  return (
    <aside className="copilot">
      <div className="copilot-head">
        <div className="copilot-title">
          <span className="ai-dot" />
          Copilot
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
          <div key={i} className={`ai-msg ${m.role === 'user' ? 'user' : ''}`}>
            <div className="ai-avatar">{m.role === 'user' ? 'J' : 'AI'}</div>
            <div className="ai-body">{m.body}</div>
          </div>
        ))}

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
            <div className="ai-avatar">AI</div>
            <div className="ai-body pulsing">Thinking…</div>
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
        <CopilotInput onSubmit={send} />
      </div>
    </aside>
  );
};
