export const TOKEN_KEY = 'unie-token';

/**
 * Resolve the API origin for browser requests.
 *
 * - In production, `user.unieconnect.com` should talk to `api.unieconnect.com`
 * - For local dev, default to same-origin so Next.js can proxy via rewrites
 * - You can override with `NEXT_PUBLIC_API_BASE` / `NEXT_PUBLIC_BACKEND_URL`
 */
export function getApiOrigin(): string {
  const env =
    process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'user.unieconnect.com') return 'https://api.unieconnect.com';
    if (env) return env;
    // Default to same-origin (enables Next.js rewrite proxy: /api/v1/*)
    return window.location.origin;
  }

  // Fallback for non-browser contexts
  return env || 'http://localhost:4001';
}

export function apiUrl(path: string): string {
  const origin = getApiOrigin();
  if (/^https?:\/\//.test(path)) return path;

  const a = origin.replace(/\/+$/, '');
  const b = path.startsWith('/') ? path : `/${path}`;
  return `${a}${b}`;
}

