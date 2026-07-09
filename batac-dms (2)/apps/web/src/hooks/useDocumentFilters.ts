import { useSearchParams } from 'react-router-dom';
import { useMemo, useCallback } from 'react';
import type { RouterInputs } from '../lib/trpc';

type ListDocumentsInput = RouterInputs['documents']['list'];

export function useDocumentFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    return {
      documentTypeId: searchParams.get('documentTypeId') || undefined,
      lifecycleState: searchParams.get('lifecycleState') || undefined,
      officeId: searchParams.get('officeId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    } as Partial<ListDocumentsInput>;
  }, [searchParams]);

  const setFilters = useCallback((newFilters: Partial<ListDocumentsInput>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          next.set(key, String(value));
        } else {
          next.delete(key);
        }
      });
      return next;
    });
  }, [setSearchParams]);

  return { filters, setFilters };
}
