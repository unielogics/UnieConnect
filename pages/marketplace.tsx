import type { GetServerSideProps } from 'next';

export default function MarketplaceRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/oms?view=marketplace',
    permanent: false,
  },
});
