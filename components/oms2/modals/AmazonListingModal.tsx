import React, { useMemo, useState } from 'react';
import { Modal, Chip } from '../ui';
import {
  createAmazonListingDraft,
  publishAmazonListingDraft,
  type AmazonItemProfile,
  type OmsSku,
  type OmsSkuDetail,
} from '../../../lib/oms';

type ItemLike = Partial<OmsSku & OmsSkuDetail> & {
  amazon?: AmazonItemProfile | null;
  title?: string;
};

export const AmazonListingModal = ({
  item,
  onClose,
  onSaved,
}: {
  item: ItemLike;
  onClose: () => void;
  onSaved?: () => void;
}) => {
  const [form, setForm] = useState({
    sellerSku: item.amazon?.sellerSku || item.sku || '',
    asin: item.amazon?.asin || item.asin || '',
    productType: 'PRODUCT',
    title: item.title || '',
    brand: String((item as any).metadata?.brand || (item as any).attributes?.brand || ''),
    price: String((item as any).metadata?.price || (item as any).attributes?.price || ''),
    condition: 'new_new',
    fulfillmentChannel: 'AMAZON',
    upc: String((item as any).upc || ''),
    ean: String((item as any).ean || ''),
    weight: String((item as any).weight || ''),
    length: String((item as any).dimensions?.length || ''),
    width: String((item as any).dimensions?.width || ''),
    height: String((item as any).dimensions?.height || ''),
    images: Array.isArray((item as any).images) ? (item as any).images.join('\n') : String((item as any).image || ''),
  });
  const [draftId, setDraftId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState<string | null>(null);

  const itemId = item.id || item.amazon?.itemId || '';
  const isReady = useMemo(() => !errors.length && Boolean(draftId), [draftId, errors.length]);

  const update = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const imageList = () => form.images.split('\n').map((v: string) => v.trim()).filter(Boolean);

  const createDraft = async () => {
    setSaving(true);
    setPublished(null);
    try {
      const res = await createAmazonListingDraft({
        itemId,
        ...form,
        price: form.price ? Number(form.price) : null,
        weight: form.weight ? Number(form.weight) : null,
        length: form.length ? Number(form.length) : null,
        width: form.width ? Number(form.width) : null,
        height: form.height ? Number(form.height) : null,
        images: imageList(),
      });
      setDraftId(String(res.draft.id || ''));
      setErrors(res.validation?.errors || []);
      setWarnings(res.validation?.warnings || []);
    } catch (err: any) {
      setErrors([err?.message || 'Unable to create Amazon listing draft']);
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!draftId) return;
    setSaving(true);
    setPublished(null);
    try {
      const res = await publishAmazonListingDraft(draftId, {
        payload: {
          ...form,
          price: form.price ? Number(form.price) : null,
          weight: form.weight ? Number(form.weight) : null,
          length: form.length ? Number(form.length) : null,
          width: form.width ? Number(form.width) : null,
          height: form.height ? Number(form.height) : null,
          images: imageList(),
        },
      });
      setErrors([]);
      setPublished(String(res.submissionResult?.message || 'Draft is ready for Amazon provider submission.'));
      onSaved?.();
    } catch (err: any) {
      setErrors([err?.message || 'Unable to publish listing draft']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="List on Amazon"
      subtitle="Create a channel-specific Amazon listing draft from this UnieConnect SKU."
      onClose={onClose}
      width={760}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Publishing requires Amazon SP-API approval and explicit user confirmation.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn secondary" disabled={saving || !itemId} onClick={createDraft}>
              Validate draft
            </button>
            <button className="btn primary" disabled={saving || !isReady} onClick={publish}>
              Publish request
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 18 }}>
        <div className="panel" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 800 }}>{item.title || item.sku || 'Catalog item'}</div>
              <div className="mono" style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{item.sku}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {item.amazon?.listingStatus ? <Chip tone="blue">{item.amazon.listingStatus}</Chip> : <Chip tone="amber">Needs listing</Chip>}
              {item.amazon?.fulfillmentChannel ? <Chip tone="purple">{item.amazon.fulfillmentChannel}</Chip> : null}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <label className="field-label">
            Seller SKU
            <input className="input" value={form.sellerSku} onChange={(e) => update('sellerSku', e.target.value)} />
          </label>
          <label className="field-label">
            ASIN, if mapped
            <input className="input" value={form.asin} onChange={(e) => update('asin', e.target.value)} />
          </label>
          <label className="field-label">
            Amazon product type
            <input className="input" value={form.productType} onChange={(e) => update('productType', e.target.value)} />
          </label>
          <label className="field-label">
            Fulfillment channel
            <select className="input" value={form.fulfillmentChannel} onChange={(e) => update('fulfillmentChannel', e.target.value)}>
              <option value="AMAZON">Amazon FBA</option>
              <option value="MERCHANT">Merchant fulfilled</option>
            </select>
          </label>
          <label className="field-label" style={{ gridColumn: '1 / -1' }}>
            Title
            <input className="input" value={form.title} onChange={(e) => update('title', e.target.value)} />
          </label>
          <label className="field-label">
            Brand
            <input className="input" value={form.brand} onChange={(e) => update('brand', e.target.value)} />
          </label>
          <label className="field-label">
            Price
            <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={(e) => update('price', e.target.value)} />
          </label>
          <label className="field-label">
            UPC
            <input className="input" value={form.upc} onChange={(e) => update('upc', e.target.value)} />
          </label>
          <label className="field-label">
            EAN
            <input className="input" value={form.ean} onChange={(e) => update('ean', e.target.value)} />
          </label>
          <label className="field-label">
            Weight
            <input className="input" type="number" min="0" step="0.01" value={form.weight} onChange={(e) => update('weight', e.target.value)} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <label className="field-label">
              Length
              <input className="input" type="number" min="0" step="0.01" value={form.length} onChange={(e) => update('length', e.target.value)} />
            </label>
            <label className="field-label">
              Width
              <input className="input" type="number" min="0" step="0.01" value={form.width} onChange={(e) => update('width', e.target.value)} />
            </label>
            <label className="field-label">
              Height
              <input className="input" type="number" min="0" step="0.01" value={form.height} onChange={(e) => update('height', e.target.value)} />
            </label>
          </div>
          <label className="field-label" style={{ gridColumn: '1 / -1' }}>
            Product images
            <textarea
              className="input"
              value={form.images}
              onChange={(e) => update('images', e.target.value)}
              rows={3}
              placeholder="One S3 image URL or uploaded asset URL per line"
            />
          </label>
        </div>

        {(errors.length || warnings.length || published) ? (
          <div className="panel" style={{ padding: 14 }}>
            {published ? <div style={{ color: 'var(--green-text)', fontWeight: 700 }}>{published}</div> : null}
            {errors.map((error) => (
              <div key={error} style={{ color: 'var(--red-text)', fontSize: 13, marginTop: 6 }}>{error}</div>
            ))}
            {warnings.map((warning) => (
              <div key={warning} style={{ color: 'var(--amber-text)', fontSize: 13, marginTop: 6 }}>{warning}</div>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};
