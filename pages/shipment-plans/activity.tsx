import type { GetServerSideProps } from 'next';

export default function ShipmentActivityRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const params = new URLSearchParams({ view: 'ledger' });
  const shipmentPlanId = typeof query.shipmentPlanId === 'string' ? query.shipmentPlanId.trim() : '';
  if (shipmentPlanId) params.set('entity', shipmentPlanId);
  return {
    redirect: {
      destination: `/oms?${params.toString()}`,
      permanent: false,
    },
  };
};
