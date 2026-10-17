import React, { RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';

type Placement = 'top' | 'bottom' | 'right';

type ActiveTooltip = {
  element: HTMLElement;
  text: string;
  rect: DOMRect;
  placement: Placement;
};

const placementFor = (element: HTMLElement): Placement => {
  if (element.closest('.sidebar-rail')) return 'right';
  if (element.closest('.topbar, .modal-head, .sb-panel-head')) return 'bottom';
  return 'top';
};

export const ViewportTooltip = ({ rootRef }: { rootRef: RefObject<HTMLElement> }) => {
  const [active, setActive] = useState<ActiveTooltip | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, ready: false });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const activeElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const hintedElement = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>('[data-hint]') : null;
    const show = (element: HTMLElement | null) => {
      if (!element || !root.contains(element)) return;
      if (activeElementRef.current === element) return;
      const text = String(element.dataset.hint || '').trim();
      if (!text) return;
      if (!element.getAttribute('aria-label') && !element.textContent?.trim()) {
        element.setAttribute('aria-label', text);
      }
      activeElementRef.current = element;
      setPosition((current) => ({ ...current, ready: false }));
      setActive({ element, text, rect: element.getBoundingClientRect(), placement: placementFor(element) });
    };
    const hide = (element?: HTMLElement | null, related?: EventTarget | null) => {
      if (element && related instanceof Node && element.contains(related)) return;
      activeElementRef.current = null;
      setActive(null);
    };
    const onPointerOver = (event: PointerEvent) => show(hintedElement(event.target));
    const onPointerOut = (event: PointerEvent) => hide(hintedElement(event.target), event.relatedTarget);
    const onFocusIn = (event: FocusEvent) => show(hintedElement(event.target));
    const onFocusOut = (event: FocusEvent) => hide(hintedElement(event.target), event.relatedTarget);
    const close = () => {
      activeElementRef.current = null;
      setActive(null);
    };

    root.addEventListener('pointerover', onPointerOver);
    root.addEventListener('pointerout', onPointerOut);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      root.removeEventListener('pointerover', onPointerOver);
      root.removeEventListener('pointerout', onPointerOut);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [rootRef]);

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!active || !tooltip) return;
    const margin = 8;
    const gap = 8;
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let left = active.rect.left + (active.rect.width - width) / 2;
    let top = active.rect.top - height - gap;

    if (active.placement === 'bottom') {
      top = active.rect.bottom + gap;
    } else if (active.placement === 'right') {
      left = active.rect.right + gap;
      top = active.rect.top + (active.rect.height - height) / 2;
      if (left + width > viewportWidth - margin) left = active.rect.left - width - gap;
    } else if (top < margin) {
      top = active.rect.bottom + gap;
    }

    left = Math.max(margin, Math.min(left, viewportWidth - width - margin));
    top = Math.max(margin, Math.min(top, viewportHeight - height - margin));
    setPosition({ left: Math.round(left), top: Math.round(top), ready: true });
  }, [active]);

  if (!active) return null;
  return (
    <div
      ref={tooltipRef}
      className="uc-viewport-tooltip"
      role="tooltip"
      style={{ left: position.left, top: position.top, visibility: position.ready ? 'visible' : 'hidden' }}
    >
      {active.text}
    </div>
  );
};
