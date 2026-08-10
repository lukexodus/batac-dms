'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import {
  ComplaintSubmissionRequestSchema,
  type ComplaintSubmissionRequest,
  type ComplaintSubmissionResponse,
  type ComplaintSubmissionResult,
  type ComplaintViolationType,
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

import { ComplaintConfirmation } from './confirmation';

import type { Path, Resolver } from 'react-hook-form';


import { PortalApiError, portalFetch } from '@/lib/api-client';


const VIOLATION_TYPE_OPTIONS: { value: ComplaintViolationType; label: string }[] = [
  { value: 'overcharging', label: 'Overcharging / excessive fare' },
  { value: 'trip_cutting', label: 'Trip cutting (short route)' },
  { value: 'refused_to_convey', label: 'Refused to convey (denied ride)' },
  { value: 'discourtesy', label: 'Discourtesy / rude behavior' },
  { value: 'other', label: 'Other' },
];

// Tricycle number only means something for transportation-related violations.
const TRANSPORTATION_VIOLATION_TYPES: ComplaintViolationType[] = [
  'overcharging',
  'trip_cutting',
  'refused_to_convey',
];

/**
 * Display copy for zod's raw default messages. The validation rule itself is
 * 100% `ComplaintSubmissionRequestSchema` (client and server share it) — this
 * only rewrites the text of a couple of zod default messages that are
 * unintelligible to a citizen ("Invalid option: expected one of ..."). Every
 * message the schema sets explicitly (24-hour time format, the
 * violationTypeOther-when-'other' rule) is left untouched and wins.
 */
const FRIENDLY_MESSAGES: Record<string, string> = {
  invalid_value: 'Please select an option',
  invalid_literal: 'Please select an option',
  invalid_type: 'This field is required',
};

/**
 * Maps an empty DOM input value to `undefined` before it reaches the schema.
 * Keeps untouched/cleared optional fields out of the payload and lets a
 * cleared required field surface the schema's "required" error instead of
 * being silently accepted as `''` (which the shared schema's `z.string()`
 * checks would otherwise let through).
 */
const emptyToUndefined = (value: unknown): string | undefined =>
  value === '' ? undefined : typeof value === 'string' ? value : undefined;

const complaintResolver: Resolver<ComplaintSubmissionRequest> = (values, context, options) => {
  const zod = zodResolver(
    ComplaintSubmissionRequestSchema,
  ) as unknown as Resolver<ComplaintSubmissionRequest>;
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

const KNOWN_FIELDS = new Set<string>([
  'violationType',
  'violationTypeOther',
  'tricycleNumber',
  'incidentDate',
  'incidentTime',
  'place',
  'remarks',
  'complainantName',
  'complainantAddress',
  'complainantContact',
  'complainantEmail',
  'respondentName',
  'respondentContact',
  'respondentEmail',
  'accessMode',
]);

/**
 * Extracts per-field errors from a 400 response so they can be mapped back
 * onto the matching form fields (TASK-PORTAL-010 acceptance criterion).
 *
 * Primary path: the `details` array (`[{ field, message, code }]`) that
 * `ValidationErrorResponseSchema` documents. The current server has no global
 * validation-error formatter yet (TASK-PORTAL-008's wiring is pending), so as
 * a fallback the Fastify validation message — segments shaped
 * `body/<field> <message>` — is parsed into the same per-field shape rather
 * than surfacing the whole 400 as one generic banner.
 */
function parseServerValidationErrors(
  err: PortalApiError,
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

const ACCESS_MODE_OPTIONS = [
  {
    value: 'digital_form',
    title: 'File online now',
    description:
      'Fill in the full form and download a printable copy to sign and submit with your evidence.',
  },
  {
    value: 'clerk_assisted',
    title: 'File in person with a clerk',
    description:
      'We capture the details now; you file and sign the complaint at the SP Secretariat with a clerk’s help.',
  },
] as const;

export default function PortalComplaintFormPage() {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ComplaintSubmissionRequest>({
    resolver: complaintResolver,
    defaultValues: { accessMode: 'digital_form' },
  });

  const watchedAccessMode = useWatch({ control, name: 'accessMode' });
  const watchedViolationType = useWatch({ control, name: 'violationType' });

  const [confirmation, setConfirmation] = useState<ComplaintSubmissionResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const isOtherViolation = watchedViolationType === 'other';
  const isTransportationViolation =
    !!watchedViolationType &&
    (TRANSPORTATION_VIOLATION_TYPES as readonly string[]).includes(watchedViolationType);

  const handleViolationTypeChange = (value: string) => {
    if (value !== 'other') {
      setValue('violationTypeOther', undefined);
      clearErrors('violationTypeOther');
    }
    if (!(TRANSPORTATION_VIOLATION_TYPES as readonly string[]).includes(value)) {
      setValue('tricycleNumber', undefined);
      clearErrors('tricycleNumber');
    }
  };

  const onSubmit = async (data: ComplaintSubmissionRequest) => {
    setServerError(null);
    try {
      const response = await portalFetch<ComplaintSubmissionResponse>('/public/complaints', {
        method: 'POST',
        body: JSON.stringify(data),
      });
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
              setError(fieldError.field as Path<ComplaintSubmissionRequest>, {
                type: 'server',
                message: fieldError.message,
              });
            }
            return;
          }
        }
        setServerError(err.message);
      } else {
        setServerError('Something went wrong while submitting your complaint. Please try again.');
      }
    }
  };

  if (confirmation) {
    return (
      <main className="flex min-h-screen items-start justify-center bg-surface-base px-4 py-12 text-text-primary">
        <ComplaintConfirmation
          result={confirmation}
          onReset={() => {
            setConfirmation(null);
            reset();
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
            <CardTitle className="text-2xl">File a Complaint</CardTitle>
            <CardDescription>
              Report an incident involving a public utility vehicle or city personnel to the SP
              Secretariat. No account is needed to file.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <CardContent className="space-y-6">
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">
                  How do you want to file this complaint?
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ACCESS_MODE_OPTIONS.map((mode) => {
                    const selected = watchedAccessMode === mode.value;
                    return (
                      <label
                        key={mode.value}
                        className={cn(
                          'flex cursor-pointer flex-col gap-1.5 rounded-md border p-4 transition-colors',
                          selected
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50',
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
                  What happened
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="violationType">
                    Type of violation <span className="text-danger-500">*</span>
                  </Label>
                  <Controller
                    name="violationType"
                    control={control}
                    render={({ field }) => (
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleViolationTypeChange(value);
                        }}
                        value={field.value ?? ''}
                      >
                        <SelectTrigger
                          id="violationType"
                          aria-invalid={!!errors.violationType}
                          aria-describedby={errors.violationType ? 'violationType-error' : undefined}
                        >
                          <SelectValue placeholder="Select the type of violation" />
                        </SelectTrigger>
                        <SelectContent>
                          {VIOLATION_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.violationType && (
                    <p id="violationType-error" className="text-destructive text-sm">
                      {errors.violationType.message}
                    </p>
                  )}
                </div>

                {isOtherViolation && (
                  <div className="space-y-2">
                    <Label htmlFor="violationTypeOther">
                      Please specify the violation <span className="text-danger-500">*</span>
                    </Label>
                    <Textarea
                      id="violationTypeOther"
                      rows={3}
                      aria-invalid={!!errors.violationTypeOther}
                      aria-describedby={
                        errors.violationTypeOther ? 'violationTypeOther-error' : undefined
                      }
                      placeholder="Describe the violation you want to report"
                      {...register('violationTypeOther', {
                        setValueAs: emptyToUndefined,
                      })}
                    />
                    {errors.violationTypeOther && (
                      <p id="violationTypeOther-error" className="text-destructive text-sm">
                        {errors.violationTypeOther.message}
                      </p>
                    )}
                  </div>
                )}

                {isTransportationViolation && (
                  <div className="space-y-2">
                    <Label htmlFor="tricycleNumber">
                      Tricycle / vehicle number{' '}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="tricycleNumber"
                      placeholder="e.g. AB-1234"
                      aria-invalid={!!errors.tricycleNumber}
                      {...register('tricycleNumber', {
                        setValueAs: emptyToUndefined,
                      })}
                    />
                    {errors.tricycleNumber && (
                      <p className="text-destructive text-sm">{errors.tricycleNumber.message}</p>
                    )}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="incidentDate">
                      Date of incident <span className="text-danger-500">*</span>
                    </Label>
                    <Input
                      id="incidentDate"
                      type="date"
                      aria-invalid={!!errors.incidentDate}
                      {...register('incidentDate', {
                        setValueAs: emptyToUndefined,
                      })}
                    />
                    {errors.incidentDate && (
                      <p className="text-destructive text-sm">{errors.incidentDate.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="incidentTime">
                      Time of incident <span className="text-danger-500">*</span>
                    </Label>
                    <Input
                      id="incidentTime"
                      type="time"
                      aria-invalid={!!errors.incidentTime}
                      {...register('incidentTime', {
                        setValueAs: emptyToUndefined,
                      })}
                    />
                    {errors.incidentTime && (
                      <p className="text-destructive text-sm">{errors.incidentTime.message}</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Time is recorded in 24-hour format — the picker only lets you choose values like
                  14:30 for 2:30 PM.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="place">
                    Place of incident <span className="text-danger-500">*</span>
                  </Label>
                  <Input
                    id="place"
                    placeholder="e.g. Public Market to Barangay 1, Batac City"
                    aria-invalid={!!errors.place}
                    {...register('place', {
                      setValueAs: emptyToUndefined,
                    })}
                  />
                  {errors.place && (
                    <p className="text-destructive text-sm">{errors.place.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="remarks">
                    Additional details <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="remarks"
                    rows={4}
                    placeholder="Describe what happened. Include any details that will help the Secretariat review your complaint."
                    {...register('remarks', {
                      setValueAs: emptyToUndefined,
                    })}
                  />
                  {errors.remarks && (
                    <p className="text-destructive text-sm">{errors.remarks.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Your details
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="complainantName">
                    Full name <span className="text-danger-500">*</span>
                  </Label>
                  <Input
                    id="complainantName"
                    placeholder="Your full name"
                    aria-invalid={!!errors.complainantName}
                    {...register('complainantName', {
                      setValueAs: emptyToUndefined,
                    })}
                  />
                  {errors.complainantName && (
                    <p className="text-destructive text-sm">{errors.complainantName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complainantAddress">
                    Address <span className="text-danger-500">*</span>
                  </Label>
                  <Input
                    id="complainantAddress"
                    placeholder="Your address"
                    aria-invalid={!!errors.complainantAddress}
                    {...register('complainantAddress', {
                      setValueAs: emptyToUndefined,
                    })}
                  />
                  {errors.complainantAddress && (
                    <p className="text-destructive text-sm">{errors.complainantAddress.message}</p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="complainantContact">
                      Contact number <span className="text-danger-500">*</span>
                    </Label>
                    <Input
                      id="complainantContact"
                      type="tel"
                      placeholder="e.g. 0917 123 4567"
                      aria-invalid={!!errors.complainantContact}
                      {...register('complainantContact', {
                        setValueAs: emptyToUndefined,
                      })}
                    />
                    {errors.complainantContact && (
                      <p className="text-destructive text-sm">
                        {errors.complainantContact.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="complainantEmail">
                      Email <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="complainantEmail"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      aria-invalid={!!errors.complainantEmail}
                      {...register('complainantEmail', {
                        setValueAs: emptyToUndefined,
                      })}
                    />
                    {errors.complainantEmail && (
                      <p className="text-destructive text-sm">{errors.complainantEmail.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Respondent{' '}
                  <span className="font-normal normal-case">
                    (optional — provide whatever you know)
                  </span>
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="respondentName">
                    Name <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="respondentName"
                    placeholder="Name of the driver or person involved"
                    aria-invalid={!!errors.respondentName}
                    {...register('respondentName', {
                      setValueAs: emptyToUndefined,
                    })}
                  />
                  {errors.respondentName && (
                    <p className="text-destructive text-sm">{errors.respondentName.message}</p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="respondentContact">
                      Contact number <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="respondentContact"
                      type="tel"
                      aria-invalid={!!errors.respondentContact}
                      {...register('respondentContact', {
                        setValueAs: emptyToUndefined,
                      })}
                    />
                    {errors.respondentContact && (
                      <p className="text-destructive text-sm">
                        {errors.respondentContact.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="respondentEmail">
                      Email <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="respondentEmail"
                      type="email"
                      inputMode="email"
                      aria-invalid={!!errors.respondentEmail}
                      {...register('respondentEmail', {
                        setValueAs: emptyToUndefined,
                      })}
                    />
                    {errors.respondentEmail && (
                      <p className="text-destructive text-sm">{errors.respondentEmail.message}</p>
                    )}
                  </div>
                </div>
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
                {isSubmitting ? 'Submitting…' : 'Submit complaint'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  );
}
