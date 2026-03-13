interface AsnRow {
  id: string;
  asnNumber: string;
  status: string;
  receivedQuantity?: number;
  createdAt?: string;
}

interface CatalogAsnsTableProps {
  asns?: AsnRow[];
  limit?: number;
}

export function CatalogAsnsTable({ asns, limit = 15 }: CatalogAsnsTableProps) {
  if (!asns || asns.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4">No ASNs found for this item</div>
    );
  }

  const displayAsns = asns.slice(0, limit);

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'received':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'in-transit':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
            <th className="py-3 px-4 font-medium text-gray-700">ASN #</th>
            <th className="py-3 px-4 font-medium text-gray-700">Status</th>
            <th className="py-3 px-4 font-medium text-gray-700">Received Qty</th>
            <th className="py-3 px-4 font-medium text-gray-700">Created</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {displayAsns.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50">
              <td className="py-3 px-4 font-mono text-gray-900">{a.asnNumber}</td>
              <td className="py-3 px-4">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium capitalize ${getStatusClass(
                    a.status
                  )}`}
                >
                  {a.status.replace('-', ' ')}
                </span>
              </td>
              <td className="py-3 px-4 text-gray-700">
                {a.receivedQuantity ?? '—'}
              </td>
              <td className="py-3 px-4 text-gray-500">
                {a.createdAt
                  ? new Date(a.createdAt).toLocaleDateString()
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {asns.length > limit && (
        <p className="text-xs text-gray-500 mt-2">
          Showing {limit} of {asns.length} ASNs
        </p>
      )}
    </div>
  );
}
