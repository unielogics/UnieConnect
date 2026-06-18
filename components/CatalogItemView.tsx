import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Hash, Tag, Ruler, Box, Activity, ShoppingCart } from 'lucide-react';
import ChannelBadge from './ChannelBadge';
import { CatalogInventorySnapshot } from './catalog/CatalogInventorySnapshot';
import { CatalogInventoryByWarehouse } from './catalog/CatalogInventoryByWarehouse';
import { CatalogRecentOrdersTable } from './catalog/CatalogRecentOrdersTable';
import { CatalogOrdersTable } from './catalog/CatalogOrdersTable';
import { CatalogAsnsTable } from './catalog/CatalogAsnsTable';
import { CatalogActivityFeed } from './catalog/CatalogActivityFeed';
import { apiUrl, TOKEN_KEY } from '../lib/api';
import type { CatalogItem } from '../lib/catalog-types';

interface WmsInventory {
  inbound: number;
  received: number;
  available: number;
  orders: number;
  shippedToday: number;
  openAsnsCount?: number;
  receiving?: number;
}

interface WmsActivities {
  summary?: { inbound: number; active: number; processing: number; shipped: number; ordersToday: number; ordersLast7Days: number };
  activityLogs?: Array<{ id: string; timestamp: string; action: string; userName: string; details?: unknown; entityType?: string }>;
  orders?: Array<{ id: string; orderNumber?: string; status: string; createdAt?: string; actualShipDate?: string; quantity?: number; quantityShipped?: number; customerName?: string; total?: number | null }>;
  asns?: Array<{ id: string; asnNumber: string; status: string; receivedQuantity?: number; createdAt?: string }>;
  tasks?: Array<{ id: string; type: string; status: string; priority?: string; createdAt?: string; completedAt?: string }>;
  wmsInventory?: WmsInventory;
  inventoryByWarehouse?: Array<{ warehouseCode: string; warehouseName?: string; inventory: WmsInventory }>;
}

interface CatalogItemViewProps {
  item: CatalogItem;
  supplierName?: string;
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
        {Icon && <Icon className="w-4 h-4 text-gray-500" />}
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div>
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  );
}

const allImages = (item: CatalogItem): string[] => {
  const list: string[] = [];
  if (item.image) list.push(item.image);
  if (item.images?.length) list.push(...item.images.filter((u) => u && !list.includes(u)));
  return list;
};

export function CatalogItemView({ item, supplierName }: CatalogItemViewProps) {
  const images = allImages(item);
  const mainImage = images[0];
  const keepaUnavailable = item.keepaUnavailable || item.enrichmentMarker === '*';
  const keepaMarker = keepaUnavailable ? (
    <span
      title="Keepa enrichment unavailable; Cortex will use manual/marketplace data."
      aria-label="Keepa enrichment unavailable"
      className="ml-1 font-black text-amber-600"
    >
      *
    </span>
  ) : null;
  const [wmsActivities, setWmsActivities] = useState<WmsActivities | null>(null);
  const [wmsLoading, setWmsLoading] = useState(false);

  useEffect(() => {
    if (!item.sku) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;
    setWmsLoading(true);
    fetch(apiUrl(`/api/v1/items/${item._id}/wms-activities`), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setWmsActivities(data || null))
      .catch(() => setWmsActivities(null))
      .finally(() => setWmsLoading(false));
  }, [item._id, item.sku]);

  return (
    <div className="space-y-6">
      {/* Inventory by warehouse - top */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
          <Activity className="w-4 h-4 text-gray-500" />
          Inventory
        </h3>
        {wmsLoading ? (
          <div className="text-sm text-gray-500">Loading inventory...</div>
        ) : wmsActivities?.inventoryByWarehouse && wmsActivities.inventoryByWarehouse.length > 0 ? (
          <CatalogInventoryByWarehouse
            inventoryByWarehouse={wmsActivities.inventoryByWarehouse}
          />
        ) : wmsActivities?.wmsInventory ? (
          <CatalogInventorySnapshot wmsInventory={wmsActivities.wmsInventory} />
        ) : (
          <div className="text-sm text-gray-500 py-4">
            Connect a warehouse to see inventory. Go to Settings to link your OMS account to a WMS warehouse.
          </div>
        )}
      </div>

      {/* Hero: large image + core info (Shopify-style) */}
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="flex-shrink-0 flex flex-col gap-2">
          <div className="relative w-full sm:w-56 aspect-square rounded-xl border border-gray-200 bg-white overflow-hidden">
            {mainImage ? (
              <img
                src={mainImage}
                alt={item.title}
                className="w-full h-full object-contain p-2"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <Box className="w-16 h-16" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.slice(0, 5).map((src, i) => (
                <button
                  key={i}
                  type="button"
                  className="flex-shrink-0 w-12 h-12 rounded-lg border border-gray-200 overflow-hidden"
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 font-mono mb-1">
            SKU {item.sku}
            {keepaMarker}
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {item.title || 'Untitled'}
            {keepaMarker}
          </h2>
          {keepaUnavailable && (
            <p className="text-xs font-medium text-amber-700 mb-3">
              Keepa enrichment unavailable; using manual/marketplace data.
            </p>
          )}
          {item.description && (
            <p className="text-sm text-gray-600 line-clamp-4 mb-4">{item.description}</p>
          )}
          {supplierName && (
            <p className="text-sm text-gray-500">Supplier: {supplierName}</p>
          )}
          {item.mappings && item.mappings.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-3">
              {item.mappings.map((m, i) => (
                <ChannelBadge key={i} channel={m.channel} label={m.channelDisplay} />
              ))}
            </div>
          )}
          {(item.createdAt || item.updatedAt) && (
            <div className="mt-4 text-xs text-gray-400">
              {item.updatedAt && `Updated ${new Date(item.updatedAt).toLocaleDateString()}`}
              {item.createdAt && item.updatedAt && ' · '}
              {item.createdAt && `Created ${new Date(item.createdAt).toLocaleDateString()}`}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailSection title="Identifiers" icon={Hash}>
          <div className="grid grid-cols-2 gap-3">
            <DetailField label="UPC" value={item.upc} />
            <DetailField label="EAN" value={item.ean} />
            <DetailField label="ASIN" value={item.asin} />
          </div>
        </DetailSection>

        <DetailSection title="Categorization" icon={Tag}>
          <div className="grid grid-cols-2 gap-3">
            <DetailField label="Category" value={item.category} />
            <DetailField label="Sub-category" value={item.subCategory} />
            <DetailField label="Line of Business" value={item.lob} />
          </div>
        </DetailSection>

        <DetailSection title="Product Details" icon={Ruler}>
          <div className="grid grid-cols-2 gap-3">
            <DetailField label="Weight (lbs)" value={item.weight} />
            <DetailField label="Length (in)" value={item.dimensions?.length} />
            <DetailField label="Width (in)" value={item.dimensions?.width} />
            <DetailField label="Height (in)" value={item.dimensions?.height} />
          </div>
        </DetailSection>

        <DetailSection title="Recent Orders" icon={ShoppingCart}>
          <CatalogRecentOrdersTable
            orders={wmsActivities?.orders}
            pageSize={25}
            maxTotal={75}
          />
        </DetailSection>
      </div>

      {/* Warehouse Activity, Orders, ASNs */}
      <div className="space-y-6">
        {/* Warehouse Activity Summary (mirror WMS) */}
        {wmsActivities?.summary && (
            <DetailSection title="Warehouse Activity" icon={Activity}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="text-xs text-gray-500 uppercase">Inbound</div>
                  <div className="text-lg font-semibold">{wmsActivities.summary.inbound ?? '—'}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="text-xs text-gray-500 uppercase">Active</div>
                  <div className="text-lg font-semibold">{wmsActivities.summary.active ?? '—'}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="text-xs text-gray-500 uppercase">Processing</div>
                  <div className="text-lg font-semibold">{wmsActivities.summary.processing ?? '—'}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="text-xs text-gray-500 uppercase">Shipped</div>
                  <div className="text-lg font-semibold">{wmsActivities.summary.shipped ?? '—'}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="text-xs text-gray-500 uppercase">Orders Today</div>
                  <div className="text-lg font-semibold">{wmsActivities.summary.ordersToday ?? '—'}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="text-xs text-gray-500 uppercase">Last 7 Days</div>
                  <div className="text-lg font-semibold">{wmsActivities.summary.ordersLast7Days ?? '—'}</div>
                </div>
              </div>
            </DetailSection>
          )}

          {/* Orders table */}
          {wmsActivities?.orders && (
            <DetailSection title="Recent Orders" icon={ShoppingCart}>
              <CatalogOrdersTable
                orders={wmsActivities.orders.map((o) => ({
                  ...o,
                  orderNumber: o.orderNumber ?? o.id ?? '',
                  quantity: o.quantity ?? 0,
                  quantityShipped: o.quantityShipped ?? 0,
                }))}
              />
            </DetailSection>
          )}

          {/* ASNs table */}
          {wmsActivities?.asns && (
            <DetailSection title="Inbound ASNs" icon={Package}>
              <CatalogAsnsTable asns={wmsActivities.asns} />
            </DetailSection>
          )}

          {/* Activity log */}
          {wmsActivities?.activityLogs && wmsActivities.activityLogs.length > 0 && (
            <DetailSection title="Activity Log" icon={Activity}>
              <CatalogActivityFeed activityLogs={wmsActivities.activityLogs} />
            </DetailSection>
          )}
      </div>

      <div>
        <Link
          href={`/items/${item._id}/shipment-activity`}
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          <Package className="w-4 h-4" />
          View Shipment Activity
        </Link>
      </div>
    </div>
  );
}
