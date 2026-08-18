import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@batac/ui/components/ui/card';

import type {
  PublicPanlalawiganOutcome,
  PublishedDocumentDetailResponse,
} from '@batac/shared/schemas/portal';

import { PreviewImage } from '@/components/preview-image';
import { PortalApiError, portalFetch } from '@/lib/api-client';
import { documentRequestHref } from '@/lib/document-request';
import { formatPhDate } from '@/lib/format';

export const metadata = { title: 'Document details' };

interface DocumentDetailPageProps {
  params: Promise<{ documentId: string }>;
}

const PANLALAWIGAN_OUTCOME_LABELS: Record<Exclude<PublicPanlalawiganOutcome, null>, string> = {
  valid: 'Valid',
  valid_in_part: 'Valid in part',
  returned: 'Returned',
  operative_in_its_entirety: 'Operative in its entirety',
  deemed_approved: 'Deemed approved (30-day lapse)',
};

function ListValue({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <span className="font-medium text-text-primary">{empty}</span>;
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item} className="font-medium text-text-primary">
          {item}
        </li>
      ))}
    </ul>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

export default async function PublishedDocumentDetailPage({ params }: DocumentDetailPageProps) {
  const { documentId } = await params;

  let data: PublishedDocumentDetailResponse['data'];
  try {
    const response = await portalFetch<PublishedDocumentDetailResponse>(
      `/public/documents/${encodeURIComponent(documentId)}`,
      { cache: 'no-store' },
    );
    data = response.data;
  } catch (err) {
    if (err instanceof PortalApiError && err.statusCode === 404) {
      notFound();
    }
    throw err;
  }

  return (
    <main className="min-h-screen bg-surface-base px-4 py-8 text-text-primary">
      <div className="mx-auto max-w-4xl">
        <Link href="/documents" className="text-sm text-text-secondary hover:underline">
          ← Back to published documents
        </Link>

        <Card className="mt-4">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border-default bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold">
                {data.documentTypeName}
              </span>
              {data.supersededBy && (
                <span className="rounded-full border border-danger-500 bg-danger-50 px-2.5 py-0.5 text-xs font-semibold text-danger-700">
                  Superseded
                </span>
              )}
            </div>
            <CardTitle className="mt-2 text-2xl leading-snug">{data.title}</CardTitle>
            <CardDescription className="font-mono text-sm">{data.finalNumber}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-[16rem_1fr]">
            <PreviewImage
              src={data.firstPagePreview?.url ?? null}
              alt={`First page preview of ${data.title}`}
              className="aspect-[3/4] w-full rounded-md"
            />
            <dl className="divide-y divide-border-subtle">
              <DetailRow label="Approved on">{formatPhDate(data.approvedAt)}</DetailRow>
              <DetailRow label="Released to the portal on">
                {formatPhDate(data.releasedAt)}
              </DetailRow>
              <DetailRow label="Authors">
                <ListValue items={data.authors} empty="Not listed" />
              </DetailRow>
              <DetailRow label="Sponsors">
                <ListValue items={data.sponsors} empty="Not listed" />
              </DetailRow>
              <DetailRow label="Committees">
                <ListValue items={data.committees} empty="Not listed" />
              </DetailRow>
              <DetailRow label="Sangguniang Panlalawigan review">
                {data.panlalawiganOutcome
                  ? `${PANLALAWIGAN_OUTCOME_LABELS[data.panlalawiganOutcome]}${data.panlalawiganOutcomeDate ? ` (${formatPhDate(data.panlalawiganOutcomeDate)})` : ''}`
                  : 'Pending'}
              </DetailRow>
              <DetailRow label="Newspaper publication">
                {data.hasNewspaperPublication
                  ? `Published${data.newspaperPublicationDate ? ` on ${formatPhDate(data.newspaperPublicationDate)}` : ''}`
                  : 'Not required'}
              </DetailRow>
              {data.closureReason && (
                <DetailRow label="Closure reason">{data.closureReason}</DetailRow>
              )}
            </dl>
          </CardContent>
        </Card>

        <p className="mt-4 text-sm text-text-muted">
          Only the first page is shown here. Subsequent pages are not published; request a
          certified copy for the full document.
        </p>

        <div className="mt-4">
          <Link
            href={documentRequestHref(data.finalNumber, data.documentId)}
            className="inline-flex h-10 items-center rounded-md bg-primary-800 px-4 py-2 text-sm font-medium text-white hover:bg-primary-900 active:bg-primary-950"
          >
            Request a certified copy
          </Link>
        </div>
      </div>
    </main>
  );
}
