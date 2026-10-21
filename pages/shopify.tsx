import Head from 'next/head';
import { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';

declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> };
  }
}

export default function ShopifyLaunchPage() {
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const launch = async () => {
      try {
        if (!window.shopify?.idToken) throw new Error('Open UnieConnect from Shopify Admin to continue.');
        const token = await window.shopify.idToken();
        const response = await fetch(apiUrl('/api/v1/auth/shopify/session'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error || body?.message || 'Shopify authentication failed.');
        const query = new URLSearchParams(window.location.search);
        query.set('view', 'connections');
        query.set('embedded', '1');
        query.set('connected', 'shopify');
        window.location.replace(`/oms?${query.toString()}`);
      } catch (err: any) {
        if (active) setError(err?.message || 'Unable to open UnieConnect from Shopify.');
      }
    };
    void launch();
    return () => { active = false; };
  }, []);

  return (
    <>
      <Head><title>Opening UnieConnect</title></Head>
      <main className="auth-page" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <section style={{ width: 'min(440px, 100%)', textAlign: 'left' }} aria-live="polite">
          <h1 style={{ margin: '0 0 8px' }}>{error ? 'Unable to open UnieConnect' : 'Opening UnieConnect'}</h1>
          <p style={{ margin: 0, color: 'var(--muted)' }}>{error || 'Authenticating your Shopify store and loading its OMS workspace...'}</p>
        </section>
      </main>
    </>
  );
}
