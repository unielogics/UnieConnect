import { useEffect, useMemo, useState } from 'react';
import { apiUrl, authFetch } from '../lib/api';

interface ChannelFilterProps {
  value: string;
  onChange: (value: string) => void;
  includeUnmapped?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

type Account = {
  id?: string;
  _id?: string;
  channel: string;
  status?: string;
  displayName?: string;
  shopDomain?: string;
  sellingPartnerId?: string;
  marketplaceId?: string;
  label?: string;
};

const labelForChannel = (channel: string) => {
  if (channel === 'shopify') return 'Shopify';
  if (channel === 'amazon') return 'Amazon';
  if (channel === 'ebay') return 'eBay';
  return channel;
};

export default function ChannelFilter({
  value,
  onChange,
  includeUnmapped = false,
  id = 'channel-filter',
  className = '',
  style,
}: ChannelFilterProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    let live = true;
    authFetch(apiUrl('/api/v1/channel-accounts'))
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (live) setAccounts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (live) setAccounts([]);
      });
    return () => {
      live = false;
    };
  }, []);
  const accountOptions = useMemo(
    () =>
      accounts
        .filter((account) => account.status !== 'archived' && account.status !== 'disconnected')
        .map((account) => ({
          id: account.id || account._id || '',
          channel: account.channel,
          label:
            account.displayName ||
            account.shopDomain ||
            account.sellingPartnerId ||
            account.marketplaceId ||
            account.label ||
            labelForChannel(account.channel),
        }))
        .filter((account) => account.id),
    [accounts],
  );

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
      {accountOptions.length > 0 && <option disabled>──────────</option>}
      {accountOptions.map((account) => (
        <option key={account.id} value={`account:${account.id}`}>
          {labelForChannel(account.channel)} · {account.label}
        </option>
      ))}
    </select>
  );
}
