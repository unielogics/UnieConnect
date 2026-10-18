import type { GetServerSideProps } from 'next';

export default function AmazonFbaRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/oms?view=skus&marketplace=amazon&shipment=create',
    permanent: false,
  },
});
