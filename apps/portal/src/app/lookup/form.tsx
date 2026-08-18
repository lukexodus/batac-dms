'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@batac/ui/components/ui/button';
import { Input } from '@batac/ui/components/ui/input';

interface TrackingLookupFormProps {
  initialValue: string;
}

export function TrackingLookupForm({ initialValue }: TrackingLookupFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/lookup?q=${encodeURIComponent(q)}`);
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Tracking number on your QR slip, e.g. 3f0c…"
        aria-label="Tracking number"
        className="flex-1 font-mono"
      />
      <Button type="submit" className="shrink-0">
        Track document
      </Button>
    </form>
  );
}
