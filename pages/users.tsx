import type { GetServerSideProps } from 'next';

export default function UsersRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/oms?view=team',
    permanent: false,
  },
});
