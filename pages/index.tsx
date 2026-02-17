import { useEffect } from 'react';
import { getApiOrigin, TOKEN_KEY } from '../lib/api';

export default function Home() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hostname === 'unieconnect.com') {
      window.location.href = `https://user.unieconnect.com${window.location.pathname}${window.location.search}`;
      return;
    }
    console.info('[unieconnect][config]', { apiOrigin: getApiOrigin(), host: window.location.host });
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      window.location.href = '/dashboard';
    } else {
      window.location.href = '/login';
    }
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050508' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Redirecting…</p>
    </div>
  );
}
