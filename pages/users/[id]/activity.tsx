import type { GetServerSideProps } from 'next';

export default function UserActivityRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const id = typeof params?.id === 'string' ? params.id.trim() : '';
  return {
    redirect: {
      destination: id ? `/oms?view=team&user=${encodeURIComponent(id)}` : '/oms?view=team',
      permanent: false,
    },
  };
};
