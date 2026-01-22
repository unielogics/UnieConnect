/** @type {import('next').NextConfig} */
const backendOrigin =
  process.env.UNIECONNECT_BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4001';
const normalizedBackendOrigin = backendOrigin.replace(/\/+$/, '');

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

