import type { GetServerSideProps } from 'next';

export default function ConnectWarehouseRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/oms?view=connections&connect=wms',
    permanent: false,
  },
});
