import { CalendarDays } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, RichTextEditor } from '@batac/ui';

import { isRichTextEmpty } from '@/lib/rich-text';
import { trpc, type RouterOutputs } from '@/lib/trpc';

function getNextTuesdayFormatted(now: Date = new Date()): string {
  const phtTime = new Date(now.getTime() + 8 * 3600 * 1000);
  let daysToTuesday = 2 - phtTime.getUTCDay();
  if (daysToTuesday < 0) daysToTuesday += 7;
  phtTime.setUTCDate(phtTime.getUTCDate() + daysToTuesday);
  const y = phtTime.getUTCFullYear();
  const m = String(phtTime.getUTCMonth() + 1).padStart(2, '0');
  const d = String(phtTime.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function OrderOfBusinessSchedulingPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [comment, setComment] = useState('');
  
  const defaultDate = getNextTuesdayFormatted();
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);

  const scheduleMutation = trpc.session.scheduleDocumentForFirstReading.useMutation({
    onSuccess: () => {
      toast.success('Document scheduled for First Reading successfully.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.documents.get.invalidate({ documentId: instance.documentId });
      void utils.tracking.getRoutingHistory.invalidate({ documentId: instance.documentId });
      navigate('/workflow/steps');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to schedule document.');
    },
  });

  const handleScheduleAndComplete = async () => {
    try {
      await scheduleMutation.mutateAsync({
        documentId: instance.documentId,
        sessionDate: new Date(selectedDate),
        comment: isRichTextEmpty(comment) ? undefined : comment,
      });
    } catch {
      // Handled by onError
    }
  };

  const isSubmitting = scheduleMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary-500" />
          Order of Business Scheduling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Schedule this document to be included in the Order of Business for an upcoming Sangguniang Panlungsod session.</p>
          <p>Once scheduled, it will be formally read on the floor on the selected date.</p>
          <p>The system defaults to the upcoming Tuesday session.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="session-date-picker" className="text-xs">
            Session Date
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="session-date-picker"
              type="date"
              className="w-44"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            {selectedDate !== defaultDate && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(defaultDate)}>
                Reset
              </Button>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Comment (optional)</label>
          <RichTextEditor
            value={comment}
            onChange={setComment}
            placeholder="Enter any comments..."
          />
        </div>

        <Button
          onClick={handleScheduleAndComplete}
          disabled={isSubmitting || !selectedDate}
        >
          {isSubmitting ? 'Processing...' : 'Schedule & Advance Workflow'}
        </Button>
      </CardContent>
    </Card>
  );
}
