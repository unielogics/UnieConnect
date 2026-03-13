/**
 * API proxy: forwards /api/v1/* to UnieConnectBackend with all auth headers.
 * Next.js rewrites do NOT forward Authorization/custom headers reliably.
 * This route explicitly forwards headers so auth works.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND = (
  process.env.UNIECONNECT_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4001'
).replace(/\/+$/, '');

const FORWARD_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'cookie',
  'x-warehouse-id',
  'x-device-id',
  'x-session-id',
] as const;

function buildBackendUrl(path: string[]): string {
  const joined = path.join('/');
  return `${BACKEND}/api/v1/${joined}`;
}

function forwardHeaders(req: NextApiRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of FORWARD_HEADERS) {
    const v = req.headers[name];
    if (v !== undefined) {
      out[name] = Array.isArray(v) ? v[0] ?? '' : String(v);
    }
  }
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawPath = req.query.path;
  const pathSegments = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];
  let url = buildBackendUrl(pathSegments);
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue;
    if (value !== undefined && value !== null) {
      const str = Array.isArray(value) ? value[0] ?? '' : String(value);
      if (str) queryParams.set(key, str);
    }
  }
  const queryString = queryParams.toString();
  if (queryString) url += `?${queryString}`;

  const headers = forwardHeaders(req);
  const fetchHeaders = new Headers();
  for (const [k, v] of Object.entries(headers)) {
    if (v) fetchHeaders.set(k, v);
  }
  const opts: RequestInit = {
    method: req.method || 'GET',
    headers: fetchHeaders,
  };

  if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
    opts.body =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!fetchHeaders.has('content-type')) {
      fetchHeaders.set('content-type', 'application/json');
    }
  }

  try {
    const backendRes = await fetch(url, opts);
    const ct = backendRes.headers.get('content-type') || '';
    const isBinary =
      ct.includes('application/pdf') ||
      ct.includes('application/octet-stream') ||
      ct.includes('image/');
    const data = isBinary
      ? Buffer.from(await backendRes.arrayBuffer())
      : await backendRes.text();
    res.status(backendRes.status);
    if (ct) res.setHeader('content-type', ct);
    const setCookie = backendRes.headers.get('set-cookie');
    if (setCookie) res.setHeader('set-cookie', setCookie);
    res.end(data);
  } catch (err: any) {
    res.status(502).json({
      error: 'Backend unreachable',
      message: err?.message || 'Could not reach API',
    });
  }
}
