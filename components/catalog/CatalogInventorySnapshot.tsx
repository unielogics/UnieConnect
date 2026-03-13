interface WmsInventory {
  inbound: number;
  received: number;
  available: number;
  orders: number;
  shippedToday: number;
  openAsnsCount?: number;
  receiving?: number;
}

interface CatalogInventorySnapshotProps {
  wmsInventory?: WmsInventory | null;
  reorderThreshold?: number;
}

export function CatalogInventorySnapshot({
  wmsInventory,
  reorderThreshold = 10,
}: CatalogInventorySnapshotProps) {
  if (!wmsInventory) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        No inventory data available
      </div>
    );
  }

  const totalQuantity = wmsInventory.available + wmsInventory.orders;
  const available = wmsInventory.available;

  const getAvailableColor = () => {
    if (available === 0) return 'text-red-600';
    if (available <= reorderThreshold) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getTotalColor = () => {
    if (totalQuantity === 0) return 'text-red-600';
    if (available <= reorderThreshold) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="text-sm font-medium text-gray-600 mb-1">Total Quantity</div>
        <div className={`text-2xl font-bold ${getTotalColor()}`}>
          {totalQuantity}
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="text-sm font-medium text-gray-600 mb-1">Reserved</div>
        <div className="text-2xl font-bold text-blue-600">
          {wmsInventory.orders}
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="text-sm font-medium text-gray-600 mb-1">Available</div>
        <div className={`text-2xl font-bold ${getAvailableColor()}`}>
          {available}
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="text-sm font-medium text-gray-600 mb-1">Inbound</div>
        <div className="text-2xl font-bold text-gray-900">
          {wmsInventory.inbound}
        </div>
      </div>
    </div>
  );
}
