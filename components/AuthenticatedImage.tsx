import React, { useEffect, useState } from 'react';
import { apiUrl, authFetch } from '../lib/api';

type AuthenticatedImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
  fallback?: React.ReactNode;
};

const protectedImageCache = new Map<string, Promise<string>>();

const isProtectedUpload = (src: string) =>
  src.includes('/api/v1/uploads/images?') || src.startsWith('/api/v1/uploads/images?');

const loadProtectedImage = (src: string) => {
  const cached = protectedImageCache.get(src);
  if (cached) return cached;

  const pending = authFetch(apiUrl(src), { headers: { Accept: 'image/*' } })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Image request failed (${response.status})`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.toLowerCase().startsWith('image/')) throw new Error('Image response has an invalid content type');
      return URL.createObjectURL(await response.blob());
    })
    .catch((error) => {
      protectedImageCache.delete(src);
      throw error;
    });
  protectedImageCache.set(src, pending);
  return pending;
};

export function AuthenticatedImage({ src, fallback = null, onError, ...props }: AuthenticatedImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(() => {
    const value = String(src || '').trim();
    return value && !isProtectedUpload(value) ? value : null;
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const value = String(src || '').trim();
    let active = true;
    setFailed(false);
    if (!value) {
      setResolvedSrc(null);
      return () => { active = false; };
    }
    if (!isProtectedUpload(value)) {
      setResolvedSrc(value);
      return () => { active = false; };
    }

    setResolvedSrc(null);
    loadProtectedImage(value)
      .then((url) => { if (active) setResolvedSrc(url); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [src]);

  if (!resolvedSrc || failed) return <>{fallback}</>;
  return (
    <img
      {...props}
      src={resolvedSrc}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
