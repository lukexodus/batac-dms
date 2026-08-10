import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@batac/ui/components/ui/card';

import { TrackingLookupForm } from './form';

import type { TrackingLookupResponse, RoutingHistoryEntry } from '@batac/shared/schemas/tracking';
import type { ReactNode } from 'react';

import { PreviewImage } from '@/components/preview-image';
import { PortalApiError, portalFetch } from '@/lib/api-client';
import { documentRequestHref } from '@/lib/document-request';
import { formatPhDateTime } from '@/lib/format';


export const metadata = { title: 'Track a document' };

interface TrackingLookupPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

function TimelineEntry({ entry }: { entry: RoutingHistoryEntry }) {
  const route = [entry.fromOfficeName, entry.toOfficeName]
    .filter((name): name is string => Boolean(name))
    .join(' → ');

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <span
        aria-hidden
        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-primary-500 bg-white"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">
          {entry.action}
          {entry.actorDisplayName && (
            <span className="font-normal text-text-muted"> — {entry.actorDisplayName}</span>
          )}
        </p>
        {route && <p className="text-xs text-text-muted">{route}</p>}
        <p className="mt-0.5 text-xs text-text-muted">{formatPhDateTime(entry.timestamp)}</p>
      </div>
    </li>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border-subtle py-2 text-sm last:border-0">
      <dt className="shrink-0 text-text-muted">{label}</dt>
      <dd className="text-right font-medium text-text-primary">{value}</dd>
    </div>
  );
}

export default async function TrackingLookupPage({ searchParams }: TrackingLookupPageProps) {
  const params = await searchParams;
  const rawQ = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = rawQ?.trim() ?? '';

  let result: TrackingLookupResponse['data'] | null = null;
  let notFound = false;
  let lookupError: string | null = null;

  if (query) {
    try {
      const response = await portalFetch<TrackingLookupResponse>(
        `/public/tracking/${encodeURIComponent(query)}`,
        { cache: 'no-store' },
      );
      result = response.data;
    } catch (err) {
      if (err instanceof PortalApiError && err.statusCode === 404) {
        notFound = true;
      } else if (err instanceof PortalApiError) {
        lookupError = err.message;
      } else {
        lookupError = 'We could not check this tracking number right now. Please try again.';
      }
    }
  }

  return (
    <main className="min-h-screen bg-surface-base px-4 py-8 text-text-primary">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-text-secondary hover:underline">
          ← Back to portal home
        </Link>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-2xl">Track a document</CardTitle>
            <CardDescription>
              Enter the tracking number printed on your QR slip to see a document’s current status
              and routing history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TrackingLookupForm initialValue={query} />
          </CardContent>
        </Card>

        {query && notFound && (
          <Card className="mt-4">
            <CardContent className="pt-6 text-center text-sm text-text-secondary">
              No document found for that tracking number. Double-check the number on your QR slip
              and try again.
            </CardContent>
          </Card>
        )}

        {query && lookupError && (
          <Card className="mt-4 border-destructive/40 bg-destructive/10">
            <CardContent className="pt-6 text-center text-sm text-destructive">
              {lookupError}
            </CardContent>
          </Card>
        )}

        {result && (
          <div className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {result.documentTypeName}
                  </span>
                  <span className="rounded-full border border-border-default bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-text-primary">
                    {result.lifecycleStatus}
                  </span>
                </div>
                <CardTitle className="mt-2 text-xl leading-snug">{result.title}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-[10rem_1fr]">
                <PreviewImage
                  src={result.firstPagePreview?.url ?? null}
                  alt="First page preview"
                  className="aspect-[3/4] w-full rounded-md"
                />
                <dl className="space-y-1">
                  <InfoRow label="Document type" value={result.documentTypeName} />
                  <InfoRow label="Preliminary number" value={result.preliminaryNumber ?? '—'} />
                  <InfoRow label="Final number" value={result.finalNumber ?? '—'} />
                  <InfoRow
                    label="Tracking number"
                    value={
                      <span className="break-all font-mono text-xs">{result.trackingNumber}</span>
                    }
                  />
                  {result.remarks && <InfoRow label="Remarks" value={result.remarks} />}
                  {result.supersededBy && (
                    <InfoRow label="Superseded by" value={result.supersededBy} />
                  )}
                  {result.closureReason && <InfoRow label="Closure reason" value={result.closureReason} />}
                </dl>
              </CardContent>
            </Card>

            {result.routingHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Routing history</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="relative space-y-0">
                    {result.routingHistory.map((entry) => (
                      <TimelineEntry key={`${entry.timestamp}-${entry.action}`} entry={entry} />
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href={documentRequestHref(result.finalNumber, result.documentId)}>
                <span className="text-sm font-semibold text-text-link hover:underline">
                  Request a certified copy →
                </span>
              </Link>
              <Link href={`/documents/${result.documentId}`} className="text-sm font-semibold text-text-link hover:underline">
                View released document page →
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
