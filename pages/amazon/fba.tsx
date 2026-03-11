import { useEffect } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';

/**
 * Redirect: Send to Amazon flow is now integrated into Create Shipment Plan.
 */
export default function AmazonFbaRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    void router.replace('/shipment-plans');
  }, [router]);

  return (
    <DashboardLayout title="Send to Amazon" subtitle="Redirecting...">
      <div className="card" style={{ padding: 24 }}>
        <p className="muted">
          FBA/FBW flows are now in Create Shipment Plan. Redirecting to Shipment plans...
        </p>
      </div>
    </DashboardLayout>
  );
}
