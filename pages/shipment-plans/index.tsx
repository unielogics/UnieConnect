import type { GetServerSideProps } from 'next';

export default function ShipmentPlansRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/oms?view=shipments',
    permanent: false,
  },
});
