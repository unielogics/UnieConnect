import type { GetServerSideProps } from 'next';

export default function SuppliersRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const supplierId = typeof query.id === 'string' ? query.id.trim() : '';
  const shipFromId = typeof query.shipFrom === 'string' ? query.shipFrom.trim() : '';
  const params = new URLSearchParams({ view: 'suppliers' });
  if (supplierId) params.set('supplier', supplierId);
  if (shipFromId) params.set('shipFrom', shipFromId);

  return {
    redirect: {
      destination: `/oms?${params.toString()}`,
      permanent: false,
    },
  };
};
