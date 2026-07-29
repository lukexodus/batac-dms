import React, { useMemo, useState } from 'react';

import { Combobox } from '@batac/ui';

import { trpc } from '../lib/trpc';

export interface DocumentPickerProps {
  value: string | null;
  onChange: (documentId: string | null) => void;
  disabled?: boolean;
}

export function DocumentPicker({ value, onChange, disabled }: DocumentPickerProps) {
  const [localQuery, setLocalQuery] = useState('');

  const { data, isLoading } = trpc.documents.list.useQuery({
    lifecycleState: 'submitted',
    limit: 25,
  });

  const items = useMemo(() => {
    const all = data?.items ?? [];
    if (!localQuery) return all;
    const q = localQuery.toLowerCase();
    return all.filter((doc) => doc.title.toLowerCase().includes(q));
  }, [data, localQuery]);

  return (
    <Combobox
      value={value}
      onChange={onChange}
      items={items}
      getItemId={(item) => item.id}
      getItemLabel={(item) => item.title}
      getItemSublabel={(item) => item.preliminaryNumber ?? item.finalNumber ?? undefined}
      onSearchChange={setLocalQuery}
      isLoading={isLoading}
      placeholder="Pick a document…"
      searchPlaceholder="Filter by title…"
      emptyText="No submitted documents found."
      {...(disabled !== undefined ? { disabled } : {})}
    />
  );
}
