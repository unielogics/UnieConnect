import type { GetServerSideProps } from 'next';

export default function ProfileRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/oms?view=profile',
    permanent: false,
  },
});
