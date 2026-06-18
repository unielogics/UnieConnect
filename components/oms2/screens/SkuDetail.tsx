import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../icons';
import { Chip, StatusChip, ProgressBar, fmt, Loading, ErrorState, EmptyState } from '../ui';
import {
  fetchOmsSkuDetail,
  fetchOmsSkus,
  fetchProductResearchResult,
  fetchRecommendations,
  OmsRecommendation,
  OmsSkuEnrichmentUpdate,
  OmsSkuDetail,
  OmsSupplier,
  ProductResearchResult,
  fetchOmsSuppliers,
  uploadCatalogImage,
  updateOmsSkuEnrichment,
} from '../../../lib/oms';
import { num, docTone, riskLabel, channelColor } from '../../../lib/oms-adapters';
import { amazonCategoryNames, amazonSubcategoriesFor } from '../../../lib/amazon-category-tree';
import type { ScreenProps } from '../UnieConnectApp';
import { AmazonListingDrawer, RecommendationDrawer } from './InventoryNetwork';

type Tab = 'overview' | 'heatmap' | 'warehouses' | 'history' | 'channels' | 'billing' | 'orders';

export const SkuDetail = ({ skuId, onBack, onNavigate, toggleSelect, isSelected }: ScreenProps & { onBack?: () => void }) => {
  const [data, setData] = useState<OmsSkuDetail | null>(null);
  const [productIntel, setProductIntel] = useState<ProductResearchResult | null>(null);
  const [recommendations, setRecommendations] = useState<OmsRecommendation[]>([]);
  const [selectedRec, setSelectedRec] = useState<OmsRecommendation | null>(null);
  const [amazonOpen, setAmazonOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const load = () => {
    if (!skuId) {
      setErr('No SKU selected');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    fetchOmsSkuDetail(skuId)
      .then((detail) => {
        setData(detail);
        fetchProductResearchResult(detail.sku).then(setProductIntel).catch(() => setProductIntel(null));
        fetchRecommendations({ entityType: 'sku', status: 'open', limit: 5 }).then((r) => {
          setRecommendations((r.recommendations || []).filter((rec) => rec.entityId === detail.id || rec.entityId === detail.sku));
        }).catch(() => setRecommendations([]));
      })
      .catch((e) => setErr(e.message || 'Failed to load SKU'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [skuId]);

  const back = () => (onBack ? onBack() : onNavigate('skus'));

  if (err) return <div className="page fade-in"><div className="card"><ErrorState message={err} onRetry={load} /></div></div>;
  if (loading || !data) return <div className="page fade-in"><div className="card"><Loading rows={6} /></div></div>;

  const intel = data.intelligence || {};
  const rl = riskLabel(intel.risk as string);
  const doc = num(intel.daysOfCover);
  const rev = num(intel.revenue30d);
  const gp = num(intel.grossProfit30d);
  const keepaUnavailable = data.keepaUnavailable || data.enrichmentMarker === '*';

  return (
    <div className="page fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12.5 }}>
        <button className="btn ghost sm" onClick={back}>
          <Icon name="chevron" size={11} style={{ transform: 'rotate(180deg)' }} /> Back to SKUs
        </button>
        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
        <span style={{ color: 'var(--text-tertiary)' }}>SKU detail</span>
        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
        <span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>
          {data.sku}
          {keepaUnavailable && (
            <span title="Keepa enrichment unavailable; Cortex will use manual/marketplace data." style={{ color: 'var(--amber)', marginLeft: 4, fontWeight: 900 }}>*</span>
          )}
        </span>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 18, alignItems: 'center', padding: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              background: 'linear-gradient(135deg, var(--bg-sunken) 0%, var(--bg-active) 100%)',
              border: '1px solid var(--border)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-tertiary)',
              overflow: 'hidden',
            }}
          >
            {data.image ? <img src={data.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="box" size={36} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                {data.sku}
                {keepaUnavailable && (
                  <span title="Keepa enrichment unavailable; Cortex will use manual/marketplace data." style={{ color: 'var(--amber)', marginLeft: 4, fontWeight: 900 }}>*</span>
                )}
              </span>
              {data.asin && <Chip dot={false}>{data.asin}</Chip>}
              {keepaUnavailable && <Chip tone="amber" dot={false}>Keepa *</Chip>}
              <Chip tone={rl.tone}>{rl.label}</Chip>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {data.title || data.sku}
              {keepaUnavailable && (
                <span title="Keepa enrichment unavailable; Cortex will use manual/marketplace data." style={{ color: 'var(--amber)', marginLeft: 6 }}>*</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              {data.price != null && (
                <>
                  <span>Price <strong style={{ color: 'var(--text)' }}>${num(data.price).toFixed(2)}</strong></span>
                  <span>·</span>
                </>
              )}
              {data.margin != null && (
                <>
                  <span>Margin <strong style={{ color: 'var(--text)' }}>{(num(data.margin) * 100).toFixed(0)}%</strong></span>
                  <span>·</span>
                </>
              )}
              {data.weight != null && (
                <>
                  <span>Weight <strong style={{ color: 'var(--text)' }}>{num(data.weight)} lb</strong></span>
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {recommendations[0] && (
              <button className="btn ghost cortex-action" onClick={() => setSelectedRec(recommendations[0])} data-hint="Review Cortex optimization">
                <span className="icon-alert-wrap">
                  <Icon name="sparkle" size={13} />
                  <span className="icon-alert-dot" />
                </span>
                Cortex
              </button>
            )}
            <button className="btn ghost" onClick={() => setAmazonOpen(true)} data-hint="Amazon listing draft">
              <Icon name="amazon" size={14} /> Amazon
            </button>
            <button className="btn ghost" onClick={() => onNavigate('ledger')}><Icon name="ledger" size={13} /> Ledger</button>
            <button className="btn" onClick={() => onNavigate('plan', data.id)}><Icon name="eye" size={13} /> View in Plan</button>
            <button
              className={`btn ${isSelected(data.id) ? '' : 'primary'}`}
              onClick={() => toggleSelect({ id: data.id, name: data.title || data.sku, ...(data as any) })}
            >
              {isSelected(data.id) ? (
                <><Icon name="check" size={13} /> Selected</>
              ) : (
                <><Icon name="plus" size={13} /> Add to shipment</>
              )}
            </button>
          </div>
        </div>
      </div>

      <ItemDetailsPanel data={data} onSaved={setData} />

      <div className="stat-grid cols-5" style={{ marginBottom: 16 }}>
        <KpiTile label="On hand" value={num(intel.available).toLocaleString()} unit="u" sub={`across ${data.warehouses.length} WHs`} />
        <KpiTile label="Inbound" value={num(intel.inbound).toLocaleString()} unit="u" sub={num(intel.inbound) > 0 ? 'ASNs en route' : 'no inbound'} />
        <KpiTile label="Days of cover" value={Math.round(doc)} unit="d" tone={doc < 14 ? 'danger' : doc < 28 ? 'warn' : 'good'} />
        <KpiTile label="Velocity / 30d" value={num(intel.velocity30d).toLocaleString()} unit="u" />
        <KpiTile label="Revenue / 30d" value={fmt.money(rev, { compact: true })} sub={`${fmt.money(gp, { compact: true })} GP`} tone="good" />
      </div>

      <SkuIntelligenceStrip
        productIntel={productIntel}
        recommendations={recommendations}
        onNavigate={onNavigate}
        onOpenRecommendation={() => recommendations[0] && setSelectedRec(recommendations[0])}
      />

      <div className="tabs" style={{ marginBottom: 16 }}>
        {([
          ['overview', 'Overview', undefined],
          ['heatmap', 'Heatmap', undefined],
          ['warehouses', 'Warehouses', data.warehouses.length],
          ['history', 'History', undefined],
          ['channels', 'Channels', data.channels?.length],
          ['billing', 'Billing', undefined],
          ['orders', 'Orders', undefined],
        ] as [Tab, string, number | undefined][]).map(([id, label, count]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
            {count !== undefined && <span className="count">{count}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview data={data} />}
      {tab === 'heatmap' && <SkuDemandHeatmap data={data} />}
      {tab === 'warehouses' && <Warehouses data={data} />}
      {tab === 'history' && <History data={data} />}
      {tab === 'channels' && <Channels data={data} />}
      {tab === 'billing' && <Billing data={data} />}
      {tab === 'orders' && (
        <div className="card">
          <div className="card-body">
            <EmptyState>
              SKU-level order history is shown on the Orders screen filtered by this SKU.
              <div style={{ marginTop: 12 }}>
                <button className="btn sm" onClick={() => onNavigate('orders')}>
                  <Icon name="orders" size={12} /> Open Orders
                </button>
              </div>
            </EmptyState>
          </div>
        </div>
      )}
      {selectedRec && <RecommendationDrawer rec={selectedRec} onClose={() => setSelectedRec(null)} onChanged={load} />}
      {amazonOpen && <AmazonListingDrawer sku={{ id: data.id, sku: data.sku, title: data.title }} onClose={() => setAmazonOpen(false)} />}
    </div>
  );
};

const KpiTile = ({ label, value, unit, sub, tone }: { label: string; value: React.ReactNode; unit?: string; sub?: string; tone?: string }) => (
  <div className={`stat ${tone || ''}`}>
    <div className="stat-label">{label}</div>
    <div className="stat-value">
      {value}
      {unit && <span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: 3 }}>{unit}</span>}
    </div>
    {sub && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{sub}</div>}
  </div>
);

const firstValue = (...values: unknown[]) => {
  const found = values.find((value) => value != null && String(value).trim() !== '');
  return found == null ? '' : String(found);
};

const dimText = (dimensions?: OmsSkuDetail['dimensions'] | null) => {
  const l = num(dimensions?.length);
  const w = num(dimensions?.width);
  const h = num(dimensions?.height);
  return l && w && h ? `${l} x ${w} x ${h} in` : '';
};

type DetailFieldKind = 'text' | 'textarea' | 'number' | 'dimensions' | 'identity' | 'images' | 'category' | 'supplier';
type DetailField = {
  key: string;
  label: string;
  value: string;
  supplierId?: string | null;
  missing: boolean;
  kind: DetailFieldKind;
  payload: (value: string) => OmsSkuEnrichmentUpdate;
};

const parseNumberOrNull = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const identityPart = (value: string) => value.replace(/[^a-z0-9]/gi, '').toUpperCase();

const splitIdentity = (value: string) => {
  const [upc = '', ean = '', asin = ''] = value.split(/[|/]/).map((part) => identityPart(part));
  return { upc, ean, asin };
};

const splitCategory = (value: string) => {
  const [category = '', subCategory = ''] = value.split('|').map((part) => part.trim());
  return { category, subCategory };
};

const cleanDimensionToken = (value: string) => {
  const cleaned = value.replace(/[^\d.]/g, '');
  const [whole = '', decimals = ''] = cleaned.split('.');
  return decimals ? `${whole || '0'}.${decimals.slice(0, 2)}` : whole;
};

const parseDimensionEntry = (raw: string) => {
  const value = String(raw || '').trim();
  if (/[x,]/i.test(value)) {
    const [length = '', width = '', height = ''] = value.split(/[x,]/i).map((part) => cleanDimensionToken(part));
    return { length, width, height };
  }
  const compact = value.replace(/[^\d.]/g, '');
  const dotIndex = compact.indexOf('.');
  if (dotIndex >= 0) {
    const beforeDot = compact.slice(0, dotIndex).replace(/\D/g, '');
    const decimals = compact.slice(dotIndex + 1).replace(/\D/g, '').slice(0, 2);
    const length = beforeDot.slice(0, 2);
    const width = beforeDot.slice(2, 4);
    const remainingHeight = beforeDot.slice(4);
    const decimalHeight = `0.${decimals}`;
    return {
      length,
      width,
      height: remainingHeight ? `${remainingHeight}.${decimals}` : decimalHeight,
    };
  }
  const digits = compact.replace(/\D/g, '');
  return {
    length: digits.slice(0, 2),
    width: digits.slice(2, 4),
    height: digits.slice(4, 6),
  };
};

const dimensionPayloadFromEntry = (entry: string) => {
  const parts = parseDimensionEntry(entry);
  return {
    length: parseNumberOrNull(parts.length),
    width: parseNumberOrNull(parts.width),
    height: parseNumberOrNull(parts.height),
  };
};

const dimensionEntryFromDimensions = (dimensions?: OmsSkuDetail['dimensions'] | null) => {
  const d = dimensions || {};
  return [d.length, d.width, d.height].map((v) => (v == null ? '' : String(v))).join(' x ');
};

const dimensionPreview = (entry: string) => {
  const parts = parseDimensionEntry(entry);
  const values = [parts.length, parts.width, parts.height].filter((part) => part !== '');
  return values.length ? `${parts.length || '-'} x ${parts.width || '-'} x ${parts.height || '-'} in` : 'Type compact dimensions, e.g. 1010.05';
};

const rememberCustomCategory = (categoryValue: string) => {
  if (typeof window === 'undefined') return;
  const { category, subCategory } = splitCategory(categoryValue);
  if (!category && !subCategory) return;
  const key = 'uc-oms-custom-amazon-categories';
  let existing: { category: string; subcategories: string[] }[] = [];
  try {
    existing = JSON.parse(window.localStorage.getItem(key) || '[]');
  } catch {
    existing = [];
  }
  const idx = existing.findIndex((node) => node.category.toLowerCase() === category.toLowerCase());
  if (idx >= 0) {
    if (subCategory && !existing[idx].subcategories.some((s) => s.toLowerCase() === subCategory.toLowerCase())) {
      existing[idx] = { ...existing[idx], subcategories: [...existing[idx].subcategories, subCategory] };
    }
  } else if (category) {
    existing.push({ category, subcategories: subCategory ? [subCategory] : [] });
  }
  window.localStorage.setItem(key, JSON.stringify(existing.slice(-80)));
};

const loadCustomCategories = () => {
  if (typeof window === 'undefined') return [] as { category: string; subcategories: string[] }[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem('uc-oms-custom-amazon-categories') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const ItemDetailsPanel = ({ data, onSaved }: { data: OmsSkuDetail; onSaved: (detail: OmsSkuDetail) => void }) => {
  const [suppliers, setSuppliers] = useState<OmsSupplier[]>([]);
  const [supplierLoadFailed, setSupplierLoadFailed] = useState(false);
  const attrs = data.attributes || {};
  const meta = data.metadata || {};
  const images = [data.image, ...(data.images || [])].filter(Boolean);
  const identityValue = [data.upc, data.ean, data.asin].filter(Boolean).join(' / ');
  const categoryValue = [data.category, data.subCategory].filter(Boolean).join(' / ');
  useEffect(() => {
    let alive = true;
    fetchOmsSuppliers()
      .then((result) => {
        if (!alive) return;
        setSuppliers(result.suppliers || []);
        setSupplierLoadFailed(false);
      })
      .catch(() => {
        if (!alive) return;
        setSuppliers([]);
        setSupplierLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  const supplierName = data.supplierId ? suppliers.find((supplier) => supplier.id === data.supplierId)?.name || data.supplierId : '';
  const fields: DetailField[] = [
    { key: 'subtitle', label: 'Subtitle', value: firstValue(data.subtitle, meta.subtitle, meta.subTitle), missing: !firstValue(data.subtitle, meta.subtitle, meta.subTitle), kind: 'text', payload: (value) => ({ subtitle: value }) },
    { key: 'brand', label: 'Brand', value: firstValue(data.brand, meta.brand, attrs.brand), missing: !firstValue(data.brand, meta.brand, attrs.brand), kind: 'text', payload: (value) => ({ brand: value }) },
    { key: 'description', label: 'Description', value: firstValue(data.description, meta.description, attrs.description), missing: !firstValue(data.description, meta.description, attrs.description), kind: 'textarea', payload: (value) => ({ description: value }) },
    { key: 'size', label: 'Size', value: firstValue(attrs.size, meta.size, attrs.variant, meta.variant), missing: !firstValue(attrs.size, meta.size, attrs.variant, meta.variant), kind: 'text', payload: (value) => ({ size: value }) },
    { key: 'weight', label: 'Weight', value: data.weight ? `${num(data.weight)} lb` : '', missing: !data.weight, kind: 'number', payload: (value) => ({ weight: parseNumberOrNull(value) }) },
    { key: 'dimensions', label: 'Dimensions', value: dimText(data.dimensions), missing: !dimText(data.dimensions), kind: 'dimensions', payload: (value) => {
      return { dimensions: dimensionPayloadFromEntry(value) };
    } },
    { key: 'identity', label: 'UPC / EAN / ASIN', value: identityValue, missing: !identityValue, kind: 'identity', payload: (value) => {
      const { upc, ean, asin } = splitIdentity(value);
      return { upc, ean, asin };
    } },
    { key: 'images', label: 'Images', value: images.length ? `${images.length} image${images.length === 1 ? '' : 's'}` : '', missing: !images.length, kind: 'images', payload: (value) => ({ images: value.split(/\r?\n/).map((url) => url.trim()).filter(Boolean) }) },
    { key: 'price', label: 'Price', value: data.price != null ? `$${num(data.price).toFixed(2)}` : '', missing: data.price == null, kind: 'number', payload: (value) => ({ price: parseNumberOrNull(value) }) },
    { key: 'category', label: 'Category', value: categoryValue, missing: !categoryValue, kind: 'category', payload: (value) => {
      const { category, subCategory } = splitCategory(value);
      return { category, subCategory };
    } },
    { key: 'supplierId', label: 'Supplier', value: supplierName, supplierId: data.supplierId || null, missing: !data.supplierId, kind: 'supplier', payload: (value) => ({ supplierId: value || null }) },
    { key: 'marketplaceSource', label: 'Marketplace source', value: firstValue(meta.source, meta.importSource, meta.channel, data.asin ? 'Amazon enriched' : ''), missing: !firstValue(meta.source, meta.importSource, meta.channel, data.asin ? 'Amazon enriched' : ''), kind: 'text', payload: (value) => ({ marketplaceSource: value }) },
  ];
  const missing = fields.filter((field) => field.missing).length;
  const complete = Math.round(((fields.length - missing) / fields.length) * 100);
  return (
    <div className="card sku-details-card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div>
          <div className="card-title"><Icon name="box" size={15} /> Item details</div>
          <div className="card-subtitle">Click any field to edit. Missing values are marked red for cleanup.</div>
        </div>
        <Chip tone={missing ? 'red' : 'green'} dot={false}>{complete}% enriched</Chip>
      </div>
      <div className="sku-detail-grid">
        {fields.map((field) => (
          <EditableDetailField key={field.key} skuId={data.id} field={field} images={images as string[]} dimensions={data.dimensions} identifiers={{ upc: data.upc || '', ean: data.ean || '', asin: data.asin || '' }} category={{ category: data.category || '', subCategory: data.subCategory || '' }} suppliers={suppliers} supplierLoadFailed={supplierLoadFailed} onSaved={onSaved} />
        ))}
      </div>
    </div>
  );
};

const editableInitialValue = (
  field: DetailField,
  options: {
    images: string[];
    dimensions?: OmsSkuDetail['dimensions'] | null;
    identifiers: { upc: string; ean: string; asin: string };
    category: { category: string; subCategory: string };
  },
) => {
  if (field.kind === 'images') return options.images.join('\n');
  if (field.kind === 'dimensions') {
    return dimensionEntryFromDimensions(options.dimensions);
  }
  if (field.kind === 'identity') return [options.identifiers.upc, options.identifiers.ean, options.identifiers.asin].join('|');
  if (field.kind === 'category') return [options.category.category, options.category.subCategory].join('|');
  if (field.kind === 'supplier') return field.supplierId || '';
  if (field.kind === 'number') return field.value.replace(/[$,]| lb/g, '');
  return field.value;
};

const EditableDetailField = ({
  skuId,
  field,
  images,
  dimensions,
  identifiers,
  category,
  suppliers,
  supplierLoadFailed,
  onSaved,
}: {
  skuId: string;
  field: DetailField;
  images: string[];
  dimensions?: OmsSkuDetail['dimensions'] | null;
  identifiers: { upc: string; ean: string; asin: string };
  category: { category: string; subCategory: string };
  suppliers: OmsSupplier[];
  supplierLoadFailed?: boolean;
  onSaved: (detail: OmsSkuDetail) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const begin = () => {
    setValue(editableInitialValue(field, { images, dimensions, identifiers, category }));
    setError('');
    setEditing(true);
  };
  const onEditorKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setEditing(false);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void save();
    }
  };
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (field.kind === 'category') rememberCustomCategory(value);
      const next = await updateOmsSkuEnrichment(skuId, field.payload(value));
      onSaved(next);
      setEditing(false);
    } catch (e: any) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button type="button" onClick={begin} className={`sku-detail-field editable ${field.missing ? 'missing' : ''}`} data-hint={`Edit ${field.label}`}>
        <div className="kv-label">{field.label}</div>
        <div className="kv-value">{field.value || 'Missing'}</div>
        <Icon name="settings" size={11} className="field-edit-icon" />
      </button>
    );
  }

  return (
    <div className={`sku-detail-field editing ${field.missing ? 'missing' : ''}`}>
      <div className="kv-label">{field.label}</div>
      {field.kind === 'dimensions' ? (
        <DimensionEditor value={value} onChange={setValue} onKeyDown={onEditorKeyDown} />
      ) : field.kind === 'identity' ? (
        <IdentityEditor value={value} onChange={setValue} onKeyDown={onEditorKeyDown} />
      ) : field.kind === 'category' ? (
        <CategoryEditor value={value} onChange={setValue} onKeyDown={onEditorKeyDown} />
      ) : field.kind === 'images' ? (
        <ImagesEditor
          value={value}
          onChange={setValue}
          onKeyDown={onEditorKeyDown}
          uploading={uploading}
          onUpload={async (files) => {
            if (!files.length) return;
            setUploading(true);
            setError('');
            try {
              const uploaded = await Promise.all(files.map((file) => uploadCatalogImage(file)));
              const current = value.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
              setValue([...current, ...uploaded.map((file) => file.url)].join('\n'));
            } catch (e: any) {
              setError(e.message || 'Image upload failed');
            } finally {
              setUploading(false);
            }
          }}
        />
      ) : field.kind === 'supplier' ? (
        <>
          <select className="sku-field-input" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onEditorKeyDown} autoFocus>
            <option value="">No supplier assigned</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
          <div className="sku-field-help">
            {supplierLoadFailed ? 'Supplier list could not load. You can still clear the assignment.' : suppliers.length ? 'Supplier assignment is saved to the SKU master record.' : 'No suppliers exist yet. Create suppliers before assigning this SKU.'}
          </div>
        </>
      ) : field.kind === 'textarea' ? (
        <textarea className="sku-field-input textarea" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onEditorKeyDown} rows={2} />
      ) : (
        <input className="sku-field-input" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onEditorKeyDown} />
      )}
      {error && <div className="sku-field-error">{error}</div>}
      <div className="sku-field-actions">
        <button className="btn primary sm" onClick={save} disabled={saving || uploading}><Icon name="check" size={11} /> {saving ? 'Saving' : 'Save'}</button>
        <button className="btn sm" onClick={() => setEditing(false)} disabled={saving || uploading}>Cancel</button>
      </div>
    </div>
  );
};

const DimensionEditor = ({
  value,
  onChange,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}) => {
  const update = (raw: string) => {
    const cleaned = raw.replace(/[^\d.x,\s]/gi, '');
    onChange(cleaned);
  };
  return (
    <>
      <input
        className="sku-field-input"
        inputMode="decimal"
        value={value}
        onChange={(e) => update(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="1010.05"
        autoFocus
      />
      <div className="sku-field-help">
        {dimensionPreview(value)}. Type 1010.05 for 10 x 10 x 0.05. Enter saves.
      </div>
    </>
  );
};

const IdentityEditor = ({
  value,
  onChange,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}) => {
  const current = splitIdentity(value);
  const update = (key: 'upc' | 'ean' | 'asin', next: string) => {
    const merged = { ...current, [key]: identityPart(next) };
    onChange([merged.upc, merged.ean, merged.asin].join('|'));
  };
  return (
    <div className="sku-triple-editor">
      <input className="sku-field-input" value={current.upc} onChange={(e) => update('upc', e.target.value)} onKeyDown={onKeyDown} placeholder="UPC" autoFocus />
      <input className="sku-field-input" value={current.ean} onChange={(e) => update('ean', e.target.value)} onKeyDown={onKeyDown} placeholder="EAN" />
      <input className="sku-field-input" value={current.asin} onChange={(e) => update('asin', e.target.value)} onKeyDown={onKeyDown} placeholder="ASIN" />
      <div className="sku-field-help span-all">Letters and numbers only. Enter saves.</div>
    </div>
  );
};

const CategoryEditor = ({
  value,
  onChange,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}) => {
  const current = splitCategory(value);
  const [accountNodes, setAccountNodes] = useState<{ category: string; subcategories: string[] }[]>([]);
  useEffect(() => {
    let alive = true;
    fetchOmsSkus({ limit: 500 } as any)
      .then((result) => {
        if (!alive) return;
        const map = new Map<string, Set<string>>();
        for (const sku of result.skus || []) {
          const cat = String((sku as any).category || '').trim();
          const sub = String((sku as any).subCategory || '').trim();
          if (!cat) continue;
          if (!map.has(cat)) map.set(cat, new Set());
          if (sub) map.get(cat)?.add(sub);
        }
        setAccountNodes(Array.from(map.entries()).map(([category, subs]) => ({ category, subcategories: Array.from(subs) })));
      })
      .catch(() => setAccountNodes([]));
    return () => {
      alive = false;
    };
  }, []);
  const customNodes = useMemo(loadCustomCategories, []);
  const customCategoryNames = [...customNodes, ...accountNodes].map((node) => node.category);
  const categories = Array.from(new Set([...amazonCategoryNames, ...customCategoryNames, current.category].filter(Boolean))).sort();
  const subcategories = Array.from(new Set([
    ...amazonSubcategoriesFor(current.category),
    ...(customNodes.find((node) => node.category.toLowerCase() === current.category.toLowerCase())?.subcategories || []),
    ...(accountNodes.find((node) => node.category.toLowerCase() === current.category.toLowerCase())?.subcategories || []),
    current.subCategory,
  ].filter(Boolean))).sort();
  const update = (next: { category?: string; subCategory?: string }) => {
    onChange([next.category ?? current.category, next.subCategory ?? current.subCategory].join('|'));
  };
  return (
    <div className="sku-category-editor">
      <input
        className="sku-field-input"
        value={current.category}
        onChange={(e) => update({ category: e.target.value, subCategory: '' })}
        onKeyDown={onKeyDown}
        list="uc-amazon-category-list"
        placeholder="Amazon category"
        autoFocus
      />
      <datalist id="uc-amazon-category-list">
        {categories.map((cat) => <option key={cat} value={cat} />)}
      </datalist>
      <input
        className="sku-field-input"
        value={current.subCategory}
        onChange={(e) => update({ subCategory: e.target.value })}
        onKeyDown={onKeyDown}
        list="uc-amazon-subcategory-list"
        placeholder="Sub-category"
      />
      <datalist id="uc-amazon-subcategory-list">
        {subcategories.map((sub) => <option key={sub} value={sub} />)}
      </datalist>
      <div className="sku-field-help">Amazon category tree suggestions plus custom account values. Enter saves.</div>
    </div>
  );
};

const ImagesEditor = ({
  value,
  onChange,
  onKeyDown,
  uploading,
  onUpload,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  uploading: boolean;
  onUpload: (files: File[]) => Promise<void>;
}) => (
  <div className="sku-images-editor">
    <textarea
      className="sku-field-input textarea"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      rows={3}
      placeholder="One image URL per line"
      autoFocus
    />
    <label className={`sku-upload-control ${uploading ? 'disabled' : ''}`}>
      <Icon name="download" size={12} style={{ transform: 'rotate(180deg)' }} />
      {uploading ? 'Uploading to S3...' : 'Upload image files'}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        disabled={uploading}
        onChange={(event) => {
          void onUpload(Array.from(event.target.files || []));
          event.currentTarget.value = '';
        }}
      />
    </label>
    <div className="sku-field-help">Upload files or paste image links. Shift+Enter adds a new line; Enter saves.</div>
  </div>
);

const SkuIntelligenceStrip = ({
  productIntel,
  recommendations,
  onNavigate,
  onOpenRecommendation,
}: {
  productIntel: ProductResearchResult | null;
  recommendations: OmsRecommendation[];
  onNavigate: ScreenProps['onNavigate'];
  onOpenRecommendation: () => void;
}) => {
  const result = productIntel?.result;
  const missing = result?.missingData || [];
  const hasRec = recommendations.length > 0;
  const requirements = [
    { label: 'Dimensions', met: !missing.includes('dimensions_weight') },
    { label: 'Weight', met: !missing.includes('dimensions_weight') },
    { label: 'Cost', met: !missing.includes('cost') },
    { label: 'Selling price', met: !missing.includes('selling_price') },
    { label: 'Demand source', met: !missing.includes('marketplace_or_csv_demand') },
  ];
  return (
    <div className="sku-intel-minibar">
      <div className="sku-intel-minibar-grid">
        <div className="sku-intel-copy">
          <div className="sku-intel-title">
            <Icon name="sparkle" size={13} />
            Cortex optimization readiness
            {hasRec && <span className="inline-alert"><Icon name="warning" size={11} /> {recommendations.length}</span>}
          </div>
          <div className="sku-intel-requirements" aria-label="Cortex baseline requirements">
            {requirements.map((req) => (
              <span key={req.label} className={`requirement-pill ${req.met ? 'met' : 'missing'}`}>
                {req.met ? <Icon name="check" size={10} /> : <Icon name="warning" size={10} />}
                {req.label}
              </span>
            ))}
          </div>
          <div className="sku-intel-summary">
            {result?.recommendedAction || 'Cortex needs baseline product, cost, price, and demand data before high-confidence optimization.'}
          </div>
        </div>
        <div className="kv">
          <div className="kv-label">Score</div>
          <div className="kv-value" style={{ color: 'var(--purple-text)' }}>{result?.opportunityScore ?? '—'}</div>
        </div>
        <div className="kv">
          <div className="kv-label">Open recs</div>
          <div className="kv-value">{recommendations.length}</div>
        </div>
        {hasRec ? (
          <button className="btn sm primary" onClick={onOpenRecommendation}>
            <Icon name="sparkle" size={13} /> Review Cortex
          </button>
        ) : missing.length ? (
          <button className="btn sm" onClick={() => onNavigate('product-research')} data-hint="Use Product Research only to fill missing enrichment data">
            <Icon name="search" size={13} /> Enrich data
          </button>
        ) : (
          <button className="btn sm" onClick={() => onNavigate('double')}>
            <Icon name="double" size={13} /> Optimize
          </button>
        )}
      </div>
    </div>
  );
};

const Overview = ({ data }: { data: OmsSkuDetail }) => (
  <div className="row-2">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <NextSixShipments data={data} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ChannelBreakdownCard data={data} />
      <RelatedSkusCard data={data} />
    </div>
  </div>
);

const SkuDemandHeatmap = ({ data }: { data: OmsSkuDetail }) => {
  const channels = data.channels || [];
  const warehouses = data.warehouses || [];
  const maxUnits = Math.max(1, ...channels.map((channel) => num(channel.units30d)));
  const totalUnits = channels.reduce((sum, channel) => sum + num(channel.units30d), 0);
  const totalWarehouseUnits = warehouses.reduce((sum, wh) => sum + num(wh.available), 0);
  return (
    <div className="sku-detail-heatmap">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title"><Icon name="grid" size={15} /> SKU demand heatmap</div>
            <div className="card-subtitle">Demand for this active SKU by channel, paired with inventory cover by warehouse.</div>
          </div>
          <Chip tone={totalUnits ? 'green' : 'amber'} dot={false}>{totalUnits ? `${totalUnits.toLocaleString()}u / 30d` : 'No demand signal'}</Chip>
        </div>
        <div className="sku-channel-heat-grid">
          {channels.length === 0 ? (
            <EmptyState>No channel demand data is available for this SKU yet.</EmptyState>
          ) : channels.map((channel) => {
            const units = num(channel.units30d);
            const intensity = Math.min(100, Math.max(0, (units / maxUnits) * 100));
            return (
              <div key={channel.channel} className={`sku-channel-heat ${intensity >= 75 ? 'hot' : intensity >= 35 ? 'warm' : 'cool'}`}>
                <div className="sku-channel-heat-head">
                  <span>{channel.channel}</span>
                  <strong>{Math.round(intensity)}%</strong>
                </div>
                <div className="sku-channel-heat-body">
                  <div>{units.toLocaleString()} units</div>
                  <div>{fmt.money(num(channel.revenue30d), { compact: true })}</div>
                  <div>{Math.round(num(channel.shareOfDemand) * 100)}% share</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title"><Icon name="inventory" size={15} /> Warehouse cover heatmap</div>
            <div className="card-subtitle">Each tile is a warehouse holding this SKU. Red means demand can outrun local cover.</div>
          </div>
          <Chip dot={false}>{totalWarehouseUnits.toLocaleString()} units on hand</Chip>
        </div>
        <div className="sku-warehouse-heat-grid">
          {warehouses.length === 0 ? (
            <EmptyState>No warehouse allocation exists for this SKU.</EmptyState>
          ) : warehouses.map((wh) => {
            const d = num(wh.daysOfCover);
            const tone = d < 14 ? 'hot' : d < 28 ? 'warm' : 'cool';
            return (
              <div key={wh.code} className={`sku-warehouse-heat ${tone}`}>
                <div className="sku-channel-heat-head">
                  <span className="mono">{wh.code}</span>
                  <strong>{Math.round(d)}d</strong>
                </div>
                <div className="sku-channel-heat-body">
                  <div>{num(wh.available).toLocaleString()} on hand</div>
                  <div>{num(wh.inbound).toLocaleString()} inbound</div>
                  <div>{num(wh.velocityPerDay).toFixed(1)} / day</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const NextSixShipments = ({ data }: { data: OmsSkuDetail }) => {
  const ships = data.nextShipments || [];
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <Icon name="shipments" size={15} /> Next 6 shipments
          </div>
          <div className="card-subtitle">Confirmed + AI-planned inbound to your network</div>
        </div>
        <button className="btn ghost sm"><Icon name="plus" size={11} /> Manual</button>
      </div>
      <div style={{ padding: 0 }}>
        {ships.length === 0 && <EmptyState>No inbound shipments planned for this SKU.</EmptyState>}
        {ships.slice(0, 6).map((s, i) => (
          <div
            key={s.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr auto',
              gap: 14,
              padding: '12px 16px',
              borderBottom: i === Math.min(ships.length, 6) - 1 ? 'none' : '1px solid var(--border-subtle)',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{(s.date || '').split('-').slice(1).join('/') || '—'}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{(s.date || '').slice(0, 4)}</div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{s.id}</span>
                <StatusChip status={s.status} />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                {s.origin} → <span className="mono" style={{ fontWeight: 600 }}>{s.destination}</span>
                {s.mode ? ` · ${s.mode}` : ''}
                {s.cube ? ` · ${s.cube}ft³` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{num(s.quantity).toLocaleString()}u</div>
              <button className="btn ghost sm">View</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ChannelBreakdownCard = ({ data }: { data: OmsSkuDetail }) => {
  const channels = data.channels || [];
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Channel breakdown</div>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {channels.length === 0 && <EmptyState>Channel breakdown not yet available for this SKU.</EmptyState>}
        {channels.map((c) => (
          <div key={c.channel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, background: channelColor(c.channel), borderRadius: 2 }} />
                {c.channel}
              </span>
              <span className="mono" style={{ fontSize: 12 }}>
                {num(c.units30d).toLocaleString()}u · {fmt.money(num(c.revenue30d), { compact: true })}
              </span>
            </div>
            <ProgressBar value={num(c.shareOfDemand) * 100} color="accent" height={5} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
              <span>{Math.round(num(c.shareOfDemand) * 100)}% of demand</span>
              <span>Refund rate {(num(c.refundRate) * 100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const RelatedSkusCard = ({ data }: { data: OmsSkuDetail }) => {
  const related = data.relatedSkus || [];
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Related SKUs</div>
      </div>
      <div style={{ padding: 0 }}>
        {related.length === 0 && <EmptyState>No related SKUs.</EmptyState>}
        {related.map((s, i) => (
          <div
            key={s.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              padding: '10px 14px',
              borderBottom: i === related.length - 1 ? 'none' : '1px solid var(--border-subtle)',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.sku}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{s.title || s.sku}</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{Math.round(num(s.daysOfCover))}d</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Warehouses = ({ data }: { data: OmsSkuDetail }) => (
  <div className="table-wrap">
    {data.warehouses.length === 0 ? (
      <EmptyState>No warehouse allocation for this SKU.</EmptyState>
    ) : (
      <table className="data">
        <thead>
          <tr>
            <th>Warehouse</th>
            <th>Region</th>
            <th className="num">On hand</th>
            <th className="num">Inbound</th>
            <th className="num">Velocity /day</th>
            <th>Days of cover</th>
            <th className="num">Storage cost / mo</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.warehouses.map((b) => {
            const d = num(b.daysOfCover);
            const tone = docTone(d);
            return (
              <tr key={b.code}>
                <td className="mono strong">{b.code}</td>
                <td className="muted">{b.region || b.name || '—'}</td>
                <td className="num mono strong">{num(b.available).toLocaleString()}</td>
                <td className="num mono muted">{num(b.inbound) > 0 ? num(b.inbound).toLocaleString() : '—'}</td>
                <td className="num mono">{num(b.velocityPerDay).toFixed(1)}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110 }}>
                    <div className="bar" style={{ flex: 1, height: 5 }}>
                      <div className={`bar-fill ${tone}`} style={{ width: `${Math.min(100, (d / 60) * 100)}%` }} />
                    </div>
                    <span className="mono num" style={{ fontSize: 11.5, color: `var(--${tone}-text)`, fontWeight: 600, minWidth: 28 }}>
                      {Math.round(d)}d
                    </span>
                  </div>
                </td>
                <td className="num mono">{b.storageCost != null ? fmt.money(num(b.storageCost)) : '—'}</td>
                <td>
                  <Chip tone={tone}>{tone === 'green' ? 'Healthy' : tone === 'amber' ? 'Low cover' : 'Stockout risk'}</Chip>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    )}
  </div>
);

const History = ({ data }: { data: OmsSkuDetail }) => {
  const events = data.history || [];
  const typeIcon: Record<string, string> = { ai: 'sparkle', ledger: 'ledger', shipment: 'shipments', billing: 'billing' };
  const typeTone: Record<string, string> = { ai: 'purple', ledger: 'blue', shipment: 'blue', billing: 'amber' };
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Activity history</div>
        <div className="seg">
          <button className="active">All</button>
          <button>AI</button>
          <button>Inventory</button>
          <button>Billing</button>
        </div>
      </div>
      <div style={{ padding: 0 }}>
        {events.length === 0 && <EmptyState>No recorded activity for this SKU yet.</EmptyState>}
        {events.map((e, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '150px 28px 1fr auto',
              gap: 14,
              padding: '12px 16px',
              borderBottom: i === events.length - 1 ? 'none' : '1px solid var(--border-subtle)',
            }}
          >
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{e.ts}</span>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                background: `var(--${typeTone[e.type] || 'blue'}-soft)`,
                color: `var(--${typeTone[e.type] || 'blue'})`,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name={typeIcon[e.type] || 'info'} size={12} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--text)' }}>{e.subject}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{e.actor}</div>
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: e.impact ? (e.impact > 0 ? 'var(--green-text)' : 'var(--red-text)') : 'var(--text-tertiary)',
              }}
            >
              {e.impact ? `${e.impact > 0 ? '+' : ''}${fmt.money(e.impact)}` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Channels = ({ data }: { data: OmsSkuDetail }) => {
  const channels = data.channels || [];
  if (channels.length === 0)
    return (
      <div className="card">
        <div className="card-body"><EmptyState>Per-channel performance not yet available for this SKU.</EmptyState></div>
      </div>
    );
  return (
    <div className="row-2-eq">
      {channels.map((c) => (
        <div key={c.channel} className="card">
          <div className="card-header">
            <div className="card-title">{c.channel}</div>
            <Chip tone="green" dot={false}>Live</Chip>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            <div className="kv"><div className="kv-label">30d units</div><div className="kv-value">{num(c.units30d).toLocaleString()}</div></div>
            <div className="kv"><div className="kv-label">30d revenue</div><div className="kv-value">{fmt.money(num(c.revenue30d), { compact: true })}</div></div>
            <div className="kv"><div className="kv-label">Share of demand</div><div className="kv-value">{Math.round(num(c.shareOfDemand) * 100)}%</div></div>
            <div className="kv"><div className="kv-label">Refund rate</div><div className="kv-value">{(num(c.refundRate) * 100).toFixed(1)}%</div></div>
          </div>
        </div>
      ))}
    </div>
  );
};

const Billing = ({ data }: { data: OmsSkuDetail }) => {
  const b = data.billing;
  const drivers = b?.drivers || [];
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">SKU-level cost · last 30 days</div>
        <Chip dot={false}>WMS-allocated</Chip>
      </div>
      {!b ? (
        <EmptyState>No billing breakdown available for this SKU.</EmptyState>
      ) : (
        <>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div className="kv"><div className="kv-label">Current monthly</div><div className="kv-value">{fmt.money(num(b.currentMonthly))}</div></div>
            <div className="kv"><div className="kv-label">Optimized monthly</div><div className="kv-value" style={{ color: 'var(--purple-text)' }}>{fmt.money(num(b.optimizedMonthly))}</div></div>
            <div className="kv"><div className="kv-label">Savings / mo</div><div className="kv-value" style={{ color: 'var(--green-text)' }}>{fmt.money(num(b.currentMonthly) - num(b.optimizedMonthly))}</div></div>
          </div>
          {drivers.length > 0 && (
            <table className="data">
              <thead>
                <tr>
                  <th>WH</th>
                  <th className="num">Storage</th>
                  <th className="num">Handling</th>
                  <th className="num">Accessorial</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((c, i) => {
                  const total = num(c.storage) + num(c.handling) + num(c.accessorial);
                  return (
                    <tr key={i}>
                      <td className="mono strong">{c.wh}</td>
                      <td className="num mono">{fmt.money(num(c.storage))}</td>
                      <td className="num mono">{fmt.money(num(c.handling))}</td>
                      <td className="num mono">{c.accessorial ? fmt.money(num(c.accessorial)) : '—'}</td>
                      <td className="num mono strong">{fmt.money(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
};
