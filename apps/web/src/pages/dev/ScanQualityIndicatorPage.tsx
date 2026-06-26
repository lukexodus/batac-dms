import React from "react";
import { ScanQualityIndicator } from "@batac/ui";

export default function ScanQualityIndicatorPage() {
  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold mb-2">ScanQualityIndicator</h1>
        <p className="text-neutral-500">Tier 3 component demonstrating boundary mapping and touch-exempt tooltip integration.</p>
      </div>

      <div className="space-y-6">
        <section className="space-y-4">
          <h2 className="text-lg font-medium border-b pb-2">Usage Examples</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-8">
              <div className="w-32 text-sm text-neutral-500">score=97, label</div>
              <ScanQualityIndicator score={97} showLabel={true} />
            </div>
            
            <div className="flex items-center gap-8">
              <div className="w-32 text-sm text-neutral-500">score=92, label</div>
              <ScanQualityIndicator score={92} showLabel={true} />
            </div>
            
            <div className="flex items-center gap-8">
              <div className="w-32 text-sm text-neutral-500">score=65, label</div>
              <ScanQualityIndicator score={65} showLabel={true} />
            </div>
            
            <div className="flex items-center gap-8">
              <div className="w-32 text-sm text-neutral-500">score=48, no label</div>
              <ScanQualityIndicator score={48} showLabel={false} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium border-b pb-2">Boundary Checks</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-8">
              <div className="w-48 text-sm text-neutral-500">Excellent/Good (95 / 94)</div>
              <div className="flex items-center gap-4">
                <ScanQualityIndicator score={95} showLabel={true} />
                <ScanQualityIndicator score={94} showLabel={true} />
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div className="w-48 text-sm text-neutral-500">Good/Fair (80 / 79)</div>
              <div className="flex items-center gap-4">
                <ScanQualityIndicator score={80} showLabel={true} />
                <ScanQualityIndicator score={79} showLabel={true} />
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div className="w-48 text-sm text-neutral-500">Fair/Poor (60 / 59)</div>
              <div className="flex items-center gap-4">
                <ScanQualityIndicator score={60} showLabel={true} />
                <ScanQualityIndicator score={59} showLabel={true} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
