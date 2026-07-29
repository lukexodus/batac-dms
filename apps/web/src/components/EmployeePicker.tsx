import React, { useState } from 'react';

import { Combobox } from '@batac/ui';

import { trpc } from '../lib/trpc';

export interface EmployeePickerProps {
  value: string | null;
  onChange: (employeeId: string | null) => void;
  disabled?: boolean;
}

export function EmployeePicker({ value, onChange, disabled }: EmployeePickerProps) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = trpc.organization.listEmployees.useQuery({
    search: search || undefined,
    limit: 25,
  });

  const items = data?.items ?? [];

  return (
    <Combobox
      value={value}
      onChange={onChange}
      items={items}
      getItemId={(item) => item.employeeId}
      getItemLabel={(item) => item.displayName}
      getItemSublabel={(item) => item.positionTitle ?? undefined}
      onSearchChange={setSearch}
      isLoading={isLoading}
      placeholder="Pick an employee…"
      searchPlaceholder="Search by name…"
      emptyText="No employees found."
      {...(disabled !== undefined ? { disabled } : {})}
    />
  );
}
