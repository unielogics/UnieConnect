/** @type {import('next').NextConfig} */
const backendOrigin =
  process.env.UNIECONNECT_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4001';
const normalizedBackendOrigin = backendOrigin.replace(/\/+$/, '');

// Helpful startup log so it's obvious what the UI is proxying to.
// eslint-disable-next-line no-console
console.log('[unieconnect] API proxy target:', normalizedBackendOrigin);

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${normalizedBackendOrigin}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

