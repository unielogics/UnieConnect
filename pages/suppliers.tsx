import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FiEdit2, FiTrash2, FiPlus, FiChevronDown, FiChevronUp, FiMapPin, FiMail, FiPhone, FiGlobe } from 'react-icons/fi';
import DashboardLayout from '../components/DashboardLayout';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { AddressInput } from '../components/AddressInput';
import { validateAddress } from '../lib/address';
import { NewSupplierModal } from '../components/oms2/modals/NewSupplierModal';
import type { OmsSupplier } from '../lib/oms';
import {
  Supplier,
  ShipFromLocation,
  createShipFromLocation,
  deleteShipFromLocation,
  deleteSupplier,
  fetchShipFromLocations,
  fetchSupplierProducts,
  fetchSuppliers,
  updateShipFromLocation,
  type SupplierProductDirect,
  type SupplierProductHistorical,
} from '../lib/amazon-fba';

type LocationForm = {
  supplierId: string;
  label: string;
  contactName: string;
  email: string;
  phone: string;
  hoursOfOperation: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateOrProvinceCode: string;
  postalCode: string;
  countryCode: string;
  isDefault: boolean;
  lat?: number;
  long?: number;
};

type FilterType = 'all' | 'online' | 'offline' | 'with_addresses' | 'without_addresses';

const createEmptyLocationForm = (supplierId = ''): LocationForm => ({
  supplierId,
  label: '',
  contactName: '',
  email: '',
  phone: '',
  hoursOfOperation: '',
  website: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateOrProvinceCode: '',
  postalCode: '',
  countryCode: 'US',
  isDefault: false,
});

function formatAddress(location: ShipFromLocation) {
  const parts = [
    location.address.addressLine1,
    location.address.addressLine2,
    location.address.city,
    location.address.stateOrProvinceCode,
    location.address.postalCode,
    location.address.countryCode,
  ].filter(Boolean);
  return parts.join(', ');
}

function matchesSearch(value: string, searchTerm: string) {
  return value.toLowerCase().includes(searchTerm.toLowerCase());
}

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [locations, setLocations] = useState<ShipFromLocation[]>([]);
  const [expandedSupplierId, setExpandedSupplierId] = useState('');
  const [highlightedLocationId, setHighlightedLocationId] = useState('');
  const [locationForm, setLocationForm] = useState<LocationForm>(createEmptyLocationForm());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingLocationId, setEditingLocationId] = useState('');
  const [locationAddressSearch, setLocationAddressSearch] = useState('');
  const [locationAddressValidated, setLocationAddressValidated] = useState(false);
  const [locationAddressValidateError, setLocationAddressValidateError] = useState<string | null>(null);
  const [locationAddressValidating, setLocationAddressValidating] = useState(false);
  const [supplierProductsBySupplier, setSupplierProductsBySupplier] = useState<
    Record<string, { direct: SupplierProductDirect[]; historical: SupplierProductHistorical[] } | undefined>
  >({});
  const [supplierProductsLoading, setSupplierProductsLoading] = useState(false);

  const locationCountBySupplier = useMemo(() => {
    const counts = new Map<string, number>();
    locations.forEach((location) => {
      counts.set(location.supplierId, (counts.get(location.supplierId) || 0) + 1);
    });
    return counts;
  }, [locations]);

  const filteredSuppliers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return suppliers.filter((supplier) => {
      const supplierLocations = locations.filter((location) => location.supplierId === supplier.id);
      const addressCount = supplierLocations.length;

      if (filterType === 'online' && !supplier.onlineSupplier) return false;
      if (filterType === 'offline' && supplier.onlineSupplier) return false;
      if (filterType === 'with_addresses' && addressCount === 0) return false;
      if (filterType === 'without_addresses' && addressCount > 0) return false;

      if (!normalizedSearch) return true;

      const searchFields = [
        supplier.name,
        supplier.email,
        supplier.phone,
        supplier.website,
        supplier.notes,
        supplier.city,
        supplier.state,
        ...supplierLocations.flatMap((location) => [
          location.label,
          location.contactName,
          location.email,
          location.phone,
          location.address.addressLine1,
          location.address.addressLine2 || '',
          location.address.city,
          location.address.stateOrProvinceCode,
          location.address.postalCode,
          location.address.countryCode,
        ]),
      ]
        .filter(Boolean)
        .join(' ');

      return matchesSearch(searchFields, normalizedSearch);
    });
  }, [filterType, locations, searchTerm, suppliers]);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const shipFromQuery = router.query.shipFrom;
    if (!shipFromQuery || locations.length === 0) return;

    const targetShipFromId = Array.isArray(shipFromQuery) ? shipFromQuery[0] : shipFromQuery;
    if (!targetShipFromId) return;

    const location = locations.find((entry) => entry.id === targetShipFromId);
    if (!location?.supplierId) return;

    setExpandedSupplierId(location.supplierId);
    setHighlightedLocationId(location.id);
  }, [router.query.shipFrom, locations]);

  const loadData = async () => {
    try {
      const [nextSuppliers, nextLocations] = await Promise.all([fetchSuppliers(), fetchShipFromLocations()]);
      setSuppliers(nextSuppliers);
      setLocations(nextLocations);
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to load ship-from records.' });
    }
  };

  const loadSupplierProducts = async (supplierId: string) => {
    if (supplierProductsBySupplier[supplierId]) return;
    setSupplierProductsLoading(true);
    try {
      const data = await fetchSupplierProducts(supplierId);
      setSupplierProductsBySupplier((current) => ({ ...current, [supplierId]: data }));
    } catch {
      setSupplierProductsBySupplier((current) => ({ ...current, [supplierId]: { direct: [], historical: [] } }));
    } finally {
      setSupplierProductsLoading(false);
    }
  };

  const toggleExpanded = (supplierId: string) => {
    setExpandedSupplierId((id) => {
      const next = id === supplierId ? '' : supplierId;
      if (next) void loadSupplierProducts(next);
      return next;
    });
  };

  const openCreateSupplierModal = () => {
    setEditingSupplier(null);
    setSupplierModalOpen(true);
  };

  const openEditSupplierModal = (supplier: Supplier, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setEditingSupplier(supplier);
    setSupplierModalOpen(true);
  };

  const closeSupplierModal = () => {
    setSupplierModalOpen(false);
    setEditingSupplier(null);
  };

  const handleSupplierSaved = (supplier?: OmsSupplier) => {
    closeSupplierModal();
    setMessage({ type: 'success', text: editingSupplier ? 'Supplier updated.' : 'Supplier created.' });
    if (supplier?.id) {
      setExpandedSupplierId(supplier.id);
      void loadSupplierProducts(supplier.id);
    }
    void loadData();
  };

  const openCreateLocationModal = (supplierId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setEditingLocationId('');
    setLocationForm(createEmptyLocationForm(supplierId));
    setLocationAddressSearch('');
    setLocationAddressValidated(false);
    setLocationAddressValidateError(null);
    setLocationModalOpen(true);
  };

  const openEditLocationModal = (location: ShipFromLocation, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setEditingLocationId(location.id);
    const addr = location.address as any;
    setLocationForm({
      supplierId: location.supplierId,
      label: location.label || '',
      contactName: location.contactName || '',
      email: location.email || '',
      phone: location.phone || '',
      hoursOfOperation: location.hoursOfOperation || '',
      website: location.website || '',
      addressLine1: location.address.addressLine1 || '',
      addressLine2: location.address.addressLine2 || '',
      city: location.address.city || '',
      stateOrProvinceCode: location.address.stateOrProvinceCode || '',
      postalCode: location.address.postalCode || '',
      countryCode: location.address.countryCode || 'US',
      isDefault: Boolean(location.isDefault),
      lat: addr?.lat,
      long: addr?.long,
    });
    setLocationAddressSearch('');
    setLocationAddressValidated(false);
    setLocationAddressValidateError(null);
    setLocationModalOpen(true);
  };

  const closeLocationModal = () => {
    setLocationModalOpen(false);
    setEditingLocationId('');
    setLocationForm(createEmptyLocationForm());
    setLocationAddressSearch('');
    setLocationAddressValidated(false);
    setLocationAddressValidateError(null);
  };

  const handleValidateLocationAddress = async () => {
    const line = [
      locationForm.addressLine1,
      locationForm.city,
      locationForm.stateOrProvinceCode,
      locationForm.postalCode,
      locationForm.countryCode,
    ]
      .filter(Boolean)
      .join(', ');
    const toValidate = line.trim() || locationAddressSearch.trim();
    if (!toValidate) {
      setLocationAddressValidateError('Enter or select an address first.');
      return;
    }
    setLocationAddressValidating(true);
    setLocationAddressValidateError(null);
    try {
      const res = await validateAddress(toValidate);
      if (res.found && res.address) {
        const a = res.address;
        setLocationForm((prev) => ({
          ...prev,
          addressLine1: a.street || prev.addressLine1,
          city: a.city || prev.city,
          stateOrProvinceCode: a.stateCode || a.state || prev.stateOrProvinceCode,
          postalCode: a.postalCode || prev.postalCode,
          countryCode: a.country ? (a.country === 'United States' || a.country === 'USA' ? 'US' : a.country) : prev.countryCode,
          lat: a.latitude,
          long: a.longitude,
        }));
        setLocationAddressValidated(true);
      } else {
        setLocationAddressValidated(false);
        setLocationAddressValidateError(res.warning || 'Address could not be validated. You can still use it.');
      }
    } catch (e: any) {
      setLocationAddressValidateError(e?.message || 'Validation failed.');
      setLocationAddressValidated(false);
    } finally {
      setLocationAddressValidating(false);
    }
  };

  const handleDeleteSupplier = async (supplierId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!window.confirm('Delete this supplier and all of its ship-from addresses?')) return;

    setBusyAction(`delete-supplier:${supplierId}`);
    setMessage(null);

    try {
      await deleteSupplier(supplierId);
      setSuppliers((current) => current.filter((s) => s.id !== supplierId));
      setLocations((current) => current.filter((l) => l.supplierId !== supplierId));
      if (expandedSupplierId === supplierId) setExpandedSupplierId('');
      setMessage({ type: 'success', text: 'Supplier deleted.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to delete supplier.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveLocation = async (event: FormEvent) => {
    event.preventDefault();

    if (!locationForm.supplierId) {
      setMessage({ type: 'error', text: 'Select a supplier before saving this address.' });
      return;
    }

    const addr: Record<string, unknown> = {
      addressLine1: locationForm.addressLine1,
      addressLine2: locationForm.addressLine2,
      city: locationForm.city,
      stateOrProvinceCode: locationForm.stateOrProvinceCode,
      postalCode: locationForm.postalCode,
      countryCode: locationForm.countryCode.toUpperCase(),
    };
    if (locationForm.lat != null) (addr as any).lat = locationForm.lat;
    if (locationForm.long != null) (addr as any).long = locationForm.long;
    const payload = {
      supplierId: locationForm.supplierId,
      label: locationForm.label,
      contactName: locationForm.contactName,
      email: locationForm.email,
      phone: locationForm.phone,
      hoursOfOperation: locationForm.hoursOfOperation,
      website: locationForm.website,
      isDefault: locationForm.isDefault,
      address: addr,
    };

    const isEditing = Boolean(editingLocationId);
    setBusyAction(isEditing ? 'update-location' : 'create-location');
    setMessage(null);

    try {
      if (isEditing) {
        const updated = await updateShipFromLocation(editingLocationId, payload);
        setLocations((current) => current.map((l) => (l.id === editingLocationId ? updated : l)));
        setHighlightedLocationId(updated.id);
        setExpandedSupplierId(updated.supplierId);
        setMessage({ type: 'success', text: 'Ship-from address updated.' });
      } else {
        const created = await createShipFromLocation(payload);
        setLocations((current) => [created, ...current]);
        setHighlightedLocationId(created.id);
        setExpandedSupplierId(created.supplierId);
        setMessage({ type: 'success', text: 'Ship-from address created.' });
      }
      closeLocationModal();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to save ship-from address.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteLocation = async (locationId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!window.confirm('Delete this ship-from address?')) return;

    setBusyAction(`delete-location:${locationId}`);
    setMessage(null);

    try {
      await deleteShipFromLocation(locationId);
      setLocations((current) => current.filter((l) => l.id !== locationId));
      setHighlightedLocationId((current) => (current === locationId ? '' : current));
      setMessage({ type: 'success', text: 'Ship-from address deleted.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to delete ship-from address.' });
    } finally {
      setBusyAction(null);
    }
  };

  const totalAddresses = locations.length;

  return (
    <DashboardLayout title="Ship-from">
      {message ? (
        <div className={`alert ${message.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 12 }}>
          {message.text}
        </div>
      ) : null}

      <section className="shipfrom-page-header">
        <div className="shipfrom-header-stats">
          <span className="muted">{suppliers.length} suppliers</span>
          <span className="muted" aria-hidden>·</span>
          <span className="muted">{totalAddresses} ship-from addresses</span>
        </div>
        <Button variant="primary" className="shipfrom-add-btn" onClick={openCreateSupplierModal}>
          <FiPlus size={18} aria-hidden />
          Add supplier
        </Button>
      </section>

      <section className="shipfrom-toolbar">
        <div className="shipfrom-toolbar-search">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search suppliers by name, location, contact..."
          />
        </div>
        <div className="shipfrom-filter-row">
          {[
            { id: 'all' as const, label: 'All' },
            { id: 'online' as const, label: 'Online' },
            { id: 'offline' as const, label: 'Offline' },
            { id: 'with_addresses' as const, label: 'With addresses' },
            { id: 'without_addresses' as const, label: 'No addresses' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              className={`shipfrom-filter-pill ${filterType === f.id ? 'active' : ''}`}
              onClick={() => setFilterType(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {filteredSuppliers.length === 0 ? (
        <div className="shipfrom-empty">
          <h3>No suppliers found</h3>
          <p className="muted">
            {searchTerm || filterType !== 'all'
              ? 'Try changing your search or filter.'
              : 'Add your first supplier to start building ship-from records.'}
          </p>
          {!searchTerm && filterType === 'all' ? (
            <Button variant="primary" onClick={openCreateSupplierModal}>
              Add your first supplier
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="shipfrom-card-grid">
          {filteredSuppliers.map((supplier) => {
            const addressCount = locationCountBySupplier.get(supplier.id) || 0;
            const supplierLocations = locations
              .filter((l) => l.supplierId === supplier.id)
              .sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)) || a.label.localeCompare(b.label));
            const primaryLocation = supplierLocations[0];
            const isExpanded = expandedSupplierId === supplier.id;
            const cityState = [supplier.city, supplier.state].filter(Boolean).join(', ');
            const products = supplierProductsBySupplier[supplier.id];

            return (
              <article
                key={supplier.id}
                className={`shipfrom-supplier-card ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleExpanded(supplier.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleExpanded(supplier.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="shipfrom-card-head">
                  <div className="shipfrom-card-title-row">
                    <h3 className="shipfrom-card-name">{supplier.name || 'Unnamed supplier'}</h3>
                    {supplier.onlineSupplier && <span className="shipfrom-badge">Online</span>}
                    <span className="shipfrom-expand-icon">{isExpanded ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}</span>
                  </div>
                  <div className="shipfrom-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="shipfrom-icon-btn"
                      onClick={(e) => openEditSupplierModal(supplier, e)}
                      title="Edit supplier"
                    >
                      <FiEdit2 size={16} />
                    </button>
                    <button
                      type="button"
                      className="shipfrom-icon-btn shipfrom-icon-btn-danger"
                      onClick={(e) => void handleDeleteSupplier(supplier.id, e)}
                      disabled={busyAction === `delete-supplier:${supplier.id}`}
                      title="Delete supplier"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="shipfrom-card-body">
                  <div className="shipfrom-card-meta">
                    <span className="shipfrom-meta-item">
                      {addressCount} {addressCount === 1 ? 'address' : 'addresses'}
                    </span>
                    {cityState && <span className="shipfrom-meta-item">{cityState}</span>}
                    {(supplier.email || supplier.phone) && (
                      <span className="shipfrom-meta-item">
                        {supplier.email || supplier.phone}
                      </span>
                    )}
                    <span className="shipfrom-meta-item">
                      {supplier.lastOrderAt ? `Last order ${new Date(supplier.lastOrderAt).toLocaleDateString()}` : 'No orders yet'}
                    </span>
                  </div>
                  {primaryLocation && (
                    <div className="shipfrom-card-address">
                      <FiMapPin size={14} className="shipfrom-icon" aria-hidden />
                      <span>{formatAddress(primaryLocation)}</span>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="shipfrom-card-expanded" onClick={(e) => e.stopPropagation()}>
                    <div className="shipfrom-expanded-header">
                      <h4>Ship-from addresses</h4>
                      <Button
                        variant="secondary"
                        onClick={(e) => openCreateLocationModal(supplier.id, e)}
                      >
                        <FiPlus size={14} aria-hidden />
                        Add address
                      </Button>
                    </div>

                    {supplierLocations.length === 0 ? (
                      <p className="shipfrom-expanded-empty">
                        {supplier.onlineSupplier
                          ? 'No address required for this online supplier. Add one if needed.'
                          : 'No ship-from addresses yet. Add the first address for this supplier.'}
                      </p>
                    ) : (
                      <ul className="shipfrom-address-list">
                        {supplierLocations.map((location) => (
                          <li
                            key={location.id}
                            className={`shipfrom-address-item ${highlightedLocationId === location.id ? 'highlighted' : ''}`}
                          >
                            <div className="shipfrom-address-item-main">
                              <div>
                                <span className="shipfrom-address-label">
                                  {location.label}
                                  {location.isDefault && <span className="shipfrom-badge-small">Default</span>}
                                </span>
                                <span className="shipfrom-address-text">{formatAddress(location)}</span>
                              </div>
                              <div className="shipfrom-address-item-actions">
                                <Link
                                  href="/shipment-plans"
                                  className="shipfrom-link-btn"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Use in shipment plan
                                </Link>
                                <button
                                  type="button"
                                  className="shipfrom-icon-btn"
                                  onClick={(e) => openEditLocationModal(location, e)}
                                  title="Edit address"
                                >
                                  <FiEdit2 size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="shipfrom-icon-btn shipfrom-icon-btn-danger"
                                  onClick={(e) => void handleDeleteLocation(location.id, e)}
                                  disabled={busyAction === `delete-location:${location.id}`}
                                  title="Delete address"
                                >
                                  <FiTrash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    {(supplier.email || supplier.phone || supplier.website || supplier.notes) && (
                      <div className="shipfrom-expanded-meta">
                        {supplier.email && (
                          <div className="shipfrom-meta-row">
                            <FiMail size={14} aria-hidden />
                            <a href={`mailto:${supplier.email}`}>{supplier.email}</a>
                          </div>
                        )}
                        {supplier.phone && (
                          <div className="shipfrom-meta-row">
                            <FiPhone size={14} aria-hidden />
                            <a href={`tel:${supplier.phone}`}>{supplier.phone}</a>
                          </div>
                        )}
                        {supplier.website && (
                          <div className="shipfrom-meta-row">
                            <FiGlobe size={14} aria-hidden />
                            <a href={supplier.website} target="_blank" rel="noopener noreferrer">{supplier.website}</a>
                          </div>
                        )}
                        {supplier.notes && <p className="shipfrom-notes">{supplier.notes}</p>}
                      </div>
                    )}

                    <div className="shipfrom-expanded-header" style={{ marginTop: 16 }}>
                      <h4>Products provided by this supplier</h4>
                    </div>
                    {supplierProductsLoading && !products ? (
                      <div className="muted" style={{ padding: '12px 0' }}>Loading products...</div>
                    ) : products ? (
                      <div className="supplier-products-section">
                        <div className="supplier-products-subsection">
                          <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Directly assigned</h4>
                          {products.direct.length === 0 ? (
                            <div className="muted" style={{ fontSize: 13 }}>No items directly linked to this supplier.</div>
                          ) : (
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '8px 0', textAlign: 'left' }}>SKU</th>
                                    <th style={{ padding: '8px 0', textAlign: 'left' }}>Title</th>
                                    <th style={{ padding: '8px 0', width: 60 }}></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {products.direct.map((p) => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td style={{ padding: '8px 0', fontWeight: 500 }}>{p.sku}</td>
                                      <td style={{ padding: '8px 0' }}>{p.title || '—'}</td>
                                      <td style={{ padding: '8px 0' }}>
                                        <Link
                                          href={`/catalog`}
                                          className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 shadow-sm hover:bg-gray-50"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          View
                                        </Link>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                        <div className="supplier-products-subsection" style={{ marginTop: 16 }}>
                          <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Used in plans / shipments</h4>
                          {products.historical.length === 0 ? (
                            <div className="muted" style={{ fontSize: 13 }}>No products found in shipment plans or inbound workflows for this supplier.</div>
                          ) : (
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '8px 0', textAlign: 'left' }}>SKU</th>
                                    <th style={{ padding: '8px 0', textAlign: 'left' }}>Title</th>
                                    <th style={{ padding: '8px 0', textAlign: 'left' }}>Source</th>
                                    <th style={{ padding: '8px 0', textAlign: 'left' }}>Last used</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {products.historical.map((p) => (
                                    <tr key={`${p.sku}-${p.source}-${p.lastUsedAt}`} style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td style={{ padding: '8px 0', fontWeight: 500 }}>{p.sku}</td>
                                      <td style={{ padding: '8px 0' }}>{p.title || '—'}</td>
                                      <td style={{ padding: '8px 0' }}>{p.source}</td>
                                      <td style={{ padding: '8px 0', fontSize: 12 }}>{p.lastUsedAt ? new Date(p.lastUsedAt).toLocaleDateString() : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {supplierModalOpen && (
        <NewSupplierModal
          supplier={editingSupplier as unknown as OmsSupplier | null}
          onClose={closeSupplierModal}
          onSuccess={handleSupplierSaved}
        />
      )}

      {locationModalOpen && (
        <Modal
          isOpen={locationModalOpen}
          onClose={closeLocationModal}
          title={editingLocationId ? 'Edit ship-from address' : 'Add ship-from address'}
          size="fullMain"
          footer={
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
<Button variant="secondary" onClick={closeLocationModal}>
              Cancel
            </Button>
              <Button
                type="submit"
                form="location-form"
                variant="primary"
                disabled={!!busyAction}
              >
                {busyAction === 'create-location' || busyAction === 'update-location' ? 'Saving...' : editingLocationId ? 'Save address' : 'Create address'}
              </Button>
            </div>
          }
        >
          <form id="location-form" onSubmit={handleSaveLocation}>
            <div className="form-section">
              <h3 className="form-section-title">Location details</h3>
              <div className="form-grid">
                <div className="form-field form-grid-full">
                  <label>Supplier *</label>
                  <select
                    value={locationForm.supplierId}
                    onChange={(e) => setLocationForm((c) => ({ ...c, supplierId: e.target.value }))}
                    required
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Address label *</label>
                  <input
                    value={locationForm.label}
                    onChange={(e) => setLocationForm((c) => ({ ...c, label: e.target.value }))}
                    required
                    placeholder="e.g. Warehouse A"
                  />
                </div>
                <div className="form-field">
                  <label>Contact name</label>
                  <input
                    value={locationForm.contactName}
                    onChange={(e) => setLocationForm((c) => ({ ...c, contactName: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>
                <div className="form-field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={locationForm.email}
                    onChange={(e) => setLocationForm((c) => ({ ...c, email: e.target.value }))}
                    placeholder="contact@example.com"
                  />
                </div>
                <div className="form-field">
                  <label>Phone</label>
                  <input
                    value={locationForm.phone}
                    onChange={(e) => setLocationForm((c) => ({ ...c, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="form-field form-grid-full">
                  <label>Hours of operation</label>
                  <input
                    value={locationForm.hoursOfOperation}
                    onChange={(e) => setLocationForm((c) => ({ ...c, hoursOfOperation: e.target.value }))}
                    placeholder="e.g. 9am–5pm Mon–Fri"
                  />
                </div>
                <div className="form-field form-grid-full">
                  <label>Website</label>
                  <input
                    value={locationForm.website}
                    onChange={(e) => setLocationForm((c) => ({ ...c, website: e.target.value }))}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">Address</h3>
              <p className="muted" style={{ marginBottom: 16 }}>
                Search and select an address to auto-fill, or enter manually. Validate to capture lat/long.
              </p>
              <div className="form-field" style={{ marginBottom: 16 }}>
                <AddressInput
                  label="Search address"
                  value={locationAddressSearch}
                  onChange={setLocationAddressSearch}
                  onSelectSuggestion={(s) => {
                    setLocationForm((prev) => ({
                      ...prev,
                      addressLine1: s.street || prev.addressLine1,
                      city: s.city || prev.city,
                      stateOrProvinceCode: s.stateCode || s.state || prev.stateOrProvinceCode,
                      postalCode: s.postalCode || prev.postalCode,
                      countryCode: s.countryCode || prev.countryCode,
                      lat: s.latitude,
                      long: s.longitude,
                    }));
                    setLocationAddressValidated(!!(s.latitude != null && s.longitude != null));
                  }}
                />
              </div>
              <div className="form-grid">
                <div className="form-field form-grid-full">
                  <label>Street *</label>
                  <input
                    value={locationForm.addressLine1}
                    onChange={(e) => {
                      setLocationForm((c) => ({ ...c, addressLine1: e.target.value }));
                      setLocationAddressValidated(false);
                    }}
                    required
                    placeholder="123 Main St"
                  />
                </div>
                <div className="form-field form-grid-full">
                  <label>Address line 2</label>
                  <input
                    value={locationForm.addressLine2}
                    onChange={(e) => setLocationForm((c) => ({ ...c, addressLine2: e.target.value }))}
                    placeholder="Suite 100"
                  />
                </div>
                <div className="form-field">
                  <label>City *</label>
                  <input
                    value={locationForm.city}
                    onChange={(e) => {
                      setLocationForm((c) => ({ ...c, city: e.target.value }));
                      setLocationAddressValidated(false);
                    }}
                    required
                    placeholder="City"
                  />
                </div>
                <div className="form-field">
                  <label>State / province *</label>
                  <input
                    value={locationForm.stateOrProvinceCode}
                    onChange={(e) => {
                      setLocationForm((c) => ({ ...c, stateOrProvinceCode: e.target.value }));
                      setLocationAddressValidated(false);
                    }}
                    required
                    placeholder="CA"
                  />
                </div>
                <div className="form-field">
                  <label>Postal code *</label>
                  <input
                    value={locationForm.postalCode}
                    onChange={(e) => {
                      setLocationForm((c) => ({ ...c, postalCode: e.target.value }));
                      setLocationAddressValidated(false);
                    }}
                    required
                    placeholder="12345"
                  />
                </div>
                <div className="form-field">
                  <label>Country code *</label>
                  <input
                    value={locationForm.countryCode}
                    onChange={(e) => setLocationForm((c) => ({ ...c, countryCode: e.target.value.toUpperCase() }))}
                    required
                    placeholder="US"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                <Button
                  variant="secondary"
                  onClick={handleValidateLocationAddress}
                  disabled={locationAddressValidating || !locationForm.addressLine1}
                >
                  {locationAddressValidating ? 'Validating...' : 'Validate address'}
                </Button>
                {locationAddressValidated && (
                  <span className="form-validate-success">
                    <FiMapPin size={14} /> Address validated (lat/long captured)
                  </span>
                )}
              </div>
              {locationAddressValidateError && (
                <div className="form-validate-error" style={{ marginTop: 12 }}>
                  {locationAddressValidateError}
                </div>
              )}
              <div className="form-field form-grid-full" style={{ marginTop: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={locationForm.isDefault}
                    onChange={(e) => setLocationForm((c) => ({ ...c, isDefault: e.target.checked }))}
                  />
                  Mark as default ship-from address
                </label>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </DashboardLayout>
  );
}
