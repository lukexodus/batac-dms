import React, { useMemo, useState } from 'react';

import { Combobox } from '@batac/ui';

import { trpc } from '../lib/trpc';

export interface DocumentPickerProps {
  value: string | null;
  onChange: (documentId: string | null) => void;
  disabled?: boolean;
  lifecycleState?: 'draft' | 'submitted' | 'in_workflow' | 'pending_mayor_action' | 'pending_panlalawigan_review' | 'completed' | 'released' | 'archived' | 'disposed' | 'cancelled' | 'superseded';
}

export function DocumentPicker({ value, onChange, disabled, lifecycleState = 'submitted' }: DocumentPickerProps) {
  const [localQuery, setLocalQuery] = useState('');

  const { data, isLoading } = trpc.documents.list.useQuery({
    lifecycleState,
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
      emptyText={`No ${lifecycleState.replace('_', ' ')} documents found.`}
      {...(disabled !== undefined ? { disabled } : {})}
    />
  );
}
