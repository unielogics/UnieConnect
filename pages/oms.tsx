import dynamic from 'next/dynamic';
import Head from 'next/head';

const UnieConnectApp = dynamic(() => import('../components/oms2/UnieConnectApp'), { ssr: false });

export default function OmsPage() {
  return (
    <>
      <Head>
        <title>UnieConnect OMS — Command Center</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>
      <UnieConnectApp />
    </>
  );
}
