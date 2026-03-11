import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { CreateShipmentPlanModal } from '../../components/CreateShipmentPlanModal';

export default function CreateShipmentPlanPage() {
  const router = useRouter();
  const [initialItems, setInitialItems] = useState<{ sku: string; title?: string; asin?: string }[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const q = router.query.items;
    if (typeof q === 'string') {
      try {
        const parsed = JSON.parse(decodeURIComponent(q)) as { sku: string; title?: string; asin?: string }[];
        if (Array.isArray(parsed) && parsed.length) {
          setInitialItems(parsed);
        }
      } catch {}
    }
    setReady(true);
  }, [router.query.items]);

  const handleClose = () => {
    router.push('/catalog');
  };

  return (
    <DashboardLayout title="Create Shipment Plan" subtitle="Add details and link to supplier">
      <div style={{ padding: 24 }}>
        {ready && (
          <CreateShipmentPlanModal
            isOpen={true}
            onClose={handleClose}
            initialItems={initialItems}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
