import { useState } from 'react';

interface OrderRow {
  id: string;
  orderNumber?: string;
  status: string;
  createdAt?: string;
  actualShipDate?: string;
  customerName?: string;
  total?: number | null;
}

interface CatalogRecentOrdersTableProps {
  orders?: OrderRow[];
  pageSize?: number;
  maxTotal?: number;
}

export function CatalogRecentOrdersTable({
  orders,
  pageSize = 25,
  maxTotal = 75,
}: CatalogRecentOrdersTableProps) {
  const [page, setPage] = useState(0);
  if (!orders || orders.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4">No orders found for this item</div>
    );
  }

  const displayOrders = orders.slice(0, maxTotal);
  const totalPages = Math.ceil(displayOrders.length / pageSize);
  const start = page * pageSize;
  const pageOrders = displayOrders.slice(start, start + pageSize);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
              <th className="py-2 px-3 font-medium text-gray-700">Date</th>
              <th className="py-2 px-3 font-medium text-gray-700">Customer</th>
              <th className="py-2 px-3 font-medium text-gray-700 text-right">Total</th>
              <th className="py-2 px-3 font-medium text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pageOrders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="py-2 px-3 text-gray-700">
                  {o.actualShipDate
                    ? new Date(o.actualShipDate).toLocaleDateString()
                    : o.createdAt
                      ? new Date(o.createdAt).toLocaleDateString()
                      : '—'}
                </td>
                <td className="py-2 px-3 text-gray-900 truncate max-w-[180px]" title={o.customerName || '—'}>
                  {o.customerName || '—'}
                </td>
                <td className="py-2 px-3 text-right text-gray-700">
                  {o.total != null ? `$${Number(o.total).toFixed(2)}` : '—'}
                </td>
                <td className="py-2 px-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                      o.status === 'shipped' || o.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : o.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {o.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>
            Showing {start + 1}-{Math.min(start + pageSize, displayOrders.length)} of{' '}
            {displayOrders.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
