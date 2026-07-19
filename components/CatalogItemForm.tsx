import { useState } from 'react';
import { Button } from './Button';
import type { CatalogItem } from '../lib/catalog-types';
import type { Supplier } from '../lib/amazon-fba';
import { uploadCatalogImage } from '../lib/oms';

interface CatalogItemFormProps {
  item?: CatalogItem | null;
  /** True when `item` is an existing catalog item being edited (locks + preserves its SKU).
   *  False when `item` merely supplies prefill data (e.g. from Keepa) for a new product.
   *  Defaults to `!!item` so existing edit-flow callers are unaffected. */
  isEditing?: boolean;
  suppliers: Supplier[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CatalogItemForm({
  item,
  isEditing,
  suppliers,
  onSubmit,
  onCancel,
  isLoading = false,
}: CatalogItemFormProps) {
  const editing = isEditing ?? !!item;
  const [formData, setFormData] = useState({
    sku: item?.sku || '',
    title: item?.title || '',
    description: item?.description || '',
    image: item?.image || '',
    upc: item?.upc || '',
    ean: item?.ean || '',
    asin: item?.asin || '',
    category: item?.category || '',
    subCategory: item?.subCategory || '',
    lob: item?.lob || '',
    weight: item?.weight != null ? String(item.weight) : '',
    length: item?.dimensions?.length != null ? String(item.dimensions.length) : '',
    width: item?.dimensions?.width != null ? String(item.dimensions.width) : '',
    height: item?.dimensions?.height != null ? String(item.dimensions.height) : '',
    supplierId: item?.supplierId || '',
    tags: Array.isArray(item?.tags) ? item.tags.join(', ') : '',
  });

  const [imagePreview, setImagePreview] = useState<string | null>(item?.image || null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const handleImageUrlChange = (url: string) => {
    setFormData((prev) => ({ ...prev, image: url }));
    setImagePreview(url || null);
  };

  const handleImageFile = async (file?: File | null) => {
    if (!file) return;
    setImageUploading(true);
    setImageError(null);
    const localPreview = URL.createObjectURL(file);
    setImagePreview(localPreview);
    try {
      const uploaded = await uploadCatalogImage(file);
      setFormData((prev) => ({ ...prev, image: uploaded.url }));
      setImagePreview(uploaded.url);
    } catch (err: any) {
      setImageError(err?.message || 'Image upload failed');
      setImagePreview(formData.image || null);
    } finally {
      setImageUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      sku: formData.sku.trim(),
      title: formData.title.trim(),
      description: formData.description || undefined,
      image: formData.image || undefined,
      upc: formData.upc || undefined,
      ean: formData.ean || undefined,
      asin: formData.asin || undefined,
      category: formData.category || undefined,
      subCategory: formData.subCategory || undefined,
      lob: formData.lob || undefined,
      weight: formData.weight ? parseFloat(formData.weight) : undefined,
      dimensions:
        formData.length || formData.width || formData.height
          ? {
              length: formData.length ? parseFloat(formData.length) : undefined,
              width: formData.width ? parseFloat(formData.width) : undefined,
              height: formData.height ? parseFloat(formData.height) : undefined,
            }
          : undefined,
      supplierId: formData.supplierId || null,
      tags: formData.tags
        ? formData.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
    };
    if (editing) {
      delete payload.sku;
    }
    await onSubmit(payload);
  };

  const formField = 'mb-4';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';
  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Image */}
        <div className={formField}>
          <label className={labelClass}>Product image</label>
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-24 h-24 object-contain rounded-lg border border-gray-200 bg-gray-50"
                  onError={() => setImagePreview(null)}
                />
              ) : (
                <div className="w-24 h-24 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-400 text-xs">
                  No image
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  void handleImageFile(e.target.files?.[0]);
                  e.currentTarget.value = '';
                }}
                className={inputClass}
                disabled={imageUploading}
              />
              <div className="text-xs text-gray-500">
                {imageUploading ? 'Uploading to S3...' : formData.image ? 'Stored in S3 for this OMS account.' : 'Upload PNG, JPG, WebP, or GIF.'}
              </div>
              {imageError && <div className="text-xs text-red-600 font-medium">{imageError}</div>}
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer">Advanced: use existing image URL</summary>
                <input
                  type="url"
                  value={formData.image}
                  onChange={(e) => handleImageUrlChange(e.target.value)}
                  placeholder="https://..."
                  className={`${inputClass} mt-2`}
                />
              </details>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="md:col-span-2">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={formField}>
              <label className={labelClass}>SKU *</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData((p) => ({ ...p, sku: e.target.value }))}
                required
                disabled={editing}
                placeholder="e.g. SKU-001"
                className={inputClass}
              />
              {editing && (
                <p className="text-xs text-gray-500 mt-1">SKU cannot be changed after creation.</p>
              )}
            </div>
            <div className={formField}>
              <label className={labelClass}>Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                required
                placeholder="Product title"
                className={inputClass}
              />
            </div>
            <div className={`${formField} md:col-span-2`}>
              <label className={labelClass}>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Product description"
                rows={3}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Product Identifiers */}
        <div className="md:col-span-2">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Product Identifiers</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={formField}>
              <label className={labelClass}>UPC</label>
              <input
                type="text"
                value={formData.upc}
                onChange={(e) => setFormData((p) => ({ ...p, upc: e.target.value }))}
                placeholder="UPC"
                className={inputClass}
              />
            </div>
            <div className={formField}>
              <label className={labelClass}>EAN</label>
              <input
                type="text"
                value={formData.ean}
                onChange={(e) => setFormData((p) => ({ ...p, ean: e.target.value }))}
                placeholder="EAN"
                className={inputClass}
              />
            </div>
            <div className={formField}>
              <label className={labelClass}>ASIN</label>
              <input
                type="text"
                value={formData.asin}
                onChange={(e) => setFormData((p) => ({ ...p, asin: e.target.value }))}
                placeholder="ASIN"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Categorization */}
        <div className="md:col-span-2">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Categorization</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={formField}>
              <label className={labelClass}>Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                placeholder="Category"
                className={inputClass}
              />
            </div>
            <div className={formField}>
              <label className={labelClass}>Sub-category</label>
              <input
                type="text"
                value={formData.subCategory}
                onChange={(e) => setFormData((p) => ({ ...p, subCategory: e.target.value }))}
                placeholder="Sub-category"
                className={inputClass}
              />
            </div>
            <div className={formField}>
              <label className={labelClass}>Line of Business</label>
              <input
                type="text"
                value={formData.lob}
                onChange={(e) => setFormData((p) => ({ ...p, lob: e.target.value }))}
                placeholder="LOB"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Physical Properties */}
        <div className="md:col-span-2">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Physical Properties</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={formField}>
              <label className={labelClass}>Weight (lbs)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.weight}
                onChange={(e) => setFormData((p) => ({ ...p, weight: e.target.value }))}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            <div className={formField}>
              <label className={labelClass}>Length (in)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.length}
                onChange={(e) => setFormData((p) => ({ ...p, length: e.target.value }))}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            <div className={formField}>
              <label className={labelClass}>Width (in)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.width}
                onChange={(e) => setFormData((p) => ({ ...p, width: e.target.value }))}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            <div className={formField}>
              <label className={labelClass}>Height (in)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.height}
                onChange={(e) => setFormData((p) => ({ ...p, height: e.target.value }))}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Other */}
        <div className="md:col-span-2">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Other</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={formField}>
              <label className={labelClass}>Supplier</label>
              <select
                value={formData.supplierId}
                onChange={(e) => setFormData((p) => ({ ...p, supplierId: e.target.value }))}
                className={inputClass}
              >
                <option value="">None</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={formField}>
              <label className={labelClass}>Tags</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData((p) => ({ ...p, tags: e.target.value }))}
                placeholder="tag1, tag2"
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={isLoading || !formData.title.trim() || (!editing && !formData.sku.trim())}
        >
          {isLoading ? 'Saving...' : editing ? 'Save' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
