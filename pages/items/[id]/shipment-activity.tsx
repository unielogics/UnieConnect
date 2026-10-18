import type { GetServerSideProps } from 'next';

export default function ItemShipmentActivityRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const id = typeof params?.id === 'string' ? params.id.trim() : '';
  return {
    redirect: {
      destination: id
        ? `/oms?view=ledger&entity=${encodeURIComponent(id)}`
        : '/oms?view=ledger',
      permanent: false,
    },
  };
};
