import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@batac/ui/components/ui/card';

import { DocumentsFilterForm } from './filters';

import type { PublishedDocumentListResponse } from '@batac/shared/schemas/portal';

import { PreviewImage } from '@/components/preview-image';
import { PortalApiError, portalFetch } from '@/lib/api-client';
import { formatPhDate } from '@/lib/format';

export const metadata = { title: 'Published documents' };

const PAGE_SIZE = 20;

interface DocumentsPageProps {
  searchParams: Promise<{
    q?: string | string[];
    documentType?: string | string[];
    year?: string | string[];
    page?: string | string[];
  }>;
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function clampPage(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

/**
 * Builds the URL query for both the public API and client-side page links
 * from the same inputs, so list rendering and pagination always agree.
 */
function queryFor(q: string, documentType: string, year: string, page: number): URLSearchParams {
  const params = new URLSearchParams();
  if (q.trim().length >= 2) params.set('q', q.trim());
  if (documentType) params.set('documentType', documentType);
  if (year) params.set('year', year);
  if (page > 1) params.set('page', String(page));
  return params;
}

function pageUrl(q: string, documentType: string, year: string, page: number): string {
  const qs = queryFor(q, documentType, year, page).toString();
  return qs ? `/documents?${qs}` : '/documents';
}

export default async function PublishedDocumentsPage({ searchParams }: DocumentsPageProps) {
  const params = await searchParams;
  const q = firstValue(params.q);
  const documentType = firstValue(params.documentType);
  const year = firstValue(params.year);
  const page = clampPage(firstValue(params.page));

  let data: PublishedDocumentListResponse | null = null;
  let listError: string | null = null;

  const apiQuery = queryFor(q, documentType, year, page);
  apiQuery.set('limit', String(PAGE_SIZE));

  try {
    data = await portalFetch<PublishedDocumentListResponse>(`/public/documents?${apiQuery.toString()}`, {
      cache: 'no-store',
    });
  } catch (err) {
    if (err instanceof PortalApiError) {
      listError = err.message;
    } else {
      listError = 'We could not load the documents list right now. Please try again.';
    }
  }

  return (
    <main className="min-h-screen bg-surface-base px-4 py-8 text-text-primary">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm text-text-secondary hover:underline">
          ← Back to portal home
        </Link>

        <header className="mt-4">
          <h1 className="text-3xl font-bold">Published documents</h1>
          <p className="mt-2 text-text-secondary">
            Resolutions, ordinances, and appropriation ordinances released by the Sangguniang
            Panlungsod. First-page previews are shown; full copies are available on request.
          </p>
        </header>

        <div className="mt-6 rounded-md border border-border-default bg-white p-4">
          <DocumentsFilterForm q={q} documentType={documentType} year={year} />
        </div>

        {listError && (
          <div
            role="alert"
            className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {listError}
          </div>
        )}

        {data && (
          <>
            <p className="mt-6 text-sm text-text-muted">
              {data.meta.total === 0
                ? 'No published documents match your filters.'
                : `${data.meta.total} document${data.meta.total === 1 ? '' : 's'} found`}
            </p>

            {data.data.length > 0 && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.data.map((document) => (
                  <Link
                    key={document.documentId}
                    href={`/documents/${document.documentId}`}
                    className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Card className="flex h-full flex-col overflow-hidden transition-colors group-hover:bg-surface-raised">
                      <PreviewImage
                        src={document.firstPagePreview?.url ?? null}
                        alt={`First page preview of ${document.title}`}
                        className="aspect-[3/4] w-full"
                      />
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-border-default bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold">
                            {document.documentTypeName}
                          </span>
                          {document.supersededBy && (
                            <span className="rounded-full border border-danger-500 bg-danger-50 px-2.5 py-0.5 text-xs font-semibold text-danger-700">
                              Superseded
                            </span>
                          )}
                        </div>
                        <CardTitle className="mt-1 line-clamp-2 text-base leading-snug">
                          {document.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-1 font-mono text-xs">
                          {document.finalNumber}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="mt-auto pt-0 text-sm text-text-muted">
                        Approved {formatPhDate(document.approvedAt)}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            {data.meta.totalPages > 1 && (
              <nav
                aria-label="Documents pages"
                className="mt-8 flex items-center justify-between gap-4 border-t border-border-default pt-4"
              >
                {data.meta.hasPrevPage ? (
                  <Link
                    href={pageUrl(q, documentType, year, page - 1)}
                    className="text-sm font-semibold text-text-link hover:underline"
                  >
                    ← Previous
                  </Link>
                ) : (
                  <span className="text-sm text-text-muted">← Previous</span>
                )}
                <span className="text-sm text-text-muted">
                  Page {data.meta.page} of {data.meta.totalPages}
                </span>
                {data.meta.hasNextPage ? (
                  <Link
                    href={pageUrl(q, documentType, year, page + 1)}
                    className="text-sm font-semibold text-text-link hover:underline"
                  >
                    Next →
                  </Link>
                ) : (
                  <span className="text-sm text-text-muted">Next →</span>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
