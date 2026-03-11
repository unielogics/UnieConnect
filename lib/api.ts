export const TOKEN_KEY = 'unie-token';

/**
 * Resolve the API origin for browser requests.
 *
 * - In production, `user.unieconnect.com` should talk to `api.unieconnect.com`
 * - For local dev, use same-origin so requests hit our custom API proxy at pages/api/v1/[...path]
 *   which forwards Authorization and other headers to the backend.
 * - Override with NEXT_PUBLIC_API_BASE to call backend directly (e.g. for debugging).
 */
export function getApiOrigin(): string {
  const env =
    process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL;

  if (typeof window !== 'undefined') {
    if (env) return env.replace(/\/+$/, '');
    const host = window.location.hostname;
    if (host === 'user.unieconnect.com') return 'https://api.unieconnect.com';
    return window.location.origin;
  }

  return env || 'http://localhost:4001';
}

export function apiUrl(path: string): string {
  const origin = getApiOrigin();
  if (/^https?:\/\//.test(path)) return path;

  const a = origin.replace(/\/+$/, '');
  const b = path.startsWith('/') ? path : `/${path}`;
  return `${a}${b}`;
}

