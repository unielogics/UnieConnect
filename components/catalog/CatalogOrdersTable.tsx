interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  createdAt?: string;
  actualShipDate?: string;
  quantity: number;
  quantityShipped: number;
}

interface CatalogOrdersTableProps {
  orders?: OrderRow[];
  limit?: number;
}

export function CatalogOrdersTable({ orders, limit = 15 }: CatalogOrdersTableProps) {
  if (!orders || orders.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4">No orders found for this item</div>
    );
  }

  const displayOrders = orders.slice(0, limit);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
            <th className="py-3 px-4 font-medium text-gray-700">Order</th>
            <th className="py-3 px-4 font-medium text-gray-700">Status</th>
            <th className="py-3 px-4 font-medium text-gray-700">Qty</th>
            <th className="py-3 px-4 font-medium text-gray-700">Shipped</th>
            <th className="py-3 px-4 font-medium text-gray-700">Date</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {displayOrders.map((o) => (
            <tr key={o.id} className="hover:bg-gray-50">
              <td className="py-3 px-4 font-mono text-gray-900">{o.orderNumber}</td>
              <td className="py-3 px-4">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium capitalize ${
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
              <td className="py-3 px-4 text-gray-700">{o.quantity}</td>
              <td className="py-3 px-4 text-gray-700">{o.quantityShipped ?? 0}</td>
              <td className="py-3 px-4 text-gray-500">
                {o.actualShipDate
                  ? new Date(o.actualShipDate).toLocaleDateString()
                  : o.createdAt
                    ? new Date(o.createdAt).toLocaleDateString()
                    : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length > limit && (
        <p className="text-xs text-gray-500 mt-2">
          Showing {limit} of {orders.length} orders
        </p>
      )}
    </div>
  );
}
