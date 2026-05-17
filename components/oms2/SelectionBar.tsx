import React from 'react';
import { Icon } from './icons';

export type SelSku = { id: string; name: string };

export const SelectionBar = ({
  count,
  items,
  onClear,
  onCreateShipment,
  onExport,
  onDelete,
  supplierMixed,
}: {
  count: number;
  items: SelSku[];
  onClear: () => void;
  onCreateShipment: () => void;
  onExport: () => void;
  onDelete: () => void;
  supplierMixed: boolean;
}) => {
  if (count === 0) return null;
  return (
    <div className="sel-bar fade-in">
      <span className="count">{count}</span>
      <span className="meta">
        selected · {items[0]?.name?.slice(0, 28)}
        {count > 1 ? ` +${count - 1} more` : ''}
      </span>
      <div className="actions">
        {supplierMixed ? (
          <span style={{ color: 'var(--amber)', fontSize: 11.5, fontWeight: 600, padding: '0 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="warning" size={11} /> Mixed suppliers
          </span>
        ) : (
          <button className="primary" onClick={onCreateShipment}>
            <Icon name="shipments" size={12} /> Create shipment plan
          </button>
        )}
        <button onClick={onExport}>
          <Icon name="download" size={12} /> Export
        </button>
        <button onClick={onDelete}>
          <Icon name="x" size={12} /> Remove
        </button>
        <button className="close" onClick={onClear} data-hint="Clear">
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  );
};
