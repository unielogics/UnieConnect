import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiUrl, authFetch } from '../../lib/api';
import { Icon } from './icons';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    authFetch(apiUrl('/api/v1/channel-accounts'))
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message || data?.error || `Marketplace accounts could not be loaded (${res.status}).`);
        return data;
      })
      .then((data) => {
        if (!live) return;
        setAccounts(Array.isArray(data) ? data : []);
      })
      .catch((nextError: any) => {
        if (live) setError(nextError?.message || 'Marketplace accounts could not be loaded.');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const cancel = loadAccounts();
    return cancel;
  }, [loadAccounts]);

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
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <select
        value={selected}
        onChange={(event) => select(event.target.value)}
        style={{
          height: 28,
          padding: '0 28px 0 10px',
          borderRadius: 6,
          border: `1px solid ${error ? 'var(--red-border)' : 'var(--border)'}`,
          background: 'var(--bg)',
          color: 'var(--text)',
          fontSize: 12,
          maxWidth: 260,
          minWidth: 0,
        }}
        aria-label="Marketplace filter"
        aria-busy={loading}
        title={error || undefined}
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
        {loading && options.length === 0 && <option disabled>Loading connected stores...</option>}
        {error && options.length === 0 && <option disabled>Store list unavailable</option>}
      </select>
      {error && (
        <button
          type="button"
          className="icon-btn"
          style={{ width: 28, height: 28, minWidth: 28, color: 'var(--red-text)' }}
          aria-label="Retry marketplace accounts"
          title={error}
          onClick={() => loadAccounts()}
        >
          <Icon name="refresh" size={12} />
        </button>
      )}
    </div>
  );
}
