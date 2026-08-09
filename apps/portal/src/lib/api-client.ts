import { env } from '@/config/env.portal';

export class PortalApiError extends Error {
  constructor(
    public statusCode: number,
    public errorType: string,
    message: string,
    public details?: Array<{ field: string; message: string; code?: string }>
  ) {
    super(message);
    this.name = 'PortalApiError';
  }
}

interface ErrorResponseBody {
  statusCode?: number;
  error?: string;
  message?: string;
  details?: Array<{ field: string; message: string; code?: string }>;
}

export async function portalFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await res.json()) as T & ErrorResponseBody;
  if (!res.ok) {
    throw new PortalApiError(
      body.statusCode ?? res.status,
      body.error ?? 'Error',
      body.message ?? 'Request failed.',
      body.details
    );
  }
  return body;
}
