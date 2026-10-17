import type { GetServerSideProps } from 'next';

export default function CustomersRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const customerId = typeof query.id === 'string' ? query.id.trim() : '';
  const destination = customerId
    ? `/oms?view=customers&customer=${encodeURIComponent(customerId)}`
    : '/oms?view=customers';

  return {
    redirect: {
      destination,
      permanent: false,
    },
  };
};
