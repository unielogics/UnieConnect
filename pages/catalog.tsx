import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../components/DashboardLayout';
import { Modal } from '../components/Modal';
import { ViewModal } from '../components/ViewModal';
import { Button } from '../components/Button';
import ChannelBadge from '../components/ChannelBadge';
import ChannelFilter from '../components/ChannelFilter';
import { CatalogItemForm } from '../components/CatalogItemForm';
import { CatalogItemView } from '../components/CatalogItemView';
import { CreateShipmentPlanModal } from '../components/CreateShipmentPlanModal';
import { apiUrl, TOKEN_KEY } from '../lib/api';
import { fetchShipFromLocations, fetchSuppliers } from '../lib/amazon-fba';
import type { ShipFromLocation, Supplier } from '../lib/amazon-fba';
import type { CatalogItem } from '../lib/catalog-types';

export type CatalogProduct = {
  id: string;
  sku: string;
  title: string;
  asin?: string;
  imageUrl?: string;
  source: 'item' | 'amazon';
  supplierId?: string;
  supplierName?: string;
  wmsInventory?: {
    inbound: number;
    received: number;
    available: number;
    orders: number;
    shippedToday: number;
    openAsnsCount?: number;
    receiving?: number;
  };
};

type SortField =
  | 'inbound'
  | 'openAsnsCount'
  | 'receiving'
  | 'available'
  | 'shippedToday'
  | 'orders';

async function fetchItems(
  token: string,
  channel?: string
): Promise<CatalogItem[]> {
  const url = new URL(apiUrl('/api/v1/items'));
  url.searchParams.set('includeMappings', '1');
  if (channel?.startsWith('account:')) url.searchParams.set('channelAccountId', channel.replace(/^account:/, ''));
  else if (channel) url.searchParams.set('channel', channel);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchItemDetail(
  token: string,
  id: string
): Promise<CatalogItem | null> {
  const res = await fetch(apiUrl(`/api/v1/items/${encodeURIComponent(id)}`), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return res.json();
}

async function createItem(
  token: string,
  body: Record<string, unknown>
) {
  const res = await fetch(apiUrl('/api/v1/items'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || 'Failed to create item');
  }
  return res.json();
}

async function updateItem(
  token: string,
  id: string,
  body: Record<string, unknown>
) {
  const res = await fetch(apiUrl(`/api/v1/items/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || 'Failed to update item');
  }
  return res.json();
}

export default function CatalogPage() {
  const router = useRouter();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [locations, setLocations] = useState<ShipFromLocation[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [selected, setSelected] = useState<Record<string, CatalogProduct>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [detailItem, setDetailItem] = useState<CatalogItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [createPlanModalOpen, setCreatePlanModalOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('available');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const loadData = async () => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;
    try {
      const [itemsResult, locsResult, suppsResult] = await Promise.allSettled([
        fetchItems(token, channelFilter || undefined),
        fetchShipFromLocations(),
        fetchSuppliers(),
      ]);
      setItems(itemsResult.status === 'fulfilled' ? itemsResult.value : []);
      setLocations(locsResult.status === 'fulfilled' ? locsResult.value : []);
      setSuppliers(suppsResult.status === 'fulfilled' ? suppsResult.value : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [channelFilter]);

  const supplierById = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers]
  );

  const products: CatalogProduct[] = useMemo(() => {
    return items.map((i) => ({
      id: i._id,
      sku: i.sku,
      title: i.title,
      asin: i.asin,
      imageUrl: i.image,
      source: 'item' as const,
      supplierId: i.supplierId,
      supplierName: i.supplierId ? supplierById.get(i.supplierId)?.name : undefined,
      wmsInventory: (i as any).wmsInventory,
    }));
  }, [items, supplierById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.sku.toLowerCase().includes(q) ||
        (p.title || '').toLowerCase().includes(q) ||
        (p.asin || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const getVal = (p: CatalogProduct) => {
      const w = p.wmsInventory;
      if (!w) return 0;
      switch (sortField) {
        case 'inbound': return w.inbound ?? 0;
        case 'openAsnsCount': return w.openAsnsCount ?? 0;
        case 'receiving': return w.receiving ?? 0;
        case 'available': return w.available ?? 0;
        case 'shippedToday': return w.shippedToday ?? 0;
        case 'orders': return w.orders ?? 0;
        default: return 0;
      }
    };
    list.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (sortDir === 'asc') return va - vb;
      return vb - va;
    });
    return list;
  }, [filtered, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortHeader = ({
    field,
    label,
  }: {
    field: SortField;
    label: string;
  }) => (
    <th
      className="py-3 px-4 w-20 font-medium text-gray-900 text-center cursor-pointer select-none hover:bg-gray-50"
      onClick={() => handleSort(field)}
      role="columnheader"
      aria-sort={sortField === field ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field ? (
          sortDir === 'asc' ? (
            <span className="text-gray-500">↑</span>
          ) : (
            <span className="text-gray-500">↓</span>
          )
        ) : (
          <span className="text-gray-300">↕</span>
        )}
      </span>
    </th>
  );

  const toggleSelect = (p: CatalogProduct) => {
    setSelected((prev) => {
      const next = { ...prev };
      const key = p.sku || p.id;
      if (next[key]) delete next[key];
      else next[key] = p;
      return next;
    });
  };

  const selectedList = Object.values(selected);
  const createPlanInitialItems = selectedList.map((p) => ({
    sku: p.sku,
    title: p.title,
    asin: p.asin,
    imageUrl: p.imageUrl,
    itemId: p.id,
  }));

  const openAddModal = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const openEditModal = (item: CatalogItem) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItem(null);
  };

  const openDetail = async (id: string) => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;
    setDetailLoading(true);
    setDetailItem(null);
    router.replace(`/catalog?id=${id}`, undefined, { shallow: true });
    try {
      const item = await fetchItemDetail(token, id);
      setDetailItem(item || null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailItem(null);
    if (router.query.id) router.replace('/catalog', undefined, { shallow: true });
  };

  useEffect(() => {
    const id = typeof router.query.id === 'string' ? router.query.id : null;
    if (id && !detailLoading && detailItem?._id !== id) void openDetail(id);
  }, [router.query.id]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;
    setSaving(true);
    setMessage(null);
    try {
      if (editingItem) {
        await updateItem(token, editingItem._id, data);
        setMessage({ type: 'success', text: 'Item updated.' });
      } else {
        await createItem(token, data);
        setMessage({ type: 'success', text: 'Item created.' });
      }
      closeModal();
      await loadData();
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Something went wrong.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      title="Catalog"
      subtitle="Manage your product catalog and select products for shipment plans"
    >
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-5">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="search"
              placeholder="Search by SKU, title, ASIN"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[220px]"
            />
            <ChannelFilter
              value={channelFilter}
              onChange={setChannelFilter}
              includeUnmapped
            />
          </div>
          <div className="flex gap-3 items-center">
            <span className="text-sm text-gray-500">
              {selectedList.length} selected
            </span>
            <Link href="/shipment-plans" className="button-secondary">
              View plans
            </Link>
            <Button
              variant="primary"
              onClick={() => setCreatePlanModalOpen(true)}
            >
              Create Shipment Plan
            </Button>
            <Button variant="primary" onClick={openAddModal}>
              Add item
            </Button>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-lg px-4 py-3 text-sm mb-4 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="text-gray-500">Loading catalog...</div>
        ) : filtered.length === 0 ? (
          <div className="text-gray-500">
            No products found. Add your first item to get started or connect
            Amazon to sync catalog.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-4 w-16 font-medium text-gray-900">
                    Image
                  </th>
                  <th className="py-3 px-4 font-medium text-gray-900">SKU</th>
                  <th className="py-3 px-4 font-medium text-gray-900">Title</th>
                  <th className="py-3 px-4 font-medium text-gray-900">
                    Channels
                  </th>
                  <th className="py-3 px-4 font-medium text-gray-900">Supplier</th>
                  <SortHeader field="inbound" label="Inbound" />
                  <SortHeader field="openAsnsCount" label="Open ASNs" />
                  <SortHeader field="receiving" label="Receiving" />
                  <SortHeader field="available" label="In Stock" />
                  <SortHeader field="shippedToday" label="Shipped Today" />
                  <SortHeader field="orders" label="Open Orders" />
                  <th className="py-3 px-4 w-32 font-medium text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => {
                  const item = items.find((i) => i._id === p.id);
                  const key = p.sku || p.id;
                  const isSel = Boolean(selected[key]);
                  return (
                    <tr
                      key={key}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        isSel ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSelect(p)}
                          aria-label={`Select ${p.sku}`}
                          className="rounded"
                        />
                      </td>
                      <td className="py-3 px-4">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="w-10 h-10 object-contain rounded border border-gray-200"
                            onError={(e) => {
                              const t = e.target as HTMLImageElement;
                              t.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300 text-xs">
                            —
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {p.sku}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {p.title || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {item?.channels && item.channels.length > 0 ? (
                            item.channels.map((ch) => (
                              <ChannelBadge key={ch} channel={ch} />
                            ))
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {p.supplierName || '—'}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-700">
                        {p.wmsInventory ? p.wmsInventory.inbound : '—'}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-700">
                        {p.wmsInventory ? (p.wmsInventory.openAsnsCount ?? '—') : '—'}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-700">
                        {p.wmsInventory ? (p.wmsInventory.receiving ?? '—') : '—'}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-700">
                        {p.wmsInventory ? p.wmsInventory.available : '—'}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-700">
                        {p.wmsInventory ? p.wmsInventory.shippedToday : '—'}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-700">
                        {p.wmsInventory ? p.wmsInventory.orders : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void openDetail(p.id)}
                          >
                            View
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => item && openEditModal(item)}
                          >
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingItem ? 'Edit item' : 'Add item'}
        size="xl"
      >
        <CatalogItemForm
          item={editingItem}
          suppliers={suppliers}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          isLoading={saving}
        />
      </Modal>

      {/* View Modal */}
      <CreateShipmentPlanModal
        isOpen={createPlanModalOpen}
        onClose={() => setCreatePlanModalOpen(false)}
        initialItems={createPlanInitialItems}
      />

      {(detailItem !== null || detailLoading) && (
        <ViewModal
          isOpen
          onClose={closeDetail}
          title={
            detailLoading
              ? 'Item details'
              : detailItem
                ? `${detailItem.sku} – ${detailItem.title || 'Item'}`
                : 'Item details'
          }
          onEdit={
            detailItem
              ? () => {
                  closeDetail();
                  openEditModal(detailItem);
                }
              : undefined
          }
        >
          {detailLoading ? (
            <div className="text-gray-500">Loading...</div>
          ) : detailItem ? (
            <CatalogItemView
              item={detailItem}
              supplierName={
                detailItem.supplierId
                  ? supplierById.get(detailItem.supplierId)?.name
                  : undefined
              }
            />
          ) : null}
        </ViewModal>
      )}
    </DashboardLayout>
  );
}
