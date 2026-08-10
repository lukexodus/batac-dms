'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@batac/ui';

import type { ComplaintSubmissionResult } from '@batac/shared/schemas/portal';

interface ComplaintConfirmationProps {
  result: ComplaintSubmissionResult;
  onReset: () => void;
}

/**
 * Confirmation view shown after a successful complaint submission
 * (TASK-PORTAL-010). Displays the returned `referenceCode`, the server's
 * message, and — only for `digital_form` submissions — a download link for
 * the system-generated printable form. `clerk_assisted` submissions get an
 * in-person filing note instead, since no printable form is generated for
 * that mode.
 */
export function ComplaintConfirmation({ result, onReset }: ComplaintConfirmationProps) {
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
        <CardTitle className="text-2xl">Complaint received</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border bg-muted/20 p-4 text-center">
          <p className="text-sm text-muted-foreground">Your reference number</p>
          <p className="mt-1 text-2xl font-bold tracking-wide">{result.referenceCode}</p>
          <p className="mt-1 text-sm text-muted-foreground">Submitted {submittedDate}</p>
        </div>

        <p className="text-text-primary">{result.message}</p>

        {result.printableFormUrl ? (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm">
              Download a printable copy of your complaint form. Print it, sign it, and submit it to
              the SP Secretariat with any supporting documents.
            </p>
            <Button asChild className="mt-3">
              <a href={result.printableFormUrl} target="_blank" rel="noopener noreferrer">
                Download complaint form
              </a>
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              The download link is valid for 24 hours.
            </p>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/20 p-4 text-sm">
            Bring your reference number{' '}
            <strong>{result.referenceCode}</strong> to the SP Secretariat at the Batac City
            Legislative Building to file and sign your complaint in person. Our staff will help you
            complete the remaining steps.
          </div>
        )}
      </CardContent>
      <div className="flex justify-center pb-6">
        <Button type="button" variant="secondary" onClick={onReset}>
          Submit another complaint
        </Button>
      </div>
    </Card>
  );
}
