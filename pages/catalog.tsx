import type { GetServerSideProps } from 'next';

export default function CatalogRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const itemId = typeof query.id === 'string' ? query.id.trim() : '';
  const destination = itemId
    ? `/oms?view=sku-detail&sku=${encodeURIComponent(itemId)}`
    : '/oms?view=skus';

  return {
    redirect: {
      destination,
      permanent: false,
    },
  };
};
