import React, { useEffect, useState } from 'react';
import { Modal, Chip, fmt, Loading } from '../ui';
import { fetchHeatmap, HeatmapResponse } from '../../../lib/oms';
import { num } from '../../../lib/oms-adapters';

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

export const StateDetailModal = ({ stateCode, onClose }: { stateCode: string; onClose: () => void }) => {
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHeatmap()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const st = (data?.states || []).find((s) => (s.state || '').toUpperCase() === stateCode);
  const whs = (data?.warehouses || []).filter((w) => (w.state || '').toUpperCase() === stateCode);

  return (
    <Modal
      title={`${STATE_NAMES[stateCode] || stateCode} operations`}
      subtitle="State demand, orders, revenue, and the warehouses serving this region."
      onClose={onClose}
      fullscreen
      chrome={
        <div style={{ marginLeft: 'auto' }}>
          <Chip tone="purple" dot={false}>{stateCode}</Chip>
        </div>
      }
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {loading ? (
          <div className="card"><Loading rows={4} /></div>
        ) : (
          <>
            <div className="stat-grid cols-3">
              <div className="stat">
                <div className="stat-label">Demand intensity</div>
                <div className="stat-value">{Math.round(num(st?.demand) * 100)}%</div>
              </div>
              <div className="stat">
                <div className="stat-label">Orders (30d)</div>
                <div className="stat-value">{fmt.num(num(st?.orders))}</div>
              </div>
              <div className="stat good">
                <div className="stat-label">Revenue (30d)</div>
                <div className="stat-value">{fmt.money(num(st?.revenue), { compact: true })}</div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Warehouses serving {stateCode}</div>
                <Chip dot={false}>{whs.length}</Chip>
              </div>
              {whs.length === 0 ? (
                <div className="empty">No warehouses located in this state. Demand here is served from adjacent regions.</div>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Region</th>
                      <th className="num">Inventory units</th>
                      <th className="num">Active SKUs</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whs.map((w) => (
                      <tr key={w.id}>
                        <td className="mono strong">{w.code || w.name}</td>
                        <td className="muted">{w.region || w.state}</td>
                        <td className="num mono">{num(w.inventoryUnits).toLocaleString()}</td>
                        <td className="num mono">{num(w.activeSkus)}</td>
                        <td>
                          <Chip tone={w.status === 'warn' ? 'amber' : 'green'} dot={false}>
                            {w.status === 'warn' ? 'Warn' : 'Live'}
                          </Chip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
