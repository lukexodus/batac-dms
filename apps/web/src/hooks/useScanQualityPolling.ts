import { trpc } from '@/lib/trpc';

/**
 * useScanQualityPolling
 *
 * Wraps trpc.documents.getScanQualityIndicator.useQuery with a refetchInterval
 * that polls while scanQualityCategory is null (i.e. OCR has not yet completed).
 * Stops polling the moment a non-null category is received — including on the
 * very first fetch, so a document whose OCR already finished before this page
 * opened never starts an interval at all.
 *
 * Takes versionId (not documentId) — the procedure is keyed on version, not document.
 * Pass undefined to skip the query entirely (e.g. when no version exists yet).
 */
export function useScanQualityPolling(versionId: string | undefined) {
  return trpc.documents.getScanQualityIndicator.useQuery(
    // TypeScript: useQuery input type is { versionId: string } but enabled: false
    // handles the undefined case at runtime — cast is safe here because the query
    // is disabled when versionId is undefined.
    { versionId: versionId! },
    {
      enabled: !!versionId,
      // Poll every 3 seconds while category is unresolved; return false once resolved
      // to stop the interval. TanStack Query interprets a function returning false as
      // "disable further polling".
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data || data.scanQualityCategory === null) {
          return 3000; // 3 s between polls while OCR is pending
        }
        return false; // OCR resolved — stop polling
      },
    },
  );
}
