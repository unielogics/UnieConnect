export const TOKEN_KEY = 'unie-token';

/**
 * Resolve the API origin for browser requests.
 *
 * - In production, `user.unieconnect.com` should talk to `api.unieconnect.com`
 * - On localhost: use http://localhost:4001 for the local backend. Override with
 *   NEXT_PUBLIC_API_BASE or NEXT_PUBLIC_BACKEND_URL if needed.
 */
export function getApiOrigin(): string {
  const env =
    process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL;

  if (typeof window !== 'undefined') {
    if (env) return env.replace(/\/+$/, '');
    const host = window.location.hostname;
    if (host === 'user.unieconnect.com') return 'https://api.unieconnect.com';
    // On localhost, use local backend
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:4001';
    return window.location.origin;
  }

  return env || 'http://localhost:4001';
}

/**
 * API origin for OAuth start flows (Shopify, Amazon, eBay).
 * OAuth callbacks always hit the production API (configured in each provider).
 * When frontend runs on localhost, OAuth start must hit production too, otherwise
 * the callback won't find the state (created in local DB).
 */
export function getOAuthApiOrigin(): string {
  const env = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL;
  if (env) return env.replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'user.unieconnect.com') return 'https://api.unieconnect.com';
    // On localhost, OAuth callback goes to production — start must hit production too
    if (host === 'localhost' || host === '127.0.0.1') return 'https://api.unieconnect.com';
  }
  return 'https://api.unieconnect.com';
}

export function apiUrl(path: string): string {
  const origin = getApiOrigin();
  if (/^https?:\/\//.test(path)) return path;

  const a = origin.replace(/\/+$/, '');
  const b = path.startsWith('/') ? path : `/${path}`;
  return `${a}${b}`;
}

/** Use for OAuth start endpoints so state is created in the same backend that receives the callback. */
export function oauthApiUrl(path: string): string {
  const origin = getOAuthApiOrigin();
  if (/^https?:\/\//.test(path)) return path;
  const a = origin.replace(/\/+$/, '');
  const b = path.startsWith('/') ? path : `/${path}`;
  return `${a}${b}`;
}

