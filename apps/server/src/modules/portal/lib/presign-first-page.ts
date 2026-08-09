import { getPresignedGetUrl } from '../../../infrastructure/s3-client.js';

export async function presignFirstPage(documentId: string) {
  const key = `documents/previews/${documentId}/page-1.webp`;
  const ttlSeconds = Number(process.env['PRESIGNED_URL_TTL_SECONDS'] ?? 900);
  const url = await getPresignedGetUrl(key, ttlSeconds);
  return {
    url,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    widthPx: null,
    heightPx: null,
  };
}
