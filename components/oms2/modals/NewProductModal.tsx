import React, { useEffect, useState } from 'react';
import { Modal } from '../ui';
import { CatalogItemForm } from '../../CatalogItemForm';
import { ProductResearchFullView } from './ProductResearchFullView';
import {
  createCatalogItem,
  fetchOmsSuppliers,
  lookupProductByIdentifier,
  CreateCatalogItemBody,
  KeepaLookupResult,
  ProductResearchResult,
} from '../../../lib/oms';
import type { Supplier } from '../../../lib/amazon-fba';
import type { CatalogItem } from '../../../lib/catalog-types';

/**
 * New-product flow, Keepa-first:
 *  Step 1 (lookup): a single ASIN/UPC/identifier box → Keepa lookup. A "Skip / enter manually"
 *    link jumps straight to the form.
 *  Step 2 (review): when the lookup carries Cortex intelligence (charts/verdict/opportunity),
 *    show the full research dashboard (reusing ProductResearchFullView) so the user can weigh the
 *    product before creating it. "Continue to create product" advances to the form. Lookups with
 *    no intelligence (pure keepa, Cortex cold) skip this step.
 *  Step 3 (form): the (optionally prefilled) CatalogItemForm; save via createCatalogItem.
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

  const [step, setStep] = useState<'lookup' | 'review' | 'form'>('lookup');
  const [identifier, setIdentifier] = useState('');
  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<CatalogItem | null>(null);
  const [fromKeepa, setFromKeepa] = useState(false);
  // The full lookup result, kept so the review step can render the Cortex intelligence dashboard.
  const [lookupResult, setLookupResult] = useState<KeepaLookupResult | null>(null);

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

  // Does the lookup carry enough Cortex intelligence to be worth a review step?
  const hasIntelligence = (r: KeepaLookupResult): boolean =>
    !!(r.extract || r.charts || r.verdict || r.opportunity);

  // Adapt a KeepaLookupResult into the ProductResearchResult shape ProductResearchFullView reads
  // (it keys everything off row.result.keepa.{extract,charts,verdict,opportunity,...}).
  const toResearchRow = (r: KeepaLookupResult): ProductResearchResult =>
    ({
      id: `lookup-${r.asin || r.upc || r.ean || identifier.trim()}`,
      sku: proposeSku(r),
      status: 'complete',
      input: { identifier: identifier.trim() },
      result: {
        sku: proposeSku(r),
        title: r.title || undefined,
        asin: r.asin || null,
        keepa: {
          source: r.source,
          asin: r.asin || null,
          title: r.title || null,
          brand: r.brand || null,
          image: r.image || null,
          category: r.category || null,
          salesRank: r.salesRank ?? null,
          buyBoxPrice: r.buyBoxPrice ?? null,
          rating: r.rating ?? null,
          reviewCount: r.reviewCount ?? null,
          verdict: r.verdict ?? null,
          opportunity: r.opportunity ?? null,
          charts: r.charts ?? null,
          extract: r.extract ?? null,
        },
      },
    } as ProductResearchResult);

  const runLookup = async () => {
    const id = identifier.trim();
    if (!id) return;
    setLooking(true);
    setLookupMsg(null);
    try {
      const r = await lookupProductByIdentifier(id);
      if (r.found) {
        setPrefill(toPrefill(r));
        setLookupResult(r);
        setFromKeepa(true);
        // Show the intelligence dashboard first when Cortex enriched the lookup; otherwise the
        // review step would be a mostly-empty shell, so go straight to the form.
        setStep(hasIntelligence(r) ? 'review' : 'form');
      } else {
        setPrefill(null);
        setLookupResult(null);
        setFromKeepa(false);
        setLookupMsg("We couldn't find that identifier on Keepa. You can enter the product manually.");
        setStep('form');
      }
    } catch {
      setPrefill(null);
      setLookupResult(null);
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

  // Review step renders the full-screen research dashboard on its own (it IS a fullscreen Modal),
  // so return it directly rather than nesting it inside the outer New-product modal.
  if (step === 'review' && lookupResult) {
    return (
      <ProductResearchFullView
        row={toResearchRow(lookupResult)}
        subtitle="Review the Keepa & Cortex intelligence, then continue to create the product."
        onClose={onClose}
        onContinue={() => setStep('form')}
      />
    );
  }

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
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--purple-soft, #f5f3ff)', color: 'var(--purple, #6d28d9)', borderRadius: 6, fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span>✨ Prefilled from Keepa — review and complete the required fields before saving.</span>
              {lookupResult && hasIntelligence(lookupResult) && (
                <button className="btn ghost sm" onClick={() => setStep('review')} style={{ flexShrink: 0 }}>
                  ← Back to research
                </button>
              )}
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
