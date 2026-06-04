import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ProfilePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/oms?view=profile');
  }, [router]);

  return null;
}
