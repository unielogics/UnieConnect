import React, { useEffect, useState } from 'react';
import { Modal } from '../ui';
import { CatalogItemForm } from '../../CatalogItemForm';
import {
  createCatalogItem,
  fetchOmsSuppliers,
  lookupProductByIdentifier,
  CreateCatalogItemBody,
  KeepaLookupResult,
} from '../../../lib/oms';
import type { Supplier } from '../../../lib/amazon-fba';
import type { CatalogItem } from '../../../lib/catalog-types';

/**
 * New-product flow, Keepa-first:
 *  Step 1 (lookup): a single ASIN/UPC/identifier box → Keepa lookup. On a hit, prefill the
 *    catalog form; if Keepa is down or finds nothing, fall through to the blank manual form.
 *    A "Skip / enter manually" link jumps straight to the form.
 *  Step 2 (form): the (optionally prefilled) CatalogItemForm; save via createCatalogItem.
 */
export const NewProductModal = ({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [step, setStep] = useState<'lookup' | 'form'>('lookup');
  const [identifier, setIdentifier] = useState('');
  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<CatalogItem | null>(null);
  const [fromKeepa, setFromKeepa] = useState(false);

  useEffect(() => {
    fetchOmsSuppliers()
      .then((d) => setSuppliers((d.suppliers || []).map((s) => ({ id: s.id, name: s.name } as Supplier))))
      .catch(() => setSuppliers([]));
  }, []);

  // Proposed SKU derived from whichever identifier resolved — traceable back to its source and
  // still fully editable (CatalogItemForm only locks the SKU input when isEditing is true).
  const proposeSku = (r: KeepaLookupResult): string =>
    r.asin ? `ASIN-${r.asin}` : r.upc ? `UPC-${r.upc}` : r.ean ? `EAN-${r.ean}` : '';

  const toPrefill = (r: KeepaLookupResult): CatalogItem =>
    ({
      sku: proposeSku(r),
      title: r.title || '',
      description: r.description || '',
      image: r.image || '',
      upc: r.upc || '',
      ean: r.ean || '',
      asin: r.asin || '',
      category: r.category || '',
      weight: r.weight ?? undefined,
      dimensions: {
        length: r.dimensions?.length ?? undefined,
        width: r.dimensions?.width ?? undefined,
        height: r.dimensions?.height ?? undefined,
      },
    } as unknown as CatalogItem);

  const runLookup = async () => {
    const id = identifier.trim();
    if (!id) return;
    setLooking(true);
    setLookupMsg(null);
    try {
      const r = await lookupProductByIdentifier(id);
      if (r.found) {
        setPrefill(toPrefill(r));
        setFromKeepa(true);
        setStep('form');
      } else {
        setPrefill(null);
        setFromKeepa(false);
        setLookupMsg("We couldn't find that identifier on Keepa. You can enter the product manually.");
        setStep('form');
      }
    } catch {
      setPrefill(null);
      setFromKeepa(false);
      setLookupMsg('Keepa lookup is unavailable right now — enter the product manually.');
      setStep('form');
    } finally {
      setLooking(false);
    }
  };

  const submit = async (data: Record<string, unknown>) => {
    setSaving(true);
    setErr(null);
    try {
      await createCatalogItem(data as unknown as CreateCatalogItemBody);
      onSuccess();
    } catch (e: any) {
      setErr(e.message || 'Failed to create product');
      setSaving(false);
    }
  };

  return (
    <Modal
      title="New product"
      subtitle={
        step === 'lookup'
          ? 'Enter an ASIN, UPC, or other identifier and we’ll pull product data from Keepa. Or skip to enter manually.'
          : 'Create a SKU in your catalog. It will appear in SKUs, Inventory Plan, and shipment workflows.'
      }
      onClose={onClose}
      fullscreen={step === 'form'}
    >
      {step === 'lookup' ? (
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '8px 0' }}>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
            ASIN / UPC / identifier
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              autoFocus
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runLookup()}
              placeholder="e.g. B08N5WRWNW or 012345678905"
              style={{ flex: 1 }}
            />
            <button className="btn primary" onClick={runLookup} disabled={looking || !identifier.trim()}>
              {looking ? 'Looking up…' : 'Look up'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 12 }}>
            We check Keepa first to prefill title, brand, category, dimensions, and weight. If nothing is found, you’ll get a blank form.
          </p>
          <button
            className="btn ghost sm"
            onClick={() => { setPrefill(null); setFromKeepa(false); setLookupMsg(null); setStep('form'); }}
            style={{ marginTop: 4 }}
          >
            Skip / enter manually →
          </button>
        </div>
      ) : (
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          {fromKeepa && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--purple-soft, #f5f3ff)', color: 'var(--purple, #6d28d9)', borderRadius: 6, fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              ✨ Prefilled from Keepa — review and complete the required fields before saving.
            </div>
          )}
          {lookupMsg && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--amber-soft, #fef3c7)', color: 'var(--amber-text, #92400e)', borderRadius: 6, fontSize: 12.5, fontWeight: 600 }}>
              {lookupMsg}
            </div>
          )}
          {err && (
            <div style={{ marginBottom: 14, padding: '8px 12px', background: 'var(--red-soft)', color: 'var(--red-text)', borderRadius: 6, fontSize: 12.5, fontWeight: 600 }}>
              {err}
            </div>
          )}
          <CatalogItemForm
            key={fromKeepa ? 'prefilled' : 'blank'}
            item={prefill}
            isEditing={false}
            suppliers={suppliers}
            onSubmit={submit}
            onCancel={onClose}
            isLoading={saving}
          />
        </div>
      )}
    </Modal>
  );
};
