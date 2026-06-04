import React, { useEffect, useMemo, useState } from 'react';
import { apiUrl, authFetch } from '../../lib/api';

export type MarketplaceFilterValue = {
  channel?: string;
  channelAccountId?: string;
};

type Account = {
  id: string;
  _id?: string;
  channel: string;
  status?: string;
  displayName?: string;
  shopDomain?: string;
  sellingPartnerId?: string;
  marketplaceId?: string;
  label?: string;
};

type Props = {
  value: MarketplaceFilterValue;
  onChange: (value: MarketplaceFilterValue) => void;
  includeUnmapped?: boolean;
};

const channelLabel = (channel: string) => {
  if (channel === 'shopify') return 'Shopify';
  if (channel === 'amazon') return 'Amazon';
  if (channel === 'ebay') return 'eBay';
  return channel || 'Channel';
};

const accountLabel = (account: Account) =>
  account.displayName ||
  account.shopDomain ||
  account.sellingPartnerId ||
  account.marketplaceId ||
  account.label ||
  channelLabel(account.channel);

export function MarketplaceFilter({ value, onChange, includeUnmapped = false }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    let live = true;
    authFetch(apiUrl('/api/v1/channel-accounts'))
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!live) return;
        setAccounts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (live) setAccounts([]);
      });
    return () => {
      live = false;
    };
  }, []);

  const options = useMemo(() => {
    const connected = accounts.filter((account) => account.status !== 'archived' && account.status !== 'disconnected');
    return connected.map((account) => ({
      value: `account:${account.id || account._id}`,
      label: `${channelLabel(account.channel)} · ${accountLabel(account)}`,
      channel: account.channel,
      channelAccountId: account.id || account._id,
    }));
  }, [accounts]);

  const selected = value.channelAccountId
    ? `account:${value.channelAccountId}`
    : value.channel
      ? `channel:${value.channel}`
      : '';

  const select = (next: string) => {
    if (!next) return onChange({});
    if (next.startsWith('account:')) {
      const option = options.find((item) => item.value === next);
      return onChange({ channel: option?.channel, channelAccountId: next.replace(/^account:/, '') });
    }
    return onChange({ channel: next.replace(/^channel:/, '') });
  };

  return (
    <select
      value={selected}
      onChange={(event) => select(event.target.value)}
      style={{
        height: 28,
        padding: '0 28px 0 10px',
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontSize: 12,
        maxWidth: 260,
      }}
      aria-label="Marketplace filter"
    >
      <option value="">All marketplaces</option>
      <option value="channel:shopify">All Shopify stores</option>
      <option value="channel:amazon">Amazon</option>
      <option value="channel:ebay">eBay</option>
      {includeUnmapped && <option value="channel:unmapped">Unmapped</option>}
      {options.length > 0 && <option disabled>──────────</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
