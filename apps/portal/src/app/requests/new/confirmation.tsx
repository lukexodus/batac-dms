'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@batac/ui';

import type { DocumentRequestSubmissionResult } from '@batac/shared/schemas/portal';

interface DocumentRequestConfirmationProps {
  result: DocumentRequestSubmissionResult;
  onReset: () => void;
}

export function DocumentRequestConfirmation({
  result,
  onReset,
}: DocumentRequestConfirmationProps) {
  const submittedDate = new Date(result.submittedAt).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card className="w-full max-w-xl">
      <CardHeader className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-100 text-2xl text-success-900">
          <span aria-hidden="true">✓</span>
        </div>
        <CardTitle className="text-2xl">Request received</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border bg-muted/20 p-4 text-center">
          <p className="text-sm text-muted-foreground">Your reference code</p>
          <p className="mt-1 text-2xl font-bold tracking-wide">{result.referenceCode}</p>
          <p className="mt-1 text-sm text-muted-foreground">Submitted {submittedDate}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">Estimated processing time</p>
            <p className="mt-1 text-xl font-semibold">
              {result.estimatedWorkingDays
                ? `${result.estimatedWorkingDays} working day${
                    result.estimatedWorkingDays === 1 ? '' : 's'
                  }`
                : 'To be confirmed'}
            </p>
          </div>
          <div className="rounded-md border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">What happens next</p>
            <p className="mt-1 text-sm text-text-primary">
              Vice Mayor and SP Secretary approval is required before a copy can be
              released.
            </p>
          </div>
        </div>

        <p className="text-text-primary">{result.message}</p>

        {result.printableFormUrl ? (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm">
              Download your printable document request form, print it, sign it, and
              bring it to the SP Secretariat for processing.
            </p>
            <Button asChild className="mt-3">
              <a href={result.printableFormUrl} target="_blank" rel="noopener noreferrer">
                Download request form
              </a>
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              The download link is valid for 24 hours.
            </p>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/20 p-4 text-sm">
            Bring your reference code <strong>{result.referenceCode}</strong> to the SP
            Secretariat so staff can prepare and print the form with you for signing.
          </div>
        )}

        <div className="rounded-md border border-warning-300 bg-warning-50 p-4 text-sm text-warning-950">
          Payment is collected in person after approval. Bring a government-issued ID
          when you pick up the approved copy so staff can verify your identity before
          release.
        </div>
      </CardContent>
      <div className="flex justify-center pb-6">
        <Button type="button" variant="secondary" onClick={onReset}>
          Submit another request
        </Button>
      </div>
    </Card>
  );
}
