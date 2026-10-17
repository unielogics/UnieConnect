import type { GetServerSideProps } from 'next';

export default function ActivityRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/oms?view=ledger',
    permanent: false,
  },
});
