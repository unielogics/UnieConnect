import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Icon } from './icons';

export type CtxItem =
  | { divider: true }
  | { label: string }
  | { icon?: string; title: string; onClick: () => void; shortcut?: string; danger?: boolean; disabled?: boolean };

type CtxState = { x: number; y: number; items: CtxItem[] } | null;

const CtxMenuCtx = createContext<{ open: (e: React.MouseEvent, items: CtxItem[]) => void }>({
  open: () => {},
});

export const CtxMenuProvider = ({ children }: { children: React.ReactNode }) => {
  const [menu, setMenu] = useState<CtxState>(null);

  const open = (e: React.MouseEvent, items: CtxItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    const normalized = items.filter((item, index) => {
      if (!('divider' in item)) return true;
      return index > 0 && index < items.length - 1 && !('divider' in items[index - 1]);
    });
    setMenu({ x: e.clientX, y: e.clientY, items: normalized });
  };
  const close = () => setMenu(null);

  useEffect(() => {
    if (!menu) return;
    const onClick = () => close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', close, true);
    };
  }, [menu]);

  const pos = useMemo(() => {
    if (!menu) return undefined;
    const w = 240;
    const h = (menu.items.length + 1) * 32;
    return {
      left: Math.max(8, Math.min(menu.x, window.innerWidth - w - 8)),
      top: Math.max(8, Math.min(menu.y, window.innerHeight - Math.min(h, window.innerHeight - 16) - 8)),
    };
  }, [menu]);

  return (
    <CtxMenuCtx.Provider value={{ open }}>
      {children}
      {menu && (
        <div className="ctx-menu fade-in" style={pos} onMouseDown={(e) => e.stopPropagation()}>
          {menu.items.map((it, i) => {
            if ('divider' in it) return <div key={i} className="ctx-divider" />;
            if ('label' in it) return <div key={i} className="ctx-label">{it.label}</div>;
            return (
              <button
                key={i}
                className={`ctx-item ${it.danger ? 'danger' : ''}`}
                disabled={it.disabled}
                aria-disabled={it.disabled || undefined}
                onClick={() => {
                  if (it.disabled) return;
                  close();
                  it.onClick();
                }}
              >
                {it.icon && (
                  <Icon
                    name={it.icon}
                    size={13}
                    style={{ color: it.danger ? 'var(--red)' : 'var(--text-tertiary)' }}
                  />
                )}
                <span>{it.title}</span>
                {it.shortcut && <span className="ctx-shortcut">{it.shortcut}</span>}
              </button>
            );
          })}
        </div>
      )}
    </CtxMenuCtx.Provider>
  );
};

export const useCtxMenu = () => useContext(CtxMenuCtx);
