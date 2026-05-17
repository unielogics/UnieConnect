import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui';
import { Icon } from '../icons';
import {
  createCatalogItem,
  createCustomer,
  createManualOrder,
  fetchOmsCustomers,
  fetchOmsSkus,
  CreateCatalogItemBody,
  CreateCustomerBody,
  CreateOrderBody,
  OmsCustomer,
  OmsSku,
} from '../../../lib/oms';
import { createSupplier } from '../../../lib/amazon-fba';

export type CsvImportEntity = 'customers' | 'skus' | 'suppliers' | 'orders';

type ImportResult = { ok: number; failed: Array<{ row: number; error: string }> };

const templates: Record<CsvImportEntity, { title: string; headers: string; help: string; example: string }> = {
  customers: {
    title: 'Customers',
    headers: 'name,email,company,phone,channel,addressLine1,city,state,postalCode,country',
    help: 'Creates customer records used by orders, support, and customer intelligence.',
    example: 'Jane Buyer,jane@example.com,Acme Retail,555-0100,manual,120 Main St,Newark,NJ,07102,US',
  },
  skus: {
    title: 'SKUs',
    headers: 'sku,title,asin,category,weight,length,width,height,supplierId',
    help: 'Creates catalog items used by inventory planning, pallet economics, and shipment workflows.',
    example: 'SKU-1001,Premium Bundle,B0TEST123,Home,2.4,12,8,6,',
  },
  suppliers: {
    title: 'Suppliers',
    headers: 'name,email,phone,website,notes',
    help: 'Creates suppliers. Add ship-from locations later in supplier setup or shipment planning.',
    example: 'Cascade Supply,ops@cascade.example,555-0200,https://example.com,Primary vendor',
  },
  orders: {
    title: 'Orders',
    headers: 'orderNumber,customerEmail,sku,quantity,unitPrice,status,channel,addressLine1,city,state,postalCode,country',
    help: 'Creates orders only when customerEmail matches an existing customer and sku matches an existing SKU.',
    example: 'ORD-1001,jane@example.com,SKU-1001,2,19.95,new,manual,120 Main St,Newark,NJ,07102,US',
  },
};

const field: React.CSSProperties = {
  width: '100%',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  outline: 'none',
  fontSize: 12.5,
};

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = (rows.shift() || []).map((h) => h.trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

const toNumber = (value: string | undefined, fallback = 0) => {
  const n = Number(value || '');
  return Number.isFinite(n) ? n : fallback;
};

export const CsvImportModal = ({
  entity,
  onClose,
  onSuccess,
}: {
  entity: CsvImportEntity;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const template = templates[entity];
  const [csv, setCsv] = useState(`${template.headers}\n${template.example}`);
  const [customers, setCustomers] = useState<OmsCustomer[]>([]);
  const [skus, setSkus] = useState<OmsSku[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const rows = useMemo(() => parseCsv(csv), [csv]);

  useEffect(() => {
    if (entity !== 'orders') return;
    Promise.all([
      fetchOmsCustomers().catch(() => ({ customers: [] })),
      fetchOmsSkus().catch(() => ({ skus: [], total: 0 })),
    ]).then(([customerResp, skuResp]) => {
      setCustomers(customerResp.customers || []);
      setSkus(skuResp.skus || []);
    });
  }, [entity]);

  const importRow = async (row: Record<string, string>) => {
    if (entity === 'customers') {
      if (!row.name?.trim()) throw new Error('name is required');
      const body: CreateCustomerBody = {
        name: row.name.trim(),
        email: row.email?.trim() || undefined,
        phone: row.phone?.trim() || undefined,
        company: row.company?.trim() || undefined,
        channel: row.channel?.trim() || 'csv',
      };
      if (row.addressLine1?.trim()) {
        body.addresses = [{
          line1: row.addressLine1.trim(),
          city: row.city?.trim() || undefined,
          state: row.state?.trim() || undefined,
          postalCode: row.postalCode?.trim() || row.postal?.trim() || undefined,
          country: row.country?.trim() || 'US',
        }];
      }
      await createCustomer(body);
      return;
    }

    if (entity === 'skus') {
      if (!row.sku?.trim()) throw new Error('sku is required');
      const body: CreateCatalogItemBody = {
        sku: row.sku.trim(),
        title: row.title?.trim() || row.name?.trim() || row.sku.trim(),
        asin: row.asin?.trim() || undefined,
        category: row.category?.trim() || undefined,
        weight: row.weight ? toNumber(row.weight) : undefined,
        supplierId: row.supplierId?.trim() || undefined,
      };
      if (row.length || row.width || row.height) {
        body.dimensions = {
          length: toNumber(row.length),
          width: toNumber(row.width),
          height: toNumber(row.height),
        };
      }
      await createCatalogItem(body);
      return;
    }

    if (entity === 'suppliers') {
      if (!row.name?.trim()) throw new Error('name is required');
      await createSupplier({
        name: row.name.trim(),
        email: row.email?.trim() || undefined,
        phone: row.phone?.trim() || undefined,
        website: row.website?.trim() || undefined,
        notes: row.notes?.trim() || undefined,
      });
      return;
    }

    const customer = customers.find((c) => (c.email || '').toLowerCase() === (row.customerEmail || row.email || '').toLowerCase());
    if (!customer) throw new Error(`customerEmail not found: ${row.customerEmail || row.email || 'blank'}`);
    const sku = skus.find((s) => (s.sku || '').toLowerCase() === (row.sku || '').toLowerCase());
    if (!sku) throw new Error(`sku not found: ${row.sku || 'blank'}`);
    const quantity = Math.max(1, toNumber(row.quantity, 1));
    const unitPrice = toNumber(row.unitPrice || row.unit_price, 0);
    const body: CreateOrderBody = {
      customerId: customer.id,
      orderNumber: row.orderNumber || row.externalOrderId || undefined,
      externalOrderId: row.externalOrderId || row.orderNumber || undefined,
      channel: row.channel || 'csv',
      status: row.status || 'new',
      total: row.total ? toNumber(row.total) : quantity * unitPrice,
      lines: [{ itemId: sku.id, sku: sku.sku, title: sku.title, quantity, unitPrice }],
    };
    if (row.addressLine1?.trim()) {
      body.shippingAddress = {
        line1: row.addressLine1.trim(),
        city: row.city?.trim() || undefined,
        state: row.state?.trim() || undefined,
        postalCode: row.postalCode?.trim() || row.postal?.trim() || undefined,
        country: row.country?.trim() || 'US',
      };
    }
    await createManualOrder(body);
  };

  const submit = async () => {
    setImporting(true);
    const next: ImportResult = { ok: 0, failed: [] };
    for (let index = 0; index < rows.length; index += 1) {
      try {
        await importRow(rows[index]);
        next.ok += 1;
      } catch (error: any) {
        next.failed.push({ row: index + 2, error: error?.message || 'Import failed' });
      }
    }
    setResult(next);
    setImporting(false);
    if (next.ok > 0 && next.failed.length === 0) onSuccess();
  };

  return (
    <Modal
      title={`Import ${template.title}`}
      subtitle={template.help}
      onClose={onClose}
      fullscreen
      footer={
        <>
          <div style={{ fontSize: 12, color: result?.failed.length ? 'var(--red-text)' : 'var(--text-tertiary)' }}>
            {result ? `${result.ok} imported · ${result.failed.length} failed` : `${rows.length} row${rows.length === 1 ? '' : 's'} ready`}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={submit} disabled={importing || rows.length === 0}>
              <Icon name="download" size={13} style={{ transform: 'rotate(180deg)' }} />
              {importing ? 'Importing...' : `Import ${template.title}`}
            </button>
          </div>
        </>
      }
    >
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 14 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">CSV template</div>
              <div className="card-subtitle mono">{template.headers}</div>
            </div>
            <button className="btn sm" onClick={() => setCsv(`${template.headers}\n`)}>
              Clear sample
            </button>
          </div>
          <div className="card-body">
            <textarea
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setResult(null);
              }}
              rows={12}
              style={{ ...field, minHeight: 260, padding: 12, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5 }}
            />
          </div>
        </div>

        {entity === 'orders' && (
          <div className="card">
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)' }}>
              <Icon name="warning" size={15} />
              Orders require existing customers and SKUs. Import customers/SKUs first, then import orders by customerEmail and sku.
            </div>
          </div>
        )}

        {result?.failed.length ? (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Rows needing correction</div>
            </div>
            <table className="data">
              <thead>
                <tr><th>CSV row</th><th>Error</th></tr>
              </thead>
              <tbody>
                {result.failed.map((failure) => (
                  <tr key={`${failure.row}-${failure.error}`}>
                    <td className="mono strong">{failure.row}</td>
                    <td>{failure.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};
