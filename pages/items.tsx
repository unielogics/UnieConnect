import { useEffect } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../components/DashboardLayout';

export default function ItemsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/catalog');
  }, [router]);
  return (
    <DashboardLayout title="Redirecting" subtitle="">
      <div className="text-gray-500">Redirecting to Catalog...</div>
    </DashboardLayout>
  );
}
