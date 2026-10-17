import type { GetServerSideProps } from 'next';

export default function OrdersRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const orderId = typeof query.id === 'string' ? query.id.trim() : '';
  const destination = orderId
    ? `/oms?view=orders&order=${encodeURIComponent(orderId)}`
    : '/oms?view=orders';

  return {
    redirect: {
      destination,
      permanent: false,
    },
  };
};
