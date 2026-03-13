interface WarehouseInventory {
  warehouseCode: string;
  warehouseName?: string;
  inventory: {
    inbound: number;
    received: number;
    available: number;
    orders: number;
    shippedToday: number;
    openAsnsCount?: number;
    receiving?: number;
  };
}

interface CatalogInventoryByWarehouseProps {
  inventoryByWarehouse?: WarehouseInventory[];
}

export function CatalogInventoryByWarehouse({
  inventoryByWarehouse,
}: CatalogInventoryByWarehouseProps) {
  if (!inventoryByWarehouse || inventoryByWarehouse.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
            <th className="py-2 px-3 font-medium text-gray-700">Warehouse</th>
            <th className="py-2 px-3 font-medium text-gray-700 text-right">In Stock</th>
            <th className="py-2 px-3 font-medium text-gray-700 text-right">Reserved</th>
            <th className="py-2 px-3 font-medium text-gray-700 text-right">Inbound</th>
            <th className="py-2 px-3 font-medium text-gray-700 text-right">Receiving</th>
            <th className="py-2 px-3 font-medium text-gray-700 text-right">Open ASNs</th>
            <th className="py-2 px-3 font-medium text-gray-700 text-right">Shipped Today</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {inventoryByWarehouse.map((wh) => {
            const inv = wh.inventory;
            const inStock = (inv?.available ?? 0) + (inv?.orders ?? 0);
            return (
              <tr key={wh.warehouseCode} className="hover:bg-gray-50">
                <td className="py-2 px-3 font-medium text-gray-900">
                  {wh.warehouseName || wh.warehouseCode}
                </td>
                <td className="py-2 px-3 text-right font-medium">{inStock}</td>
                <td className="py-2 px-3 text-right text-blue-600">
                  {inv?.orders ?? 0}
                </td>
                <td className="py-2 px-3 text-right">{inv?.inbound ?? 0}</td>
                <td className="py-2 px-3 text-right">{inv?.receiving ?? 0}</td>
                <td className="py-2 px-3 text-right">
                  {inv?.openAsnsCount ?? 0}
                </td>
                <td className="py-2 px-3 text-right">
                  {inv?.shippedToday ?? 0}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
