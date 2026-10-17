import React, { useState } from 'react';
import { Icon } from './icons';

export type SelSku = {
  id: string;
  name: string;
  supplierId?: string | null;
  sku?: string;
  amazon?: unknown;
  fbaIntent?: boolean;
  [key: string]: unknown;
};

export const SelectionBar = ({
  count,
  items,
  onClear,
  onCreateShipment,
  onExport,
  onArchive,
  supplierMixed,
}: {
  count: number;
  items: SelSku[];
  onClear: () => void;
  onCreateShipment: () => void;
  onExport: () => void;
  onArchive: () => Promise<void>;
  supplierMixed: boolean;
}) => {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');

  if (count === 0) return null;

  const archive = async () => {
    setArchiving(true);
    setArchiveError('');
    try {
      await onArchive();
    } catch (error: any) {
      setArchiveError(error?.message || 'Could not archive the selected SKUs.');
      setArchiving(false);
    }
  };

  return (
    <div className={`sel-bar fade-in ${confirmArchive ? 'confirming' : ''}`} role="region" aria-label="Selected SKU actions">
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
        {confirmArchive ? (
          <span className="archive-confirm" role="alert">
            <span>Archive {count} SKU{count === 1 ? '' : 's'}?</span>
            <button onClick={() => { setConfirmArchive(false); setArchiveError(''); }} disabled={archiving}>Cancel</button>
            <button className="danger" onClick={archive} disabled={archiving}>
              {archiving ? 'Archiving...' : 'Archive'}
            </button>
          </span>
        ) : (
          <button onClick={() => setConfirmArchive(true)}>
            <Icon name="archive" size={12} /> Archive
          </button>
        )}
        <button className="close" onClick={onClear} data-hint="Clear">
          <Icon name="x" size={14} />
        </button>
      </div>
      {archiveError ? <span className="sel-error" role="alert">{archiveError}</span> : null}
    </div>
  );
};
