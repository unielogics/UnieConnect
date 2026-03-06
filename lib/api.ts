export const TOKEN_KEY = 'unie-token';

/**
 * Resolve the API origin for browser requests.
 *
 * - In production, `user.unieconnect.com` talks to `http://api.unieconnect.com` by default
 * - For local dev, default to same-origin so Next.js can proxy via rewrites
 * - You can override with `NEXT_PUBLIC_API_BASE` / `NEXT_PUBLIC_BACKEND_URL`
 */
export function getApiOrigin(): string {
  const env =
    process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL;

  if (typeof window !== 'undefined') {
    // Env override so production can point to a different API (e.g. if api.unieconnect.com is not yet reachable)
    if (env) return env.replace(/\/+$/, '');
    const host = window.location.hostname;
    if (host === 'user.unieconnect.com') return 'http://api.unieconnect.com';
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

