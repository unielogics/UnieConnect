interface ChannelBadgeProps {
  channel: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

function channelLabel(ch: string): string {
  const c = String(ch || '').toLowerCase();
  if (c === 'shopify') return 'Shopify';
  if (c === 'amazon') return 'Amazon';
  if (c === 'ebay') return 'eBay';
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : '—';
}

export default function ChannelBadge({ channel, label, className = '', style }: ChannelBadgeProps) {
  const display = label ?? channelLabel(channel);
  return (
    <span
      className={`badge channel-badge ${className}`.trim()}
      style={style}
      title={display}
      data-channel={channel}
    >
      {display}
    </span>
  );
}
