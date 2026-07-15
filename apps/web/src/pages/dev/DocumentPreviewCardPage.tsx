import React from 'react';

import { DocumentPreviewCard } from '@batac/ui/components/domain/DocumentPreviewCard';

import type { DocumentPreview } from '@batac/ui/types/domain';

const interactiveDocWithSLA: DocumentPreview = {
  id: 'doc-001',
  documentNumber: '7SP 2026-001',
  numberVariant: 'final',
  title:
    'An Ordinance Providing for the Comprehensive Solid Waste Management Program of the City of Batac, Ilocos Norte, Appropriating Funds Therefor, and for Other Purposes.',
  documentState: 'PANLALAWIGAN_REVIEW',
  lastActionAt: new Date('2026-06-13T09:00:00+08:00'),
  slaDeadlineAt: new Date('2026-07-13T09:00:00+08:00'),
  slaStartedAt: new Date('2026-06-13T09:00:00+08:00'),
  thumbnailUrl: 'https://placehold.co/300x400/e5e5e5/a3a3a3?text=Preview',
};

const docNoSLA: DocumentPreview = {
  id: 'doc-002',
  documentNumber: '7SP 2026-002',
  numberVariant: 'final',
  title: 'A Resolution Commending the Local Police Force for their Service.',
  documentState: 'ARCHIVED',
  lastActionAt: new Date('2026-05-10T14:30:00+08:00'),
  slaDeadlineAt: new Date('2026-05-20T14:30:00+08:00'), // SLA fields present, but state is ARCHIVED
  slaStartedAt: new Date('2026-05-10T14:30:00+08:00'),
};

const docNoThumbnail: DocumentPreview = {
  id: 'doc-003',
  documentNumber: '12345',
  numberVariant: 'preliminary',
  title: 'Citizen Complaint regarding Noise Pollution in Barangay 1.',
  documentState: 'PENDING_MAYOR',
  lastActionAt: new Date('2026-06-25T10:00:00+08:00'),
  slaDeadlineAt: new Date('2026-07-05T10:00:00+08:00'),
  slaStartedAt: new Date('2026-06-25T10:00:00+08:00'),
};

export function DocumentPreviewCardPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 p-8">
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Interactive with SLATimer</h2>
        <p className="text-sm text-neutral-500">
          State is PANLALAWIGAN_REVIEW and SLA fields are present. `onClick` is provided, so it is
          interactive.
        </p>
        <div className="max-w-[280px]">
          <DocumentPreviewCard
            document={interactiveDocWithSLA}
            onClick={() => console.log('Clicked doc-001')}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Non-interactive, No SLATimer</h2>
        <p className="text-sm text-neutral-500">
          State is ARCHIVED. SLA fields are present, but SLATimer should NOT render. No `onClick`
          provided.
        </p>
        <div className="max-w-[280px]">
          <DocumentPreviewCard document={docNoSLA} />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">No Thumbnail, Interactive with SLATimer</h2>
        <p className="text-sm text-neutral-500">State is PENDING_MAYOR.</p>
        <div className="max-w-[280px]">
          <DocumentPreviewCard
            document={docNoThumbnail}
            onClick={() => console.log('Clicked doc-003')}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Loading Skeleton</h2>
        <p className="text-sm text-neutral-500">
          `isLoading` is true. Skeleton placeholders should match real content positions.
        </p>
        <div className="max-w-[280px]">
          <DocumentPreviewCard document={interactiveDocWithSLA} isLoading={true} />
        </div>
      </div>
    </div>
  );
}

export default DocumentPreviewCardPage;
