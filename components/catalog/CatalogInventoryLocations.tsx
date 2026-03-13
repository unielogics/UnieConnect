/**
 * Inventory locations accordion for catalog item detail.
 * Renders when backend provides location-level inventory data.
 * Currently a placeholder - the wms-activities API does not return location-level data.
 * Add locations prop and implement accordion when backend supports it.
 */

interface LocationRecord {
  location?: { fullLocation?: string };
  quantity?: number;
  reservedQuantity?: number;
  availableQuantity?: number;
}

interface CatalogInventoryLocationsProps {
  locations?: LocationRecord[];
}

export function CatalogInventoryLocations({ locations }: CatalogInventoryLocationsProps) {
  if (!locations || locations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {locations.map((loc, index) => (
        <div
          key={index}
          className="rounded-lg border border-gray-200 bg-white p-3 text-sm"
        >
          <div className="font-mono font-medium text-gray-900">
            {loc.location?.fullLocation ?? 'Unknown'}
          </div>
          <div className="flex gap-4 mt-2 text-gray-600">
            <span>Qty: {loc.quantity ?? 0}</span>
            {loc.reservedQuantity != null && (
              <span>Reserved: {loc.reservedQuantity}</span>
            )}
            {loc.availableQuantity != null && (
              <span>Available: {loc.availableQuantity}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
