import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, Avatar, fmt, Loading, ErrorState, EmptyState } from '../ui';
import { useCtxMenu } from '../ContextMenu';
import { fetchOmsCustomers, OmsCustomer } from '../../../lib/oms';
import { num, channelColor } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';

const ChannelTagInline = ({ ch }: { ch?: string }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 7px',
      borderRadius: 4,
      background: 'var(--bg-active)',
      color: 'var(--text-secondary)',
    }}
  >
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: channelColor(ch) }} />
    {ch || '—'}
  </span>
);

const segChip = (seg?: string) => {
  switch (seg) {
    case 'VIP':
      return <Chip tone="purple">VIP</Chip>;
    case 'Repeat':
      return <Chip tone="green">Repeat</Chip>;
    case 'Returning':
      return <Chip tone="blue">Returning</Chip>;
    default:
      return <Chip>{seg || 'New'}</Chip>;
  }
};

export const Customers = ({ onNavigate }: ScreenProps) => {
  const [rows, setRows] = useState<OmsCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('all');
  const ctx = useCtxMenu();

  const load = () => {
    setLoading(true);
    setErr(null);
    fetchOmsCustomers()
      .then((d) => setRows(d.customers || []))
      .catch((e) => setErr(e.message || 'Failed to load customers'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(
    () =>
      rows.filter((c) => {
        if (segment !== 'all' && c.segment !== segment) return false;
        if (
          search &&
          !(c.name || '').toLowerCase().includes(search.toLowerCase()) &&
          !(c.email || '').toLowerCase().includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [rows, search, segment]
  );

  const totalLTV = rows.reduce((s, c) => s + num(c.ltv), 0);
  const repeatRate = rows.length ? rows.filter((c) => num(c.orders) > 1).length / rows.length : 0;
  const vips = rows.filter((c) => c.segment === 'VIP').length;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Buyers who've ordered across your channels. Unified by email + address fingerprint.</p>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="download" size={13} /> Export</button>
          <button className="btn primary"><Icon name="sparkle" size={13} /> Generate segments</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Customers</div>
          <div className="stat-value">{fmt.num(rows.length)}</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>unified</div>
        </div>
        <div className="stat good">
          <div className="stat-label">Repeat rate</div>
          <div className="stat-value">{Math.round(repeatRate * 100)}%</div>
          <div className="stat-delta up"><span className="arrow">▲</span> &gt;1 order</div>
        </div>
        <div className="stat">
          <div className="stat-label">VIP customers</div>
          <div className="stat-value">{vips}</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>
            {rows.length ? Math.round((vips / rows.length) * 100) : 0}% of total
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Avg LTV</div>
          <div className="stat-value">${rows.length ? (totalLTV / rows.length).toFixed(0) : 0}</div>
          <div className="stat-delta" style={{ color: 'var(--text-tertiary)' }}>lifetime value</div>
        </div>
      </div>

      {err ? (
        <div className="card"><ErrorState message={err} onRetry={load} /></div>
      ) : loading ? (
        <div className="card"><Loading rows={6} /></div>
      ) : (
        <div className="table-wrap">
          <div className="table-toolbar">
            <div style={{ position: 'relative', flex: '0 1 280px' }}>
              <Icon name="search" size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email"
                style={{ width: '100%', height: 28, padding: '0 10px 0 28px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 12 }}
              />
            </div>
            {['all', 'VIP', 'Repeat', 'Returning', 'New'].map((s) => (
              <button key={s} className={`filter-chip ${segment === s ? 'applied' : ''}`} onClick={() => setSegment(s)} style={{ cursor: 'pointer', textTransform: 'capitalize' }}>
                {s}
              </button>
            ))}
            <div className="spacer" />
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
              {filtered.length} of {rows.length}
            </span>
            <button className="btn ghost sm"><Icon name="columns" size={12} /> Columns</button>
          </div>
          {filtered.length === 0 ? (
            <EmptyState>No customers match.</EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Location</th>
                  <th>Primary channel</th>
                  <th className="num">Orders</th>
                  <th className="num">LTV</th>
                  <th className="num">AOV</th>
                  <th>Last order</th>
                  <th>First order</th>
                  <th>Segment</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onContextMenu={(e) =>
                      ctx.open(e, [
                        { label: 'Customer' },
                        { icon: 'eye', title: 'Open customer profile' },
                        { icon: 'orders', title: 'View orders', onClick: () => onNavigate('orders') },
                        { icon: 'support', title: 'Email customer', shortcut: '⌘E' },
                        { divider: true },
                        { icon: 'sparkle', title: 'Add to AI segment' },
                        { icon: 'tag', title: 'Tag…' },
                        { divider: true },
                        { icon: 'refresh', title: 'Refresh data', shortcut: '⌘R', onClick: load },
                      ])
                    }
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={c.name} size={26} />
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{c.city || '—'}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{c.state || ''}</div>
                    </td>
                    <td><ChannelTagInline ch={c.primaryChannel} /></td>
                    <td className="num mono strong">{num(c.orders)}</td>
                    <td className="num mono strong">${num(c.ltv).toLocaleString()}</td>
                    <td className="num mono muted">${num(c.aov).toFixed(2)}</td>
                    <td className="muted">{c.lastOrder || '—'}</td>
                    <td className="muted">{c.firstOrder || '—'}</td>
                    <td>{segChip(c.segment)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(c.tags || []).map((t) => (
                          <Chip key={t} dot={false} tone="outline">
                            {t}
                          </Chip>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
