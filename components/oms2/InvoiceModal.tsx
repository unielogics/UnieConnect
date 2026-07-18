import React, { useEffect, useState } from 'react';
import { Icon } from './icons';
import { Modal, Chip, StatusChip, Loading, ErrorState, fmt } from './ui';
import { fetchBillingInvoices, fetchInvoicePdf, downloadBlob, BillingInvoiceRow } from '../../lib/oms';
import type { NavFn } from './UnieConnectApp';

export const InvoiceModal = ({
  invoiceNumber,
  onClose,
  onNavigate,
  onOpenOrderById,
  onOpenAsnById,
}: {
  invoiceNumber: string;
  onClose: () => void;
  onNavigate: NavFn;
  onOpenOrderById?: (orderId: string) => void;
  onOpenAsnById?: (asnId: string) => void;
}) => {
  const [rows, setRows] = useState<BillingInvoiceRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setRows(null);
    setErr(null);
    fetchBillingInvoices({ invoiceNumber, limit: 200 })
      .then((res) => setRows(res.rows))
      .catch((e) => setErr(e.message || 'Failed to load invoice'));
  }, [invoiceNumber]);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const blob = await fetchInvoicePdf(invoiceNumber);
      downloadBlob(blob, `invoice-${invoiceNumber}.pdf`);
    } catch {
      /* noop — button stays enabled for retry */
    } finally {
      setExporting(false);
    }
  };

  const first = rows && rows[0];
  const total = rows ? rows.reduce((sum, r) => sum + r.amount, 0) : 0;

  return (
    <Modal
      title={`Invoice ${invoiceNumber}`}
      subtitle={first ? `${first.warehouse || 'Warehouse'} · Billed for ${(first.date || '').slice(0, 10)}` : undefined}
      onClose={onClose}
      width={1040}
      footer={
        <>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
            {rows ? `${rows.length} line items · ${fmt.money(total)}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" onClick={exportPdf} disabled={exporting || !rows}>
              <Icon name="download" size={13} /> {exporting ? 'Exporting…' : 'Export PDF'}
            </button>
          </div>
        </>
      }
    >
      {err ? (
        <ErrorState message={err} />
      ) : !rows ? (
        <Loading rows={5} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            {first && <StatusChip status={first.status} />}
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>·</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
              Total <strong style={{ color: 'var(--text)' }}>{fmt.money(total)}</strong>
            </span>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Line items</div>
              <Chip dot={false}>{rows.length}</Chip>
            </div>
            <div style={{ padding: 0 }}>
              {rows.length === 0 ? (
                <div style={{ padding: 16, fontSize: 12.5, color: 'var(--text-tertiary)' }}>No line items on this invoice.</div>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Description</th>
                      <th className="num">Qty</th>
                      <th className="num">Unit</th>
                      <th className="num">Amount</th>
                      <th>Links</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td><Chip dot={false}>{r.category}</Chip></td>
                        <td>{r.description || r.code || '—'}</td>
                        <td className="num mono">{r.qty || '—'}</td>
                        <td className="num mono">{r.unitPrice ? fmt.money(r.unitPrice) : '—'}</td>
                        <td className="num mono strong">{fmt.money(r.amount)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {r.linkedOrder ? (
                              <button
                                className="btn ghost sm"
                                onClick={() => onOpenOrderById?.(r.linkedOrder!.omsId)}
                              >
                                Order {r.linkedOrder.publicId} →
                              </button>
                            ) : null}
                            {r.linkedAsn ? (
                              <button
                                className="btn ghost sm"
                                onClick={() => onOpenAsnById?.(r.linkedAsn!.omsId)}
                              >
                                ASN {r.linkedAsn.publicId} →
                              </button>
                            ) : null}
                            {!r.linkedOrder && !r.linkedAsn && <span className="muted">—</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
};
