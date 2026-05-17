import React, { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { Chip, Loading, EmptyState } from '../ui';
import { fetchCommandCenter, fetchHeatmap, fetchLabelAudit } from '../../../lib/oms';
import { timeAgo } from '../../../lib/oms-adapters';
import type { ScreenProps } from '../UnieConnectApp';

type Conn = { id: string; name: string; region: string; status: string; lastSync: string; entities: string[]; owner: string };

const ConnectionCard = ({ c }: { c: Conn }) => {
  const tone =
    c.status === 'healthy' || c.status === 'live' ? 'green' : c.status === 'warn' ? 'amber' : c.status === 'idle' ? 'default' : 'blue';
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{c.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{c.region}</div>
        </div>
        <Chip tone={tone as any}>{c.status}</Chip>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {c.entities.map((e) => (
          <span key={e} className="chip outline" style={{ fontSize: 10.5 }}>
            {e}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Last sync · {c.lastSync}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn ghost sm"><Icon name="settings" size={11} /></button>
          <button className="btn ghost sm"><Icon name="refresh" size={11} /></button>
        </div>
      </div>
    </div>
  );
};

export const Connections = (_: ScreenProps) => {
  const [conns, setConns] = useState<Conn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchCommandCenter('7d').catch(() => null),
      fetchHeatmap().catch(() => null),
      fetchLabelAudit().catch(() => null),
    ])
      .then(([cc, hm, la]) => {
        const out: Conn[] = [];
        const src = cc?.source || {};
        const channels = cc?.counts?.channels ?? 0;
        out.push({
          id: 'mkt',
          name: 'Marketplace channels',
          region: `${channels} connected`,
          status: 'healthy',
          lastSync: cc?.generatedAt ? timeAgo(cc.generatedAt) : 'live',
          entities: ['Orders', 'Customers', 'Listings'],
          owner: 'marketplace',
        });
        out.push({
          id: 'sales',
          name: 'Sales feed',
          region: String(src.sales || 'aurora_orders'),
          status: 'live',
          lastSync: cc?.generatedAt ? timeAgo(cc.generatedAt) : 'live',
          entities: ['Revenue', 'AOV', 'Units'],
          owner: 'marketplace',
        });
        (hm?.warehouses || []).forEach((w) =>
          out.push({
            id: w.id,
            name: `WMS · ${w.code || w.name}`,
            region: w.region || w.state || '—',
            status: w.status === 'warn' ? 'warn' : 'healthy',
            lastSync: 'live',
            entities: ['Inventory', 'ASNs', 'Billing'],
            owner: 'wms',
          })
        );
        out.push({
          id: 'cortex',
          name: 'Cortex Intelligence',
          region: String(src.inventory || 'cortex'),
          status: 'live',
          lastSync: 'continuous',
          entities: ['Demand', 'Net-Opt', 'Audit'],
          owner: 'intelligence',
        });
        const carriers = Array.from(new Set((la?.findings || []).map((f) => f.carrier).filter(Boolean))) as string[];
        (carriers.length ? carriers : ['ShipStation']).forEach((c, i) =>
          out.push({
            id: `carrier-${i}`,
            name: c,
            region: 'rate cards',
            status: 'healthy',
            lastSync: 'live',
            entities: ['Labels', 'Rates', 'Tracking'],
            owner: 'carrier',
          })
        );
        setConns(out);
      })
      .finally(() => setLoading(false));
  }, []);

  const groups = [
    { label: 'Marketplaces', filter: 'marketplace', icon: 'tag' },
    { label: 'WMS warehouses', filter: 'wms', icon: 'box' },
    { label: 'Intelligence', filter: 'intelligence', icon: 'sparkle' },
    { label: 'Carriers & rates', filter: 'carrier', icon: 'shipments' },
  ];

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Connections</h1>
          <p className="page-subtitle">Marketplaces, CSV, WMS warehouses, Cortex, and carriers — single source of sync health for the OMS.</p>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="refresh" size={13} /> Sync all</button>
          <button className="btn primary"><Icon name="plus" size={13} /> Connect new</button>
        </div>
      </div>

      {loading ? (
        <div className="card"><Loading rows={6} /></div>
      ) : (
        groups.map((g) => {
          const items = conns.filter((c) => c.owner === g.filter);
          return (
            <div key={g.filter} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Icon name={g.icon} size={14} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{g.label}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
              </div>
              {items.length === 0 ? (
                <EmptyState>No {g.label.toLowerCase()} connected.</EmptyState>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {items.map((c) => (
                    <ConnectionCard key={c.id} c={c} />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
