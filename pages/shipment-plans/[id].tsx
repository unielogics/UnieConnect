import type { GetServerSideProps } from 'next';

export default function ShipmentPlanDetailRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const id = typeof params?.id === 'string' ? params.id.trim() : '';
  return {
    redirect: {
      destination: id
        ? `/oms?view=shipments&asn=${encodeURIComponent(id)}`
        : '/oms?view=shipments',
      permanent: false,
    },
  };
};
