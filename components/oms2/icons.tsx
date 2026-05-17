import React from 'react';

type IconName =
  | 'grid' | 'cockpit' | 'double' | 'inventory' | 'studio' | 'orders' | 'shipments'
  | 'billing' | 'audit' | 'support' | 'plug' | 'ledger' | 'search' | 'bell' | 'settings'
  | 'sparkle' | 'chevron' | 'chevronDown' | 'chevronUp' | 'plus' | 'download' | 'filter'
  | 'columns' | 'play' | 'check' | 'x' | 'arrowUp' | 'arrowDown' | 'arrowRight' | 'bolt'
  | 'target' | 'warning' | 'info' | 'refresh' | 'map' | 'box' | 'tag' | 'moon' | 'sun'
  | 'panelRight' | 'layers' | 'flame' | 'eye' | 'save' | 'list';

export const Icon = ({
  name,
  size = 16,
  strokeWidth = 1.75,
  className = '',
  style,
}: {
  name: IconName | string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    style,
  };
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    cockpit: <><circle cx="12" cy="12" r="9" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><path d="M12 12 16 8" /></>,
    double: <><path d="M3 5h8v14H3z" /><path d="M13 5h8v14h-8z" /><path d="M11 12h2" /></>,
    inventory: <><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></>,
    studio: <><path d="M12 2v4" /><circle cx="12" cy="12" r="6" /><path d="M12 18v4" /><path d="M2 12h4M18 12h4" /></>,
    orders: <><path d="M4 5h2l2 12h10l2-8H7" /><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /></>,
    shipments: <><path d="M3 7h11v9H3z" /><path d="M14 10h5l2 3v3h-7" /><circle cx="7" cy="18" r="1.5" /><circle cx="17" cy="18" r="1.5" /></>,
    billing: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h10M7 13h6M7 17h4" /></>,
    audit: <><path d="M9 3h6l4 4v14H5V3z" /><path d="M9 13l2 2 4-4" /></>,
    support: <><circle cx="12" cy="12" r="9" /><path d="M9 10a3 3 0 1 1 4.5 2.6c-1 .5-1.5 1-1.5 2" /><circle cx="12" cy="17" r="0.6" fill="currentColor" /></>,
    plug: <><path d="M9 7V3M15 7V3" /><path d="M6 7h12v5a6 6 0 0 1-12 0V7z" /><path d="M12 18v3" /></>,
    ledger: <><path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .4 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.4 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .4-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.4H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.4 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
    sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /><path d="M19 17l.7 1.8L21 19.5l-1.3.7L19 22l-.7-1.8L17 19.5l1.3-.7L19 17z" /></>,
    chevron: <path d="M9 6l6 6-6 6" />,
    chevronDown: <path d="M6 9l6 6 6-6" />,
    chevronUp: <path d="M6 15l6-6 6 6" />,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    download: <><path d="M12 4v12" /><path d="M8 12l4 4 4-4" /><path d="M4 20h16" /></>,
    filter: <path d="M3 5h18l-7 9v5l-4-2v-3z" />,
    columns: <><rect x="3" y="3" width="6" height="18" rx="1.5" /><rect x="11" y="3" width="6" height="12" rx="1.5" /><rect x="19" y="3" width="2" height="6" rx="1" /></>,
    play: <path d="M8 5l11 7-11 7V5z" fill="currentColor" />,
    check: <path d="M5 13l4 4L19 7" />,
    x: <><path d="M6 6l12 12M18 6L6 18" /></>,
    arrowUp: <><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></>,
    arrowDown: <><path d="M12 5v14" /><path d="M5 12l7 7 7-7" /></>,
    arrowRight: <><path d="M5 12h14M13 5l7 7-7 7" /></>,
    bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
    warning: <><path d="M12 3 2 21h20L12 3z" /><path d="M12 10v5" /><circle cx="12" cy="18" r="0.6" fill="currentColor" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><circle cx="12" cy="8" r="0.6" fill="currentColor" /></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>,
    map: <><path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2z" /><path d="M9 3v16M15 5v16" /></>,
    box: <><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" /><path d="M3 7l9 4 9-4M12 11v10" /></>,
    tag: <><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.5" cy="7.5" r="1" fill="currentColor" /></>,
    moon: <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></>,
    panelRight: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></>,
    layers: <><path d="M12 3 2 8l10 5 10-5-10-5z" /><path d="M2 13l10 5 10-5" /><path d="M2 18l10 5 10-5" /></>,
    flame: <path d="M12 3s4 5 4 9a4 4 0 0 1-8 0c0-1 .5-2 1-2.5-.5 2 1 3 1 3s-2-3 2-9.5z" />,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    save: <><path d="M5 3h11l4 4v14H5z" /><path d="M8 3v6h8V3" /><path d="M8 14h8v7H8z" /></>,
    list: <><path d="M3 6h3M3 12h3M3 18h3" /><path d="M9 6h12M9 12h12M9 18h12" /></>,
  };
  return <svg {...props}>{paths[name] || null}</svg>;
};
