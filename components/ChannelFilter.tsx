interface ChannelFilterProps {
  value: string;
  onChange: (value: string) => void;
  includeUnmapped?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function ChannelFilter({
  value,
  onChange,
  includeUnmapped = false,
  id = 'channel-filter',
  className = '',
  style,
}: ChannelFilterProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        fontSize: 13,
        color: 'var(--text)',
        ...style,
      }}
    >
      <option value="">All channels</option>
      <option value="shopify">Shopify</option>
      <option value="amazon">Amazon</option>
      <option value="ebay">eBay</option>
      {includeUnmapped && <option value="unmapped">Unmapped</option>}
    </select>
  );
}
