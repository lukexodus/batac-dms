'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@batac/ui/components/ui/button';
import { Input } from '@batac/ui/components/ui/input';

import type { PublicDocumentType } from '@batac/shared/schemas/portal';

const DOCUMENT_TYPE_OPTIONS: { value: PublicDocumentType; label: string }[] = [
  { value: 'SP_RESOLUTION', label: 'Resolution' },
  { value: 'SP_ORDINANCE', label: 'Ordinance' },
  { value: 'APPROPRIATION_ORDINANCE', label: 'Appropriation Ordinance' },
];

const YEARS: number[] = [];
const CURRENT_YEAR = new Date().getFullYear();
for (let y = CURRENT_YEAR; y >= 2010; y -= 1) {
  YEARS.push(y);
}

interface DocumentsFilterFormProps {
  q: string;
  documentType: string;
  year: string;
}

export function DocumentsFilterForm({ q, documentType, year }: DocumentsFilterFormProps) {
  const router = useRouter();
  const [qValue, setQValue] = useState(q);
  const [typeValue, setTypeValue] = useState(documentType);
  const [yearValue, setYearValue] = useState(year);

  const applyFilters = (nextQ: string, nextType: string, nextYear: string) => {
    const search = new URLSearchParams();
    if (nextQ.trim().length >= 2) search.set('q', nextQ.trim());
    if (nextType) search.set('documentType', nextType);
    if (nextYear) search.set('year', nextYear);
    const qs = search.toString();
    router.push(qs ? `/documents?${qs}` : '/documents');
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(qValue, typeValue, yearValue);
  };

  const onReset = () => {
    setQValue('');
    setTypeValue('');
    setYearValue('');
    router.push('/documents');
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <div className="flex-1 space-y-1.5">
        <label htmlFor="filter-q" className="text-xs font-medium text-text-muted">
          Search title
        </label>
        <Input
          id="filter-q"
          value={qValue}
          onChange={(e) => setQValue(e.target.value)}
          placeholder="Search resolutions and ordinances…"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="filter-type" className="text-xs font-medium text-text-muted">
          Document type
        </label>
        <select
          id="filter-type"
          value={typeValue}
          onChange={(e) => setTypeValue(e.target.value)}
          className="h-10 w-full rounded-md border border-border-default bg-white px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-48"
        >
          <option value="">All types</option>
          {DOCUMENT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="filter-year" className="text-xs font-medium text-text-muted">
          Year
        </label>
        <select
          id="filter-year"
          value={yearValue}
          onChange={(e) => setYearValue(e.target.value)}
          className="h-10 w-full rounded-md border border-border-default bg-white px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-32"
        >
          <option value="">All years</option>
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit">Filter</Button>
        <Button type="button" variant="outline" onClick={onReset}>
          Reset
        </Button>
      </div>
    </form>
  );
}
