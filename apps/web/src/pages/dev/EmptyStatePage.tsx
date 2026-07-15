import { FileText, Search } from 'lucide-react';

import { EmptyState } from '@batac/ui';

export default function EmptyStatePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 p-8">
      <section>
        <h2 className="mb-4 text-xl font-bold">With Action</h2>
        <div className="border-border/50 bg-background rounded-md border p-8">
          <EmptyState
            icon={FileText}
            heading="No documents in queue"
            body="Upload a resolution or ordinance to begin the SP workflow."
            action={{
              label: 'Upload Document',
              onClick: () => console.log('Upload Document clicked'),
            }}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Without Action</h2>
        <div className="border-border/50 bg-background rounded-md border p-8">
          <EmptyState
            icon={Search}
            heading="No results match your filters"
            body="Adjust the date range or document type filter to see more results."
          />
        </div>
      </section>
    </div>
  );
}
