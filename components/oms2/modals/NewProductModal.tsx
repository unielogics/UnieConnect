import React, { useEffect, useState } from 'react';
import { Modal } from '../ui';
import { CatalogItemForm } from '../../CatalogItemForm';
import { createCatalogItem, fetchOmsSuppliers, CreateCatalogItemBody } from '../../../lib/oms';
import type { Supplier } from '../../../lib/amazon-fba';

export const NewProductModal = ({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchOmsSuppliers()
      .then((d) =>
        setSuppliers(
          (d.suppliers || []).map((s) => ({ id: s.id, name: s.name } as Supplier))
        )
      )
      .catch(() => setSuppliers([]));
  }, []);

  const submit = async (data: Record<string, unknown>) => {
    setSaving(true);
    setErr(null);
    try {
      await createCatalogItem(data as unknown as CreateCatalogItemBody);
      onSuccess();
    } catch (e: any) {
      setErr(e.message || 'Failed to create product');
      setSaving(false);
    }
  };

  return (
    <Modal
      title="New product"
      subtitle="Create a SKU in your catalog. It will appear in SKUs, Inventory Plan, and shipment workflows."
      onClose={onClose}
      fullscreen
    >
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        {err && (
          <div
            style={{
              marginBottom: 14,
              padding: '8px 12px',
              background: 'var(--red-soft)',
              color: 'var(--red-text)',
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            {err}
          </div>
        )}
        <CatalogItemForm
          suppliers={suppliers}
          onSubmit={submit}
          onCancel={onClose}
          isLoading={saving}
        />
      </div>
    </Modal>
  );
};
