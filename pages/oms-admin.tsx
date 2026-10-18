import type { GetServerSideProps } from 'next';

export default function OmsAdminRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/oms?view=admin',
    permanent: false,
  },
});
