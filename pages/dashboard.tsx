import type { GetServerSideProps } from 'next';

export default function DashboardRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const params = new URLSearchParams({ view: 'command' });
  for (const key of ['audit', 'source']) {
    const value = query[key];
    if (typeof value === 'string' && value) params.set(key, value);
  }
  return {
    redirect: {
      destination: `/oms?${params.toString()}`,
      permanent: false,
    },
  };
};
