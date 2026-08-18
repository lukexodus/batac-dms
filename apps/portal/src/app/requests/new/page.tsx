'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import {
  DocumentRequestSubmissionRequestSchema,
  type DocumentRequestSubmissionRequest,
  type DocumentRequestSubmissionResponse,
  type DocumentRequestSubmissionResult,
  type PublicDocumentType,
} from '@batac/shared/schemas/portal';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from '@batac/ui';

import { DocumentRequestConfirmation } from './confirmation';

import type { Path, Resolver } from 'react-hook-form';

import { PortalApiError, portalFetch } from '@/lib/api-client';

const DOCUMENT_TYPE_OPTIONS: { value: PublicDocumentType; label: string }[] = [
  { value: 'SP_RESOLUTION', label: 'SP Resolution' },
  { value: 'SP_ORDINANCE', label: 'SP Ordinance' },
  { value: 'APPROPRIATION_ORDINANCE', label: 'Appropriation Ordinance' },
];

const ACCESS_MODE_OPTIONS = [
  {
    value: 'digital_form',
    title: 'Fill out the form online',
    description:
      'Complete the form now, then download a printable copy to sign and submit to the SP Secretariat.',
  },
  {
    value: 'clerk_assisted',
    title: 'Finish with a clerk in person',
    description:
      'Capture your request now, then visit the SP Secretariat where staff can print the form and help you complete the in-person signing step.',
  },
] as const;

const FRIENDLY_MESSAGES: Record<string, string> = {
  invalid_value: 'Please select an option',
  invalid_literal: 'Please select an option',
  invalid_type: 'This field is required',
};

const KNOWN_FIELDS = new Set<string>([
  'requesterName',
  'requesterAgency',
  'requesterEmail',
  'requesterPhone',
  'documentType',
  'documentTitle',
  'documentNumber',
  'numberOfPagesCopied',
  'purpose',
  'idType',
  'accessMode',
]);

const documentRequestResolver: Resolver<DocumentRequestSubmissionRequest> = (
  values,
  context,
  options
) => {
  const zod = zodResolver(
    DocumentRequestSubmissionRequestSchema
  ) as unknown as Resolver<DocumentRequestSubmissionRequest>;
  const result = zod(values, context, options);
  if ('errors' in result) {
    const errors = result.errors as Record<string, { type?: string; message?: string } | undefined>;
    for (const key of Object.keys(errors)) {
      const fieldError = errors[key];
      if (fieldError?.type) {
        const friendly = FRIENDLY_MESSAGES[fieldError.type];
        if (friendly) {
          fieldError.message = friendly;
        }
      }
    }
  }
  return result;
};

const emptyToUndefined = (value: unknown): string | undefined =>
  value === '' ? undefined : typeof value === 'string' ? value : undefined;

const optionalInteger = (value: unknown): number | undefined => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getDefaultValues = (
  refValue?: string
): (Partial<DocumentRequestSubmissionRequest> & { accessMode: 'digital_form' }) => {
  const defaults: Partial<DocumentRequestSubmissionRequest> & {
    accessMode: 'digital_form';
  } = {
    accessMode: 'digital_form',
  };

  if (refValue) {
    defaults.documentTitle = refValue;
    defaults.documentNumber = refValue;
  }

  return defaults;
};

function parseServerValidationErrors(
  err: PortalApiError
): Array<{ field: string; message: string }> {
  if (Array.isArray(err.details)) {
    const out: Array<{ field: string; message: string }> = [];
    for (const detail of err.details) {
      if (detail && typeof detail.field === 'string' && detail.message) {
        out.push({ field: detail.field, message: detail.message });
      }
    }
    return out;
  }

  if (typeof err.message === 'string' && err.message.includes('body/')) {
    const out: Array<{ field: string; message: string }> = [];
    for (const segment of err.message.split(', ')) {
      const match = /^body\/([^ ]+) (.+)$/.exec(segment);
      const field = match?.[1];
      const message = match?.[2];
      if (field && message && KNOWN_FIELDS.has(field)) {
        out.push({ field, message });
      }
    }
    return out;
  }

  return [];
}

function DocumentRequestForm() {
  const searchParams = useSearchParams();
  const prefillRef = searchParams.get('ref')?.trim() || undefined;

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<DocumentRequestSubmissionRequest>({
    resolver: documentRequestResolver,
    defaultValues: getDefaultValues(prefillRef),
  });

  const watchedAccessMode = useWatch({ control, name: 'accessMode' });
  const [confirmation, setConfirmation] = useState<DocumentRequestSubmissionResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!prefillRef) {
      return;
    }
    if (!getValues('documentNumber')) {
      setValue('documentNumber', prefillRef, { shouldDirty: false });
    }
    if (!getValues('documentTitle')) {
      setValue('documentTitle', prefillRef, { shouldDirty: false });
    }
  }, [getValues, prefillRef, setValue]);

  const onSubmit = async (data: DocumentRequestSubmissionRequest) => {
    setServerError(null);
    clearErrors();
    try {
      const response = await portalFetch<DocumentRequestSubmissionResponse>(
        '/public/document-requests',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );
      setConfirmation(response.data);
    } catch (err) {
      if (err instanceof PortalApiError) {
        if (err.statusCode === 429) {
          setServerError('Too many submissions. Please try again later.');
          return;
        }
        if (err.statusCode === 400) {
          const fieldErrors = parseServerValidationErrors(err);
          if (fieldErrors.length > 0) {
            for (const fieldError of fieldErrors) {
              setError(fieldError.field as Path<DocumentRequestSubmissionRequest>, {
                type: 'server',
                message: fieldError.message,
              });
            }
            return;
          }
        }
        setServerError(err.message);
      } else {
        setServerError(
          'Something went wrong while submitting your request. Please try again.'
        );
      }
    }
  };

  if (confirmation) {
    return (
      <main className="flex min-h-screen items-start justify-center bg-surface-base px-4 py-12 text-text-primary">
        <DocumentRequestConfirmation
          result={confirmation}
          onReset={() => {
            setConfirmation(null);
            reset(getDefaultValues(prefillRef));
          }}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-base px-4 py-8 text-text-primary">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-text-secondary hover:underline">
          ← Back to portal home
        </Link>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-2xl">Request a document copy</CardTitle>
            <CardDescription>
              Submit a no-login request for a certified copy of an SP document. Payment
              is collected in person after approval, not online.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <CardContent className="space-y-6">
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">
                  How do you want to complete this request?
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ACCESS_MODE_OPTIONS.map((mode) => {
                    const selected = watchedAccessMode === mode.value;
                    return (
                      <label
                        key={mode.value}
                        className={cn(
                          'flex cursor-pointer flex-col gap-1.5 rounded-md border p-4 transition-colors',
                          selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        )}
                      >
                        <span className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            className="h-4 w-4 accent-primary"
                            value={mode.value}
                            {...register('accessMode')}
                          />
                          <span className="text-sm font-semibold">{mode.title}</span>
                        </span>
                        <span className="text-sm text-muted-foreground">{mode.description}</span>
                      </label>
                    );
                  })}
                </div>
                {errors.accessMode && (
                  <p id="accessMode-error" className="text-destructive text-sm">
                    {errors.accessMode.message}
                  </p>
                )}
              </fieldset>

              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Request details
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="documentType">
                    Document type <span className="text-danger-500">*</span>
                  </Label>
                  <Controller
                    name="documentType"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <SelectTrigger
                          id="documentType"
                          aria-invalid={!!errors.documentType}
                          aria-describedby={errors.documentType ? 'documentType-error' : undefined}
                        >
                          <SelectValue placeholder="Select the kind of document" />
                        </SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.documentType && (
                    <p id="documentType-error" className="text-destructive text-sm">
                      {errors.documentType.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="documentTitle">
                    Document title <span className="text-danger-500">*</span>
                  </Label>
                  <Input
                    id="documentTitle"
                    placeholder="Enter the document title or keep the copied reference and update it if you know the full title"
                    aria-invalid={!!errors.documentTitle}
                    aria-describedby={
                      errors.documentTitle
                        ? 'documentTitle-error'
                        : prefillRef
                          ? 'documentTitle-prefill'
                          : undefined
                    }
                    {...register('documentTitle', {
                      setValueAs: emptyToUndefined,
                    })}
                  />
                  {prefillRef && (
                    <p id="documentTitle-prefill" className="text-xs text-muted-foreground">
                      A document reference from the link was copied here for convenience.
                    </p>
                  )}
                  {errors.documentTitle && (
                    <p id="documentTitle-error" className="text-destructive text-sm">
                      {errors.documentTitle.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="documentNumber">
                      Document number <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="documentNumber"
                      placeholder="e.g. 7SP 2026-04"
                      aria-invalid={!!errors.documentNumber}
                      aria-describedby={
                        errors.documentNumber
                          ? 'documentNumber-error'
                          : prefillRef
                            ? 'documentNumber-prefill'
                            : undefined
                      }
                      {...register('documentNumber', {
                        setValueAs: emptyToUndefined,
                      })}
                    />
                    {prefillRef && (
                      <p id="documentNumber-prefill" className="text-xs text-muted-foreground">
                        Pre-filled from the `?ref=` link you followed. You can edit it if needed.
                      </p>
                    )}
                    {errors.documentNumber && (
                      <p id="documentNumber-error" className="text-destructive text-sm">
                        {errors.documentNumber.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="numberOfPagesCopied">
                      Number of pages to copy{' '}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="numberOfPagesCopied"
                      type="number"
                      min={1}
                      inputMode="numeric"
                      placeholder="e.g. 3"
                      aria-invalid={!!errors.numberOfPagesCopied}
                      {...register('numberOfPagesCopied', {
                        setValueAs: optionalInteger,
                      })}
                    />
                    {errors.numberOfPagesCopied && (
                      <p className="text-destructive text-sm">
                        {errors.numberOfPagesCopied.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purpose">
                    Purpose of request <span className="text-danger-500">*</span>
                  </Label>
                  <Textarea
                    id="purpose"
                    rows={4}
                    placeholder="Explain why you are requesting a copy of this document"
                    aria-invalid={!!errors.purpose}
                    aria-describedby={errors.purpose ? 'purpose-error' : undefined}
                    {...register('purpose', {
                      setValueAs: emptyToUndefined,
                    })}
                  />
                  {errors.purpose && (
                    <p id="purpose-error" className="text-destructive text-sm">
                      {errors.purpose.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Requester details
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="requesterName">
                    Full name <span className="text-danger-500">*</span>
                  </Label>
                  <Input
                    id="requesterName"
                    placeholder="Your full name"
                    aria-invalid={!!errors.requesterName}
                    {...register('requesterName', {
                      setValueAs: emptyToUndefined,
                    })}
                  />
                  {errors.requesterName && (
                    <p className="text-destructive text-sm">{errors.requesterName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requesterAgency">
                    Agency / organization{' '}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="requesterAgency"
                    placeholder="Agency, office, school, or organization"
                    aria-invalid={!!errors.requesterAgency}
                    {...register('requesterAgency', {
                      setValueAs: emptyToUndefined,
                    })}
                  />
                  {errors.requesterAgency && (
                    <p className="text-destructive text-sm">{errors.requesterAgency.message}</p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="requesterEmail">
                      Email <span className="text-danger-500">*</span>
                    </Label>
                    <Input
                      id="requesterEmail"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      aria-invalid={!!errors.requesterEmail}
                      {...register('requesterEmail', {
                        setValueAs: emptyToUndefined,
                      })}
                    />
                    {errors.requesterEmail && (
                      <p className="text-destructive text-sm">{errors.requesterEmail.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="requesterPhone">
                      Phone number <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="requesterPhone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="e.g. 0917 123 4567"
                      aria-invalid={!!errors.requesterPhone}
                      {...register('requesterPhone', {
                        setValueAs: emptyToUndefined,
                      })}
                    />
                    <p className="text-xs text-muted-foreground">
                      This is the primary contact channel when your request is approved
                      and ready for payment.
                    </p>
                    {errors.requesterPhone && (
                      <p className="text-destructive text-sm">{errors.requesterPhone.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="idType">
                    Government-issued ID to present at pickup{' '}
                    <span className="text-danger-500">*</span>
                  </Label>
                  <Input
                    id="idType"
                    placeholder="e.g. Government employee ID, birth certificate, barangay residency certificate, passport"
                    aria-invalid={!!errors.idType}
                    {...register('idType', {
                      setValueAs: emptyToUndefined,
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Identity must be verified before the approved copy can be released.
                  </p>
                  {errors.idType && (
                    <p className="text-destructive text-sm">{errors.idType.message}</p>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-warning-300 bg-warning-50 p-4 text-sm text-warning-950">
                This online form does not complete the transaction. Payment is collected
                in person after approval, and staff must verify a government-issued ID at
                pickup before releasing the copy.
              </div>

              {serverError && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {serverError}
                </div>
              )}
            </CardContent>

            <CardFooter className="justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting…' : 'Submit request'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  );
}

export default function PortalDocumentRequestFormPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-start justify-center bg-surface-base px-4 py-12 text-text-primary">
          <p role="status">Loading request form…</p>
        </main>
      }
    >
      <DocumentRequestForm />
    </Suspense>
  );
}
