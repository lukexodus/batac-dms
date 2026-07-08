import { FileText, Search } from "lucide-react";

import { EmptyState } from "@batac/ui";

export default function EmptyStatePage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-12">
      <section>
        <h2 className="text-xl font-bold mb-4">With Action</h2>
        <div className="p-8 border border-border/50 rounded-md bg-background">
          <EmptyState
            icon={FileText}
            heading="No documents in queue"
            body="Upload a resolution or ordinance to begin the SP workflow."
            action={{ label: "Upload Document", onClick: () => console.log("Upload Document clicked") }}
          />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Without Action</h2>
        <div className="p-8 border border-border/50 rounded-md bg-background">
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
