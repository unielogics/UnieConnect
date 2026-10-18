import type { GetServerSideProps } from 'next';

export default function CreateShipmentPlanRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/oms?view=skus&shipment=create',
    permanent: false,
  },
});
