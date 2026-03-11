/** @type {import('next').NextConfig} */
const backendOrigin =
  (process.env.UNIECONNECT_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'http://localhost:4001'
  ).replace(/\/+$/, '');

// Next.js rewrites do NOT forward Authorization to external URLs - keep no rewrites.
// Requests hit pages/api/v1/[...path].ts which forwards headers.
// eslint-disable-next-line no-console
console.log('[unieconnect] API proxy:', backendOrigin);

const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;

