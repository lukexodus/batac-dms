'use client';

import Image from 'next/image';
import { useState } from 'react';

import { cn } from '@batac/ui/lib/utils';

interface PreviewImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

/**
 * Host allowlist mirroring `apps/portal/next.config.ts`'s
 * `images.remotePatterns` entry. When the presigned URL's host is not
 * allowlisted (e.g. a local S3/minio endpoint during development),
 * `next/image` would throw at render time, so a plain `<img>` fallback is
 * used instead. The production host `https://r2.batac.gov.ph` renders
 * through the Next image optimizer as intended.
 */
const ALLOWED_PREVIEW_HOSTS = new Set(['r2.batac.gov.ph']);

function isAllowedHost(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && ALLOWED_PREVIEW_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Renders a first-page document preview inside a `relative` container that
 * the caller sizes (e.g. `aspect-[3/4] w-full`). Falls back to a
 * "No preview" placeholder when the URL is missing or fails to load.
 */
export function PreviewImage({ src, alt, className }: PreviewImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {src && !failed ? (
        isAllowedHost(src) ? (
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <img
            src={src}
            alt={alt}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
          <span>No preview</span>
        </div>
      )}
    </div>
  );
}
