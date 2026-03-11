import Link from 'next/link';
import { Package } from 'lucide-react';
import ChannelBadge from './ChannelBadge';
import type { CatalogItem } from '../lib/catalog-types';
import type { Supplier } from '../lib/amazon-fba';

interface CatalogItemViewProps {
  item: CatalogItem;
  supplierName?: string;
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h3 className="text-base font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  );
}

export function CatalogItemView({ item, supplierName }: CatalogItemViewProps) {
  return (
    <div className="space-y-6">
      {/* Image and Basic Info */}
      <div className="flex gap-6">
        {item.image && (
          <div className="flex-shrink-0">
            <img
              src={item.image}
              alt={item.title}
              className="w-32 h-32 object-contain rounded-lg border border-gray-200 bg-gray-50"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="flex-1 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500">SKU</div>
            <div className="text-sm font-mono font-medium text-gray-900">{item.sku}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Title</div>
            <div className="text-sm font-semibold text-gray-900">{item.title || '—'}</div>
          </div>
          <div className="col-span-2">
            <div className="text-xs text-gray-500">Description</div>
            <div className="text-sm text-gray-900">{item.description || '—'}</div>
          </div>
          {supplierName && (
            <div>
              <div className="text-xs text-gray-500">Supplier</div>
              <div className="text-sm text-gray-900">{supplierName}</div>
            </div>
          )}
        </div>
      </div>

      <DetailSection title="Identifiers">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DetailField label="UPC" value={item.upc} />
          <DetailField label="EAN" value={item.ean} />
          <DetailField label="ASIN" value={item.asin} />
        </div>
      </DetailSection>

      <DetailSection title="Categorization">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <DetailField label="Category" value={item.category} />
          <DetailField label="Sub-category" value={item.subCategory} />
          <DetailField label="Line of Business" value={item.lob} />
        </div>
      </DetailSection>

      <DetailSection title="Physical Properties">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DetailField label="Weight (lbs)" value={item.weight} />
          <DetailField label="Length (in)" value={item.dimensions?.length} />
          <DetailField label="Width (in)" value={item.dimensions?.width} />
          <DetailField label="Height (in)" value={item.dimensions?.height} />
        </div>
      </DetailSection>

      {item.mappings && item.mappings.length > 0 && (
        <DetailSection title="Channel Mappings">
          <div className="flex gap-2 flex-wrap">
            {item.mappings.map((m, i) => (
              <ChannelBadge key={i} channel={m.channel} label={m.channelDisplay} />
            ))}
          </div>
        </DetailSection>
      )}

      <div>
        <Link
          href={`/items/${item._id}/shipment-activity`}
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <Package className="w-4 h-4" />
          View Shipment Activity
        </Link>
      </div>
    </div>
  );
}
